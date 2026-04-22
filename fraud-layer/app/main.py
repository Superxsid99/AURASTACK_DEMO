from __future__ import annotations

import re
import secrets
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pypdf import PdfReader

from .engine import FraudEngine
from .models import FraudCase
from .rules import all_rules
from .store import FraudStore


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "fraud_layer.db"
STATIC_DIR = ROOT / "static"

app = FastAPI(title="Fraud Layer", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = FraudStore(DB_PATH)
engine = FraudEngine()


def _extract_pdf_text(file_path: Path) -> str:
    reader = PdfReader(str(file_path))
    text_parts: list[str] = []
    for page in reader.pages:
        text_parts.append(page.extract_text() or "")
    return "\n".join(text_parts).strip()


def _derive_case_from_text(*, sector: str, title: str, text: str) -> FraudCase:
    now = datetime.utcnow()
    case_id = f"FRD-UPL-{int(now.timestamp() * 1000)}-{secrets.randbelow(999):03d}"
    name_match = re.search(r"(Patient Name|Name)\s*[:\-]\s*([A-Za-z .]+)", text, re.IGNORECASE)
    policy_match = re.search(r"(Policy Number|Policy No|Policy)\s*[:\-]\s*([A-Za-z0-9\-\/]+)", text, re.IGNORECASE)
    diagnosis_match = re.search(r"(Diagnosis|ICD[- ]?10)\s*[:\-]\s*([A-Za-z0-9 .,\-]+)", text, re.IGNORECASE)
    amount_match = re.search(r"(Total|Amount|Claim Amount)\s*[:\-]?\s*([0-9,]+(?:\.[0-9]+)?)", text, re.IGNORECASE)

    customer_name = (name_match.group(2).strip() if name_match else "Unknown")
    policy_number = (policy_match.group(2).strip() if policy_match else "NA")
    diagnosis = (diagnosis_match.group(2).strip() if diagnosis_match else "NA")
    claim_amount = float((amount_match.group(2).replace(",", "") if amount_match else "95000"))

    return FraudCase(
        case_id=case_id,
        sector=sector,
        customer_id=f"CUS-UPL-{now.strftime('%H%M%S')}",
        customer_name=customer_name,
        provider_name="Uploaded Evidence",
        policy_number=policy_number,
        claim_number=f"CLM-UPL-{now.strftime('%M%S')}",
        claim_amount=claim_amount,
        diagnosis_code=diagnosis[:32],
        procedure_code="AUTO-EXTRACT",
        treatment_date=now.date().isoformat(),
        submitted_at=now.isoformat(),
        ip_address="upld.ip",
        device_id="upld.device",
        bank_account_hash="upld.bank",
        phone_hash="upld.phone",
        previous_claim_count_30d=1,
        invoice_hash=f"inv_{abs(hash(title + text[:120])) % 999999}",
        document_text=text[:10000] if text else title,
        is_known_fraud=0,
    )


class DetectRequest(BaseModel):
    case_id: str


class SweepRequest(BaseModel):
    sector: str


class ModelConfigUpdateRequest(BaseModel):
    configs: dict[str, str]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/rules")
def list_rules(sector: str = "insurance") -> dict[str, Any]:
    return {"sector": sector, "rules": all_rules(sector)}


@app.get("/api/cases")
def list_cases(sector: str = "insurance") -> dict[str, Any]:
    rows = store.list_cases(sector)
    decorated: list[dict[str, Any]] = []
    for row in rows:
        latest = store.latest_detection(row["case_id"])
        row_copy = dict(row)
        row_copy["latest_detection"] = latest
        decorated.append(row_copy)
    return {"data": decorated}


@app.get("/api/case/{case_id}")
def get_case(case_id: str) -> dict[str, Any]:
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    latest = store.latest_detection(case_id)
    return {"case": case, "latest_detection": latest}


@app.get("/api/explain/{case_id}")
def explain_case(case_id: str) -> dict[str, Any]:
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    latest = store.latest_detection(case_id)
    if not latest:
        configs = store.get_model_configs()
        scoped = store.list_cases(case.get("sector"))
        generated = engine.detect(case, scoped, model_config=configs)
        store.insert_detection(generated)
        latest = store.latest_detection(case_id)
    return {
        "case": case,
        "latest_detection": latest,
        "model_configs": store.get_model_configs(),
    }


@app.get("/api/model-configs")
def get_model_configs() -> dict[str, Any]:
    return {"data": store.get_model_configs()}


@app.put("/api/model-configs")
def update_model_configs(payload: ModelConfigUpdateRequest) -> dict[str, Any]:
    saved = store.save_model_configs(payload.configs)
    return {"data": saved}


@app.post("/api/upload-evidence")
async def upload_evidence(
    sector: str = Form(default="insurance"),
    title: str = Form(default="Uploaded evidence"),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    uploads_dir = ROOT / "data" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    target = uploads_dir / file.filename
    with target.open("wb") as out:
        out.write(await file.read())
    text = ""
    if target.suffix.lower() == ".pdf":
        try:
            text = _extract_pdf_text(target)
        except Exception:
            text = ""
    if not text:
        try:
            text = target.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            text = ""
    case = _derive_case_from_text(sector=sector, title=title or file.filename, text=text)
    store.insert_case(case)
    return {"ok": True, "case_id": case.case_id, "filename": file.filename}


@app.post("/api/detect")
def detect(payload: DetectRequest) -> dict[str, Any]:
    case = store.get_case(payload.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    all_cases = store.list_cases(case.get("sector"))
    result = engine.detect(case, all_cases, model_config=store.get_model_configs())
    store.insert_detection(result)
    return {"data": result.__dict__}


@app.post("/api/sweep")
def sweep(payload: SweepRequest) -> dict[str, Any]:
    all_cases = store.list_cases(payload.sector)
    output = engine.sector_sweep(payload.sector, all_cases, model_config=store.get_model_configs())
    return {"data": output}


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def root() -> FileResponse:
    return FileResponse(STATIC_DIR / "home.html")


@app.get("/lab")
def lab() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/fraud")
def fraud_lab_alias() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/layers")
def layers() -> FileResponse:
    return FileResponse(STATIC_DIR / "layers.html")


@app.get("/admin")
def admin() -> FileResponse:
    return FileResponse(STATIC_DIR / "admin.html")
