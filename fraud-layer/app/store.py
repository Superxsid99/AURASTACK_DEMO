from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from .models import DetectionResult, FraudCase
from .sample_data import seeded_cases


class FraudStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS cases (
                    case_id TEXT PRIMARY KEY,
                    sector TEXT NOT NULL,
                    customer_id TEXT,
                    customer_name TEXT,
                    provider_name TEXT,
                    policy_number TEXT,
                    claim_number TEXT,
                    claim_amount REAL,
                    diagnosis_code TEXT,
                    procedure_code TEXT,
                    treatment_date TEXT,
                    submitted_at TEXT,
                    ip_address TEXT,
                    device_id TEXT,
                    bank_account_hash TEXT,
                    phone_hash TEXT,
                    previous_claim_count_30d INTEGER,
                    invoice_hash TEXT,
                    document_text TEXT,
                    is_known_fraud INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS detections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_id TEXT NOT NULL,
                    score REAL NOT NULL,
                    verdict TEXT NOT NULL,
                    risk_band TEXT NOT NULL,
                    triggered_rules_json TEXT NOT NULL,
                    model_breakdown_json TEXT NOT NULL,
                    explanation TEXT NOT NULL,
                    findings_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS model_configs (
                    stage_key TEXT PRIMARY KEY,
                    model_name TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            self._ensure_detection_columns(conn)
            existing = conn.execute("SELECT COUNT(*) AS c FROM cases").fetchone()["c"]
            if existing == 0:
                for c in seeded_cases():
                    self.insert_case(c)
            self._seed_default_model_configs(conn)

    def _ensure_detection_columns(self, conn: sqlite3.Connection) -> None:
        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(detections)").fetchall()
        }
        if "model_selection_json" not in columns:
            conn.execute("ALTER TABLE detections ADD COLUMN model_selection_json TEXT NOT NULL DEFAULT '{}'")
        if "layer_trace_json" not in columns:
            conn.execute("ALTER TABLE detections ADD COLUMN layer_trace_json TEXT NOT NULL DEFAULT '[]'")

    def _seed_default_model_configs(self, conn: sqlite3.Connection) -> None:
        defaults = {
            "intake_normalize": "gpt-5.4-mini",
            "entity_profiling": "xgboost-claim-risk-v2",
            "graph_linkage": "graphsage-link-v1",
            "deviation_ml": "gmm-ewma-hybrid",
            "rules_verdict": "rule-engine-v3",
            "explanation": "gpt-5.4",
        }
        now = datetime.utcnow().isoformat()
        for stage_key, model_name in defaults.items():
            conn.execute(
                """
                INSERT OR IGNORE INTO model_configs (stage_key, model_name, updated_at)
                VALUES (?, ?, ?)
                """,
                (stage_key, model_name, now),
            )

    def insert_case(self, case: FraudCase) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO cases (
                  case_id, sector, customer_id, customer_name, provider_name, policy_number, claim_number,
                  claim_amount, diagnosis_code, procedure_code, treatment_date, submitted_at,
                  ip_address, device_id, bank_account_hash, phone_hash, previous_claim_count_30d,
                  invoice_hash, document_text, is_known_fraud
                ) VALUES (
                  :case_id, :sector, :customer_id, :customer_name, :provider_name, :policy_number, :claim_number,
                  :claim_amount, :diagnosis_code, :procedure_code, :treatment_date, :submitted_at,
                  :ip_address, :device_id, :bank_account_hash, :phone_hash, :previous_claim_count_30d,
                  :invoice_hash, :document_text, :is_known_fraud
                )
                """,
                case.__dict__,
            )

    def list_cases(self, sector: str | None = None) -> list[dict[str, Any]]:
        with self._conn() as conn:
            if sector:
                rows = conn.execute(
                    "SELECT * FROM cases WHERE sector=? ORDER BY submitted_at DESC", (sector,)
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM cases ORDER BY submitted_at DESC").fetchall()
            return [dict(r) for r in rows]

    def get_case(self, case_id: str) -> dict[str, Any] | None:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM cases WHERE case_id=?", (case_id,)).fetchone()
            return dict(row) if row else None

    def insert_detection(self, detection: DetectionResult) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO detections (
                  case_id, score, verdict, risk_band, triggered_rules_json, model_breakdown_json,
                  model_selection_json, layer_trace_json, explanation, findings_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    detection.case_id,
                    detection.score,
                    detection.verdict,
                    detection.risk_band,
                    json.dumps(detection.triggered_rules),
                    json.dumps(detection.model_breakdown),
                    json.dumps(detection.model_selection),
                    json.dumps(detection.layer_trace),
                    detection.explanation,
                    json.dumps(detection.findings),
                    detection.created_at,
                ),
            )

    def latest_detection(self, case_id: str) -> dict[str, Any] | None:
        with self._conn() as conn:
            row = conn.execute(
                """
                SELECT * FROM detections WHERE case_id=? ORDER BY id DESC LIMIT 1
                """,
                (case_id,),
            ).fetchone()
            if not row:
                return None
            payload = dict(row)
            payload["triggered_rules"] = json.loads(payload.pop("triggered_rules_json"))
            payload["model_breakdown"] = json.loads(payload.pop("model_breakdown_json"))
            payload["model_selection"] = json.loads(payload.pop("model_selection_json", "{}"))
            payload["layer_trace"] = json.loads(payload.pop("layer_trace_json", "[]"))
            payload["findings"] = json.loads(payload.pop("findings_json"))
            return payload

    def get_model_configs(self) -> dict[str, str]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT stage_key, model_name FROM model_configs ORDER BY stage_key"
            ).fetchall()
            return {row["stage_key"]: row["model_name"] for row in rows}

    def save_model_configs(self, payload: dict[str, str]) -> dict[str, str]:
        now = datetime.utcnow().isoformat()
        with self._conn() as conn:
            for stage_key, model_name in payload.items():
                conn.execute(
                    """
                    INSERT INTO model_configs(stage_key, model_name, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(stage_key) DO UPDATE SET
                      model_name=excluded.model_name,
                      updated_at=excluded.updated_at
                    """,
                    (stage_key, model_name, now),
                )
        return self.get_model_configs()
