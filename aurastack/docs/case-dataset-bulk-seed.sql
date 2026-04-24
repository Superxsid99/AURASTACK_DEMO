-- AuraStack Bulk Mock Data Seeder (PostgreSQL)
-- Depends on: docs/case-dataset-schema.sql
-- Purpose: Generate realistic demo-scale data for dashboards and timelines.
--
-- Run:
--   psql "$DATABASE_URL" -f docs/case-dataset-bulk-seed.sql
--
-- Notes:
-- 1) This script clears prior seeded demo rows (CAS-SEED-2026-*) before inserting fresh data.
-- 2) It inserts 10,000 cases by default. Change seed_count in params CTE to tune volume.

BEGIN;

-- Remove previous seeded set (safe: scoped by case_code prefix)
DELETE FROM cases WHERE case_code LIKE 'CAS-SEED-2026-%';

WITH params AS (
  SELECT 10000::int AS seed_count
),
case_rows AS (
  SELECT
    gs AS idx,
    ('CAS-SEED-2026-' || lpad(gs::text, 5, '0'))::text AS case_code,
    (ARRAY['banking','health','motor','property','cross_industry'])[1 + (random() * 4)::int] AS domain,
    (ARRAY[
      'omnichannel_routing_v1',
      'hospital_intake_v1',
      'claims_mgmt_v1',
      'medical_uw_v1',
      'compliance_audit_v1',
      'loan_origination_v1',
      'collections_v1',
      'kyc_onboarding_v1'
    ])[1 + (random() * 7)::int] AS workflow_id,
    (ARRAY['new','in_progress','completed','review','rejected'])[1 + (random() * 4)::int] AS status,
    (ARRAY['low','medium','high','critical'])[1 + (random() * 3)::int] AS priority,
    (ARRAY[
      'Seema Agarwal','Rohit Mehta','Anjali Sharma','Sidhant Kumar','Neha Verma',
      'Karan Singh','Pooja Nair','Amit Rao','Meera Iyer','Rahul Khanna'
    ])[1 + (random() * 9)::int] AS customer_name,
    lower('user' || gs || '@claritty.in') AS customer_email,
    ('POL-' || (100000 + gs)::text) AS policy_number,
    (ARRAY[
      'cashless_claim','reimbursement','motor_fnol','renewal_request','kyc_update',
      'loan_application','collection_settlement','regulatory_case'
    ])[1 + (random() * 7)::int] AS claim_type,
    now() - ((random() * 120)::int || ' days')::interval - ((random() * 23)::int || ' hours')::interval AS created_at
  FROM params p
  CROSS JOIN generate_series(1, (SELECT seed_count FROM params)) gs
),
inserted AS (
  INSERT INTO cases (
    case_code, domain, workflow_id, status, priority, customer_name, customer_email, policy_number, claim_type, created_at, updated_at, closed_at
  )
  SELECT
    case_code,
    domain,
    workflow_id,
    status,
    priority,
    customer_name,
    customer_email,
    policy_number,
    claim_type,
    created_at,
    CASE
      WHEN status IN ('completed','rejected') THEN created_at + ((2 + (random() * 72)::int) || ' hours')::interval
      ELSE created_at + ((1 + (random() * 24)::int) || ' hours')::interval
    END AS updated_at,
    CASE
      WHEN status IN ('completed','rejected') THEN created_at + ((4 + (random() * 96)::int) || ' hours')::interval
      ELSE NULL
    END AS closed_at
  FROM case_rows
  RETURNING id, case_code, domain, workflow_id, status, priority, customer_name, customer_email, policy_number, claim_type, created_at, updated_at
),
docs_plan AS (
  SELECT
    i.id AS case_id,
    i.case_code,
    g.doc_no,
    CASE
      WHEN i.domain = 'health' AND g.doc_no = 1 THEN 'discharge-summary-' || replace(i.case_code, 'CAS-SEED-', '') || '.pdf'
      WHEN i.domain = 'health' AND g.doc_no = 2 THEN 'lab-report-' || replace(i.case_code, 'CAS-SEED-', '') || '.pdf'
      WHEN i.domain = 'motor' THEN 'damage-photo-' || g.doc_no || '-' || replace(i.case_code, 'CAS-SEED-', '') || '.jpg'
      WHEN i.domain = 'banking' THEN 'income-proof-' || g.doc_no || '-' || replace(i.case_code, 'CAS-SEED-', '') || '.pdf'
      ELSE 'support-doc-' || g.doc_no || '-' || replace(i.case_code, 'CAS-SEED-', '') || '.pdf'
    END AS file_name,
    CASE
      WHEN i.domain = 'motor' AND g.doc_no <= 3 THEN 'image/jpeg'
      ELSE 'application/pdf'
    END AS file_type,
    (100000 + (random() * 4000000)::bigint) AS file_size_bytes,
    ('s3://aurastack-seed/' || i.case_code || '/doc-' || g.doc_no)::text AS storage_url,
    CASE
      WHEN i.domain = 'health' AND g.doc_no = 1 THEN 34
      WHEN i.domain = 'health' THEN (2 + (random() * 12)::int)
      WHEN i.domain = 'motor' AND g.doc_no <= 3 THEN 1
      ELSE (1 + (random() * 8)::int)
    END AS pages,
    CASE
      WHEN i.domain = 'health' AND g.doc_no = 1 THEN 'discharge'
      WHEN i.domain = 'health' AND g.doc_no = 2 THEN 'lab'
      WHEN i.domain = 'health' THEN 'invoice'
      WHEN i.domain = 'motor' THEN 'incident_photo'
      WHEN i.domain = 'banking' THEN 'policy'
      ELSE 'supporting'
    END AS doc_type,
    CASE
      WHEN random() < 0.04 THEN 'failed'
      WHEN random() < 0.90 THEN 'processed'
      ELSE 'uploaded'
    END AS status,
    i.created_at + ((5 + (random() * 240)::int) || ' minutes')::interval AS created_at
  FROM inserted i
  CROSS JOIN LATERAL generate_series(1, CASE WHEN i.domain = 'health' THEN (3 + (random() * 6)::int) ELSE (1 + (random() * 4)::int) END) g(doc_no)
),
inserted_docs AS (
  INSERT INTO documents (
    case_id, file_name, file_type, file_size_bytes, storage_url, pages, doc_type, status, created_at
  )
  SELECT
    case_id, file_name, file_type, file_size_bytes, storage_url, pages, doc_type, status, created_at
  FROM docs_plan
  RETURNING id, case_id, file_name, file_type, pages, doc_type, status, created_at
),
doc_extractions_plan AS (
  SELECT
    d.id AS document_id,
    CASE WHEN d.file_type = 'application/pdf' THEN 'gpt-5.4' ELSE 'ocr' END AS engine,
    CASE
      WHEN d.doc_type = 'discharge' THEN
        'Discharge summary parsed. Diagnosis: Metastatic Pancreatic Adenocarcinoma. Admission and chemotherapy cycle notes detected.'
      WHEN d.doc_type = 'lab' THEN
        'Lab values extracted. Tumor marker trends and CBC values detected.'
      ELSE
        'Document text extracted and normalized.'
    END AS raw_text,
    jsonb_build_object(
      'documentType', d.doc_type,
      'pages', d.pages,
      'diagnosis', CASE WHEN d.doc_type IN ('discharge','lab') THEN 'Metastatic Pancreatic Adenocarcinoma' ELSE NULL END,
      'provider', CASE WHEN d.doc_type IN ('discharge','lab') THEN 'Apollo Hospitals' ELSE NULL END,
      'icd10', CASE WHEN d.doc_type IN ('discharge','lab') THEN jsonb_build_array('C25.9') ELSE '[]'::jsonb END
    ) AS structured_json,
    CASE
      WHEN d.status = 'failed' THEN round((0.25 + random() * 0.30)::numeric, 4)
      WHEN d.doc_type = 'discharge' THEN round((0.86 + random() * 0.12)::numeric, 4)
      ELSE round((0.72 + random() * 0.25)::numeric, 4)
    END AS confidence,
    d.created_at + ((2 + (random() * 45)::int) || ' minutes')::interval AS created_at
  FROM inserted_docs d
  WHERE d.status IN ('processed','uploaded','failed')
)
INSERT INTO document_extractions (document_id, engine, raw_text, structured_json, confidence, created_at)
SELECT document_id, engine, raw_text, structured_json, confidence, created_at
FROM doc_extractions_plan;

