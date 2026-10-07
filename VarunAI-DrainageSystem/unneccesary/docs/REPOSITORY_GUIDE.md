# DrainGuard AI repository guide

This is the handoff for someone cloning the repository, reviewing the hackathon implementation, or continuing the product after the prototype.

## Product promise

DrainGuard turns a street-drain photo into a transparent cleanup decision:

```text
photo → evidence → priority → crew allocation → after-photo verification
```

It is a decision-support tool for inspection prioritization. It does not predict flood occurrence, measure pollution volume, or replace hydraulic engineering.

## What is implemented

### Inspection and AI evidence

- Browser upload with sample reset and re-analysis.
- Image resizing/compression before evidence is stored.
- Research-backed ResNet-50 blocked/clear classifier in a 24 MB INT8 ONNX artifact.
- Drain-domain evidence gate for unrelated or low-confidence photos.
- COCO-SSD for visible litter-object signals only; it is not the drain-blockage model.
- Texture/debris visual fallback when model resources cannot load.
- Visible confidence, factor contributions, recommended action, and model limitations.

### Environmental decision support

- Coordinate entry from a searched place or report location.
- Coordinate-specific rainfall from Open-Meteo.
- Nearby mapped waterway context from OpenStreetMap/Overpass.
- Failure-tolerant parallel lookups with explicit unavailable states.
- Separate environmental estimate with evidence coverage.
- Dry, moderate, and heavy controlled rainfall scenarios.

### Queue and operations

- Leaflet/OpenStreetMap map with report markers and labels.
- Queue sorted by cleanup priority/environmental concern.
- Priority Shock panel showing rank movement when conditions change.
- Action Planner allocating reports across crews and inspection capacity.
- Device persistence for reports, scores, and compressed evidence.
- Human-review board for low-confidence, failed, unchanged, or mismatched evidence.
- Copyable field brief for an operational handoff.

### Verification

- Real after-cleanup upload, not a completion toggle.
- Same-drain scene fingerprint comparison.
- Before/after side-by-side and comparison-slider views.
- Explicit checks for scene match, drain confidence, residual blockage, residual litter, and improvement.
- Verified-clear outcome only when every policy threshold passes.

### Evidence and quality

- Held-out 40-image, camera-disjoint browser-model audit.
- Confusion matrix and 95% Wilson interval.
- Twelve deterministic workflow-policy cases.
- Central scoring tests for missing context, zero rainfall, thresholds, and monotonicity.
- GitHub Actions CI for lint, typecheck, build, tests, and dependency audit.

## Repository map

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Main inspection, queue, review, verification, and field-brief workflow |
| `app/DrainMap.tsx` | Leaflet map and report markers |
| `app/EnvironmentalPanels.tsx` | Priority explanation, scenarios, dashboard, planner, trust, validation, and evaluation panels |
| `app/api/environmental-context/route.ts` | Validated server boundary for environmental lookups |
| `lib/vision.js` | Browser image features, model loading, evidence gate, and scene comparison |
| `lib/decisions.js` | Human-readable verification and priority policy thresholds |
| `lib/scoring/` | Priority, environmental, and rainfall scenario formulas |
| `lib/environment.ts` | Open-Meteo, geocoding, Overpass, timeout, and coverage handling |
| `public/models/` | Browser ONNX model, runtime contract, and attribution |
| `evaluation/` | Benchmark images, manifest, frozen predictions, and results |
| `scripts/` | Dataset preparation, model export, and evaluation commands |
| `tests/` | Rendered feature, scoring, artifact, and policy regression tests |
| `docs/` | Architecture, Devpost copy, evaluation, model card, and this handoff |
| `.github/workflows/ci.yml` | Pull-request and `main` branch quality checks |

## Local development

```bash
git clone https://github.com/bhavyakeerthi3/drainguard-ai.git
cd drainguard-ai
npm install
npm run dev
```

Open `http://localhost:3000`.

The current prototype needs no API keys. Browser model libraries and environmental providers are public dependencies, so local testing needs network access for live-provider paths.

## Verification commands

```bash
npm run lint
npm run typecheck
npm run test:scoring
npm test
npm audit --omit=dev --audit-level=high
```

The model-reproduction commands require Python and `requirements-evaluation.txt`:

```bash
python -m pip install -r requirements-evaluation.txt
python scripts/prepare_blockage_benchmark.py
npm run evaluate:baseline
npm run export:vision
```

## Safe product claims

Use these claims in presentations and project pages:

- “AI-assisted drain inspection prioritization.”
- “Research-backed browser blockage classifier with a reproducible proxy audit.”
- “Location-specific rainfall and mapped waterway context.”
- “Before/after evidence and human review protect the close-out decision.”

Avoid these claims:

- “Predicts floods.”
- “Measures pollution.”
- “Proves Bengaluru field accuracy.”
- “Fully autonomous municipal dispatch.”
- “Shared multi-user backend.”

## Current prototype boundary

Reports and compressed evidence are stored in browser `localStorage` for a single-device pilot. The planned production extension is an authenticated shared backend with object storage, role-based access, retention policy, and immutable audit events. The model also needs an independently labelled local field set before deployment claims can be broadened.

## Submission links

- Live app: <https://drainguard-ai-earth.vercel.app>
- GitHub: <https://github.com/bhavyakeerthi3/drainguard-ai>
- Hackathon copy: [DEVPOST.md](DEVPOST.md)
- Model card: [MODEL_CARD.md](MODEL_CARD.md)
- Evaluation protocol: [EVALUATION.md](EVALUATION.md)
