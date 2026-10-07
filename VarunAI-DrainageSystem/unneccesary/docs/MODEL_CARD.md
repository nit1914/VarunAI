# DrainGuard blockage classifier model card

## Model

- **Task:** binary visual classification of a trash screen as blocked or clear
- **Architecture:** ResNet-50 with a two-class head
- **Origin:** published weights from Vandaele, Dance, and Ojha's University of Reading research release
- **Deployment artifact:** 24 MB statically quantized INT8 ONNX model
- **Runtime:** ONNX Runtime Web, client-side
- **Decision threshold:** 0.5, frozen on a separate seven-camera calibration set

DrainGuard did not relabel generic COCO detections as a drain model. COCO-SSD is a separate litter-object signal. The primary blockage estimate comes from the domain-specific research classifier.

## Intended use

The model supports inspection prioritization for images centered on a drain, inlet, or trash screen. Its score can help rank reports and highlight uncertain evidence for a person.

It is not intended to predict floods, estimate hydraulic capacity, quantify pollution, issue emergency alerts, or automatically authorize/close municipal work without the other evidence gates.

## Data and protocol

The source release contains 80,452 manually labelled images from 54 Environment Agency cameras collected from January 2022 to January 2023. DrainGuard's local audit uses a fixed 68-image subset:

- 28 balanced calibration images from seven cameras;
- 40 balanced audit images from four different cameras held out by the source paper;
- published crop coordinates applied before inference;
- no camera overlap between calibration and audit.

## Performance

| Metric | Result |
| --- | ---: |
| Accuracy / balanced accuracy | 92.5% |
| Recall | 100% |
| Specificity | 85% |
| Precision | 87% |
| F1 | 0.93 |
| 95% Wilson interval for accuracy | 80.1%–97.4% |

Confusion matrix: 20 true positives, 17 true negatives, 3 false positives, and 0 false negatives.

## Safeguards

- A separate drain-domain gate routes uncertain/non-drain inputs to human review.
- The product shows measured limitations and confidence scope beside the metric.
- Cleanup verification additionally requires the same scene, a 15-point reduction, and low residual obstruction/litter.
- Model-resource failure falls back to a deterministic visual estimate and changes the visible analysis label.
- Photos and inference stay in the browser in this prototype.

## Limitations and risks

- The domain is UK trash screens, not all global street-drain geometries.
- Wide photos where the inlet occupies little of the frame can underperform; field capture should center the drain.
- Leaves and other non-blocking debris can cause false alarms, a limitation also discussed by the source paper.
- Quantization changes some probabilities even when the audited decisions remain strong.
- Scores are not calibrated flood probabilities.

## Attribution

- Dataset and weights: [Vandaele (2023), University of Reading Research Data Archive](https://doi.org/10.17864/1947.000498), CC BY 4.0; images are Crown Copyright under OGL v3.0.
- Paper: [Vandaele, Dance, and Ojha (2024), Journal of Hydroinformatics](https://doi.org/10.2166/hydro.2024.013).