-- Workflow runs + stage runs
WITH seeded_cases AS (
  SELECT id, case_code, workflow_id, status, created_at FROM cases WHERE case_code LIKE 'CAS-SEED-2026-%'
),
wf_runs AS (
  INSERT INTO workflow_runs (case_id, workflow_id, run_status, started_at, ended_at, latency_ms)
  SELECT
    c.id,
    c.workflow_id,
    CASE
      WHEN c.status = 'rejected' THEN 'failed'
      WHEN c.status = 'completed' THEN 'completed'
      WHEN c.status = 'review' THEN 'paused'
      ELSE 'running'
    END AS run_status,
    c.created_at + ((1 + (random() * 20)::int) || ' minutes')::interval AS started_at,
    CASE WHEN c.status IN ('completed','rejected') THEN c.created_at + ((40 + (random() * 600)::int) || ' minutes')::interval ELSE NULL END AS ended_at,
    (20000 + (random() * 450000)::int)::bigint AS latency_ms
  FROM seeded_cases c
  RETURNING id, case_id, workflow_id, run_status, started_at, ended_at
),
stages AS (
  SELECT
    wr.id AS workflow_run_id,
    wr.case_id,
    st.stage_key,
    st.ord,
    CASE
      WHEN wr.run_status = 'failed' AND st.ord >= 4 THEN 'failed'
      WHEN wr.run_status = 'running' AND st.ord >= 4 THEN 'running'
      WHEN wr.run_status = 'paused' AND st.ord >= 5 THEN 'pending'
      ELSE 'completed'
    END AS status,
    wr.started_at + ((st.ord - 1) * 6 || ' minutes')::interval AS started_at,
    CASE
      WHEN wr.run_status = 'running' AND st.ord >= 4 THEN NULL
      WHEN wr.run_status = 'paused' AND st.ord >= 5 THEN NULL
      ELSE wr.started_at + (st.ord * 6 || ' minutes')::interval
    END AS ended_at
  FROM wf_runs wr
  CROSS JOIN LATERAL (
    VALUES
      (1, 'email_intake'),
      (2, 'workflow_routing'),
      (3, 'document_preprocessor'),
      (4, 'document_ocr'),
      (5, 'validation'),
      (6, 'decision'),
      (7, 'notify_customer')
  ) AS st(ord, stage_key)
)
INSERT INTO stage_runs (
  workflow_run_id, stage_key, status, input_json, output_json, started_at, ended_at, error_message
)
SELECT
  s.workflow_run_id,
  s.stage_key,
  s.status,
  jsonb_build_object('caseId', s.case_id, 'stage', s.stage_key),
  jsonb_build_object(
    'result', s.status,
    'notes', CASE WHEN s.stage_key = 'workflow_routing' THEN 'Auto-routed based on intent+document type.' ELSE 'Stage processed.' END
  ),
  s.started_at,
  s.ended_at,
  CASE WHEN s.status = 'failed' THEN 'Simulated stage failure for demo.' ELSE NULL END
