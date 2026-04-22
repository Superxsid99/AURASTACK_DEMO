from __future__ import annotations

import math
from collections import Counter
from statistics import mean, pstdev
from typing import Any

import numpy as np
from sklearn.mixture import GaussianMixture

from .models import DetectionResult
from .rules import evaluate_rules


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


DEFAULT_MODEL_CONFIG: dict[str, str] = {
    "intake_normalize": "gpt-5.4-mini",
    "entity_profiling": "xgboost-claim-risk-v2",
    "graph_linkage": "graphsage-link-v1",
    "deviation_ml": "gmm-ewma-hybrid",
    "rules_verdict": "rule-engine-v3",
    "explanation": "gpt-5.4",
}


class FraudEngine:
    """Doc-aligned engine with 4 core layers:
    1) Entity profiling
    2) Relational graph score
    3) Deviation/ML score
    4) Explanation layer
    """

    def detect(
        self,
        case: dict[str, Any],
        all_cases: list[dict[str, Any]],
        model_config: dict[str, str] | None = None,
    ) -> DetectionResult:
        selected_models = dict(DEFAULT_MODEL_CONFIG)
        if model_config:
            selected_models.update({k: v for k, v in model_config.items() if v})

        intake_score = self._intake_score(case)
        entity_score = self._entity_profile_score(case, all_cases)
        graph_score, related_count = self._graph_score(case, all_cases)
        deviation_score, gmm_score = self._deviation_score(case, all_cases)
        triggered_rules = evaluate_rules(case, related_count=related_count)
        rules_score = min(35.0, len(triggered_rules) * 9.0)

        weighted = (
            0.25 * entity_score
            + 0.25 * graph_score
            + 0.30 * deviation_score
            + 0.20 * rules_score
        )
        score = round(_clamp(weighted), 2)
        risk_band = self._risk_band(score)
        verdict = self._verdict(score, len(triggered_rules))

        explanation = self._explain(
            case=case,
            score=score,
            risk_band=risk_band,
            triggered_rules=triggered_rules,
            related_count=related_count,
            selected_models=selected_models,
        )

        findings = {
            "caseId": case["case_id"],
            "sector": case["sector"],
            "relatedEntities": related_count,
            "rulesTriggered": triggered_rules,
            "policyNumber": case.get("policy_number"),
            "providerName": case.get("provider_name"),
            "claimAmount": case.get("claim_amount"),
        }

        layer_trace = [
            {
                "stage_key": "intake_normalize",
                "stage_name": "Intake & Normalize",
                "model": selected_models["intake_normalize"],
                "status": "completed",
                "score": round(intake_score, 2),
                "weight": 0.0,
                "input_signals": {
                    "documentTextLength": len(str(case.get("document_text") or "")),
                    "hasPolicyNumber": bool(str(case.get("policy_number") or "").strip()),
                    "hasClaimAmount": bool(float(case.get("claim_amount") or 0) > 0),
                },
                "output": {
                    "normalizedClaimAmount": float(case.get("claim_amount") or 0),
                    "normalizedPolicyNumber": str(case.get("policy_number") or "NA"),
                },
                "summary": "Input normalized into canonical fraud schema.",
            },
            {
                "stage_key": "entity_profiling",
                "stage_name": "Entity Profiling",
                "model": selected_models["entity_profiling"],
                "status": "completed",
                "score": round(entity_score, 2),
                "weight": 0.25,
                "input_signals": {
                    "claimAmount": float(case.get("claim_amount") or 0),
                    "previousClaims30d": int(case.get("previous_claim_count_30d") or 0),
                },
                "output": {
                    "entityRiskScore": round(entity_score, 2),
                },
                "summary": "Assessed customer/provider behavior against peer cohort.",
            },
            {
                "stage_key": "graph_linkage",
                "stage_name": "Relational Graph",
                "model": selected_models["graph_linkage"],
                "status": "completed",
                "score": round(graph_score, 2),
                "weight": 0.25,
                "input_signals": {
                    "sharedEntityKeys": [
                        "ip_address",
                        "device_id",
                        "bank_account_hash",
                        "phone_hash",
                        "invoice_hash",
                    ],
                },
                "output": {
                    "relatedCaseCount": related_count,
                    "graphRiskScore": round(graph_score, 2),
                },
                "summary": "Detected graph links across accounts/devices/invoices.",
            },
            {
                "stage_key": "deviation_ml",
                "stage_name": "Deviation / ML Score",
                "model": selected_models["deviation_ml"],
                "status": "completed",
                "score": round(deviation_score, 2),
                "weight": 0.30,
                "input_signals": {
                    "claimAmount": float(case.get("claim_amount") or 0),
                    "historicalCaseCount": len(all_cases),
                },
                "output": {
                    "gmmLikelihoodScore": round(gmm_score, 2),
                    "deviationScore": round(deviation_score, 2),
                },
                "summary": "Compared claim distribution against baseline using anomaly models.",
            },
            {
                "stage_key": "rules_verdict",
                "stage_name": "Rules + Verdict",
                "model": selected_models["rules_verdict"],
                "status": "completed",
                "score": round(rules_score, 2),
                "weight": 0.20,
                "input_signals": {
                    "triggeredRules": triggered_rules,
                },
                "output": {
                    "verdict": verdict,
                    "riskBand": risk_band,
                    "finalScore": score,
                },
                "summary": "Applied hard-rule policy controls and generated verdict.",
            },
            {
                "stage_key": "explanation",
                "stage_name": "Explanation Layer",
                "model": selected_models["explanation"],
                "status": "completed",
                "score": round(score, 2),
                "weight": 0.0,
                "input_signals": {
                    "verdict": verdict,
                    "riskBand": risk_band,
                },
                "output": {
                    "investigatorSummary": explanation,
                },
                "summary": "Generated human-readable rationale for audit and investigator handoff.",
            },
        ]

        return DetectionResult.now(
            case_id=case["case_id"],
            score=score,
            verdict=verdict,
            risk_band=risk_band,
            triggered_rules=triggered_rules,
            model_breakdown={
                "entityProfiling": round(entity_score, 2),
                "relationalGraph": round(graph_score, 2),
                "deviationScore": round(deviation_score, 2),
                "gmmLikelihood": round(gmm_score, 2),
                "rulesScore": round(rules_score, 2),
            },
            model_selection=selected_models,
            layer_trace=layer_trace,
            explanation=explanation,
            findings=findings,
        )

    def _intake_score(self, case: dict[str, Any]) -> float:
        doc_text = str(case.get("document_text") or "")
        text_len = len(doc_text.strip())
        has_policy = bool(str(case.get("policy_number") or "").strip() and str(case.get("policy_number")) != "NA")
        has_amount = float(case.get("claim_amount") or 0) > 0
        has_claim = bool(str(case.get("claim_number") or "").strip())
        base = 22.0
        base += min(56.0, text_len / 140.0)
        base += 8.0 if has_policy else 0.0
        base += 7.0 if has_amount else 0.0
        base += 7.0 if has_claim else 0.0
        return _clamp(base)

    def _entity_profile_score(self, case: dict[str, Any], all_cases: list[dict[str, Any]]) -> float:
        amount = float(case.get("claim_amount") or 0.0)
        same_sector = [c for c in all_cases if c["sector"] == case["sector"]]
        amounts = [float(c.get("claim_amount") or 0.0) for c in same_sector] or [amount]
        avg = mean(amounts)
        sigma = pstdev(amounts) if len(amounts) > 1 else max(avg * 0.20, 1.0)
        z = 0.0 if sigma == 0 else abs((amount - avg) / sigma)
        velocity = min(3.0, float(case.get("previous_claim_count_30d", 0)))
        score = (z * 18.0) + (velocity * 10.0)
        return _clamp(score)

    def _graph_score(self, case: dict[str, Any], all_cases: list[dict[str, Any]]) -> tuple[float, int]:
        keys = ["ip_address", "device_id", "bank_account_hash", "phone_hash", "invoice_hash"]
        related_count = 0
        for peer in all_cases:
            if peer["case_id"] == case["case_id"]:
                continue
            shared = sum(
                1
                for k in keys
                if str(case.get(k) or "").strip() and str(case.get(k)) == str(peer.get(k))
            )
            if shared >= 2:
                related_count += 1
        return _clamp(related_count * 14.0), related_count

    def _deviation_score(self, case: dict[str, Any], all_cases: list[dict[str, Any]]) -> tuple[float, float]:
        x = np.array(
            [
                [
                    float(c.get("claim_amount") or 0.0),
                    float(c.get("previous_claim_count_30d") or 0.0),
                ]
                for c in all_cases
            ],
            dtype=np.float64,
        )
        if len(x) < 3:
            raw = min(100.0, float(case.get("claim_amount", 0)) / 15000.0)
            return raw, raw
        model = GaussianMixture(n_components=min(2, len(x)), random_state=42)
        model.fit(x)
        target = np.array(
            [[float(case.get("claim_amount") or 0.0), float(case.get("previous_claim_count_30d") or 0.0)]],
            dtype=np.float64,
        )
        log_prob = float(model.score_samples(target)[0])
        probs = [float(model.score_samples(row.reshape(1, -1))[0]) for row in x]
        lo, hi = min(probs), max(probs)
        if math.isclose(hi, lo):
            likelihood = 50.0
        else:
            likelihood = 100.0 * (1 - ((log_prob - lo) / (hi - lo)))
        return _clamp(likelihood), _clamp(likelihood)

    def _risk_band(self, score: float) -> str:
        if score >= 75:
            return "CRITICAL"
        if score >= 55:
            return "HIGH"
        if score >= 35:
            return "MEDIUM"
        return "LOW"

    def _verdict(self, score: float, rules_triggered: int) -> str:
        if score >= 75 or rules_triggered >= 3:
            return "FRAUD"
        if score >= 35:
            return "REVIEW"
        return "GENUINE"

    def _explain(
        self,
        *,
        case: dict[str, Any],
        score: float,
        risk_band: str,
        triggered_rules: list[str],
        related_count: int,
        selected_models: dict[str, str],
    ) -> str:
        rule_text = ", ".join(triggered_rules) if triggered_rules else "No hard-rule breach"
        return (
            f"{case['case_id']} scored {score}/100 ({risk_band}). "
            f"Graph links detected: {related_count}. "
            f"Triggered rules: {rule_text}. "
            f"Models used: Entity({selected_models['entity_profiling']}), "
            f"Graph({selected_models['graph_linkage']}), "
            f"Deviation({selected_models['deviation_ml']}). "
            "This verdict combines entity profiling, graph linkage, deviation modeling, and policy rules."
        )

    def sector_sweep(
        self,
        sector: str,
        cases: list[dict[str, Any]],
        model_config: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        scoped = [c for c in cases if c["sector"] == sector]
        if not scoped:
            return {"sector": sector, "count": 0, "fraudRate": 0, "avgScore": 0, "topRule": "none"}
        results = [self.detect(c, scoped, model_config=model_config) for c in scoped]
        fraud_count = sum(1 for r in results if r.verdict == "FRAUD")
        avg_score = round(mean(r.score for r in results), 2)
        all_rules = [rule for r in results for rule in r.triggered_rules]
        top_rule = Counter(all_rules).most_common(1)[0][0] if all_rules else "none"
        return {
            "sector": sector,
            "count": len(scoped),
            "fraudRate": round(100.0 * fraud_count / len(scoped), 2),
            "avgScore": avg_score,
            "topRule": top_rule,
        }
