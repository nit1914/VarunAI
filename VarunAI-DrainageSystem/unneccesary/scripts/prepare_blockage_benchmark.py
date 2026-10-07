"""Create a small, reproducible camera-separated blockage benchmark.

Requirements (kept outside the app runtime):
    python -m pip install remotezip pillow

The source archive is 12 GB. RemoteZip reads only the central directory and
the selected image byte ranges, so this script does not download the archive.
"""

from __future__ import annotations

import io
import json
import random
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageOps
from remotezip import RemoteZip


ARCHIVE_URL = "https://researchdata.reading.ac.uk/498/2/blockagedetection_dataset.zip"
DATASET_URL = "https://researchdata.reading.ac.uk/498/"
DATASET_DOI = "https://doi.org/10.17864/1947.000498"
SEED = 20260820
CALIBRATION_CAMERAS = (
    "Cornwall_BoscastleMarine",
    "Cornwall_CawsandCP",
    "Cornwall_IdlessDam_cam1",
    "Cornwall_KingsandPP",
    "Cornwall_PlymptonForSt",
    "sites_sheptonmallet_cam2",
    "sites_uphill_cam1",
)
AUDIT_CAMERAS = (
    "Cornwall_Crinnis",
    "Cornwall_Mevagissey_PreScree",
    "Devon_BarnstapleBradiford",
    "sites_sistontunnel_cam1",
)
IMAGES_PER_LABEL = {"calibration": 2, "audit": 5}
LABELS = ("blocked", "clear")
OUTPUT_SIZE = (224, 224)

CAMERA_ALIASES = {
    "Cornwall_BodminPetrocsWell_Scree": "Cornwall_BodminPetrocsWell_Screen",
    "Cornwall_LostwithielUP_Scree": "Cornwall_LostwithielUP_Screen",
    "Cornwall_Mevagissey_PreScree": "Cornwall_Mevagissey_PreScreen",
    "Cornwall_PlymptonChaddlewood_MainScree": "Cornwall_PlymptonChaddlewood_MainScreen",
    "Cornwall_PlymptonKa": "Cornwall_PlymptonKay",
    "Cornwall_PorthlevenScree": "Cornwall_PorthlevenScreen",
    "Devon_BarnstapleConeyGut_Scree": "Devon_BarnstapleConeyGut_Screen",
    "Devon_KenwithValleyChannelScree": "Devon_KenwithValleyChannelScreen",
    "Devon_LympstoneScree": "Devon_LympstoneScreen",
    "Devon_SwimbridgeScree": "Devon_SwimbridgeScreen",
}


def parse_member(member: str) -> tuple[str, str] | None:
    parts = member.split("/")
    if len(parts) != 4 or parts[0] != "images" or parts[2] not in LABELS:
        return None
    if not parts[3].lower().endswith((".jpg", ".jpeg", ".png")):
        return None
    return parts[1], parts[2]


def main() -> None:
    workspace = Path(__file__).resolve().parents[1]
    output = (workspace / "evaluation" / "blockage-benchmark").resolve()
    if workspace not in output.parents:
        raise RuntimeError("Benchmark output escaped the workspace")
    images_dir = output / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    coordinates_path = workspace / "evaluation" / "upstream" / "crop_coordinates.txt"
    if not coordinates_path.exists():
        raise RuntimeError("Run scripts/fetch_upstream_classifier.py before preparing the benchmark")
    crop_coordinates: dict[str, tuple[int, int, int, int]] = {}
    for line in coordinates_path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) == 5 and all(part.isdigit() for part in parts[1:]):
            crop_coordinates[parts[0]] = tuple(int(value) for value in parts[1:])

    rng = random.Random(SEED)
    with RemoteZip(ARCHIVE_URL) as archive:
        by_camera: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
        for member in archive.namelist():
            parsed = parse_member(member)
            if parsed is None:
                continue
            camera, label = parsed
            by_camera[camera][label].append(member)

        selected = {
            "calibration": list(CALIBRATION_CAMERAS),
            "audit": list(AUDIT_CAMERAS),
        }
        missing = [camera for cameras in selected.values() for camera in cameras if camera not in by_camera or not all(by_camera[camera][label] for label in LABELS)]
        if missing:
            raise RuntimeError(f"Missing labelled source images for: {', '.join(missing)}")
        entries: list[dict[str, str]] = []

        for split, cameras in selected.items():
            for camera in cameras:
                for label in LABELS:
                    candidates = sorted(by_camera[camera][label])
                    chosen = rng.sample(candidates, IMAGES_PER_LABEL[split])
                    for sample_index, member in enumerate(chosen, start=1):
                        filename = f"{split}-{camera}-{label}-{sample_index:02d}.jpg".replace(" ", "_")
                        destination = images_dir / filename
                        coordinate_key = CAMERA_ALIASES.get(camera, camera)
                        if coordinate_key not in crop_coordinates:
                            raise RuntimeError(f"Missing published crop coordinates for {camera}")
                        xmin, xmax, ymin, ymax = crop_coordinates[coordinate_key]
                        prepared_exists = False
                        if destination.exists():
                            with Image.open(destination) as existing:
                                prepared_exists = existing.size == OUTPUT_SIZE
                        if not prepared_exists:
                            raw = archive.read(member)
                            with Image.open(io.BytesIO(raw)) as image:
                                prepared = ImageOps.exif_transpose(image).convert("RGB")
                            prepared = prepared.crop((xmin, ymin, xmax, ymax)).resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)
                            prepared.save(destination, "JPEG", quality=88, optimize=True)
                        entries.append({
                            "id": destination.stem,
                            "split": split,
                            "camera": camera,
                            "label": label,
                            "file": f"images/{filename}",
                            "sourceMember": member,
                            "crop": {"xmin": xmin, "xmax": xmax, "ymin": ymin, "ymax": ymax},
                        })
                        print(f"prepared {split}: {camera} / {label} / {sample_index}", flush=True)

    manifest = {
        "schemaVersion": 1,
        "seed": SEED,
        "imagePreparation": "Published trash-screen crop coordinates, EXIF transpose, RGB conversion, 224x224 Lanczos resize, JPEG quality 88",
        "sampling": "Camera-disjoint audit: 7 calibration cameras with 2 images per class and 4 source-paper test cameras with 5 images per class.",
        "source": {
            "title": "Trash screen blockage detection using cameras and deep learning: code and dataset",
            "creator": "Remy Vandaele",
            "publisher": "University of Reading",
            "year": 2023,
            "url": DATASET_URL,
            "doi": DATASET_DOI,
            "license": "CC BY 4.0",
        },
        "entries": entries,
    }
    generated_files = {entry["file"].removeprefix("images/") for entry in entries}
    for existing in images_dir.glob("*.jpg"):
        if existing.name not in generated_files:
            existing.unlink()
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(entries)} images across {len(CALIBRATION_CAMERAS) + len(AUDIT_CAMERAS)} cameras to {output}")


if __name__ == "__main__":
    main()
