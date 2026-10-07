# Evaluation protocol

DrainGuard reports computer-vision performance separately from workflow-policy tests. Model metrics come from labelled images; deterministic workflow fixtures check that ranking, verification, and human-review rules do not regress.

## Held-out blockage audit

The deployed artifact is the University of Reading ResNet-50 binary blockage classifier, converted to ONNX and statically quantized to INT8 for browser inference. Its threshold is calibrated on 28 balanced images from seven cameras. The final audit uses 40 different balanced images from the four cameras held out by the source paper: Crinnis, Mevagissey, Barnstaple Bradiford, and Siston.

Calibration and audit cameras never overlap. The source images are manually labelled `blocked` or `clear`, and the benchmark applies the crop coordinates published with the dataset before inference.

| Metric | Result |
| --- | ---: |
| Accuracy | 92.5% |
| Balanced accuracy | 92.5% |
| Blocked recall / sensitivity | 100% |
| Clear specificity | 85% |
| Precision | 87% |
| F1 | 0.93 |
| Accuracy 95% Wilson interval | 80.1%–97.4% |

### Confusion matrix

| Actual \ Predicted | Blocked | Clear |
| --- | ---: | ---: |
| Blocked | 20 true positives | 0 false negatives |
| Clear | 3 false positives | 17 true negatives |

The old colour-and-texture fallback scored 50% balanced accuracy on this same audit. It remains only as an availability fallback if the browser model cannot load; it is not the primary AI claim.

The source paper reports 88% average balanced accuracy for its binary classifier on the full research evaluation. DrainGuard's smaller 40-image audit verifies the exact quantized browser artifact and its integration; it does not supersede the paper.

## Reproduce the artifact and results

```bash
python -m pip install -r requirements-evaluation.txt
python scripts/fetch_upstream_classifier.py
python scripts/prepare_blockage_benchmark.py
npm run evaluate:baseline
npm run export:vision
npm test
```

The preparation script reads only the selected ranges from the 12 GB archive, uses a fixed seed, records every original archive member and crop, and removes unused benchmark images. Frozen outputs are stored in `evaluation/blockage-benchmark/`.

## Twelve workflow decisions

The policy suite calls the same pure functions used by the interface.

| Group | Cases | Expected behavior |
| --- | ---: | --- |
| Blocked controls | 3 | Remain open and ranked |
| Clear controls | 3 | Stay low priority |
| Same-drain cleaned pairs | 2 | Match scene, then verify improvement |
| Unchanged after evidence | 1 | Reject zero-point reduction |
| Different-scene evidence | 2 | Reject scene mismatch |
| Non-drain input | 1 | Route to human review |

## Environmental scoring checks

The separate scoring suite executes the same centralized functions used by the interface. It checks that weights sum to 100%, missing rainfall and waterway context stay unavailable instead of becoming invented values, real zero rainfall stays zero, partial provider failure preserves valid data, proximity boundaries are exact, and priority rises monotonically across controlled rainfall scenarios.

## What these results do not establish

- The audit uses UK trash-screen CCTV imagery, not Bengaluru street-drain photos.
- Forty images provide a useful integration audit but a wide confidence interval.
- The audit does not validate flood prediction, pollution volume, environmental impact avoided, every drain design, night scenes, or unusual camera angles.
- The three false positives show why clear-looking and uncertain reports still need review.
- Same-drain verification needs a separate, larger matched-pair field study.

The next validation milestone is an independently labelled Bengaluru field set stratified by drain type, lighting, rain, angle, silt, vegetation, and litter.
