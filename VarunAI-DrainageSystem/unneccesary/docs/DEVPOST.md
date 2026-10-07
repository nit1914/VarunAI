# Devpost submission copy

## Project title

DrainGuard AI

## Tagline

Stop street waste before the next storm moves it downstream.

## Short description

DrainGuard AI is an AI-assisted environmental monitoring prototype that helps identify blocked, litter-filled storm drains, prioritize cleanup using visible evidence, rainfall, and mapped waterway context, and verify the work with before-and-after evidence.

## Inspiration

Municipal crews cannot inspect every drain before rainfall. Cleanup is often reactive and driven by the latest complaint instead of consistent evidence. Street litter can collect around blocked drains, and rainfall may transport visible waste toward waterways. We wanted to build something narrower and more actionable than a flood predictor: a tool that answers, **“Which reported drain should we inspect first, and can we prove it was cleaned?”**

## What it does

DrainGuard follows a **Detect → Prioritize → Act → Verify** workflow:

1. A worker uploads a street photo.
2. The app checks whether it contains credible drain-like evidence.
3. Client-side analysis estimates visible obstruction and litter.
4. Rainfall is fetched using the report coordinates.
5. OpenStreetMap / Overpass is queried for nearby mapped water features.
6. Central scoring modules calculate cleanup priority and a separate environmental decision-support estimate.
7. A prominent explanation shows every factor, weight, contribution, confidence, limitation, and recommended action.
8. Reports appear on an accessible map and in a highest-priority-first queue.
9. A second photo must pass same-scene, drain-evidence, obstruction-improvement, and litter checks before the report closes.
10. Failed or uncertain evidence stays visible in a human-review queue.

The rainfall explorer uses controlled scenarios to show sensitivity. It does not present them as forecasts.

## How we built it

The application uses Next.js, React, TypeScript, ONNX Runtime Web, TensorFlow.js, Leaflet, OpenStreetMap, and Open-Meteo, and is deployed on Vercel.

The primary blockage signal comes from a research-backed ResNet-50 classifier published with a manually labelled University of Reading trash-screen dataset. We converted it to ONNX, statically quantized it to a 24 MB INT8 artifact, and run it entirely in the browser. COCO-SSD is a separate visible-litter signal; it is not presented as a storm-drain model. An engineered drain gate and offline visual fallback use grate-like edges, natural-scene colour, debris tones, and texture.

For reproducibility, the classifier threshold is fixed on 28 images from seven cameras. A separate balanced audit uses 40 images from the four cameras held out by the source paper and achieves 92.5% accuracy/balanced accuracy, 100% blocked recall, 85% clear specificity, 87% precision, and 0.93 F1. The repository includes the image manifest, exact source members and crops, frozen predictions, confusion matrix, confidence interval, exporter, model card, and integrity tests.

Cleanup priority is:

```text
55% blockage + 30% rainfall index + 15% litter
```

The environmental decision-support estimate is:

```text
40% blockage + 30% rainfall index + 20% litter + 10% mapped waterway proximity
```

If waterway data is unavailable, DrainGuard keeps the factor null, lowers evidence coverage, normalizes across available evidence, and explains the limitation. It never invents proximity.

Before/after verification uses a normalized 12 × 8 scene fingerprint. A report can close only when the scene match, drain confidence, residual obstruction, residual litter, and improvement thresholds pass.

## Challenges

- General object detectors do not contain a storm-drain blockage class, and our first colour/texture fallback reached only 50% balanced accuracy on the held-out audit.
- Lighting and camera angles make before/after comparisons difficult.
- An unrelated clean-drain photo must never close another report.
- Environmental map services can be incomplete or temporarily unavailable.
- Demo statistics can easily be mistaken for real-world impact.

We addressed these by replacing the weak primary heuristic with an openly licensed, domain-specific research classifier; preserving the heuristic only as a visible availability fallback; separating drain evidence from litter detection; adding a same-scene gate; exposing each verification check; treating unavailable context explicitly; routing uncertainty to people; and labelling sample content as demo data.

## Accomplishments

- Working public application deployed on Vercel
- Automatic analysis for user-uploaded images
- Research-backed ResNet-50 blockage inference running locally in the browser
- Reproducible 92.5% held-out audit with precision, recall, specificity, F1, confidence interval, and confusion matrix
- 50% fallback baseline recorded instead of hidden
- Location-specific weather for mapped reports
- Mapped waterway proximity with graceful failure handling
- Centralized, configurable scoring weights
- Dynamic “Why this priority?” explanations
- Rainfall scenario explorer
- Environmental dashboard with empty and demo states
- Accessible environmental risk map using symbols, labels, and colour
- Persistent before/after evidence on the inspection device
- Same-drain mismatch protection and visible human review
- 12 executable decision-policy cases plus 6 environmental-scoring tests
- Automated benchmark split, artifact, metric, and attribution integrity checks
- Clean strict TypeScript, lint, production build, dependency audit, and GitHub CI

## What we learned

The most useful AI system is not always the one making the biggest prediction. A focused tool that recommends a clear action, exposes its assumptions, and knows when to involve a human can be more practical for public infrastructure.

We also learned that a metric is only useful when the split and scope are visible. Our original heuristic failed to generalize, so we kept that baseline, moved to published domain weights, separated calibration and test cameras, reported the 95% interval, and stated that UK trash-screen results are not Bengaluru field accuracy. Missing environmental data follows the same principle: it stays unavailable instead of becoming fake low risk.

## What's next

- Shared authenticated Postgres and object storage for municipal teams
- A field-labelled Bengaluru drain dataset and subgroup evaluation
- Fine-tuning for local grates, silt, vegetation, night scenes, and camera angles
- Precision, recall, calibration, and subgroup reporting
- Validation of the environmental-risk policy with domain experts
- Ward dashboards, crew assignment, and an immutable audit trail

## Links

- Live application: <https://drainguard-ai-earth.vercel.app>
- Source code: <https://github.com/bhavyakeerthi3/drainguard-ai>
- Demo video: **add the final YouTube URL before submitting**

## Suggested tags

Environmental Technology, AI/ML, Climate Tech, Sustainability, Smart Cities, Computer Vision, Waterway Protection, Waste Reduction, Civic Tech, Next.js, React, TypeScript, TensorFlow.js, Leaflet, OpenStreetMap, Open-Meteo, Vercel
