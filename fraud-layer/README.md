# Fraud Layer (Standalone)

A separate, pluggable fraud detection layer aligned to the SBI architecture:

1. Entity profiling
2. Relational graph linkage
3. Deviation scoring (GMM-based)
4. LLM-ready explanation output

## What is included

- Standalone FastAPI backend (`app/main.py`)
- Persistent SQLite storage (`data/fraud_layer.db`)
- Seeded insurance + banking fraud demo cases
- Web UI for:
  - viewing rule taxonomy
  - uploading evidence (`pdf`/`txt`)
  - running single-case detection
  - running sector sweep metrics

## Run

```powershell
cd C:\Users\asus\Desktop\AURASTACK\fraud-layer
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8090
```

Open: `http://localhost:8090`

## Demo flow

1. Open app
2. Upload a document from **Upload Evidence**
3. Select uploaded case in **Demo Cases**
4. Click **Detect**
5. Show:
   - risk score
   - verdict
   - triggered rules
   - model breakdown

## Model mapping to doc

- GMM (implemented via `sklearn.mixture.GaussianMixture`)
- EWMA (next step placeholder)
- Graph linkage score (implemented)
- LightGBM / GraphSAGE (production extension points)
- GPT explanation layer (API-ready slot; deterministic explanation included now)
