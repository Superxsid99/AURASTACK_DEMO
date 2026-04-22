from __future__ import annotations

from typing import Any


INSURANCE_RULES = [
    {
        "key": "INS_DUPLICATE_CLAIM",
        "name": "Duplicate Claim Submission",
        "severity": "HIGH",
        "description": "Same treatment window and invoice details submitted across multiple claims.",
    },
    {
        "key": "INS_UPCODING_UNBUNDLING",
        "name": "Provider Upcoding / Unbundling",
        "severity": "CRITICAL",
        "description": "Procedure and billing pattern exceeds diagnosis norms and regional baselines.",
    },
    {
        "key": "INS_WAITING_PERIOD",
        "name": "Coverage Eligibility Breach",
        "severity": "HIGH",
        "description": "Claim falls within waiting period or excluded condition window.",
    },
    {
        "key": "INS_DOC_TAMPER",
        "name": "Document Forgery / Tampering",
        "severity": "CRITICAL",
        "description": "Metadata mismatch, OCR inconsistency, or signature irregularity detected.",
    },
]


BANKING_RULES = [
    {
        "key": "BNK_ACCOUNT_TAKEOVER",
        "name": "Account Takeover Pattern",
        "severity": "CRITICAL",
        "description": "Unusual device + IP + velocity signature for same account profile.",
    },
    {
        "key": "BNK_MULE_NETWORK",
        "name": "Mule Network Link",
        "severity": "HIGH",
        "description": "Shared destination accounts and circular transfer behavior detected.",
    },
    {
        "key": "BNK_SYNTHETIC_KYC",
        "name": "Synthetic Identity Indicators",
        "severity": "HIGH",
        "description": "KYC fields inconsistent with historical profile and bureau references.",
    },
]


def all_rules(sector: str) -> list[dict[str, str]]:
    if sector == "banking":
        return BANKING_RULES
    return INSURANCE_RULES


def evaluate_rules(case: dict[str, Any], related_count: int) -> list[str]:
    triggered: list[str] = []
    amount = float(case.get("claim_amount", 0) or 0)
    prev_claims = int(case.get("previous_claim_count_30d", 0) or 0)
    invoice_hash = str(case.get("invoice_hash", "")).strip()
    doc_text = str(case.get("document_text", "")).lower()

    if case.get("sector") == "insurance":
        if related_count >= 1 and invoice_hash:
            triggered.append("INS_DUPLICATE_CLAIM")
        if amount > 450000 and ("abrasive billing" in doc_text or "misc fee" in doc_text):
            triggered.append("INS_UPCODING_UNBUNDLING")
        if "waiting period" in doc_text or "pre-existing" in doc_text:
            triggered.append("INS_WAITING_PERIOD")
        if "tampered" in doc_text or "modified pdf" in doc_text or "signature mismatch" in doc_text:
            triggered.append("INS_DOC_TAMPER")
    else:
        if prev_claims >= 3 and related_count >= 2:
            triggered.append("BNK_ACCOUNT_TAKEOVER")
        if related_count >= 3:
            triggered.append("BNK_MULE_NETWORK")
        if "synthetic" in doc_text or "kyc mismatch" in doc_text:
            triggered.append("BNK_SYNTHETIC_KYC")
    return triggered

