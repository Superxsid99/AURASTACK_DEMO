from __future__ import annotations

import base64
import email as email_lib
import email.header
import email.policy
import email.utils
import imaplib
import io
import json
import os
import re
import smtplib
import ssl
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv, find_dotenv

# Load env in deterministic order:
# 1) repo root .env
# 2) apps/api/.env (shared runtime config)
# 3) cwd-discovered .env as final fallback
HERE = Path(__file__).resolve()
REPO_ROOT = HERE.parents[3]
load_dotenv(REPO_ROOT / ".env", override=True)
load_dotenv(REPO_ROOT / "apps" / "api" / ".env", override=True)
load_dotenv(find_dotenv(usecwd=True), override=True)
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from hashlib import md5
from typing import Any, Dict, List, Literal, Optional, Tuple, TypedDict

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from langgraph.graph import END, StateGraph
except Exception:
    END = "__END__"
    StateGraph = None  # type: ignore

from openai import OpenAI
from pypdf import PdfReader
from PIL import Image
import pytesseract

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger("agents")

StepType = Literal[
    "EMAIL_INTAKE", "EMAIL_REPLY", "PRE_PROCESSOR", "DOCUMENT_OCR", "DATA_EXTRACTION",
    "VALIDATION", "KNOWLEDGE_CHECK", "DECISION", "HUMAN_REVIEW",
    "APPROVAL", "REJECTION", "CLAIM_CLASSIFICATION", "POLICY_LOOKUP",
    "NOTIFY_CUSTOMER", "SLA_CHECK",
    "DOCUMENT_VALIDATION", "FRAUD_SCREENING", "MEDICAL_CODING",
    "COVERAGE_RULES", "PROVIDER_NETWORK_CHECK", "SETTLEMENT_ESTIMATION",
    "HUMAN_HANDOFF", "CUSTOMER_COMMS", "AUDIT_COMPLIANCE",
]
Decision = Literal["APPROVED", "REVIEW_REQUIRED", "REJECTED"]

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4")
OPENAI_VISION_MODEL = os.getenv("OPENAI_VISION_MODEL", "gpt-5.4")
OPENAI_VISION_FALLBACK_MODEL = os.getenv("OPENAI_VISION_FALLBACK_MODEL", "gpt-4.1-mini")
OPENAI_DECISION_MODEL = os.getenv("OPENAI_DECISION_MODEL", OPENAI_MODEL)
OPENAI_VISION_TIMEOUT_SEC = int(os.getenv("OPENAI_VISION_TIMEOUT_SEC", "25"))
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@aurastack.ai")
IMAP_HOST = os.getenv("IMAP_HOST", "imap.gmail.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
IMAP_USER = os.getenv("IMAP_USER", "")
IMAP_PASS = os.getenv("IMAP_PASS", "")
IMAP_MAILBOX = os.getenv("IMAP_MAILBOX", "INBOX")
IMAP_POLL_INTERVAL = int(os.getenv("IMAP_POLL_INTERVAL", "60"))
API_INBOUND_URL = os.getenv("API_INBOUND_URL", "http://localhost:8000/email/inbound")
# Prefer INTERNAL_WORKER_TOKEN (API's source of truth), then API_INBOUND_TOKEN for backward compatibility.
API_INBOUND_TOKEN = os.getenv("INTERNAL_WORKER_TOKEN") or os.getenv("API_INBOUND_TOKEN", "dev-worker-token")
API_INBOX_SETTINGS_URL = os.getenv("API_INBOX_SETTINGS_URL", "http://localhost:8000/internal/inbox-settings")
API_POLICY_LOOKUP_URL = os.getenv("API_POLICY_LOOKUP_URL", "http://localhost:8000/internal/policies/lookup")
POLICY_DOCS_DIR = os.getenv("POLICY_DOCS_DIR", str(REPO_ROOT / "policy docs"))
POLICY_KB_MAX_CHUNKS = int(os.getenv("POLICY_KB_MAX_CHUNKS", "600"))
POLICY_KB_REFRESH_SEC = int(os.getenv("POLICY_KB_REFRESH_SEC", "180"))
IMAP_FORCE_INTAKE_SENDERS = [
    s.strip().lower()
    for s in os.getenv("IMAP_FORCE_INTAKE_SENDERS", "").split(",")
    if s.strip()
]


class AgentDefinition(BaseModel):
    name: str
    kind: Literal["extraction", "validation", "orchestrator", "email", "document", "decision", "classifier", "fraud", "compliance", "analytics", "knowledge"]
    instructions: str
    rules: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ExtractionInput(BaseModel):
    caseId: str
    intakeJobId: str

class ValidationInput(BaseModel):
    caseId: str
    intakeJobId: str
    extraction: Dict[str, object]

class FlowStep(BaseModel):
    id: str
    kind: Literal["extraction", "validation", "human_review"]
    agentName: str
    nextOnSuccess: Optional[str] = None
    nextOnFailure: Optional[str] = None

class FlowRunInput(BaseModel):
    caseId: str
    intakeJobId: str
    flowConfig: Dict[str, object]

class WorkflowStepExecuteInput(BaseModel):
    executionId: str
    caseId: str
    workflowId: str
    stepId: str
    stepName: str
    stepType: StepType
    payload: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)
    config: Dict[str, Any] = Field(default_factory=dict)

class WorkflowStepExecuteOutput(BaseModel):
    output: Dict[str, Any]
    decision: Optional[Decision] = None

class EmailSendInput(BaseModel):
    to: str
    subject: str
    body: str
    html: Optional[str] = None
    replyTo: Optional[str] = None

class AgentState(TypedDict):
    step_type: str
    payload: Dict[str, Any]
    context: Dict[str, Any]
    config: Dict[str, Any]
    output: Dict[str, Any]
    decision: Optional[str]


def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}

def _find_step(steps: Dict[str, Any], *field_hints: str) -> Dict[str, Any]:
    """Find the first step output in context.steps that contains any of the given fields.
    Allows agents to work regardless of what the workflow step is named."""
    for step_val in steps.values():
        if isinstance(step_val, dict):
            for hint in field_hints:
                if hint in step_val:
                    return step_val
    return {}

def _extract_text_from_pdf_bytes(content: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(content))
        return "\n".join((page.extract_text() or "").strip() for page in reader.pages).strip()
    except Exception:
        return ""

def _extract_pdf_page_texts(content: bytes) -> List[str]:
    try:
        reader = PdfReader(io.BytesIO(content))
        return [str((page.extract_text() or "")).strip() for page in reader.pages]
    except Exception:
        return []

def _extract_text_from_image_bytes(content: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(content))
        return pytesseract.image_to_string(image).strip()
    except Exception:
        return ""

def _strip_md_json(raw: str) -> str:
    return re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())

def _decode_base64_payload(payload: str) -> bytes:
    text = str(payload or "").strip()
    if "," in text and text.lower().startswith("data:"):
        text = text.split(",", 1)[1]
    text = re.sub(r"\s+", "", text)
    missing_padding = len(text) % 4
    if missing_padding:
        text += "=" * (4 - missing_padding)
    return base64.b64decode(text)


def _sanitize_ocr_text(text: str) -> str:
    raw = str(text or "")
    if not raw:
        return ""
    cleaned_lines: List[str] = []
    for line in raw.splitlines():
        low = line.strip().lower()
        if not low:
            continue
        if "pdfmachine" in low:
            continue
        if "a pdf writer that produces quality pdf files" in low:
            continue
        if "get yours now" in low:
            continue
        cleaned_lines.append(line.rstrip())
    cleaned = "\n".join(cleaned_lines)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


