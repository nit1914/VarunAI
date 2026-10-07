"""Export and audit the published University of Reading blockage classifier.

The source paper held out Crinnis, Mevagissey, Barnstaple Bradiford, and
Siston cameras. This script keeps that official camera boundary for the local
audit and calibrates the decision threshold only on other cameras.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from PIL import Image
from onnxruntime.quantization import CalibrationDataReader, CalibrationMethod, QuantFormat, QuantType, quantize_static
from torchvision.models import resnet50
from torchvision.transforms import v2


IMAGE_SIZE = 224
OFFICIAL_TEST_CAMERAS = {
    "Cornwall_Crinnis",
    "Cornwall_Mevagissey_PreScree",
    "Devon_BarnstapleBradiford",
    "sites_sistontunnel_cam1",
}


class ProbabilityModel(torch.nn.Module):
    def __init__(self, classifier: torch.nn.Module) -> None:
        super().__init__()
        self.classifier = classifier

    def forward(self, image: torch.Tensor) -> torch.Tensor:
        return torch.softmax(self.classifier(image), dim=1)[:, 1:2]


class ImageCalibrationReader(CalibrationDataReader):
    def __init__(self, tensors: list[np.ndarray]) -> None:
        self.iterator = iter({"image": tensor[np.newaxis, ...]} for tensor in tensors)

    def get_next(self) -> dict[str, np.ndarray] | None:
        return next(self.iterator, None)


def metrics(labels: np.ndarray, probabilities: np.ndarray, threshold: float, cameras: int) -> dict[str, object]:
    predictions = (probabilities >= threshold).astype(int)
    tp = int(np.sum((labels == 1) & (predictions == 1)))
    tn = int(np.sum((labels == 0) & (predictions == 0)))
    fp = int(np.sum((labels == 0) & (predictions == 1)))
    fn = int(np.sum((labels == 1) & (predictions == 0)))
    total = len(labels)
    accuracy = (tp + tn) / total
    recall = tp / max(1, tp + fn)
    specificity = tn / max(1, tn + fp)
    precision = tp / max(1, tp + fp)
    f1 = 2 * precision * recall / max(1e-12, precision + recall)
    z = 1.96
    denominator = 1 + z**2 / total
    center = (accuracy + z**2 / (2 * total)) / denominator
    margin = z * np.sqrt((accuracy * (1 - accuracy) + z**2 / (4 * total)) / total) / denominator
    return {
        "threshold": round(float(threshold), 6),
        "samples": total,
        "cameras": cameras,
        "confusionMatrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
        "accuracy": round(float(accuracy), 3),
        "accuracyWilson95": [round(float(center - margin), 3), round(float(center + margin), 3)],
        "balancedAccuracy": round(float((recall + specificity) / 2), 3),
        "precision": round(float(precision), 3),
        "recall": round(float(recall), 3),
        "specificity": round(float(specificity), 3),
        "f1": round(float(f1), 3),
    }


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    benchmark = root / "evaluation" / "blockage-benchmark"
    upstream = root / "evaluation" / "upstream"
    manifest = json.loads((benchmark / "manifest.json").read_text(encoding="utf-8"))
    preprocess = v2.Compose([
        v2.ToImage(),
        v2.Resize((IMAGE_SIZE, IMAGE_SIZE), antialias=True),
        v2.ToDtype(torch.float32, scale=True),
        v2.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    classifier = resnet50(weights=None)
    classifier.fc = torch.nn.Linear(classifier.fc.in_features, 2)
    classifier.load_state_dict(torch.load(upstream / "classifier.pth", map_location="cpu", weights_only=True))
    model = ProbabilityModel(classifier).eval()

    entries = manifest["entries"]
    tensors = [preprocess(Image.open(benchmark / entry["file"]).convert("RGB")).numpy() for entry in entries]
    with torch.inference_mode():
        probabilities = model(torch.from_numpy(np.stack(tensors))).numpy().reshape(-1)
    labels = np.asarray([1 if entry["label"] == "blocked" else 0 for entry in entries])
    official_test_mask = np.asarray([entry["camera"] in OFFICIAL_TEST_CAMERAS for entry in entries])
    calibration_mask = np.asarray([entry["split"] == "calibration" and entry["camera"] not in OFFICIAL_TEST_CAMERAS for entry in entries])

    calibration_probabilities = probabilities[calibration_mask]
    threshold_candidates = sorted(set([0.5, *calibration_probabilities.tolist()]))
    threshold_metrics = [metrics(labels[calibration_mask], calibration_probabilities, threshold, 7) for threshold in threshold_candidates]
    selected = sorted(threshold_metrics, key=lambda item: (-float(item["balancedAccuracy"]), -float(item["recall"]), abs(float(item["threshold"]) - 0.5)))[0]
    threshold = float(selected["threshold"])

    models_directory = root / "public" / "models"
    models_directory.mkdir(parents=True, exist_ok=True)
    float_model = models_directory / "drain-blockage-resnet50-float.onnx"
    quantized_model = models_directory / "drain-blockage-resnet50-v1.onnx"
    torch.onnx.export(
        model,
        torch.zeros(1, 3, IMAGE_SIZE, IMAGE_SIZE),
        float_model,
        input_names=["image"],
        output_names=["blocked_probability"],
        dynamic_axes={"image": {0: "batch"}, "blocked_probability": {0: "batch"}},
        opset_version=18,
        dynamo=False,
    )
    quantize_static(
        float_model,
        quantized_model,
        ImageCalibrationReader([tensors[index] for index, included in enumerate(calibration_mask) if included]),
        quant_format=QuantFormat.QDQ,
        activation_type=QuantType.QUInt8,
        weight_type=QuantType.QInt8,
        per_channel=True,
        calibrate_method=CalibrationMethod.MinMax,
    )
    float_model.unlink()
    legacy_model = models_directory / "drain-blockage-mobilenet-v1.onnx"
    legacy_metadata = models_directory / "drain-blockage-mobilenet-v1.json"
    if legacy_model.exists():
        legacy_model.unlink()
    if legacy_metadata.exists():
        legacy_metadata.unlink()

    session = ort.InferenceSession(str(quantized_model), providers=["CPUExecutionProvider"])
    quantized_probabilities = session.run(None, {"image": np.stack(tensors)})[0].reshape(-1)
    audit = metrics(labels[official_test_mask], quantized_probabilities[official_test_mask], threshold, 4)
    report = {
        "schemaVersion": 2,
        "model": "Published ResNet-50 binary blockage classifier, statically quantized to INT8 for browser inference",
        "source": {
            "datasetDoi": "https://doi.org/10.17864/1947.000498",
            "paperDoi": "https://doi.org/10.2166/hydro.2024.013",
            "license": "CC BY 4.0; source images are Crown Copyright under OGL v3.0",
            "paperReportedBalancedAccuracy": 0.88,
        },
        "protocol": "Threshold calibrated on 28 images from 7 non-test cameras; local audit uses 40 balanced images from the four cameras held out by the source paper.",
        "selectedThreshold": threshold,
        "calibration": selected,
        "test": audit,
        "maximumQuantizationDifference": round(float(np.max(np.abs(probabilities - quantized_probabilities))), 6),
        "modelBytes": quantized_model.stat().st_size,
        "predictions": [
            {
                "id": entry["id"],
                "camera": entry["camera"],
                "actual": entry["label"],
                "blockedProbability": round(float(probability), 6),
                "predicted": "blocked" if probability >= threshold else "clear",
            }
            for entry, probability, included in zip(entries, quantized_probabilities, official_test_mask, strict=True)
            if included
        ],
    }
    (benchmark / "results.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    metadata = {
        "schemaVersion": 1,
        "model": "/models/drain-blockage-resnet50-v1.onnx",
        "architecture": report["model"],
        "threshold": threshold,
        "input": {"width": IMAGE_SIZE, "height": IMAGE_SIZE, "layout": "NCHW", "color": "RGB", "normalization": "ImageNet"},
        "evaluation": audit,
        "evaluationScope": report["protocol"],
    }
    (models_directory / "drain-blockage-resnet50-v1.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "predictions"}, indent=2))


if __name__ == "__main__":
    main()
