# AuraStack Fraud Layer - Client Technical Specification

Version: 1.0  
Last updated: April 21, 2026  
Scope: Standalone fraud detection layer for Insurance + Banking, embeddable into AuraStack or external systems.

## 1) Purpose and Design Goal

The Fraud Layer is a modular risk decision component that can sit behind:
- Email intake systems
- Claim management systems
- Loan origination systems
- Payment orchestration systems
- Case management tools

It ingests structured signals and evidence, computes a fraud risk score, produces a verdict (`allow`, `review`, `block`), and emits explainable findings for investigators and auditors.

---

## 2) Architecture Layers (End-to-End)

### Layer A - Intake and Normalization
- Input channels: API, email-driven workflows, batch files, portal uploads.
- Input payload: case metadata, sector, amount, signal values, and optional evidence docs.
- Output: normalized fraud case object with typed fields and signal map.

### Layer B - Entity Profiling
- Profiles customer, policy/account, provider/merchant, device, and channel behavior.
- Converts raw indicators into signal primitives (for example `newDeviceFlag`, `incomeMismatchPercent`, `duplicateClaimCount`).

### Layer C - Relational Link / Graph Layer
- Connects entities across cases/transactions to discover suspicious overlap.
- Example links: same invoice hash across claims, same device across identities, circular transfer paths.

### Layer D - Deviation / ML Score Layer
- Produces anomaly-style indicators and normalized feature signals.
- In current v1 implementation, this is represented by pre-computed signal inputs.
- In production v2, this can host statistical/ML models (see Section 8).

### Layer E - Rule + Verdict Layer
- Applies sector-specific fraud rules with weighted scoring.
- Combines matched rule score + severity bonus.
- Produces:
  - `riskScore` (0-100)
  - `riskBand` (low/medium/high/critical)
  - `verdict` (allow/review/block)
  - Explainable findings and evidence list

---

## 3) Current Implemented Engine (Live Today)

Implementation source:
- `apps/api/src/fraudSystem.ts`
- `apps/api/src/server.ts`

### 3.1 Sectors
- Insurance
- Banking

### 3.2 Rule Library (Implemented)

Insurance rules:
1. `INS_DUPLICATE_CLAIM` (High, weight 28)
2. `INS_UPCODING_PROVIDER` (Critical, weight 32)
3. `INS_WAITING_PERIOD_BREACH` (High, weight 24)
4. `INS_DOCUMENT_TAMPER` (Critical, weight 36)

Banking rules:
1. `BNK_ACCOUNT_TAKEOVER` (Critical, weight 38)
2. `BNK_MULE_LAYERING` (Critical, weight 40)
3. `BNK_SYNTHETIC_IDENTITY` (High, weight 30)
4. `BNK_LOAN_DOC_FABRICATION` (High, weight 29)

---

## 4) Exact Calculation Logic

This section reflects the exact scoring logic implemented in `fraudSystem.ts`.

### 4.1 Signal truthiness
For each rule signal key:
- Boolean: `true` means matched.
- Number: `> 0` means matched.
- String: non-empty string means matched.
- Else: not matched.

### 4.2 Rule trigger threshold
For each rule:
- `minSignalMatch = max(1, ceil(numberOfSignalsInRule * 0.5))`
- Rule is triggered only if `matchedSignals >= minSignalMatch`.

### 4.3 Rule score contribution
If a rule triggers:
- `matchRatio = matchedSignals / numberOfSignalsInRule`
- `scoreContribution = round(ruleWeight * matchRatio)`

### 4.4 Severity bonus
Added per triggered rule:
- `medium = +8`
- `high = +14`
- `critical = +20`

### 4.5 Raw and final score
- `rawScore = sum(scoreContribution + severityBonus for all triggered rules)`
- `riskScore = clamp(rawScore, 0, 100)`

### 4.6 Risk band mapping
- `riskScore >= 80` -> `critical`
- `riskScore >= 60` -> `high`
- `riskScore >= 35` -> `medium`
- else -> `low`

### 4.7 Verdict mapping
- `riskScore >= 80` -> `block`
- `riskScore >= 35` -> `review`
- else -> `allow`

---

## 5) Worked Examples (Using Demo Data)

### Example A - Insurance duplicate claim (`FRD-INS-001`)
Matched rule:
- `INS_DUPLICATE_CLAIM`:
  - matched signals: 2/2
  - `scoreContribution = round(28 * 1.0) = 28`
  - severity bonus (high) = `+14`
  - subtotal = `42`

Other insurance rules do not meet trigger threshold.  
Final:
- `riskScore = 42`
- `riskBand = medium`
- `verdict = review`

### Example B - Banking mule pattern (`FRD-BNK-003`)
Matched rule:
- `BNK_MULE_LAYERING`:
  - matched signals: 3/3
  - `scoreContribution = round(40 * 1.0) = 40`
  - severity bonus (critical) = `+20`
  - subtotal = `60`

Final:
- `riskScore = 60`
- `riskBand = high`
- `verdict = review`

---

## 6) APIs (Operational Integration)

