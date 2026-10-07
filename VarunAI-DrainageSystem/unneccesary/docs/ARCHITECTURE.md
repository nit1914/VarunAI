# DrainGuard architecture

## System goal

DrainGuard converts visual drain inspections into an explainable environmental cleanup queue. It deliberately separates four questions:

1. Is this credible drain evidence?
2. How urgent is the cleanup under local rainfall?
3. Does the after photo prove that the same drain was cleared?
4. Is mapped environmental context available, and how much evidence coverage supports the estimate?

## End-to-end flow

```mermaid
sequenceDiagram
    actor Worker as Field worker
    participant UI as Next.js client
    participant API as Environmental-context API
    participant Vision as On-device vision
    participant Weather as Open-Meteo
    participant Map as Leaflet / OSM
    participant Store as Device storage

    Worker->>UI: Upload before photo
    UI->>Vision: Extract visual signals
    Vision-->>UI: Drain confidence, blockage, litter
    UI->>API: Send validated report coordinates
    par Independent lookups
        API->>Weather: Fetch coordinate-specific forecast
        API->>Map: Query nearby mapped water features
    end
    API-->>UI: Partial or complete environmental context
    UI->>UI: Calculate transparent priority score
    UI->>UI: Calculate environmental decision-support estimate
    UI->>Map: Add and rank report
    UI->>Store: Persist report and compressed evidence
    Worker->>UI: Upload after photo
    UI->>Vision: Re-analyze and compare fingerprints
    alt Same drain and cleanup thresholds pass
        UI->>Map: Mark Verified clear
    else Evidence is uncertain
        UI->>Map: Route to human review
    end
```

## Main modules

| Module | Location | Responsibility |
| --- | --- | --- |
| Inspection workflow | `app/page.tsx` | Upload, image preparation, analysis, risk calculation, persistence, review and verification UI |
| Priority map | `app/DrainMap.tsx` | Leaflet map, markers, report selection and map movement |
| Environmental panels | `app/EnvironmentalPanels.tsx` | Explanation, scenarios, aggregate metrics, demo mode, verification checks and validation boundaries |
| Central scoring | `lib/scoring/` | Configurable priority, environmental-risk and rainfall-scenario calculations |
| Environmental endpoint | `app/api/environmental-context/route.ts` | Coordinate validation, HTTP caching, and a single client-facing data boundary |
| Environmental lookup | `lib/environment.ts` | Parallel Open-Meteo and Overpass lookups with independent unavailable states and timeouts |
| Decision policy | `lib/decisions.js` | Auditable drain, priority and cleanup thresholds |
| Regression suite | `tests/rendered-html.test.mjs` | Production build, feature wiring and 12 decision cases |

## Vision pipeline

### 1. Image preparation

Uploaded images are decoded in the browser, resized to a maximum dimension of 960 pixels, and compressed to JPEG for evidence storage. The original file is not uploaded to a DrainGuard server in the current prototype.

### 2. Drain evidence gate

The app samples a 96 × 96 canvas and derives:

- horizontal and vertical edge density;
- grate-like structural evidence;
- dark and earth-toned surface evidence;
- natural-scene colour variation;
- penalties for large unrelated COCO object classes.

A result below 60% drain confidence enters `Needs review`, even if its calculated risk is high.

### 3. Litter and obstruction

The primary blockage model is the published University of Reading ResNet-50 classifier, converted to a 24 MB INT8 ONNX artifact and executed client-side through ONNX Runtime Web. Its threshold is calibrated separately and its browser artifact has a camera-separated audit. COCO-SSD runs through TensorFlow.js and provides visible object detections. Only a restricted set of litter-relevant classes affects the litter signal. Texture and debris-tone heuristics provide a labelled fallback if either model resource is unavailable.

COCO-SSD is not represented as a drain-specific model; the ResNet-50 classifier supplies the blockage-domain signal.

### 4. Scene fingerprint

Each image is reduced to a 12 × 8 luminance fingerprint. Values are normalized by image mean and deviation, reducing sensitivity to global brightness changes. Cosine correlation becomes a 0–100 scene-match score.

An after photo needs a scene match of at least 68% before it can close a report.

## Risk engine

```text
rainfall index = clamp((rainfall mm / 64) × 100)
priority       = round(0.55 × blockage
                     + 0.30 × rainfall index
                     + 0.15 × litter)
```

| Score | Operational action |
| ---: | --- |
| 80–100 | Dispatch now |
| 60–79 | Inspect today |
| 0–59 | Monitor |

Low risk does not automatically mean `Verified clear`; that status requires after-cleanup evidence.

## Environmental decision-support estimate

```text
environmental risk = 0.40 × blockage
                   + 0.30 × rainfall index
                   + 0.20 × litter
                   + 0.10 × waterway proximity
```

Waterway proximity is derived only from mapped OpenStreetMap / Overpass features. If that lookup fails, the factor remains `null`, evidence coverage falls to 90%, and the score is normalized across the available evidence. If rainfall is unavailable, that factor also remains `null`; cleanup-priority coverage falls to 70%, and environmental coverage falls by 30 percentage points. Unavailable context is never converted into a zero-risk or made-up forecast value.

## Cleanup verification policy

The decision policy is intentionally isolated in `lib/decisions.js`. A report closes automatically only when:

```text
sameDrain = true
drainConfidence >= 60
blockage <= 48
litter <= 48
reduction >= 15
```

Every failed condition retains the report for human review.

## External services

| Service | Data sent | Purpose | Fallback |
| --- | --- | --- | --- |
| Open-Meteo forecast | Latitude and longitude | Location-specific rainfall | Explicit unavailable state; normalize across visible evidence |
| Nominatim / Open-Meteo geocoding | User-entered location text | Convert place to coordinates | Ask for a more specific location |
| OpenStreetMap tiles | Map viewport | Display inspection markers | Queue remains usable |
| OpenStreetMap / Overpass | Report coordinates | Approximate proximity to mapped water features | Show unavailable; lower evidence coverage |
| jsDelivr | Model-library request | Load ONNX Runtime Web, TensorFlow.js, and COCO-SSD | Visual-feature fallback |

The two environmental lookups run in parallel inside a Vercel Function. Each has a bounded timeout, so one slow provider does not erase valid data from the other. Successful API responses are cached at the edge for 15 minutes with stale-while-revalidate support.

## Persistence

The prototype stores a versioned report payload in browser `localStorage`:

```text
sites: MapSite[]
evidence: Record<siteId, {
  beforeImage,
  beforeAnalysis,
  afterImage?,
  verification?,
  updatedAt
}>
```

This is suitable for a single-device pilot and demo. A municipal deployment requires authenticated, shared storage with role-based access, retention controls, and an audit log.

## Responsible boundaries

- DrainGuard prioritizes inspections; it does not predict flood occurrence.
- Visual obstruction is not hydraulic capacity.
- Forecast data and image quality affect the priority score.
- Low-confidence and mismatched evidence must remain reviewable by a person.
- The model audit validates the exact browser artifact on a small UK trash-screen proxy set, not Bengaluru field accuracy.

## Production roadmap

1. Provision shared Postgres and object storage for reports and images.
2. Add authentication and ward-level access control.
3. Collect and independently label a Bengaluru drain dataset.
4. Train or fine-tune a drain-specific detector for grates, silt, vegetation and litter.
5. Report precision, recall, calibration and subgroup performance.
6. Add immutable crew-action and verification audit events.