FROM stages s;

-- Agent runs
WITH seeded_cases AS (
  SELECT id, case_code, domain, status, created_at FROM cases WHERE case_code LIKE 'CAS-SEED-2026-%'
),
agents_plan AS (
  SELECT
    c.id AS case_id,
    a.ord,
    a.agent_key,
    a.tool_used,
    CASE
      WHEN c.status = 'rejected' AND a.ord >= 5 THEN 'failed'
      WHEN c.status IN ('in_progress','new') AND a.ord >= 5 THEN 'running'
      ELSE 'completed'
    END AS status,
    (1200 + (random() * 6000)::int) AS prompt_tokens,
    (600 + (random() * 4000)::int) AS completion_tokens,
    'gpt-5.4'::text AS model,
    c.created_at + ((a.ord * 5) || ' minutes')::interval AS started_at,
    CASE
      WHEN c.status IN ('in_progress','new') AND a.ord >= 5 THEN NULL
      ELSE c.created_at + ((a.ord * 6 + 1) || ' minutes')::interval
    END AS ended_at
  FROM seeded_cases c
  CROSS JOIN LATERAL (
    VALUES
      (1, 'intake_orchestrator_01', 'email_parser'),
      (2, 'workflow_router_01', 'intent_classifier'),
      (3, 'doc_preprocessor_01', 'pdf_splitter'),
      (4, 'doc_ext_01', 'vision_ocr'),
      (5, 'fraud_det_01', 'risk_engine'),
      (6, 'decision_agent_01', 'policy_rules'),
      (7, 'notify_customer_01', 'smtp_sender')
  ) AS a(ord, agent_key, tool_used)
)
INSERT INTO agent_runs (
  case_id, agent_key, tool_used, status, prompt_tokens, completion_tokens, total_tokens, model, cost_inr, started_at, ended_at, result_json
)
SELECT
  ap.case_id,
  ap.agent_key,
  ap.tool_used,
  ap.status,
  ap.prompt_tokens,
  ap.completion_tokens,
  ap.prompt_tokens + ap.completion_tokens,
  ap.model,
  round(((ap.prompt_tokens + ap.completion_tokens) * 0.00035)::numeric, 4) AS cost_inr,
  ap.started_at,
  ap.ended_at,
  jsonb_build_object(
    'agent', ap.agent_key,
    'status', ap.status,
    'tool', ap.tool_used
  )
FROM agents_plan ap;