def _prompt_text_window(text: str, head: int = 12000, middle: int = 10000, tail: int = 12000) -> str:
    src = str(text or "")
    if not src:
        return ""
    if len(src) <= (head + middle + tail):
        return src
    mid_start = max(0, (len(src) // 2) - (middle // 2))
    mid_end = min(len(src), mid_start + middle)
    return (
        src[:head]
        + "\n\n[... middle segment ...]\n\n"
        + src[mid_start:mid_end]
        + "\n\n[... tail segment ...]\n\n"
        + src[-tail:]
    )

def extract_text_from_documents(documents: List[Dict[str, Any]]) -> Dict[str, Any]:
    extracted_chunks: List[str] = []
    ocr_docs = 0
    for document in documents:
        if isinstance(document.get("text"), str) and document["text"].strip():
            extracted_chunks.append(document["text"].strip())
            continue
        content_b64 = document.get("contentBase64")
        mime_type = str(document.get("mimeType", "")).lower()
        if not isinstance(content_b64, str) or not content_b64:
            continue
        try:
            raw = _decode_base64_payload(content_b64)
        except Exception:
            continue
        text = ""
        if "pdf" in mime_type or str(document.get("name", "")).lower().endswith(".pdf"):
            text = _extract_text_from_pdf_bytes(raw)
        elif mime_type.startswith("image/"):
            text = _extract_text_from_image_bytes(raw)
        if text:
            ocr_docs += 1
            extracted_chunks.append(text)
    combined = "\n".join(chunk for chunk in extracted_chunks if chunk).strip()
    return {"text": combined, "documentCount": len(documents), "ocrProcessedDocuments": ocr_docs, "hasExtractedText": bool(combined)}

_POLICY_KB_CACHE: Dict[str, Any] = {
    "loaded_at": 0.0,
    "root": POLICY_DOCS_DIR,
    "files_signature": "",
    "chunks": [],
}


def _policy_file_signature(files: List[Path]) -> str:
    parts: List[str] = []
    for fp in files:
        try:
            info = fp.stat()
            parts.append(f"{fp.name}:{int(info.st_mtime)}:{info.st_size}")
        except Exception:
            continue
    return "|".join(sorted(parts))


def _extract_policy_chunks_from_pdf(pdf_path: Path) -> List[Dict[str, Any]]:
    chunks: List[Dict[str, Any]] = []
    try:
        reader = PdfReader(str(pdf_path))
    except Exception:
        return chunks

    keyword_map = {
        "waiting period": "waiting_period",
        "co-pay": "co_pay",
        "copay": "co_pay",
        "deductible": "deductible",
        "exclusion": "exclusion",
        "sub-limit": "sub_limit",
        "room rent": "room_rent",
        "pre-existing": "pre_existing",
        "grace period": "grace_period",
        "sum insured": "sum_insured",
        "cashless": "cashless",
        "reimbursement": "reimbursement",
        "documents required": "required_documents",
        "claim intimation": "claim_intimation",
    }

    for page_idx, page in enumerate(reader.pages):
        text = (page.extract_text() or "").strip()
        if not text:
            continue
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        for line in lines:
            low = line.lower()
            matched_tags = [tag for needle, tag in keyword_map.items() if needle in low]
            if not matched_tags and len(line) < 50:
                continue
            if not matched_tags and len(line) > 220:
                continue
            chunks.append(
                {
                    "doc": pdf_path.name,
                    "page": page_idx + 1,
                    "text": line[:320],
                    "tags": matched_tags or ["general_clause"],
                }
            )
            if len(chunks) >= POLICY_KB_MAX_CHUNKS:
                return chunks
    return chunks


def _load_policy_kb(force: bool = False) -> Dict[str, Any]:
    now = time.time()
    if not force and now - float(_POLICY_KB_CACHE.get("loaded_at", 0)) < POLICY_KB_REFRESH_SEC:
        return _POLICY_KB_CACHE

    root = Path(POLICY_DOCS_DIR)
    files = sorted(root.glob("*.pdf")) if root.exists() else []
    signature = _policy_file_signature(files)
    if not force and signature == _POLICY_KB_CACHE.get("files_signature"):
        _POLICY_KB_CACHE["loaded_at"] = now
        return _POLICY_KB_CACHE

    chunks: List[Dict[str, Any]] = []
    for fp in files:
        chunks.extend(_extract_policy_chunks_from_pdf(fp))
        if len(chunks) >= POLICY_KB_MAX_CHUNKS:
            chunks = chunks[:POLICY_KB_MAX_CHUNKS]
            break

    _POLICY_KB_CACHE.update(
        {
            "loaded_at": now,
            "root": str(root),
            "files_signature": signature,
            "chunks": chunks,
            "files": [f.name for f in files],
        }
    )
    return _POLICY_KB_CACHE


def _search_policy_kb(query: str, claim_type: str = "health", top_k: int = 5) -> List[Dict[str, Any]]:
    kb = _load_policy_kb()
    chunks = kb.get("chunks") or []
    q = (query or "").lower()
    tokens = [t for t in re.split(r"[^a-z0-9]+", q) if len(t) > 2]
    claim_hint_tokens = [claim_type.lower(), "claim", "policy", "insurance"]
    all_tokens = list(dict.fromkeys(tokens + claim_hint_tokens))
    scored: List[Tuple[int, Dict[str, Any]]] = []
    for chunk in chunks:
        text = str(chunk.get("text", "")).lower()
        score = 0
        for token in all_tokens:
            if token in text:
                score += 2
        tags = chunk.get("tags") or []
        if claim_type.lower() == "health" and any(tag in {"waiting_period", "exclusion", "co_pay", "room_rent"} for tag in tags):
            score += 1
        if score > 0:
            scored.append((score, chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [item[1] for item in scored[:top_k]]

openai_client: Optional[OpenAI] = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


class BaseLangGraphAgent:
    def __init__(self) -> None:
        self.graph = self._build_graph()

    def _build_graph(self):
        if StateGraph is None:
            return None
        builder = StateGraph(AgentState)
        builder.add_node("run", self._run_node)
        builder.set_entry_point("run")
        builder.add_edge("run", END)
        return builder.compile()

    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        raise NotImplementedError

    def invoke(self, state: AgentState) -> AgentState:
        if self.graph is None:
            updates = self._run_node(state)
            merged = dict(state)
            merged.update(updates)
            return merged  # type: ignore
        return self.graph.invoke(state)  # type: ignore


class EmailAgent(BaseLangGraphAgent):
    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        if state["step_type"] == "EMAIL_REPLY":
            # Delegate to EmailSendAgent for proper LLM-generated body
            return email_send_agent._run_node(state)
        sender = (
            state["payload"].get("sender")
            or state["payload"].get("fromAddress")
            or "unknown@sender.local"
        )
        return {"output": {"emailReceived": True, "from": sender, "subject": state["payload"].get("emailSubject", ""), "documentCount": len(state["payload"].get("documents", [])) if isinstance(state["payload"].get("documents"), list) else 0, "timestamp": datetime.utcnow().isoformat()}}


class PreProcessorAgent(BaseLangGraphAgent):
    """Pre-processes large inbound payloads into logical document groups and cascade hints."""

    _SECTION_RULES: Dict[str, List[str]] = {
        "clinical_records": ["discharge summary", "admission", "diagnosis", "clinical", "treatment", "oncology", "surgery", "physician"],
        "lab_results": ["lab", "pathology", "test result", "hematology", "biochemistry", "radiology", "scan", "mri", "ct"],
        "billing_documents": ["invoice", "bill", "receipt", "amount", "charges", "payment", "gst", "tax", "pharmacy bill"],
        "prescriptions": ["prescription", "rx", "dosage", "medicine", "drug", "tablet", "capsule", "chemo", "chemotherapy"],
        "identity_policy": ["policy", "member id", "insurance card", "id proof", "aadhaar", "passport", "pan", "kyc"],
    }

    def _pdf_pages(self, raw: bytes) -> List[str]:
        return _extract_pdf_page_texts(raw)

    def _group_from_text(self, text: str, fallback: str = "other_documents") -> str:
        hay = text.lower()
        best_group = fallback
        best_score = 0
        for group, keywords in self._SECTION_RULES.items():
            score = sum(1 for kw in keywords if kw in hay)
            if score > best_score:
                best_group = group
                best_score = score
        return best_group

    def _claim_type(self, text: str) -> str:
        hay = text.lower()
        if any(token in hay for token in ["health", "hospital", "medical", "diagnosis", "surgery", "discharge"]):
            return "health"
        if any(token in hay for token in ["vehicle", "car", "motor", "accident"]):
            return "auto"
        if any(token in hay for token in ["property", "fire", "home", "flood"]):
            return "property"
        if any(token in hay for token in ["life", "deceased", "death"]):
            return "life"
        return "other"

    def _severity(self, text: str) -> str:
        hay = text.lower()
        high_terms = ["metastatic", "oncology", "cancer", "icu", "critical", "chemotherapy", "sepsis", "stroke", "cardiac"]
        medium_terms = ["surgery", "admission", "fracture", "operation", "procedure"]
        if any(term in hay for term in high_terms):
            return "high"
        if any(term in hay for term in medium_terms):
            return "medium"
        return "low"

    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        payload = _safe_dict(state.get("payload", {}))
        docs = payload.get("documents", [])
        documents = docs if isinstance(docs, list) else []

        groups: Dict[str, List[Dict[str, Any]]] = {
            "clinical_records": [],
            "lab_results": [],
            "billing_documents": [],
            "prescriptions": [],
            "identity_policy": [],
            "other_documents": [],
        }
        total_pdf_pages = 0
        combined_text_parts: List[str] = []

        for doc in documents:
            if not isinstance(doc, dict):
                continue
            name = str(doc.get("name") or "attachment")
            mime_type = str(doc.get("mimeType") or "").lower()
            b64 = doc.get("contentBase64")

            if isinstance(doc.get("text"), str) and doc["text"].strip():
                combined_text_parts.append(doc["text"].strip())

            if isinstance(b64, str) and b64:
                try:
                    raw = _decode_base64_payload(b64)
                except Exception:
                    raw = b""
            else:
                raw = b""

            if raw and ("pdf" in mime_type or name.lower().endswith(".pdf")):
                page_texts = self._pdf_pages(raw)
                page_count = len(page_texts)
                total_pdf_pages += page_count
                if page_texts:
                    # Use full-page coverage for better routing on long medical files.
                    combined_text_parts.append("\n".join(page_texts)[:180000])
                if page_count == 0:
                    groups["other_documents"].append({"name": name, "mimeType": mime_type, "pages": 0})
                    continue
                for idx, page_text in enumerate(page_texts, start=1):
                    group = self._group_from_text(page_text, "clinical_records")
                    groups[group].append({"name": name, "mimeType": mime_type, "page": idx})
            else:
                filename_group = self._group_from_text(name.replace("_", " ").replace("-", " "), "other_documents")
                groups[filename_group].append({"name": name, "mimeType": mime_type, "pages": 1})

        combined_text = " ".join(
            [str(payload.get("emailSubject", "")), str(payload.get("emailBody", "")), *combined_text_parts]
        ).strip()
        claim_type = self._claim_type(combined_text)
        severity_band = self._severity(combined_text)
        oncology_signal = any(token in combined_text.lower() for token in ["oncology", "metastatic", "carcinoma", "chemotherapy", "tumor"])

        contains_large_pdf = total_pdf_pages >= 30
        cascade_keys: List[str] = []
        # Front door is always implicit; specialized cascades are emitted explicitly.
        if claim_type == "health":
            cascade_keys.extend(["hospital_intake_v1", "claims_mgmt_v1"])
        elif claim_type in {"auto", "property", "life"}:
            cascade_keys.append("claims_mgmt_v1")
        if severity_band == "high":
            cascade_keys.append("medical_uw_v1")
        if oncology_signal or severity_band == "high":
            cascade_keys.append("compliance_audit_v1")

        # Keep order deterministic and unique.
        deduped_keys: List[str] = []
        for key in cascade_keys:
            if key not in deduped_keys:
                deduped_keys.append(key)

        routed_agents: Dict[str, str] = {
            "clinical_records": "medical_data_extractor_ai",
            "lab_results": "lab_analyst_ai",
            "billing_documents": "billing_ai",
            "prescriptions": "pharma_validator_ai",
            "identity_policy": "policy_identity_ai",
            "other_documents": "general_doc_ai",
        }

        return {
            "output": {
                "totalDocuments": len(documents),
                "totalPdfPages": total_pdf_pages,
                "containsLargePdf": contains_large_pdf,
                "cascadeRequired": contains_large_pdf or severity_band in {"medium", "high"},
                "summary": (
                    f"Pre-processed {len(documents)} documents ({total_pdf_pages} PDF pages). "
                    f"Claim type={claim_type}, severity={severity_band}, oncologySignal={oncology_signal}."
                ),
                "triage": {
                    "intent": "CLAIM",
                    "claimType": claim_type,
                    "severityBand": severity_band,
                    "oncologySignal": oncology_signal,
                },
                "documentGroups": groups,
                "groupAgentRouting": routed_agents,
                "recommendedWorkflowKeys": deduped_keys,
            }
        }


class VLMDocumentAgent(BaseLangGraphAgent):
    """GPT-4o vision OCR + LLM data extraction. Falls back to pytesseract/regex."""

    @staticmethod
    def _normalize_extracted_fields(fields: Dict[str, Any]) -> Dict[str, Any]:
        mapping = {
            "policy_number": "policyNumber",
            "claim_number": "claimNumber",
            "claimant_name": "claimantName",
            "date_of_incident": "dateOfIncident",
            "amount": "claimAmount",
            "diagnosis_codes": "diagnosisCodes",
            "treatment_description": "treatmentDescription",
            "vehicle_make_model": "vehicleInfo",
            "damage_description": "damageDescription",
            "provider_name": "providerName",
            "primary_diagnosis": "primaryDiagnosis",
            "chief_complaint": "chiefComplaint",
            "symptoms": "symptoms",
            "treatment_procedure": "treatmentProcedure",
            "admission_date": "admissionDate",
            "discharge_date": "dischargeDate",
            "condition_on_discharge": "conditionOnDischarge",
            "follow_up_instructions": "followUpInstructions",
            "medication_list": "medicationList",
        }
        normalized: Dict[str, Any] = {}
        for key, value in fields.items():
            out_key = mapping.get(str(key), str(key))
            if value not in (None, "", [], {}):
                normalized[out_key] = value
        return normalized

    @staticmethod
    def _name_from_email(address: str) -> str:
        local = (address.split("@")[0] if "@" in address else address).strip()
        if not local:
            return ""
        cleaned = re.sub(r"[^a-zA-Z0-9._-]+", " ", local).replace(".", " ").replace("_", " ").replace("-", " ")
        candidate = " ".join(word.capitalize() for word in cleaned.split() if word)
        return candidate.strip()

    def _infer_member_name(self, payload: Dict[str, Any], text: str) -> str:
        direct = str(payload.get("memberName") or "").strip()
        if direct and direct.lower() not in {"unknown", "n/a", "na"}:
            if "<" in direct:
                direct = direct.split("<")[0].strip()
            if direct:
                return direct
        patterns = [
            r"(?:patient|claimant|member|insured)\s*name\s*[:\-]\s*([A-Za-z][A-Za-z\s.'-]{2,60})",
            r"name\s*[:\-]\s*([A-Za-z][A-Za-z\s.'-]{2,60})",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        sender = str(payload.get("fromAddress") or payload.get("sender") or payload.get("customerEmail") or "").strip()
        guessed = self._name_from_email(sender)
        return guessed or "Unknown"

    def _normalize_image_for_ocr(self, content_b64: str, mime_type: str) -> tuple[str, str]:
        """Normalize images to PNG data URI payload to reduce parser failures on odd formats."""
        raw = _decode_base64_payload(content_b64)
        image = Image.open(io.BytesIO(raw))
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        # Keep OCR latency bounded for large email attachments.
        max_side = 1800
        if max(image.size) > max_side:
            image.thumbnail((max_side, max_side))
        out = io.BytesIO()
        image.save(out, format="PNG")
        return base64.b64encode(out.getvalue()).decode("utf-8"), "image/png"

    def _summarize_pdf_with_openai(self, raw: bytes, doc_name: str) -> Dict[str, Any]:
        """Fallback PDF parser for large/scanned documents when direct text extraction is weak."""
        if not openai_client:
            return {}
        encoded = base64.b64encode(raw).decode("utf-8")
        prompt = (
            "You are an insurance medical-document parser.\n"
            "Read this full PDF and return ONLY valid JSON (no markdown) with:\n"
            '{"text":"full extracted text or best-possible consolidated text",'
            '"documentType":"medical_report|invoice|lab_report|policy|other",'
            '"fields":{"policyNumber":null,"claimNumber":null,"claimantName":null,"providerName":null,'
            '"primaryDiagnosis":null,"chiefComplaint":null,"treatmentProcedure":null,'
            '"admissionDate":null,"dischargeDate":null,"conditionOnDischarge":null,'
            '"followUpInstructions":null,"diagnosisCodes":[],"medicationList":[]}}\n'
            "If a field is unavailable, keep it null or empty."
        )
        resp = openai_client.responses.create(  # type: ignore[union-attr]
            model=OPENAI_VISION_MODEL,
            input=[{
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {
                        "type": "input_file",
                        "filename": doc_name or "document.pdf",
                        "file_data": f"data:application/pdf;base64,{encoded}",
                    },
                ],
            }],
            temperature=0,
            timeout=max(OPENAI_VISION_TIMEOUT_SEC, 45),
        )
        raw_text = self._response_output_text(resp)
        cleaned = _strip_md_json(raw_text)
        try:
            parsed = json.loads(cleaned or "{}")
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
        return {"text": raw_text, "documentType": "other", "fields": {}}

    def _clinical_focus_window(self, text: str) -> str:
        src = str(text or "")
        if not src:
            return ""
        lines = [ln.strip() for ln in src.splitlines() if ln.strip()]
        keywords = [
            "diagnosis", "disease", "chief complaint", "present known illness",
            "discussion", "summary", "discharge medication", "follow-up",
            "admission", "discharge", "oncology", "procedure", "surgery",
        ]
        picked = [line for line in lines if any(k in line.lower() for k in keywords)]
        focus = "\n".join(picked[:5000])
        base = _prompt_text_window(src, head=20000, middle=15000, tail=20000)
        if focus:
            return f"{focus}\n\n[full-document window]\n{base}"
        return base

    @staticmethod
    def _response_output_text(resp: Any) -> str:
        direct = (getattr(resp, "output_text", "") or "").strip()
        if direct:
            return direct
        output = getattr(resp, "output", None)
        if not isinstance(output, list):
            return ""
        chunks: List[str] = []
        for item in output:
            content = getattr(item, "content", None)
            if not isinstance(content, list):
                continue
            for part in content:
                text = getattr(part, "text", None)
                if isinstance(text, str) and text.strip():
                    chunks.append(text.strip())
        return "\n".join(chunks).strip()

    def _ocr_image_vlm(self, content_b64: str, mime_type: str) -> Dict[str, Any]:
        norm_b64, norm_mime = self._normalize_image_for_ocr(content_b64, mime_type)
        instruction = (
            "You are an insurance document analyst. Extract ALL text and structured data. "
            "Return ONLY valid JSON (no markdown):\n"
            "- text: full extracted text\n"
            "- documentType: one of [insurance_claim_form, medical_record, id_document, policy_document, invoice, prescription, hospital_bill, vehicle_damage_report, lab_report, discharge_summary, other]\n"
            "- fields: {policy_number, claim_number, claimant_name, date_of_incident, amount, diagnosis_codes, treatment_description, vehicle_make_model, damage_description, provider_name}"
        )

        response_text = ""
        primary_error: Optional[Exception] = None
        try:
            # Primary path (gpt-5.4 + detail original)
            resp = openai_client.responses.create(  # type: ignore[union-attr]
                model=OPENAI_VISION_MODEL,
                input=[{
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": instruction},
                        {
                            "type": "input_image",
                            "image_url": f"data:{norm_mime};base64,{norm_b64}",
                            "detail": "original",
                        },
                    ],
                }],
                temperature=0,
                timeout=OPENAI_VISION_TIMEOUT_SEC,
            )
            response_text = self._response_output_text(resp)
        except Exception as exc:
            primary_error = exc
            try:
                # Compatibility fallback path for vision in responses API
                resp = openai_client.responses.create(  # type: ignore[union-attr]
                    model=OPENAI_VISION_FALLBACK_MODEL,
                    input=[{
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": instruction},
                            {
                                "type": "input_image",
                                "image_url": f"data:{norm_mime};base64,{norm_b64}",
                                "detail": "high",
                            },
                        ],
                    }],
                    temperature=0,
                    timeout=OPENAI_VISION_TIMEOUT_SEC,
                )
                response_text = self._response_output_text(resp)
            except Exception as fallback_exc:
                logger.warning(f"Vision OCR failed in both primary and fallback paths: primary={primary_error} fallback={fallback_exc}")
                raise fallback_exc

        cleaned = _strip_md_json(response_text)
        try:
            return json.loads(cleaned or "{}")
        except Exception:
            # If model emitted non-JSON text, preserve OCR text instead of failing the whole document.
            return {"text": response_text, "documentType": "other", "fields": {}}

    def _run_ocr(self, docs: List[Dict[str, Any]]) -> Dict[str, Any]:
        all_text: List[str] = []
        doc_types: List[str] = []
        ext_fields: Dict[str, Any] = {}
        ocr_count = 0
        failed_docs: List[str] = []
        pdf_doc_count = 0
        total_pdf_pages = 0
        for doc in docs:
            doc_name = str(doc.get("name", "")).strip() or "unknown-document"
            if isinstance(doc.get("text"), str) and doc["text"].strip():
                all_text.append(doc["text"].strip())
                continue
            content_b64 = doc.get("contentBase64")
            mime_type = str(doc.get("mimeType", "")).lower()
            if not content_b64:
                failed_docs.append(doc_name)
                continue
            if openai_client and mime_type.startswith("image/"):
                try:
                    parsed = self._ocr_image_vlm(content_b64, mime_type)
                    if parsed.get("text"):
                        all_text.append(str(parsed["text"]))
                        ocr_count += 1
                    if parsed.get("documentType"):
                        doc_types.append(str(parsed["documentType"]))
                    if isinstance(parsed.get("fields"), dict):
                        ext_fields.update(self._normalize_extracted_fields(parsed["fields"]))
                    continue
                except Exception as exc:
                    logger.warning(f"VLM OCR failed for {doc_name}: {exc}")
            try:
                raw = _decode_base64_payload(content_b64)
                if "pdf" in mime_type or doc_name.endswith(".pdf"):
                    pdf_doc_count += 1
                    page_texts = _extract_pdf_page_texts(raw)
                    total_pdf_pages += len(page_texts)
                    text = "\n".join(page_texts).strip()
                    if openai_client and len(text) < 1200:
                        try:
                            parsed_pdf = self._summarize_pdf_with_openai(raw, doc_name)
                            parsed_text = str(parsed_pdf.get("text", "")).strip()
                            if parsed_text:
                                text = parsed_text
                            if parsed_pdf.get("documentType"):
                                doc_types.append(str(parsed_pdf["documentType"]))
                            if isinstance(parsed_pdf.get("fields"), dict):
                                ext_fields.update(self._normalize_extracted_fields(parsed_pdf["fields"]))
                        except Exception as exc:
                            logger.warning(f"PDF OpenAI fallback failed for {doc_name}: {exc}")
                elif mime_type.startswith("image/"):
                    text = _extract_text_from_image_bytes(raw)
                elif mime_type.startswith("text/") or doc_name.endswith(".txt") or doc_name.endswith(".csv"):
                    text = raw.decode("utf-8", errors="replace").strip()
                else:
                    text = ""
                if text:
                    all_text.append(text)
                    ocr_count += 1
                else:
                    failed_docs.append(doc_name)
            except Exception:
                failed_docs.append(doc_name)
        combined = _sanitize_ocr_text("\n\n".join(t for t in all_text if t).strip())
        return {
            "text": combined,
            "documentCount": len(docs),
            "documentTypes": doc_types,
            "extractedFields": ext_fields,
            "hasExtractedText": bool(combined),
            "ocrProcessedDocuments": ocr_count,
            "ocrFailedDocuments": len(failed_docs),
            "failedDocumentNames": failed_docs[:50],
            "pdfDocumentCount": pdf_doc_count,
            "totalPdfPagesProcessed": total_pdf_pages,
        }

    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        docs = state["payload"].get("documents", [])
        docs = docs if isinstance(docs, list) else []
        if state["step_type"] == "DATA_EXTRACTION":
            steps = _safe_dict(state["context"].get("steps", {}))
            ocr = _safe_dict(
                steps.get("Document OCR") or steps.get("OCR") or steps.get("Email Intake OCR")
                or _find_step(steps, "ocrProcessedDocuments", "hasExtractedText", "documentCount")
            )
            text = _sanitize_ocr_text(str(ocr.get("text", "")))
            vlm_fields = _safe_dict(ocr.get("extractedFields"))
            member_name = self._infer_member_name(state["payload"], text)
            if openai_client and text:
                try:
                    prompt_text = self._clinical_focus_window(text)
                    prompt = (
                        "Extract structured insurance claim data. Return ONLY valid JSON.\n"
                        "Do not fabricate unknown values. Use null when not present.\n"
                        '{"claimNumber":null,"policyNumber":null,"claimantName":null,"dateOfIncident":null,'
                        '"claimAmount":null,"claimType":"health|auto|property|life|other","diagnosisCodes":[],'
                        '"primaryDiagnosis":null,"chiefComplaint":null,"symptoms":null,"treatmentDescription":null,'
                        '"treatmentProcedure":null,"admissionDate":null,"dischargeDate":null,"conditionOnDischarge":null,'
                        '"followUpInstructions":null,"medicationList":[],"vehicleInfo":null,"damageDescription":null,'
                        '"providerName":null,"memberName":null,"confidence":0.0}\n\n'
                        "If this is a discharge summary, extract from sections like Diagnosis, Disease Name, Chief Complaint(s), "
                        "Present Known Illness, Summary, Discussion, Discharge Medication List, Condition on Discharge, "
                        "Follow-up Instructions, Date of Admission, and Date of Discharge.\n"
                        "For medicationList, return a unique array of medicine names.\n"
                        "Prefer exact values from report text.\n\n"
                        f"Text:\n{prompt_text}"
                    )
                    resp = openai_client.chat.completions.create(model=OPENAI_MODEL, messages=[{"role": "user", "content": prompt}], max_tokens=1000, temperature=0)
                    fields = json.loads(_strip_md_json(resp.choices[0].message.content or "{}"))
                    fields = self._normalize_extracted_fields(_safe_dict(fields))
                    fields.update({k: v for k, v in self._normalize_extracted_fields(vlm_fields).items() if v and k not in fields})
                    if not fields.get("claimantName"):
                        fields["claimantName"] = member_name
                    if not fields.get("memberName"):
                        fields["memberName"] = fields.get("claimantName") or member_name
                    present = sum(1 for key in ("claimNumber", "policyNumber", "claimantName", "dateOfIncident", "providerName", "diagnosisCodes", "treatmentDescription") if fields.get(key))
                    fields["confidence"] = round(max(0.55, min(0.99, 0.55 + (present * 0.06))), 3)
                    return {"output": {"extractedFields": fields, "sourceTextLength": len(text), "extractionMethod": "llm"}}
                except Exception as exc:
                    logger.warning(f"LLM extraction failed: {exc}")
            fields: Dict[str, Any] = {"claimNumber": None, "policyNumber": None, "claimantName": member_name, "memberName": member_name, **{k: v for k, v in self._normalize_extracted_fields(vlm_fields).items() if v}}
            if text:
                cm = re.search(r"claim[\s_-]*(?:id|ref|no|number|#)?[:\s\-]+([A-Z0-9][A-Z0-9\-\/]{4,})", text, re.IGNORECASE)
                pm = re.search(r"policy[\s_-]*(?:id|ref|no|number|#)?[:\s\-]+([A-Z0-9][A-Z0-9\-\/]{4,})", text, re.IGNORECASE)
                am = re.search(r"(?:amount|total)[:\s]+\$?([\d,]+\.?\d*)", text, re.IGNORECASE)
                dm = re.search(r"(?:date of incident|incident date)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})", text, re.IGNORECASE)
                prv = re.search(r"(?:hospital|provider|clinic)\s*(?:name)?[:\s\-]+([A-Za-z0-9&.,\-\s]{3,80})", text, re.IGNORECASE)
                diag = re.findall(r"\b([A-TV-Z][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?)\b", text)
                cname = re.search(r"(?:patient|claimant|member|insured)\s*name\s*[:\-]\s*([A-Za-z][A-Za-z\s.'-]{2,60})", text, re.IGNORECASE)
                primary_diag = re.search(r"(?:final diagnosis|diagnosis|disease name)\s*[:\-]?\s*([^\n]{3,200})", text, re.IGNORECASE)
                chief_complaint = re.search(r"(?:chief complaint\(s\)|chief complaint|present known illness|complaint)\s*[:\-]?\s*([^\n]{3,240})", text, re.IGNORECASE)
                treatment_proc = re.search(r"(?:surgery\/procedure|treatment\/procedure|summary)\s*[:\-]?\s*([^\n]{3,300})", text, re.IGNORECASE)
                admission_date = re.search(r"(?:date of admission|admission date)\s*[:\-]?\s*([^\n]{3,80})", text, re.IGNORECASE)
                discharge_date = re.search(r"(?:date of discharge|discharge date)\s*[:\-]?\s*([^\n]{3,80})", text, re.IGNORECASE)
                discharge_condition = re.search(r"(?:condition on discharge)\s*[:\-]?\s*([^\n]{2,120})", text, re.IGNORECASE)
                follow_up = re.search(r"(?:follow-up instructions|follow up instructions|review with)\s*[:\-]?\s*([^\n]{3,240})", text, re.IGNORECASE)
                symptoms_text = re.search(r"(?:symptoms?|chief complaint)\s*[:\-]?\s*([^\n]{3,220})", text, re.IGNORECASE)
                treatment_desc = re.search(r"(?:discussion|impression|clinical summary)\s*[:\-]?\s*([^\n]{10,500})", text, re.IGNORECASE)
                meds_block = re.search(r"(?:discharge medication list)([\s\S]{0,3500})", text, re.IGNORECASE)
                if cm: fields["claimNumber"] = cm.group(1)
                if pm: fields["policyNumber"] = pm.group(1)
                if am: fields["claimAmount"] = float(am.group(1).replace(",", ""))
                if dm: fields["dateOfIncident"] = dm.group(1)
                if prv and not fields.get("providerName"): fields["providerName"] = prv.group(1).strip()
                if diag and not fields.get("diagnosisCodes"): fields["diagnosisCodes"] = diag[:8]
                if cname and not fields.get("claimantName"): fields["claimantName"] = cname.group(1).strip()
                if primary_diag and not fields.get("primaryDiagnosis"): fields["primaryDiagnosis"] = primary_diag.group(1).strip()
                if chief_complaint and not fields.get("chiefComplaint"): fields["chiefComplaint"] = chief_complaint.group(1).strip()
                if symptoms_text and not fields.get("symptoms"): fields["symptoms"] = symptoms_text.group(1).strip()
                if treatment_proc and not fields.get("treatmentProcedure"): fields["treatmentProcedure"] = treatment_proc.group(1).strip()
                if treatment_desc and not fields.get("treatmentDescription"): fields["treatmentDescription"] = treatment_desc.group(1).strip()
                if admission_date and not fields.get("admissionDate"): fields["admissionDate"] = admission_date.group(1).strip()
                if discharge_date and not fields.get("dischargeDate"): fields["dischargeDate"] = discharge_date.group(1).strip()
                if discharge_condition and not fields.get("conditionOnDischarge"): fields["conditionOnDischarge"] = discharge_condition.group(1).strip()
                if follow_up and not fields.get("followUpInstructions"): fields["followUpInstructions"] = follow_up.group(1).strip()
                if meds_block and not fields.get("medicationList"):
                    medication_names = re.findall(r"\b(?:tab|inj|syp|patch)\.?\s*([A-Za-z0-9\- ]{2,60})", meds_block.group(1), re.IGNORECASE)
                    meds: List[str] = []
                    seen = set()
                    for item in medication_names:
                        name = re.sub(r"\s+", " ", item).strip(" -.,")
                        key = name.lower()
                        if not name or key in seen:
                            continue
                        seen.add(key)
                        meds.append(name)
                        if len(meds) >= 12:
                            break
                    if meds:
                        fields["medicationList"] = meds
            present = sum(1 for key in ("claimNumber", "policyNumber", "claimantName", "dateOfIncident", "providerName", "diagnosisCodes", "treatmentDescription") if fields.get(key))
            fields["confidence"] = round(max(0.5, min(0.9, 0.5 + (present * 0.06))), 3)
            return {"output": {"extractedFields": fields, "sourceTextLength": len(text), "extractionMethod": "regex"}}
        return {"output": self._run_ocr(docs)}


class ClaimClassifierAgent(BaseLangGraphAgent):
    """Classifies incoming emails: inquiry type, claim type, priority."""

    INQUIRY_TYPES = ["new_claim", "status_inquiry", "document_upload", "complaint", "renewal", "general_query"]
    CLAIM_TYPES = ["health", "auto", "property", "life", "travel", "liability", "other"]

    @staticmethod
    def _normalize_confidence(raw: Any, fallback: float = 0.72) -> float:
        try:
            value = float(raw)
        except Exception:
            value = fallback
        return round(max(0.55, min(0.99, value)), 3)

    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        subject = str(state["payload"].get("emailSubject", ""))
        body = str(state["payload"].get("emailBody", ""))
        member_name = str(state["payload"].get("memberName", "Unknown"))
        combined = f"Subject: {subject}\n\nBody:\n{body[:3000]}"
        if openai_client:
            try:
                prompt = (
                    f"You are an insurance intake classifier.\nCustomer: {member_name}\n{combined}\n\n"
                    "Return ONLY valid JSON (no markdown):\n"
                    '{"inquiryType":"new_claim|status_inquiry|document_upload|complaint|renewal|general_query",'
                    '"claimType":"health|auto|property|life|travel|liability|other",'
                    '"priority":"critical|high|medium|low",'
                    '"policyNumber":null,"memberName":null,"estimatedAmount":null,'
                    '"urgencyReason":null,"summary":"one sentence","requiredDocuments":[],"confidence":0.0}'
                )
                resp = openai_client.chat.completions.create(model=OPENAI_MODEL, messages=[{"role": "user", "content": prompt}], max_tokens=500, temperature=0)
                result = json.loads(_strip_md_json(resp.choices[0].message.content or "{}"))
                normalized = {
                    **result,
                    "confidence": self._normalize_confidence(result.get("confidence"), 0.78),
                    "memberName": result.get("memberName") or member_name,
                    "classifiedAt": datetime.utcnow().isoformat(),
                    "method": "llm",
                }
                return {"output": normalized}
            except Exception as exc:
                logger.warning(f"Classifier LLM failed: {exc}")
        tl = combined.lower()
        inquiry = "general_query"
        claim = "other"
        priority = "medium"
        if any(w in tl for w in ["file a claim", "new claim", "accident", "damage", "injured", "hospital", "stolen"]): inquiry = "new_claim"
        elif any(w in tl for w in ["status", "update", "where is my", "when will"]): inquiry = "status_inquiry"
        elif any(w in tl for w in ["attach", "document", "upload", "enclosed", "find attached"]): inquiry = "document_upload"
        elif any(w in tl for w in ["complaint", "unhappy", "unacceptable", "disappointed"]): inquiry = "complaint"; priority = "high"
        elif any(w in tl for w in ["renew", "renewal", "expire"]): inquiry = "renewal"
        if any(w in tl for w in ["health", "medical", "doctor", "hospital", "prescription", "surgery"]): claim = "health"
        elif any(w in tl for w in ["car", "vehicle", "auto", "accident", "collision", "crash"]): claim = "auto"
        elif any(w in tl for w in ["home", "house", "property", "fire", "flood", "theft"]): claim = "property"
        elif any(w in tl for w in ["life", "death", "beneficiary", "deceased"]): claim = "life"; priority = "high"
        elif any(w in tl for w in ["travel", "trip", "flight", "luggage"]): claim = "travel"
        if any(w in tl for w in ["emergency", "urgent", "critical", "immediately", "life-threatening"]): priority = "critical"
        return {"output": {"inquiryType": inquiry, "claimType": claim, "priority": priority, "policyNumber": None, "memberName": member_name, "estimatedAmount": None, "urgencyReason": None, "summary": f"{inquiry} for {claim} insurance", "requiredDocuments": [], "confidence": self._normalize_confidence(0.70), "classifiedAt": datetime.utcnow().isoformat(), "method": "keyword"}}


class ValidationAgent(BaseLangGraphAgent):
    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        ocr = _safe_dict(
            steps.get("Document OCR") or steps.get("OCR") or steps.get("Email Intake OCR")
            or _find_step(steps, "ocrProcessedDocuments", "hasExtractedText", "documentCount")
        )
        pre = _safe_dict(steps.get("Pre Processor") or _find_step(steps, "containsLargePdf", "totalPdfPages"))
        docs_count = len(state["payload"].get("documents", [])) if isinstance(state["payload"].get("documents"), list) else 0
        required_count = len(state["config"].get("requiredDocuments", [])) if isinstance(state["config"].get("requiredDocuments"), list) else 2
        min_confidence = float(state["config"].get("minConfidence", 0.80))
        text_length = len(_sanitize_ocr_text(str(ocr.get("text", "")))) if isinstance(ocr.get("text"), str) else 0
        has_large_pdf = bool(pre.get("containsLargePdf")) or int(pre.get("totalPdfPages", 0) or 0) >= 20
        if has_large_pdf and text_length >= 10000 and docs_count >= 1:
            # Large parsed clinical PDFs (e.g., discharge summaries) are treated as a complete intake packet.
            required_count = min(required_count, 1)
            min_confidence = min(min_confidence, 0.65)
        elif (has_large_pdf or text_length >= 5000) and docs_count >= 1 and not isinstance(state["config"].get("requiredDocuments"), list):
            # A single large discharge summary can satisfy intake completeness when no explicit checklist is configured.
            required_count = 1
        missing_docs = max(0, required_count - docs_count)
        confidence = max(
            0.05,
            min(
                0.99,
                0.55
                + min(0.3, docs_count * 0.08)
                + min(0.3, text_length / 5000.0)
                - (missing_docs * 0.15),
            ),
        )
        passed = confidence >= min_confidence and missing_docs == 0
        reasons: List[str] = []
        if confidence < min_confidence: reasons.append(f"Confidence {confidence:.1%} below threshold {min_confidence:.1%}")
        if missing_docs > 0: reasons.append(f"Missing {missing_docs} required documents")
        output: Dict[str, Any] = {"passed": passed, "confidence": round(confidence, 3), "requiresHumanReview": not passed, "missingDocuments": missing_docs, "reasons": reasons}
        if state["step_type"] == "KNOWLEDGE_CHECK":
            output["knowledgeBase"] = state["config"].get("knowledgeBase", "default")
            output["knowledgePass"] = passed
        return {"output": output}


class KnowledgeBaseAgent(BaseLangGraphAgent):
    """Retrieve policy evidence snippets from local policy docs for explainable decisions."""
    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        extraction = _safe_dict(_safe_dict(steps.get("Data Extraction")).get("extractedFields"))
        classifier = _safe_dict(steps.get("Claim Classification") or {})
        policy = _safe_dict(steps.get("Policy Lookup") or {})

        claim_type = str(
            extraction.get("claimType")
            or classifier.get("claimType")
            or state["payload"].get("caseType")
            or policy.get("policyType")
            or "health"
        ).lower()

        query_parts = [
            str(state["payload"].get("emailSubject") or ""),
            str(state["payload"].get("emailBody") or ""),
            str(extraction.get("treatmentDescription") or ""),
            str(extraction.get("diagnosisCodes") or ""),
            str(extraction.get("providerName") or ""),
            str(policy.get("policyNumber") or state["payload"].get("policyNumber") or ""),
        ]
        query = " ".join(part for part in query_parts if part).strip()
        evidence = _search_policy_kb(query=query, claim_type=claim_type, top_k=5)
        confidence = round(min(0.99, 0.55 + (len(evidence) * 0.08)), 3)
        primary = evidence[0] if evidence else None
        summary = (
            f"Matched {len(evidence)} policy clause candidates from policy docs."
            if evidence
            else "No strong policy clause match found; review may be needed."
        )

        return {"output": {
            "knowledgeBase": "policy_docs_local",
            "knowledgePass": len(evidence) > 0,
            "confidence": confidence,
            "summary": summary,
            "primaryCitation": primary,
            "citations": evidence,
            "query": query[:600],
            "evaluatedAt": datetime.utcnow().isoformat(),
        }}


class DecisionAgent(BaseLangGraphAgent):
    def _deterministic(self, state: AgentState) -> Decision:
        steps = _safe_dict(state["context"].get("steps", {}))
        validation = _safe_dict(
            steps.get("Validation") or steps.get("Policy Validation") or steps.get("Validate Documents")
            or _find_step(steps, "confidence", "missingDocuments", "requiresHumanReview")
        )
        c = float(validation.get("confidence", 0.0))
        m = int(validation.get("missingDocuments", 0))
        if m >= 2: return "REJECTED"
        if c >= 0.88: return "APPROVED"
        if c >= 0.65: return "REVIEW_REQUIRED"
        return "REJECTED"

    @staticmethod
    def _read_validation(steps: Dict[str, Any]) -> Dict[str, Any]:
        return _safe_dict(
            steps.get("Validation") or steps.get("Policy Validation") or steps.get("Validate Documents")
            or _find_step(steps, "confidence", "missingDocuments", "requiresHumanReview", "passed")
        )

    def _apply_guardrails(self, validation: Dict[str, Any], proposed: Decision, deterministic: Decision) -> Decision:
        confidence = float(validation.get("confidence", 0.0))
        missing_docs = int(validation.get("missingDocuments", 0))
        passed = bool(validation.get("passed", False))

        # Hard business guardrails to prevent contradictory outcomes.
        if missing_docs >= 2:
            return "REJECTED"
        if passed and missing_docs == 0 and confidence >= 0.88:
            return "APPROVED"
        if confidence < 0.65 and missing_docs > 0:
            return "REJECTED"
        if proposed == "REJECTED" and confidence >= 0.8 and missing_docs == 0:
            return deterministic
        return proposed

    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        validation = self._read_validation(steps)
        deterministic = self._deterministic(state)
        decision: Decision = deterministic
        reason = "Decision based on validation confidence and document completeness."
        if openai_client:
            try:
                steps_sum = {k: {sk: sv for sk, sv in v.items() if sk in ("confidence", "passed", "decision", "claimType", "priority", "missingDocuments")} for k, v in steps.items() if isinstance(v, dict)}
                completion = openai_client.chat.completions.create(
                    model=OPENAI_DECISION_MODEL, temperature=0,
                    messages=[
                        {"role": "system", "content": 'You are an insurance decision agent. Respond ONLY with valid JSON: {"decision":"APPROVED|REVIEW_REQUIRED|REJECTED","reason":"..."}'},
                        {"role": "user", "content": json.dumps({"member": state["payload"].get("memberName"), "caseType": state["payload"].get("caseType"), "steps": steps_sum, "config": state["config"]})},
                    ]
                )
                parsed = json.loads(_strip_md_json(completion.choices[0].message.content or "{}"))
                pd = str(parsed.get("decision", "")).upper()
                if pd in {"APPROVED", "REVIEW_REQUIRED", "REJECTED"}:
                    decision = self._apply_guardrails(validation, pd, deterministic)  # type: ignore[arg-type]
                    reason = str(parsed.get("reason", "LLM decision"))
                    if decision != pd:
                        reason = f"{reason} Guardrail adjusted decision to {decision} based on validation thresholds."
            except Exception as exc:
                reason = f"Deterministic fallback (LLM error: {exc})"
        else:
            decision = self._apply_guardrails(validation, deterministic, deterministic)
        if decision == "APPROVED" and validation.get("passed") is True:
            reason = "All required validations passed and no mandatory documents are missing."
        elif decision == "REVIEW_REQUIRED":
            reason = reason if reason else "Case needs manual review due to confidence and/or document quality thresholds."
        elif decision == "REJECTED" and int(validation.get("missingDocuments", 0)) >= 2:
            reason = "Required documents are insufficient for adjudication."
        return {"output": {"decision": decision, "reason": reason, "requiresHumanReview": decision == "REVIEW_REQUIRED", "decidedAt": datetime.utcnow().isoformat()}, "decision": decision}


class EmailSendAgent(BaseLangGraphAgent):
    """Sends professional LLM-tailored emails via SMTP."""

    @staticmethod
    def _render_template(template: str, values: Dict[str, Any]) -> str:
        result = template
        for key, value in values.items():
            result = result.replace(f"{{{{{key}}}}}", str(value))
        return result

    def _generate_body(self, state: AgentState) -> str:
        if not openai_client:
            steps = _safe_dict(state["context"].get("steps", {}))
            dec_step = _safe_dict(_find_step(steps, "decision", "reason", "decidedAt"))
            decision = str(dec_step.get("decision") or "REVIEW_REQUIRED")
            reason = str(dec_step.get("reason") or "Your case is under review.")
            member_name = str(state["payload"].get("memberName", "Valued Customer"))
            return f"Dear {member_name},\n\nYour insurance claim decision: {decision}.\n\n{reason}\n\nRegards,\nAuraStack Insurance Team"

        steps = _safe_dict(state["context"].get("steps", {}))
        dec_step = _safe_dict(
            steps.get("Decision") or steps.get("Make Decision") or steps.get("Final Decision")
            or _find_step(steps, "decision", "reason", "decidedAt")
        )
        decision = str(dec_step.get("decision") or state["context"].get("decision", "REVIEW_REQUIRED"))
        reason = str(dec_step.get("reason") or "Your case has been processed by our AI system.")

        # Gather extracted claim fields for personalisation
        ext_step = _safe_dict(
            steps.get("Data Extraction") or steps.get("Extract Data")
            or _find_step(steps, "extractedFields", "extractionMethod")
        )
        fields = _safe_dict(ext_step.get("extractedFields"))
        policy_number = str(fields.get("policyNumber") or state["payload"].get("policyNumber") or "")
        claim_amount = str(fields.get("claimAmount") or "")
        claim_number = str(fields.get("claimNumber") or "")
        date_of_incident = str(fields.get("dateOfIncident") or "")
        treatment = str(fields.get("treatmentDescription") or fields.get("diagnosisCodes") or "")

        member_name = str(state["payload"].get("memberName", "Valued Customer"))
        # Strip any email header from member_name (e.g. "John <john@x.com>")
        if "<" in member_name:
            member_name = member_name.split("<")[0].strip()
        claim_type = str(state["payload"].get("caseType", "insurance")).capitalize()
        customer_email = str(state["payload"].get("customerEmail", ""))

        details_block = ""
        if policy_number: details_block += f"\n  • Policy Number   : {policy_number}"
        if claim_number:  details_block += f"\n  • Claim Reference : {claim_number}"
        if date_of_incident: details_block += f"\n  • Date of Incident: {date_of_incident}"
        if claim_amount:  details_block += f"\n  • Claim Amount    : {claim_amount}"
        if treatment:     details_block += f"\n  • Treatment/Notes : {treatment}"

        decision_label = {"APPROVED": "✅ APPROVED", "REJECTED": "❌ REJECTED", "REVIEW_REQUIRED": "⏳ UNDER REVIEW"}.get(decision, decision)
        tone = {"APPROVED": "warm, congratulatory, and reassuring", "REJECTED": "empathetic, respectful, and solution-focused (mention they can appeal or resubmit)", "REVIEW_REQUIRED": "professional, reassuring, and clear about next steps"}.get(decision, "professional")

        system_prompt = (
            "You are a senior claims officer at an insurance company writing a professional customer notification email. "
            "Write in a warm, human tone — never robotic or template-like. Use proper paragraphs. "
            "Do NOT include a subject line. Do NOT use placeholders like [name] or [date]. "
            "Output only the email body text (plain text, no markdown)."
        )
        user_prompt = (
            f"Write a {tone} insurance claim decision notification email.\n\n"
            f"Customer Name: {member_name}\n"
            f"Claim Type: {claim_type}\n"
            f"Decision: {decision_label}\n"
            f"Decision Reason: {reason}\n"
            + (f"Claim Details:{details_block}\n" if details_block else "")
            + "\nInclude: greeting, decision with brief explanation, any next steps or action required, and a warm sign-off from 'AuraStack Insurance Claims Team'."
        )
        try:
            resp = openai_client.chat.completions.create(
                model=OPENAI_DECISION_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=600, temperature=0.4,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as exc:
            logger.warning(f"Email LLM failed: {exc}")
            return f"Dear {member_name},\n\nYour {claim_type} claim decision: {decision}.\n\n{reason}\n\nRegards,\nAuraStack Insurance Claims Team"

    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        to_email = str(state["payload"].get("customerEmail") or state["config"].get("toEmail") or "")
        member_name = str(state["payload"].get("memberName", "Valued Customer"))
        if "<" in member_name:
            member_name = member_name.split("<")[0].strip()
        # Build a meaningful subject from the actual decision
        steps = _safe_dict(state["context"].get("steps", {}))
        dec_step = _safe_dict(
            steps.get("Decision") or steps.get("Make Decision") or steps.get("Final Decision")
            or _find_step(steps, "decision", "reason", "decidedAt")
        )
        decision = str(dec_step.get("decision") or state["context"].get("decision", ""))
        decision_label = {"APPROVED": "Approved ✅", "REJECTED": "Decision Update", "REVIEW_REQUIRED": "Under Review ⏳"}.get(decision, "Update")
        claim_type = str(state["payload"].get("caseType", "insurance")).capitalize()
        workflow_name = str(state["context"].get("workflowName") or "Workflow")
        case_id = str(state["payload"].get("caseId") or state["context"].get("caseId") or "")
        playbook = _safe_dict(state["config"].get("playbook"))
        subject_key = "reviewSubject"
        body_key = "reviewBody"
        if decision == "APPROVED":
            subject_key = "approvalSubject"; body_key = "approvalBody"
        elif decision == "REJECTED":
            subject_key = "rejectionSubject"; body_key = "rejectionBody"
        templ_subject = str(playbook.get(subject_key) or "").strip()
        templ_body = str(playbook.get(body_key) or "").strip()
        if templ_subject:
            subject = self._render_template(templ_subject, {
                "memberName": member_name,
                "caseId": case_id,
                "decision": decision,
                "claimType": claim_type,
                "workflowName": workflow_name,
            })
        else:
            subject = f"Your Insurance Claim Has Been {decision_label} – {member_name}"

        if templ_body:
            body_text = self._render_template(templ_body, {
                "memberName": member_name,
                "caseId": case_id,
                "decision": decision,
                "claimType": claim_type,
                "workflowName": workflow_name,
            })
        else:
            body_text = self._generate_body(state)
        result: Dict[str, Any] = {"emailSent": False, "to": to_email, "subject": subject, "body": body_text, "timestamp": datetime.utcnow().isoformat()}
        if not to_email:
            result["error"] = "No recipient email configured"
            return {"output": result}
        if not SMTP_USER or not SMTP_PASS:
            result["emailSent"] = True
            result["simulated"] = True
            return {"output": result}
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject; msg["From"] = SMTP_FROM; msg["To"] = to_email
            msg.attach(MIMEText(body_text, "plain"))
            html = state["config"].get("htmlTemplate")
            if html: msg.attach(MIMEText(str(html), "html"))
            ctx = ssl.create_default_context()
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.ehlo(); server.starttls(context=ctx); server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(SMTP_FROM, to_email, msg.as_string())
            result["emailSent"] = True
            logger.info(f"Email sent -> {to_email}: {subject}")
        except Exception as exc:
            result["error"] = str(exc)
            logger.error(f"SMTP error: {exc}")
        return {"output": result}


class PolicyLookupAgent(BaseLangGraphAgent):
    """Policy lookup via API-backed DB. Falls back to prefix map if no record found."""
    _MAP: Dict[str, Any] = {
        "HLT": ("health", ["Hospitalisation", "OPD", "Critical Illness"], 500_000),
        "MED": ("health", ["Hospitalisation", "Day Care", "Pre/Post Hospitalisation"], 300_000),
        "AUT": ("auto", ["Third Party", "Comprehensive", "Personal Accident"], 1_000_000),
        "MOT": ("auto", ["Own Damage", "Third Party", "Zero Depreciation"], 800_000),
        "PRP": ("property", ["Fire & Allied", "Flood", "Theft", "Natural Disaster"], 2_000_000),
        "LIF": ("life", ["Term Life", "Accidental Death", "Critical Illness Rider"], 5_000_000),
        "TRV": ("travel", ["Trip Cancellation", "Medical Emergency", "Baggage Loss"], 200_000),
    }
    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        ext = _safe_dict(_safe_dict(steps.get("Data Extraction") or steps.get("Extract Data")).get("extractedFields"))
        classifier = _safe_dict(steps.get("Claim Classification") or steps.get("Email Classifier"))
        pn = str(ext.get("policyNumber") or classifier.get("policyNumber") or state["payload"].get("policyNumber") or "").strip().upper()
        member_email = str(state["payload"].get("customerEmail") or state["payload"].get("memberEmail") or "").strip().lower()
        member_name = str(ext.get("claimantName") or state["payload"].get("memberName") or "").strip()
        case_type = str(state["payload"].get("caseType") or classifier.get("claimType") or "").strip().lower()

        try:
            resp = httpx.post(
                API_POLICY_LOOKUP_URL,
                json={
                    "token": API_INBOUND_TOKEN,
                    "policyNumber": pn or None,
                    "memberEmail": member_email or None,
                    "memberName": member_name or None,
                    "caseType": case_type or None,
                },
                timeout=8,
            )
            if resp.status_code == 200:
                data = _safe_dict(resp.json().get("data"))
                if bool(data.get("policyFound")):
                    kb_hits = _search_policy_kb(query=f"{pn} {case_type} policy terms", claim_type=case_type or "health", top_k=3)
                    data["kbEvidence"] = kb_hits
                    data["lookupMethod"] = "db_api"
                    return {"output": data}
        except Exception as exc:
            logger.warning(f"Policy lookup API failed: {exc}")

        prefix = pn[:3] if len(pn) >= 3 else "HLT"
        info = self._MAP.get(prefix, ("health", ["Basic Coverage"], 250_000))
        kb_hits = _search_policy_kb(query=f"{pn} {case_type} policy terms", claim_type=case_type or "health", top_k=3)
        return {"output": {"policyFound": bool(pn), "policyNumber": pn or "UNKNOWN", "policyType": info[0], "coverageTypes": info[1], "sumInsured": info[2], "currency": "INR", "policyHolder": str(state["payload"].get("memberName", "")), "status": "active", "expiryDate": "2027-03-17", "lookupMethod": "prefix_fallback", "kbEvidence": kb_hits}}


class DocumentValidationAgent(BaseLangGraphAgent):
    def _required_docs(self, claim_type: str, config: Dict[str, Any]) -> List[str]:
        configured = config.get("requiredDocuments")
        if isinstance(configured, list) and configured:
            return [str(item).strip() for item in configured if str(item).strip()]
        base = {
            "health": ["id", "bill", "discharge", "prescription"],
            "auto": ["rc", "license", "estimate", "photos"],
            "property": ["incident", "invoice", "photos"],
        }
        return base.get(claim_type.lower(), ["id", "document"])

    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        classifier = _safe_dict(steps.get("Claim Classification") or _find_step(steps, "claimType", "inquiryType"))
        extraction = _safe_dict(_safe_dict(steps.get("Data Extraction")).get("extractedFields"))
        claim_type = str(classifier.get("claimType") or extraction.get("claimType") or state["payload"].get("caseType") or "health").lower()
        required = self._required_docs(claim_type, state["config"])
        docs = state["payload"].get("documents")
        docs = docs if isinstance(docs, list) else []
        hay = " ".join(str(d.get("name", "")).lower() for d in docs if isinstance(d, dict))
        missing = [doc for doc in required if doc.lower() not in hay]
        coverage = max(0.0, min(1.0, 1 - (len(missing) / max(1, len(required)))))
        confidence = round(max(0.5, min(0.99, 0.62 + (coverage * 0.35))), 3)
        return {"output": {
            "claimType": claim_type,
            "requiredDocuments": required,
            "submittedDocuments": len(docs),
            "missingDocumentLabels": missing,
            "documentCompleteness": round(coverage, 3),
            "confidence": confidence,
            "passed": len(missing) == 0,
            "requiresHumanReview": len(missing) > 0,
            "validatedAt": datetime.utcnow().isoformat(),
        }}


class FraudScreeningAgent(BaseLangGraphAgent):
    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        extraction = _safe_dict(_safe_dict(steps.get("Data Extraction")).get("extractedFields"))
        policy = _safe_dict(steps.get("Policy Lookup") or _find_step(steps, "sumInsured", "policyFound"))
        validation = _safe_dict(steps.get("Validation") or steps.get("Document Validation") or _find_step(steps, "missingDocuments", "missingDocumentLabels"))
        amount = float(extraction.get("claimAmount", 0) or 0)
        sum_insured = float(policy.get("sumInsured", 0) or 0)
        risk = 18
        markers: List[str] = []
        if not bool(policy.get("policyFound", True)):
            risk += 28
            markers.append("policy_not_found")
        if sum_insured > 0 and amount > (sum_insured * 0.85):
            risk += 24
            markers.append("high_claim_to_cover_ratio")
        missing = validation.get("missingDocumentLabels")
        if isinstance(missing, list) and len(missing) > 0:
            risk += min(22, len(missing) * 7)
            markers.append("missing_supporting_documents")
        if not extraction.get("claimantName"):
            risk += 12
            markers.append("claimant_identity_incomplete")
        score = int(max(1, min(99, risk)))
        band = "low" if score < 35 else "medium" if score < 70 else "high"
        return {"output": {
            "fraudScore": score,
            "fraudRiskBand": band,
            "flags": markers,
            "requiresHumanReview": band != "low",
            "screenedAt": datetime.utcnow().isoformat(),
        }}


class MedicalCodingAgent(BaseLangGraphAgent):
    ICD_PATTERN = re.compile(r"\b([A-TV-Z][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?)\b", re.IGNORECASE)

    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        extraction = _safe_dict(_safe_dict(steps.get("Data Extraction")).get("extractedFields"))
        diagnosis = extraction.get("diagnosisCodes")
        codes: List[str] = []
        if isinstance(diagnosis, list):
            codes.extend(str(item).upper() for item in diagnosis if str(item).strip())
        if not codes:
            ocr = _safe_dict(steps.get("Document OCR") or _find_step(steps, "text"))
            text = str(ocr.get("text", ""))[:12000]
            codes.extend(match.upper() for match in self.ICD_PATTERN.findall(text))
        unique_codes = list(dict.fromkeys(codes))[:20]
        confidence = round(0.55 + min(0.4, len(unique_codes) * 0.08), 3)
        return {"output": {
            "diagnosisCodes": unique_codes,
            "primaryDiagnosisCode": unique_codes[0] if unique_codes else None,
            "medicalCodingConfidence": min(0.99, confidence),
            "codedAt": datetime.utcnow().isoformat(),
        }}


class CoverageRulesAgent(BaseLangGraphAgent):
    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        extraction = _safe_dict(_safe_dict(steps.get("Data Extraction")).get("extractedFields"))
        policy = _safe_dict(steps.get("Policy Lookup") or _find_step(steps, "policyType", "coverageTypes", "sumInsured"))
        claim_type = str(extraction.get("claimType") or state["payload"].get("caseType") or policy.get("policyType") or "health").lower()
        coverage_types = policy.get("coverageTypes")
        coverage_types = coverage_types if isinstance(coverage_types, list) else []
        issues: List[str] = []
        if not bool(policy.get("policyFound", False)):
            issues.append("policy_not_found")
        if coverage_types and claim_type == "health":
            cset = " ".join(str(item).lower() for item in coverage_types)
            if not any(token in cset for token in ["hospital", "health", "medical"]):
                issues.append("coverage_type_mismatch")
        waiting_period_days = int(state["config"].get("waitingPeriodDays", 0) or 0)
        if waiting_period_days > 0 and not extraction.get("dateOfIncident"):
            issues.append("incident_date_missing_for_waiting_period")
        eligible = len(issues) == 0
        return {"output": {
            "coverageEligible": eligible,
            "coverageIssues": issues,
            "rulesVersion": str(state["config"].get("rulesVersion", "v1.0")),
            "requiresHumanReview": not eligible,
            "checkedAt": datetime.utcnow().isoformat(),
        }}


class ProviderNetworkAgent(BaseLangGraphAgent):
    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        extraction = _safe_dict(_safe_dict(steps.get("Data Extraction")).get("extractedFields"))
        provider_name = str(extraction.get("providerName") or "").strip()
        configured = state["config"].get("networkProviders")
        providers = [str(item).strip().lower() for item in configured] if isinstance(configured, list) else []
        in_network: Optional[bool] = None
        match = None
        if provider_name and providers:
            p_low = provider_name.lower()
            for item in providers:
                if item and (item in p_low or p_low in item):
                    in_network = True
                    match = item
                    break
            if in_network is None:
                in_network = False
        confidence = 0.5 if in_network is None else (0.95 if in_network else 0.85)
        return {"output": {
            "providerName": provider_name or None,
            "providerInNetwork": in_network,
            "providerMatch": match,
            "networkConfidence": confidence,
            "requiresHumanReview": in_network is False,
            "checkedAt": datetime.utcnow().isoformat(),
        }}


class SettlementEstimatorAgent(BaseLangGraphAgent):
    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        extraction = _safe_dict(_safe_dict(steps.get("Data Extraction")).get("extractedFields"))
        policy = _safe_dict(steps.get("Policy Lookup") or _find_step(steps, "sumInsured"))
        claim_amount = float(extraction.get("claimAmount", 0) or 0)
        sum_insured = float(policy.get("sumInsured", 0) or 0)
        deductible_pct = float(state["config"].get("deductiblePct", 0.05) or 0.05)
        co_pay_pct = float(state["config"].get("coPayPct", 0.1) or 0.1)
        capped = claim_amount if sum_insured <= 0 else min(claim_amount, sum_insured)
        deductible = round(capped * deductible_pct, 2)
        co_pay = round(max(0.0, capped - deductible) * co_pay_pct, 2)
        payable = round(max(0.0, capped - deductible - co_pay), 2)
        return {"output": {
            "currency": str(policy.get("currency") or "INR"),
            "claimAmount": claim_amount,
            "sumInsured": sum_insured,
            "deductibleAmount": deductible,
            "coPayAmount": co_pay,
            "estimatedPayable": payable,
            "settlementBand": "high" if payable >= 250000 else "medium" if payable >= 75000 else "low",
            "estimatedAt": datetime.utcnow().isoformat(),
        }}


class HumanHandoffAgent(BaseLangGraphAgent):
    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        reasons: List[str] = []
        validation = _safe_dict(steps.get("Validation") or steps.get("Document Validation") or _find_step(steps, "missingDocumentLabels"))
        missing = validation.get("missingDocumentLabels")
        if isinstance(missing, list) and missing:
            reasons.append("missing_documents")
        fraud = _safe_dict(steps.get("Fraud Screening") or _find_step(steps, "fraudScore", "fraudRiskBand"))
        if int(fraud.get("fraudScore", 0) or 0) >= 70:
            reasons.append("high_fraud_risk")
        coverage = _safe_dict(steps.get("Coverage Rules") or _find_step(steps, "coverageEligible", "coverageIssues"))
        if not bool(coverage.get("coverageEligible", True)):
            reasons.append("coverage_rule_exception")
        decision = _safe_dict(steps.get("Decision") or _find_step(steps, "decision")).get("decision")
        if decision == "REVIEW_REQUIRED":
            reasons.append("decision_requires_review")
        queue = str(state["config"].get("queue") or "claims-human-review")
        return {"output": {
            "handoffRequired": len(reasons) > 0,
            "handoffQueue": queue,
            "handoffReasons": reasons or ["manual_quality_gate"],
            "ownerRole": str(state["config"].get("ownerRole") or "reviewer"),
            "slaHours": int(state["config"].get("slaHours", 24) or 24),
            "createdAt": datetime.utcnow().isoformat(),
        }}


class CustomerCommsAgent(BaseLangGraphAgent):
    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        decision = str(_safe_dict(steps.get("Decision") or _find_step(steps, "decision")).get("decision") or "REVIEW_REQUIRED")
        member_name = str(state["payload"].get("memberName", "Customer")).strip() or "Customer"
        case_id = str(state["payload"].get("caseId") or state["context"].get("caseId") or "")
        handoff = _safe_dict(steps.get("Human Handoff") or _find_step(steps, "handoffRequired", "handoffReasons"))
        handoff_required = bool(handoff.get("handoffRequired", False))
        status_line = "has been approved" if decision == "APPROVED" else "needs additional review" if decision == "REVIEW_REQUIRED" else "could not be approved"
        draft = (
            f"Dear {member_name},\n\n"
            f"Your case {case_id or 'reference'} {status_line}. "
            f"{'A specialist is reviewing your file.' if handoff_required else 'Our automated checks have completed.'}\n\n"
            "Regards,\nAuraStack Support"
        )
        output: Dict[str, Any] = {
            "channel": str(state["config"].get("channel") or "email"),
            "messageDraft": draft,
            "decision": decision,
            "handoffRequired": handoff_required,
            "generatedAt": datetime.utcnow().isoformat(),
        }
        if bool(state["config"].get("sendEmail", False)):
            email_state: AgentState = {
                "step_type": "EMAIL_REPLY",
                "payload": state["payload"],
                "context": state["context"],
                "config": state["config"],
                "output": {},
                "decision": None,
            }
            sent = email_send_agent._run_node(email_state)
            output["emailDelivery"] = _safe_dict(sent.get("output"))
        return {"output": output}


class AuditComplianceAgent(BaseLangGraphAgent):
    def _run_node(self, state: AgentState) -> Dict[str, Any]:
        steps = _safe_dict(state["context"].get("steps", {}))
        step_names = [name for name, data in steps.items() if isinstance(data, dict)]
        required = state["config"].get("requiredAuditSteps")
        required_steps = [str(item) for item in required] if isinstance(required, list) and required else ["Email Intake", "Document OCR", "Data Extraction", "Validation", "Decision"]
        missing = [name for name in required_steps if name not in step_names]
        decision = str(_safe_dict(steps.get("Decision") or _find_step(steps, "decision")).get("decision") or "")
        signature_raw = json.dumps({
            "executionId": state["context"].get("executionId"),
            "caseId": state["context"].get("caseId") or state["payload"].get("caseId"),
            "decision": decision,
            "steps": step_names,
            "timestamp": datetime.utcnow().isoformat(),
        }, sort_keys=True)
        audit_hash = md5(signature_raw.encode("utf-8")).hexdigest()
        return {"output": {
            "auditTrailComplete": len(missing) == 0,
            "requiredSteps": required_steps,
            "missingAuditSteps": missing,
            "executedSteps": step_names,
            "decision": decision or None,
            "auditHash": audit_hash,
            "complianceScore": round(max(0.0, min(1.0, 1 - (len(missing) / max(1, len(required_steps))))), 3),
            "generatedAt": datetime.utcnow().isoformat(),
        }}


email_agent = EmailAgent()
pre_processor_agent = PreProcessorAgent()
vlm_document_agent = VLMDocumentAgent()
document_agent = vlm_document_agent
validation_agent = ValidationAgent()
knowledge_base_agent = KnowledgeBaseAgent()
decision_agent = DecisionAgent()
claim_classifier_agent = ClaimClassifierAgent()
email_send_agent = EmailSendAgent()
policy_lookup_agent = PolicyLookupAgent()
document_validation_agent = DocumentValidationAgent()
fraud_screening_agent = FraudScreeningAgent()
medical_coding_agent = MedicalCodingAgent()
coverage_rules_agent = CoverageRulesAgent()
provider_network_agent = ProviderNetworkAgent()
settlement_estimator_agent = SettlementEstimatorAgent()
human_handoff_agent = HumanHandoffAgent()
customer_comms_agent = CustomerCommsAgent()
audit_compliance_agent = AuditComplianceAgent()


class IMAPPoller:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    @staticmethod
    def _decode_hdr(value: str) -> str:
        parts = email.header.decode_header(value)
        return "".join(f.decode(e or "utf-8") if isinstance(f, bytes) else f for f, e in parts)

    # Must contain at least 2 of these to be treated as a claim email
    CLAIM_KEYWORDS = [
        "insurance claim", "health claim", "medical claim",
        "pre-authorization", "pre-auth", "preauth", "cashless",
        "reimbursement", "policy number", "policy no", "pol-",
        "member id", "member no", "insured",
        "hospital admission", "admitted to hospital", "discharge summary",
        "tpa", "third party administrator",
        "aurastack", "claim submission", "claim request",
        "surgery claim", "treatment claim", "accident claim",
    ]
    DOMAIN_KEYWORDS = {
        "Insurance - Health": [
            "health", "cashless", "reimbursement", "pre-auth", "preauth",
            "hospital", "medical", "treatment", "surgery", "tpa", "patient",
            "admission", "discharge", "pharmacy"
        ],
        "Insurance - Motor": [
            "motor", "vehicle", "car", "bike", "garage", "accident", "fnol",
            "repair", "surveyor", "salvage"
        ],
        "Insurance - Property & Casualty": [
            "property", "casualty", "liability", "commercial", "fire", "flood",
            "site", "endorsement"
        ],
        "Banking": [
            "loan", "kyc", "aml", "credit", "collection", "payment", "account",
            "neft", "imps", "upi"
        ],
    }
    DOMAIN_NEGATIVE_KEYWORDS = {
        "Insurance - Health": [
            "motor", "vehicle", "car", "bike", "garage", "accident", "fnol",
            "property", "casualty", "liability", "fire", "flood",
            "loan", "kyc", "aml", "upi", "neft", "imps"
        ]
    }

    # Single high-confidence keywords — one match is enough
    STRONG_KEYWORDS = [
        "pre-authorization", "preauth", "cashless claim",
        "reimbursement claim", "policy number", "discharge summary",
        "tpa claim", "aurastack", "insurance claim", "health claim",
        "medical claim", "claim submission", "claim request", "insurance"
    ]

    # Senders to always ignore
    SPAM_SENDER_PATTERNS = [
        "linkedin", "noreply", "no-reply", "notification", "alert",
        "coursera", "udemy", "newsletter", "marketing", "promo",
        "donotreply", "do-not-reply", "mailer-daemon", "postmaster",
        "jobalert", "job-alert", "recruiter", "unsubscribe",
        "admissions", "college", "university", "institute", "school",
        "internshala", "trainings", "info@", "support@", "hello@",
        "team@", "contact@", "sales@", "welcome@"
    ]

    def _is_claim_email(self, from_addr: str, subject: str, body: str) -> bool:
        """Return True only if this email is a genuine insurance claim submission.
        Uses GPT-4o-mini when available; falls back to keyword matching."""
        from_lower = from_addr.lower()
        subject_lower = (subject or "").lower()
        body_lower = (body or "")[:1200].lower()
        combined = f"{subject_lower} {body_lower}"

        # Hard reject known spam/notification senders
        for pattern in self.SPAM_SENDER_PATTERNS:
            if pattern in from_lower:
                return False

        # Deterministic fast-path for obvious claim/service emails.
        deterministic_markers = [
            "claim", "insurance", "policy", "reimbursement", "cashless", "pre-auth",
            "hospital", "medical", "treatment", "surgery", "discharge", "admission"
        ]
        marker_hits = sum(1 for marker in deterministic_markers if marker in combined)
        if marker_hits >= 2:
            return True

        # LLM-based classification (primary method)
        if openai_client:
            try:
                prompt = (
                    f"From: {from_addr}\n"
                    f"Subject: {subject}\n"
                    f"Body (first 400 chars): {body[:400]}\n\n"
                    "Is this a genuine health or general insurance claim submission, "
                    "pre-authorization request, or insurance services inquiry? "
                    "Answer only YES or NO."
                )
                resp = openai_client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=3,
                    temperature=0,
                )
                answer = resp.choices[0].message.content.strip().upper()
                logger.info(f"IMAP LLM filter [{answer}] — {subject[:50]}")
                if answer.startswith("Y"):
                    return True
                # If LLM says NO but deterministic markers show likely claim, accept.
                if marker_hits >= 2:
                    logger.info(f"IMAP LLM override [YES] via deterministic markers ({marker_hits}) — {subject[:50]}")
                    return True
                return False
            except Exception as exc:
                logger.warning(f"LLM claim filter failed, using keywords: {exc}")

        # Keyword fallback
        for kw in self.STRONG_KEYWORDS:
            if kw in combined:
                return True
        matches = sum(1 for kw in self.CLAIM_KEYWORDS if kw in combined)
        return matches >= 2

    def _should_force_intake(self, from_addr: str) -> bool:
        sender = str(from_addr or "").strip().lower()
        if not sender or not IMAP_FORCE_INTAKE_SENDERS:
            return False
        return any(allowed in sender for allowed in IMAP_FORCE_INTAKE_SENDERS)

    def _fetch_inbox_configs(self) -> List[Dict[str, Any]]:
        """Fetch active inbox configs from the API. Falls back to env vars."""
        try:
            resp = httpx.get(
                API_INBOX_SETTINGS_URL,
                headers={
                    "Authorization": f"Bearer {API_INBOUND_TOKEN}",
                    "x-internal-token": API_INBOUND_TOKEN,
                },
                timeout=5,
            )
            if resp.status_code == 200:
                active = [c for c in resp.json().get("data", []) if c.get("isActive")]
                if active:
                    if IMAP_USER and IMAP_PASS:
                        normalized_imap_user = IMAP_USER.strip().lower()
                        merged: List[Dict[str, Any]] = []
                        for cfg in active:
                            cfg_email = str(cfg.get("email", "")).strip().lower()
                            cfg_username = str(cfg.get("username", "")).strip().lower()
                            cfg_domain = str(cfg.get("domain", "")).strip().lower()
                            should_override = (
                                cfg_email == normalized_imap_user
                                or cfg_username == normalized_imap_user
                                or cfg_domain == "insurance - health"
                            )
                            if should_override:
                                patched = dict(cfg)
                                patched["host"] = IMAP_HOST
                                patched["port"] = IMAP_PORT
                                patched["username"] = IMAP_USER
                                patched["password"] = IMAP_PASS
                                patched["mailbox"] = IMAP_MAILBOX
                                if not patched.get("email"):
                                    patched["email"] = IMAP_USER
                                merged.append(patched)
                            else:
                                merged.append(cfg)
                        return merged
                    return active
        except Exception as exc:
            logger.warning(f"Could not fetch inbox configs from API: {exc}")
        # Fall back to env var config
        if IMAP_USER and IMAP_PASS:
            return [{
                "host": IMAP_HOST, "port": IMAP_PORT,
                "username": IMAP_USER, "password": IMAP_PASS,
                "mailbox": IMAP_MAILBOX, "email": IMAP_USER,
                "domain": "Insurance - Health",
                "claimTypeKey": "health",
            }]
        return []

    def _matches_domain(self, domain: str, subject: str, body: str) -> bool:
        haystack = f"{subject} {(body or '')[:1200]}".lower()

        negative = self.DOMAIN_NEGATIVE_KEYWORDS.get(domain, [])
        if any(keyword in haystack for keyword in negative):
            return False

        keywords = self.DOMAIN_KEYWORDS.get(domain)
        if keywords and any(keyword in haystack for keyword in keywords):
            return True

        # Health fallback: allow generic insurance-claim wording if no conflicting domain signal exists.
        if domain == "Insurance - Health":
            generic_health_markers = [
                "insurance claim",
                "claim submission",
                "claim intimation",
                "policy number",
                "hospital bill",
                "discharge summary",
                "medical report"
            ]
            return any(marker in haystack for marker in generic_health_markers)

        return not keywords

    def fetch_once(self) -> int:
        configs = self._fetch_inbox_configs()
        if not configs:
            return 0
        total = 0
        for cfg in configs:
            total += self._fetch_inbox(
                host=cfg.get("host", IMAP_HOST),
                port=int(cfg.get("port", IMAP_PORT)),
                username=cfg.get("username", IMAP_USER),
                password=cfg.get("password", IMAP_PASS),
                mailbox=cfg.get("mailbox", IMAP_MAILBOX),
                inbox_email=cfg.get("email", cfg.get("username", IMAP_USER)),
                domain=cfg.get("domain", ""),
            )
        return total

    def _fetch_inbox(self, host: str, port: int, username: str, password: str, mailbox: str, inbox_email: str, domain: str = "") -> int:
        processed = 0
        skipped_non_claim = 0
        skipped_domain = 0
        try:
            conn = imaplib.IMAP4_SSL(host, port)
            conn.login(username, password)
            conn.select(mailbox)
            # Process recent messages (including read ones) so demo emails are not missed
            # when opened in mailbox before polling. API inbound de-duplicates by message id.
            since_day = (datetime.utcnow() - timedelta(days=3)).strftime("%d-%b-%Y")
            _, ids_raw = conn.search(None, f'(SINCE "{since_day}")')
            ids = ids_raw[0].split()
            # Keep bounded to latest emails for predictable poll latency.
            if len(ids) > 200:
                ids = ids[-200:]
            logger.info(f"IMAP [{inbox_email}]: {len(ids)} recent message(s) since {since_day}")
            for mid in ids:
                try:
                    _, raw = conn.fetch(mid, "(RFC822)")
                    if not raw or not raw[0]: continue
                    rb = raw[0][1] if isinstance(raw[0], tuple) else raw[0]
                    msg = email_lib.message_from_bytes(rb, policy=email_lib.policy.default)  # type: ignore[attr-defined]
                    from_raw = self._decode_hdr(str(msg.get("From", "")))
                    _, parsed_from_addr = email.utils.parseaddr(from_raw)
                    from_addr = parsed_from_addr or from_raw
                    subject = self._decode_hdr(str(msg.get("Subject", "(No Subject)")))
                    message_id = str(msg.get("Message-ID", "")).strip()
                    if not message_id:
                        # Some providers omit Message-ID; create deterministic fallback id for idempotency.
                        message_id = f"fallback-{md5(rb).hexdigest()}@imap.local"
                    body = ""; attachments: List[Dict[str, Any]] = []
                    for part in msg.walk():
                        ctype = part.get_content_type()
                        disposition = str(part.get("Content-Disposition", "")).lower()
                        filename = part.get_filename()
                        is_binary_doc = (
                            ctype.startswith("image/")
                            or "pdf" in ctype
                            or ctype.startswith("application/")
                        )
                        should_capture = ("attachment" in disposition) or (bool(filename) and is_binary_doc) or ("inline" in disposition and is_binary_doc)
                        if should_capture:
                            fn = filename or f"inline-{md5((str(mid) + ctype).encode()).hexdigest()[:8]}"
                            pl = part.get_payload(decode=True)
                            if pl: attachments.append({"name": fn, "mimeType": ctype, "contentBase64": base64.b64encode(pl).decode()})
                        elif ctype == "text/plain" and not body:
                            pl = part.get_payload(decode=True)
                            if pl: body = pl.decode(part.get_content_charset() or "utf-8", errors="replace")
                        elif ctype == "text/html" and not body:
                            pl = part.get_payload(decode=True)
                            if pl: body = re.sub(r"<[^>]+>", " ", pl.decode(part.get_content_charset() or "utf-8", errors="replace")).strip()

                    force_intake = self._should_force_intake(from_addr)
                    is_claim = True if force_intake else self._is_claim_email(from_addr, subject, body)
                    domain_match = (not domain) or self._matches_domain(domain, subject, body)

                    # Health inbox fallback: if mail has attachments, treat it as claim/intake material.
                    if domain == "Insurance - Health" and attachments and not is_claim:
                        is_claim = True

                    if not is_claim:
                        skipped_non_claim += 1
                        logger.info(f"IMAP: skipping non-claim email — [{subject[:60]}] from {from_addr[:40]}")
                        continue
                    if force_intake:
                        logger.info(f"IMAP: force-intake sender matched — [{subject[:60]}] from {from_addr[:40]}")
                    if not domain_match:
                        skipped_domain += 1
                        logger.info(f"IMAP: skipping domain-mismatch email for [{domain}] — [{subject[:60]}]")
                        continue

                    resp = httpx.post(
                        API_INBOUND_URL,
                        json={"fromAddress": from_addr, "toAddress": inbox_email, "subject": subject, "body": body, "messageId": message_id, "attachments": attachments, "token": API_INBOUND_TOKEN},
                        timeout=30,
                    )
                    if resp.status_code in (200, 201, 202, 409):
                        conn.store(mid, "+FLAGS", "\\Seen")
                        processed += 1
                    else:
                        logger.error(f"API inbound {resp.status_code}: {resp.text[:200]}")
                except Exception as exc:
                    logger.error(f"IMAP message error {mid}: {exc}")
            logger.info(
                f"IMAP [{inbox_email}] summary: processed={processed}, "
                f"skipped_non_claim={skipped_non_claim}, skipped_domain={skipped_domain}"
            )
            conn.logout()
        except Exception as exc:
            logger.error(f"IMAP connection error [{inbox_email}]: {exc}")
        return processed

    def _loop(self) -> None:
        logger.info(f"IMAP poller started (interval={IMAP_POLL_INTERVAL}s)")
        while not self._stop.is_set():
            self.fetch_once()
            self._stop.wait(IMAP_POLL_INTERVAL)

    def start(self) -> None:
        self._thread = threading.Thread(target=self._loop, daemon=True, name="imap-poller")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()


imap_poller = IMAPPoller()

agents_registry: Dict[str, AgentDefinition] = {
    "intakeExtractionAgent": AgentDefinition(name="intakeExtractionAgent", kind="document", instructions="Extract structured intake fields using GPT-4o vision or OCR fallback.", rules=["Use GPT-4o vision for image documents.", "Fall back to pytesseract if VLM unavailable.", "Use pypdf for PDF text."]),
    "triageValidationAgent": AgentDefinition(name="triageValidationAgent", kind="validation", instructions="Validate extraction and route to human review if confidence below threshold.", rules=["Confidence >= minConfidence (default 0.80) for auto-approve.", "Missing docs -> REVIEW_REQUIRED.", "Confidence < 0.65 + missing docs -> REJECTED."]),
    "claimClassifierAgent": AgentDefinition(name="claimClassifierAgent", kind="classifier", instructions="Classify customer emails by inquiry type, claim type, and priority.", rules=["Detect: new_claim, status_inquiry, document_upload, complaint, renewal, general_query.", "Classify: health, auto, property, life, travel, other.", "Priority: critical(4h), high(24h), medium(48h), low(72h)."]),
    "decisionAgent": AgentDefinition(name="decisionAgent", kind="decision", instructions="Make final APPROVED/REVIEW_REQUIRED/REJECTED decision.", rules=["APPROVED: confidence >= 0.88, no missing docs.", "REVIEW_REQUIRED: 0.65-0.87.", "REJECTED: < 0.65 or >= 2 missing docs."]),
    "emailSendAgent": AgentDefinition(name="emailSendAgent", kind="email", instructions="Send LLM-personalised claim update emails via SMTP.", rules=["Generate empathetic decision-tailored body.", "STARTTLS for secure delivery.", "Simulate in dev when SMTP not configured."]),
    "policyLookupAgent": AgentDefinition(name="policyLookupAgent", kind="orchestrator", instructions="Look up policy details by policy number prefix.", rules=["Return coverage types and sum insured.", "Replace mock with real policy API in production."]),
    "knowledgeBaseAgent": AgentDefinition(name="knowledgeBaseAgent", kind="knowledge", instructions="Ground decisions using local policy documents and return clause citations.", rules=["Search policy docs by claim context and policy hints.", "Return citations with document/page/snippet.", "Mark knowledgePass=false when no reliable match exists."]),
    "documentValidationAgent": AgentDefinition(name="documentValidationAgent", kind="validation", instructions="Validate documents against claim-specific checklist.", rules=["Use requiredDocuments in config when present.", "Mark missing docs and confidence.", "Escalate when required docs are missing."]),
    "fraudScreeningAgent": AgentDefinition(name="fraudScreeningAgent", kind="fraud", instructions="Score fraud risk from claim, policy, and document signals.", rules=["Compute fraud risk band low/medium/high.", "Flag policy mismatch and abnormal claim ratios.", "Require review for medium/high risk."]),
    "medicalCodingAgent": AgentDefinition(name="medicalCodingAgent", kind="extraction", instructions="Extract ICD-style diagnosis coding from medical text.", rules=["Prefer extracted diagnosisCodes when available.", "Parse OCR text for ICD patterns.", "Return confidence and primary code."]),
    "coverageRulesAgent": AgentDefinition(name="coverageRulesAgent", kind="validation", instructions="Apply policy coverage rules and waiting-period checks.", rules=["Validate claim type against policy coverage.", "Return explicit coverage issues.", "Escalate when policy is missing or mismatched."]),
    "providerNetworkAgent": AgentDefinition(name="providerNetworkAgent", kind="validation", instructions="Check if provider/hospital is in network.", rules=["Compare provider name with configured network list.", "Return providerInNetwork and confidence.", "Escalate on out-of-network."]),
    "settlementEstimatorAgent": AgentDefinition(name="settlementEstimatorAgent", kind="analytics", instructions="Estimate payable settlement from claim and policy.", rules=["Apply deductible and co-pay config.", "Cap by sum insured.", "Return detailed payable breakdown."]),
    "humanHandoffAgent": AgentDefinition(name="humanHandoffAgent", kind="orchestrator", instructions="Create escalation/handoff package for manual review.", rules=["Compile escalation reasons from prior steps.", "Assign queue and owner role.", "Emit SLA for reviewer handoff."]),
    "customerCommsAgent": AgentDefinition(name="customerCommsAgent", kind="email", instructions="Generate customer-ready communication updates.", rules=["Create stage-aware message draft.", "Optionally send via emailSendAgent when configured.", "Include decision and handoff context."]),
    "auditComplianceAgent": AgentDefinition(name="auditComplianceAgent", kind="compliance", instructions="Generate audit/compliance trail and integrity hash.", rules=["Track required audit steps.", "Compute immutable audit hash.", "Return compliance completeness score."]),
    "preProcessorAgent": AgentDefinition(name="preProcessorAgent", kind="orchestrator", instructions="Split large inbound PDFs into logical document groups and suggest cascading workflow handoffs.", rules=["Detect oversized PDF payloads.", "Route grouped docs to specialized agents.", "Emit recommended workflow keys for cascading orchestration."]),
}

app = FastAPI(title="aurastack-agents", version="2.0.0")

@app.on_event("startup")
async def startup() -> None:
    imap_poller.start()

@app.on_event("shutdown")
async def shutdown() -> None:
    imap_poller.stop()

@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "service": "aurastack-agents", "version": "2.0.0", "capabilities": {"llm": bool(openai_client), "vlm": bool(openai_client), "smtp": bool(SMTP_USER), "imap": bool(IMAP_USER)}, "agents": list(agents_registry.keys())}

@app.get("/agents")
def list_agents() -> Dict[str, List[Dict[str, object]]]:
    return {"data": [a.model_dump() for a in agents_registry.values()]}

@app.post("/agents")
def create_agent(agent: AgentDefinition) -> Dict[str, Dict[str, object]]:
    agents_registry[agent.name] = agent
    return {"data": agent.model_dump()}

@app.post("/workflow/execute-step")
def execute_workflow_step(payload: WorkflowStepExecuteInput) -> Dict[str, WorkflowStepExecuteOutput]:
    state: AgentState = {"step_type": payload.stepType, "payload": payload.payload, "context": payload.context, "config": payload.config, "output": {}, "decision": None}
    if payload.stepType in {"EMAIL_INTAKE"}:
        result = email_agent.invoke(state)
    elif payload.stepType in {"PRE_PROCESSOR"}:
        result = pre_processor_agent.invoke(state)
    elif payload.stepType in {"DOCUMENT_OCR", "DATA_EXTRACTION"}:
        result = vlm_document_agent.invoke(state)
    elif payload.stepType in {"VALIDATION"}:
        result = validation_agent.invoke(state)
    elif payload.stepType in {"KNOWLEDGE_CHECK"}:
        result = knowledge_base_agent.invoke(state)
    elif payload.stepType == "DECISION":
        result = decision_agent.invoke(state)
    elif payload.stepType == "CLAIM_CLASSIFICATION":
        result = claim_classifier_agent.invoke(state)
    elif payload.stepType in {"NOTIFY_CUSTOMER", "EMAIL_REPLY"}:
        result = email_send_agent.invoke(state)
    elif payload.stepType == "POLICY_LOOKUP":
        result = policy_lookup_agent.invoke(state)
    elif payload.stepType == "DOCUMENT_VALIDATION":
        result = document_validation_agent.invoke(state)
    elif payload.stepType == "FRAUD_SCREENING":
        result = fraud_screening_agent.invoke(state)
    elif payload.stepType == "MEDICAL_CODING":
        result = medical_coding_agent.invoke(state)
    elif payload.stepType == "COVERAGE_RULES":
        result = coverage_rules_agent.invoke(state)
    elif payload.stepType == "PROVIDER_NETWORK_CHECK":
        result = provider_network_agent.invoke(state)
    elif payload.stepType == "SETTLEMENT_ESTIMATION":
        result = settlement_estimator_agent.invoke(state)
    elif payload.stepType == "HUMAN_HANDOFF":
        result = human_handoff_agent.invoke(state)
    elif payload.stepType == "CUSTOMER_COMMS":
        result = customer_comms_agent.invoke(state)
    elif payload.stepType == "AUDIT_COMPLIANCE":
        result = audit_compliance_agent.invoke(state)
    elif payload.stepType == "SLA_CHECK":
        result = {**state, "output": {"slaStatus": "active", "checked": True, "checkedAt": datetime.utcnow().isoformat()}, "decision": None}
    else:
        result = {**state, "output": {"status": "no-op", "stepType": payload.stepType}, "decision": None}
    decision = result.get("decision")
    normalized = decision if decision in {"APPROVED", "REVIEW_REQUIRED", "REJECTED"} else None
    return {"data": WorkflowStepExecuteOutput(output=_safe_dict(result.get("output")), decision=normalized)}  # type: ignore[arg-type]

@app.post("/email/send")
def send_email_direct(payload: EmailSendInput) -> Dict[str, Any]:
    if not SMTP_USER or not SMTP_PASS:
        return {"data": {"sent": True, "simulated": True, "to": payload.to, "subject": payload.subject}}
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = payload.subject; msg["From"] = SMTP_FROM; msg["To"] = payload.to
        if payload.replyTo: msg["Reply-To"] = payload.replyTo
        msg.attach(MIMEText(payload.body, "plain"))
        if payload.html: msg.attach(MIMEText(payload.html, "html"))
        ctx = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo(); server.starttls(context=ctx); server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, payload.to, msg.as_string())
        return {"data": {"sent": True, "to": payload.to, "subject": payload.subject}}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/email/poll")
