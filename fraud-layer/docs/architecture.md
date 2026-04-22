# SBI-Aligned Fraud Layer Architecture

## Layer 0: Intake and Normalization
- Email, API, file upload, stream connectors
- Converts raw payloads to normalized fraud events

## Layer 1: Entity Profiling
- Builds profile vectors per customer, policy, provider, device, IP, account
- Features:
  - claim velocity
  - amount deviation
  - historical acceptance/rejection ratio

## Layer 2: Relational Graph
- Builds link graph between events using shared entities
- Exposes:
  - ring density
  - reused invoice signatures
  - shared mule-account patterns

## Layer 3: Deviation/Anomaly Scoring (ML)
- Current implementation:
  - Gaussian Mixture Model (GMM) likelihood score
  - Statistical z-score and velocity contribution
- Production extension points:
  - EWMA drift channel
  - Isolation Forest
  - LightGBM fraud classifier
  - GraphSAGE embeddings + community detection

## Layer 4: Rules and Decisioning
- Hard business/regulatory rules:
  - duplicate claim
  - upcoding/unbundling
  - waiting-period breach
  - document tampering
- Combines ML + graph + rules into final risk score and verdict

## Layer 5: LLM Explanation and Investigator UX
- Generates investigator-facing narrative:
  - why flagged
  - which signals fired
  - suggested next actions
- Current implementation is deterministic and API-ready for GPT-based explanation.
