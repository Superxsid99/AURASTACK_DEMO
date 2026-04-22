# Fraud Layer Demo: How It Works

This standalone Fraud Detection Layer is designed as a drop-in module for Insurance and Banking systems.

## Multi-Page UX

- `/` (Home): executive overview + architecture summary
- `/lab`: live detection surface (rules, cases, detect, sweep, upload)
- `/layers`: stage-by-stage explainability inspector
- `/admin`: per-stage model governance and assignment

## Detection Pipeline (6 Layers)

1. `intake_normalize`
- Parses and normalizes incoming evidence fields.
- Signals include document text length, policy presence, claim amount presence.

2. `entity_profiling`
- Scores claimant/provider behavior against peer baseline.
- Uses amount and claim velocity style signals.

3. `graph_linkage`
- Finds suspicious relational links (shared IP/device/bank/phone/invoice).
- Outputs related-case count + graph risk.

4. `deviation_ml`
- Runs anomaly/deviation scoring (GMM-style likelihood based in this demo).
- Outputs deviation score + likelihood-style metric.

5. `rules_verdict`
- Applies hard policy rules (duplicate claim, upcoding, waiting period, etc).
- Produces final `FRAUD / REVIEW / GENUINE`.

6. `explanation`
- Generates investigator-readable rationale and audit-facing summary.

## Model Governance (Admin Page)

- Admin can set model per stage (persisted in DB).
- Config is applied to all **new** detections immediately.
- Saved keys:
  - `intake_normalize`
  - `entity_profiling`
  - `graph_linkage`
  - `deviation_ml`
  - `rules_verdict`
  - `explanation`

## What the Layer Explorer Shows

For each stage:
- selected model name
- score and stage weight
- input signals
- output payload
- stage summary/status

This gives full traceability for investor and audit demos.

## Suggested 3-Minute Demo Script

1. Open `/` and explain the 6-layer architecture.
2. Open `/admin` and change one model (for example `deviation_ml`).
3. Open `/lab`, select a case, click **Detect Selected**.
4. Open `/layers` and show that stage trace reflects chosen model and outputs.
5. Run **Sector Sweep** in `/lab` to show aggregate performance.

