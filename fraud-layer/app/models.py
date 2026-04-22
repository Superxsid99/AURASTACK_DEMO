from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class FraudCase:
    case_id: str
    sector: str
    customer_id: str
    customer_name: str
    provider_name: str
    policy_number: str
    claim_number: str
    claim_amount: float
    diagnosis_code: str
    procedure_code: str
    treatment_date: str
    submitted_at: str
    ip_address: str
    device_id: str
    bank_account_hash: str
    phone_hash: str
    previous_claim_count_30d: int
    invoice_hash: str
    document_text: str
    is_known_fraud: int = 0


@dataclass
class DetectionResult:
    case_id: str
    score: float
    verdict: str
    risk_band: str
    triggered_rules: list[str]
    model_breakdown: dict[str, float]
    model_selection: dict[str, str]
    layer_trace: list[dict[str, Any]]
    explanation: str
    findings: dict[str, Any]
    created_at: str

    @classmethod
    def now(
        cls,
        *,
        case_id: str,
        score: float,
        verdict: str,
        risk_band: str,
        triggered_rules: list[str],
        model_breakdown: dict[str, float],
        model_selection: dict[str, str],
        layer_trace: list[dict[str, Any]],
        explanation: str,
        findings: dict[str, Any],
    ) -> "DetectionResult":
        return cls(
            case_id=case_id,
            score=score,
            verdict=verdict,
            risk_band=risk_band,
            triggered_rules=triggered_rules,
            model_breakdown=model_breakdown,
            model_selection=model_selection,
            layer_trace=layer_trace,
            explanation=explanation,
            findings=findings,
            created_at=datetime.utcnow().isoformat(),
        )