-- Communications (incoming + outgoing)
WITH seeded_cases AS (
  SELECT id, case_code, customer_email, customer_name, status, created_at, updated_at
  FROM cases
  WHERE case_code LIKE 'CAS-SEED-2026-%'
),
incoming AS (
  INSERT INTO communications (
    case_id, channel, direction, from_address, to_address, subject, body_text, provider_message_id, thread_id, created_at
  )
  SELECT
    c.id,
    'email',
    'in',
    c.customer_email,
    'claims-intake@aurastack.one',
    'Claim submission for ' || c.case_code,
    'Please find attached claim documents. Policy: ' || coalesce(c.case_code, 'N/A'),
    'msg-in-' || replace(c.case_code, '-', ''),
    'thread-' || replace(c.case_code, '-', ''),
    c.created_at + interval '1 minute'
  FROM seeded_cases c
  RETURNING case_id, thread_id
)
INSERT INTO communications (
  case_id, channel, direction, from_address, to_address, subject, body_text, provider_message_id, thread_id, created_at
)
SELECT
  c.id,
  'email',
  'out',
  'no-reply@aurastack.one',
  c.customer_email,
  CASE
    WHEN c.status = 'completed' THEN 'Your claim has been approved'
    WHEN c.status = 'rejected' THEN 'Claim requires additional review'
    ELSE 'Claim update: processing in progress'
  END,
  CASE
    WHEN c.status = 'completed' THEN 'Your claim has passed all checks and is approved.'
    WHEN c.status = 'rejected' THEN 'We need additional details to proceed.'
    ELSE 'Your claim is being processed. We will update you shortly.'
  END,
  'msg-out-' || replace(c.case_code, '-', ''),
  'thread-' || replace(c.case_code, '-', ''),
  c.updated_at
FROM seeded_cases c;

-- Case events
WITH seeded_cases AS (
  SELECT id, case_code, created_at, updated_at FROM cases WHERE case_code LIKE 'CAS-SEED-2026-%'
),
events_plan AS (
  SELECT id AS case_id, 'email_received'::text AS event_type, 'completed'::text AS event_status, 'email_intake'::text AS stage_key, 'intake_orchestrator_01'::text AS agent_key, created_at + interval '1 minute' AS ts FROM seeded_cases
  UNION ALL
  SELECT id, 'workflow_routed', 'completed', 'workflow_routing', 'workflow_router_01', created_at + interval '4 minutes' FROM seeded_cases
  UNION ALL
  SELECT id, 'ocr_done', 'completed', 'document_ocr', 'doc_ext_01', created_at + interval '14 minutes' FROM seeded_cases
  UNION ALL
  SELECT id, 'decision_made', 'completed', 'decision', 'decision_agent_01', created_at + interval '24 minutes' FROM seeded_cases
  UNION ALL
  SELECT id, 'email_sent', 'completed', 'notify_customer', 'notify_customer_01', updated_at FROM seeded_cases
)
INSERT INTO case_events (case_id, event_type, event_status, stage_key, agent_key, payload_json, created_at)
SELECT
  e.case_id,
  e.event_type,
  e.event_status,
  e.stage_key,
  e.agent_key,
  jsonb_build_object('source', 'bulk_seed', 'event', e.event_type),
  e.ts
FROM events_plan e;

-- Audit logs
INSERT INTO audit_logs (
  actor_type, actor_id, action, resource_type, resource_id, before_json, after_json, ip_address, created_at
)
SELECT
  CASE WHEN random() < 0.65 THEN 'agent' ELSE 'system' END AS actor_type,
  CASE WHEN random() < 0.65 THEN (ARRAY['intake_orchestrator_01','doc_ext_01','decision_agent_01','notify_customer_01'])[1 + (random() * 3)::int] ELSE 'system-daemon' END AS actor_id,
  (ARRAY['CASE_CREATED','DOC_EXTRACTED','WORKFLOW_ROUTED','DECISION_WRITTEN','EMAIL_SENT'])[1 + (random() * 4)::int] AS action,
  'case'::text AS resource_type,
  c.id::text AS resource_id,
  NULL::jsonb AS before_json,
  jsonb_build_object('caseCode', c.case_code, 'domain', c.domain) AS after_json,
  ('10.10.' || (1 + (random() * 200)::int)::text || '.' || (1 + (random() * 200)::int)::text)::inet AS ip_address,
  c.updated_at
FROM cases c
WHERE c.case_code LIKE 'CAS-SEED-2026-%';

COMMIT;

-- Quick checks:
-- SELECT count(*) FROM cases WHERE case_code LIKE 'CAS-SEED-2026-%';
-- SELECT domain, count(*) FROM cases WHERE case_code LIKE 'CAS-SEED-2026-%' GROUP BY domain ORDER BY 2 DESC;
-- SELECT status, count(*) FROM cases WHERE case_code LIKE 'CAS-SEED-2026-%' GROUP BY status ORDER BY 2 DESC;
