-- AuraStack Unified Case Dataset (PostgreSQL)
-- This schema mirrors the structure you shared for operational + historical analytics.
-- Run in pgAdmin/psql on your target database.

-- Optional helpers
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) cases
CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code text UNIQUE NOT NULL,
  domain text NOT NULL, -- banking/health/motor/property/cross_industry
  workflow_id text,
  status text NOT NULL, -- new/in_progress/completed/rejected/review
  priority text NOT NULL, -- low/medium/high/critical
  customer_name text,
  customer_email text,
  policy_number text,
  claim_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cases_domain ON cases(domain);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_workflow_id ON cases(workflow_id);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);

-- 2) case_events (historical timeline)
CREATE TABLE IF NOT EXISTS case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- email_received, ocr_done, decision_made, email_sent...
  event_status text NOT NULL, -- started/completed/failed
  stage_key text,
  agent_key text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_type_status ON case_events(event_type, event_status);
CREATE INDEX IF NOT EXISTS idx_case_events_created_at ON case_events(created_at DESC);

-- 3) documents
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size_bytes bigint,
  storage_url text,
  pages integer,
  doc_type text, -- discharge/invoice/lab/policy/etc
  status text NOT NULL, -- uploaded/processed/failed
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- 4) document_extractions
CREATE TABLE IF NOT EXISTS document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  engine text NOT NULL, -- gpt-5.4/ocr
  raw_text text,
  structured_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(5,4), -- 0.0000 to 1.0000
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_extractions_document_id ON document_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_engine ON document_extractions(engine);

-- 5) workflow_runs
CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  workflow_id text NOT NULL,
  run_status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  latency_ms bigint
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_case_id ON workflow_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at DESC);

-- 6) stage_runs
CREATE TABLE IF NOT EXISTS stage_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  status text NOT NULL,
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_stage_runs_workflow_run_id ON stage_runs(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_stage_runs_stage_key ON stage_runs(stage_key);

-- 7) agent_runs
CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  tool_used text,
  status text NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  model text,
  cost_inr numeric(12,4),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_case_id ON agent_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_key ON agent_runs(agent_key);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at DESC);

-- 8) communications (incoming + outgoing)
CREATE TABLE IF NOT EXISTS communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES cases(id) ON DELETE SET NULL,
  channel text NOT NULL, -- email/chat/webhook
  direction text NOT NULL, -- in/out
  from_address text,
  to_address text,
  subject text,
  body_text text,
  provider_message_id text,
  thread_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communications_case_id ON communications(case_id);
CREATE INDEX IF NOT EXISTS idx_communications_thread_id ON communications(thread_id);
CREATE INDEX IF NOT EXISTS idx_communications_direction ON communications(direction);
CREATE INDEX IF NOT EXISTS idx_communications_created_at ON communications(created_at DESC);

-- 9) audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL, -- user/agent/system
  actor_id text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  before_json jsonb,
  after_json jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Seed (minimal demo row-set)
WITH new_case AS (
  INSERT INTO cases (
    case_code, domain, workflow_id, status, priority, customer_name, customer_email, policy_number, claim_type
  )
  VALUES (
    'CAS-2026-40732', 'health', 'hospital_intake_v1', 'in_progress', 'high',
    'Seema Agarwal', 'seema@example.com', 'POL-HLT-009876', 'cashless_claim'
  )
  ON CONFLICT (case_code) DO UPDATE SET updated_at = now()
  RETURNING id
)
INSERT INTO case_events (case_id, event_type, event_status, stage_key, agent_key, payload_json)
SELECT id, 'email_received', 'completed', 'entry', 'intake_orchestrator_01', '{"source":"imap","attachments":1}'::jsonb
FROM new_case
ON CONFLICT DO NOTHING;

