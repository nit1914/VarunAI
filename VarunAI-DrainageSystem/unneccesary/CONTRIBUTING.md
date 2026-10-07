# Contributing to DrainGuard AI

## Development setup

1. Install Node.js 22.13 or newer.
2. Clone the repository and run `npm install`.
3. Start the app with `npm run dev`.
4. Keep photos and API credentials out of commits. `.env*` files are ignored.

## Before opening a pull request

Run the same checks used by GitHub Actions:

```bash
npm run lint
npm run typecheck
npm test
npm audit --omit=dev --audit-level=high
```

If changing the model artifact or evaluation fixtures, also run the commands in [docs/EVALUATION.md](docs/EVALUATION.md) and update the model card. Do not publish a new accuracy number without stating the dataset, split, camera overlap policy, and limitations.

## Product and safety rules

- Keep the priority formula and factor contributions visible.
- Never turn unavailable weather or waterway context into a fabricated value.
- Do not describe the system as a flood predictor or pollution meter.
- Preserve human review for low-confidence, mismatched, unchanged, or non-drain evidence.
- Treat browser persistence as single-device storage until a shared backend is actually implemented.
- Add or update regression tests when changing scoring, verification, model loading, or provider failure behavior.

## Pull requests

Describe the user-facing change, files affected, verification performed, and remaining limitation. Include a screenshot or short recording for meaningful UI changes when practical.