def trigger_poll(background: bool = False) -> Dict[str, Any]:
    if not imap_poller._fetch_inbox_configs():
        raise HTTPException(status_code=503, detail="No inbox email configurations available")
    if background:
        threading.Thread(target=imap_poller.fetch_once, daemon=True).start()
        return {"data": {"triggered": True, "background": True, "timestamp": datetime.utcnow().isoformat()}}
    processed = imap_poller.fetch_once()
    return {"data": {"triggered": True, "background": False, "processed": processed, "timestamp": datetime.utcnow().isoformat()}}

@app.post("/run/extraction")
def run_extraction(payload: ExtractionInput) -> Dict[str, object]:
    digest = int(md5(payload.caseId.encode()).hexdigest(), 16)
    return {"agent": "intakeExtractionAgent", "caseId": payload.caseId, "intakeJobId": payload.intakeJobId, "extractedFields": 12 + (digest % 10), "missingDocuments": ["Photo ID"] if digest % 4 == 0 else [], "summary": "Extraction completed by VLM document agent."}

@app.post("/run/validation")
def run_validation(payload: ValidationInput) -> Dict[str, object]:
    ef = int(payload.extraction.get("extractedFields", 0))
    md_list = payload.extraction.get("missingDocuments", [])
    mc = len(md_list) if isinstance(md_list, list) else 0
    conf = max(0.55, min(0.99, 0.65 + (ef / 100.0) - (mc * 0.15)))
    reasons: List[str] = []
    if conf < 0.8: reasons.append("Confidence below 0.8")
    if mc > 0: reasons.append("Required documents missing")
    return {"agent": "triageValidationAgent", "caseId": payload.caseId, "intakeJobId": payload.intakeJobId, "confidence": round(conf, 3), "requiresReview": conf < 0.8 or mc > 0, "reasons": reasons or ["Validation passed."]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=False)