### 6.1 Get taxonomy + rules
`GET /fraud/system/taxonomy`

Response:
- `data.sectors`
- `data.rules`

### 6.2 Get demo cases
`GET /fraud/system/demo-cases?sector=insurance|banking`

### 6.3 Get one demo case
`GET /fraud/system/demo-cases/:caseId`

### 6.4 Run single detection
`POST /fraud/system/detect`

Input options:
- Detect by existing case id + sector
- Or ad-hoc detect with direct `signals`, `sector`, `title`, `amount`

Output:
- `data.input` (resolved detection input)
- `data.result` (score, band, verdict, findings)

### 6.5 Run sector sweep
`POST /fraud/system/demo-run`

Body:
- `{ "sector": "insurance" }` or `{ "sector": "banking" }`

Output:
- aggregate metrics (`total`, `flagged`, `blocked`, `review`)
- case-by-case results

---

## 7) Explainability and Auditability

Each triggered finding contains:
- `ruleKey`
- `fraudType`
- `severity`
- `scoreContribution`
- `evidence[]` (signal values that triggered detection)

This enables investigator transparency, compliance narratives, and regulator-ready traceability.

---

## 8) ML Models - Current and Recommended

### 8.1 Current production code status
Current fraud verdict engine is deterministic weighted rules (fully implemented and live).

### 8.2 Recommended ML augmentation (next phase)
To align with enterprise fraud architecture patterns (including SBI-style layered systems), add:

1. Entity anomaly model  
- Model: Isolation Forest / One-Class SVM  
- Output: `entityAnomalyScore` in [0,1]

2. Tabular supervised fraud model  
- Model: XGBoost / LightGBM  
- Inputs: transaction velocity, device risk, mismatch metrics, historical fraud exposure  
- Output: `mlFraudProbability` in [0,1]

3. Graph risk model  
- Model: GraphSAGE / Node2Vec + classifier  
- Inputs: account-device-beneficiary-provider graph centrality and cyclic edges  
- Output: `graphRiskScore` in [0,1]

4. Document authenticity model  
- OCR + vision model + metadata consistency checks  
- Output: `docTamperProbability` in [0,1]

### 8.3 Hybrid scoring formula (recommended)
Use weighted fusion:

`finalFraudScore =`
- `0.35 * rulesScoreNormalized`
- `+ 0.25 * mlFraudProbability * 100`
- `+ 0.20 * graphRiskScore * 100`
- `+ 0.20 * docTamperProbability * 100`

Then:
- clamp 0..100
- apply same risk band and verdict thresholds

This preserves explainability while improving detection power.

---

## 9) Demo Script for Client / Investor Meeting (3-5 minutes)

1. Open Fraud Layer UI and select sector (`Insurance` then `Banking`).
2. Click one high-risk demo case.
3. Click `Detect Selected`.
4. Show:
   - Risk score
   - Verdict
   - Triggered findings
   - Signal evidence per finding
5. Run `Sweep` to show:
   - total cases
   - flagged rate
   - block/review split
6. Explain hybrid path:
   - rules are live today
   - ML/graph modules are pluggable next layer

---

## 10) Security and Compliance Notes

- Deterministic findings are fully reproducible.
- Rule keys and evidence logs can be persisted into case audit tables.
- Verdict is explainable and regulator-friendly by design.
- Can be integrated with RBAC so only approved roles view sensitive findings.

---

## 11) What is Live vs What is Roadmap

Live now:
- Multi-sector fraud rule engine
- Weighted scoring and severity bonuses
- Risk band + verdict decisioning
- Demo datasets and sweep API
- Explainable findings

Roadmap (recommended next sprint):
- Trainable ML probability model
- Graph analytics model for collusion/rings
- Document tamper model calibration
- Drift monitoring and threshold auto-tuning

---

## 12) Appendix - Rule-to-Signal Map (Quick Reference)

Insurance:
- `INS_DUPLICATE_CLAIM`: `duplicateClaimCount`, `sameInvoiceHashSeen`
- `INS_UPCODING_PROVIDER`: `procedureDiagnosisMismatch`, `providerAnomalyScore`, `billingInflationPercent`
- `INS_WAITING_PERIOD_BREACH`: `waitingPeriodBreach`, `excludedConditionFlag`
- `INS_DOCUMENT_TAMPER`: `ocrInconsistencyScore`, `metadataTamperFlag`, `signatureMismatchFlag`

Banking:
- `BNK_ACCOUNT_TAKEOVER`: `newDeviceFlag`, `geoVelocityKm`, `recentPasswordReset`, `beneficiaryAddedWithin24h`
- `BNK_MULE_LAYERING`: `cashInOutVelocity`, `roundTripTransferFlag`, `counterpartyEntropy`
- `BNK_SYNTHETIC_IDENTITY`: `kycMismatchCount`, `bureauThinFileFlag`, `deviceReuseAcrossIdentities`
- `BNK_LOAN_DOC_FABRICATION`: `incomeMismatchPercent`, `statementAnomalyScore`, `employerVerificationFailed`
