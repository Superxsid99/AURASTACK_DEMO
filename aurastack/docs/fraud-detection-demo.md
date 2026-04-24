# AuraStack Fraud Detection Demo (Insurance + Banking)

## What this adds

A separate fraud-detection subsystem is available through API routes under:

- `GET /fraud/system/taxonomy`
- `GET /fraud/system/demo-cases`
- `GET /fraud/system/demo-cases/:caseId`
- `POST /fraud/system/detect`
- `POST /fraud/system/demo-run`

## Fraud patterns covered

### Insurance

- Duplicate claim submission
- Provider upcoding / unbundling
- Coverage eligibility / waiting-period breach
- Document forgery / tampering

### Banking

- Account takeover (ATO)
- Mule account / layering
- Synthetic identity
- Loan application document fabrication

## Demo datasets

- `data/fraud-demo/fraud-cases-demo.json`
  - Mixed fraud + genuine scenarios
- `data/fraud-demo/sample-documents.json`
  - Evidence documents mapped to demo cases

## Demo flow (5-7 minutes)

1. Open taxonomy
   - show rule keys, severity, fraud signals
2. Open cases
   - one insurance fraud case + one banking fraud case
3. Run one detection by case id
   - show findings + risk band + verdict
4. Run sweep
   - show total, flagged, review, blocked metrics

## Example API calls

```bash
curl http://localhost:8000/fraud/system/taxonomy
```

```bash
curl "http://localhost:8000/fraud/system/demo-cases?sector=insurance"
```

```bash
curl -X POST http://localhost:8000/fraud/system/detect \
  -H "Content-Type: application/json" \
  -d "{\"caseId\":\"ins-001\",\"sector\":\"insurance\",\"signals\":{\"duplicateClaimCount\":3}}"
```

```bash
curl -X POST http://localhost:8000/fraud/system/demo-run \
  -H "Content-Type: application/json" \
  -d "{\"sector\":\"banking\"}"
```
