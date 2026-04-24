-- AuraStack BFSI Demo Seeder (ratio-controlled)
-- Depends on:
--   1) docs/case-dataset-schema.sql
--
-- Goal:
--   Seed "presentation-grade" data with realistic inefficiencies:
--   - Non-perfect STP
--   - Meaningful review/reject buckets
--   - Fraud false positives
--   - SLA breaches in controlled % range
--
-- Run:
--   psql "$DATABASE_URL" -f docs/case-dataset-bfsi-demo-seed.sql

BEGIN;

-- Clean previous BFSI demo set only
DELETE FROM cases WHERE case_code LIKE 'CAS-BFSI-2026-%';

WITH params AS (
  SELECT 3200::int AS n
),
base AS (
  SELECT
    gs AS idx,
    ('CAS-BFSI-2026-' || lpad(gs::text, 5, '0'))::text AS case_code,
    -- domain distribution: Banking 36%, Health 30%, Motor 16%, Property 10%, Cross 8%
    CASE
      WHEN r1 < 0.36 THEN 'banking'
      WHEN r1 < 0.66 THEN 'health'
      WHEN r1 < 0.82 THEN 'motor'
      WHEN r1 < 0.92 THEN 'property'
      ELSE 'cross_industry'
    END AS domain,
    now() - ((random() * 30)::int || ' days')::interval - ((random() * 20)::int || ' hours')::interval AS created_at,
    random() AS rr_status,
    random() AS rr_priority,
    random() AS rr_sla,
    random() AS rr_quality
  FROM params p
  CROSS JOIN generate_series(1, (SELECT n FROM params)) gs
  CROSS JOIN LATERAL (SELECT random() AS r1) rand
),
cases_planned AS (
  SELECT
    idx,
    case_code,
    domain,
    CASE
      WHEN domain = 'banking' THEN
        (ARRAY['loan_origination_v1','credit_underwriting_v1','collections_v1','payments_v1','aml_monitoring_v1'])[1 + (random() * 4)::int]
      WHEN domain = 'health' THEN
        (ARRAY['cashless_claims_v1','reimbursement_claims_v1','hospital_intake_v1','tpa_coordination_v1'])[1 + (random() * 3)::int]
      WHEN domain = 'motor' THEN
        (ARRAY['motor_claims_v1','surveyor_assignment_v1','salvage_recovery_v1'])[1 + (random() * 2)::int]
      WHEN domain = 'property' THEN
        (ARRAY['property_claims_v1','liability_claims_v1','commercial_underwriting_v1'])[1 + (random() * 2)::int]
      ELSE
        (ARRAY['document_processing_v1','reg_reporting_v1','agent_sla_monitoring_v1'])[1 + (random() * 2)::int]
    END AS workflow_id,
    -- status buckets with non-perfect outcomes
    CASE
      WHEN rr_status < 0.58 THEN 'completed'
      WHEN rr_status < 0.81 THEN 'in_progress'
      WHEN rr_status < 0.93 THEN 'review'
      WHEN rr_status < 0.98 THEN 'new'
      ELSE 'rejected'
    END AS status,
    CASE
      WHEN rr_priority < 0.53 THEN 'medium'
      WHEN rr_priority < 0.76 THEN 'high'
      WHEN rr_priority < 0.93 THEN 'low'
      ELSE 'critical'
    END AS priority,
    (ARRAY[
      'Seema Agarwal','Rahul Verma','Priya Nair','Amit Shah','Nisha Rao',
      'Arjun Singh','Sidhant Kumar','Kiran Iyer','Mehul Patel','Ananya Das'
    ])[1 + (random() * 9)::int] AS customer_name,
    lower('demo' || idx || '@claritty.in') AS customer_email,
    ('POL-' || (200000 + idx)::text) AS policy_number,
    CASE
      WHEN domain = 'banking' THEN (ARRAY['loan_application','kyc_update','delinquency','payment_issue'])[1 + (random() * 3)::int]
      WHEN domain = 'health' THEN (ARRAY['cashless_claim','reimbursement','preauth','appeal'])[1 + (random() * 3)::int]
      WHEN domain = 'motor' THEN (ARRAY['fnol','garage_assessment','settlement'])[1 + (random() * 2)::int]
      WHEN domain = 'property' THEN (ARRAY['property_claim','liability_notice','survey_request'])[1 + (random() * 2)::int]
      ELSE (ARRAY['doc_processing','regulatory_reporting','sla_review'])[1 + (random() * 2)::int]
    END AS claim_type,
    created_at,
    rr_sla,
    rr_quality
  FROM base
),
inserted_cases AS (
  INSERT INTO cases (
    case_code, domain, workflow_id, status, priority,
    customer_name, customer_email, policy_number, claim_type,
    created_at, updated_at, closed_at
  )
  SELECT
    case_code, domain, workflow_id, status, priority,
    customer_name, customer_email, policy_number, claim_type,
    created_at,
    created_at + ((2 + (random() * 72)::int) || ' hours')::interval,
    CASE WHEN status IN ('completed','rejected') THEN created_at + ((6 + (random() * 96)::int) || ' hours')::interval ELSE NULL END
  FROM cases_planned
  RETURNING id, case_code, domain, workflow_id, status, priority, customer_email, created_at, updated_at
),
docs_plan AS (
  SELECT
    c.id AS case_id,
    d.doc_no,
    CASE
      WHEN c.domain = 'health' AND d.doc_no = 1 THEN 'discharge-summary-' || replace(c.case_code, 'CAS-BFSI-', '') || '.pdf'
      WHEN c.domain = 'health' AND d.doc_no = 2 THEN 'hospital-invoice-' || replace(c.case_code, 'CAS-BFSI-', '') || '.pdf'
      WHEN c.domain = 'motor' THEN 'damage-photo-' || d.doc_no || '-' || replace(c.case_code, 'CAS-BFSI-', '') || '.jpg'
      WHEN c.domain = 'banking' THEN 'income-statement-' || d.doc_no || '-' || replace(c.case_code, 'CAS-BFSI-', '') || '.pdf'
      ELSE 'supporting-doc-' || d.doc_no || '-' || replace(c.case_code, 'CAS-BFSI-', '') || '.pdf'
    END AS file_name,
    CASE WHEN c.domain = 'motor' AND d.doc_no <= 3 THEN 'image/jpeg' ELSE 'application/pdf' END AS file_type,
    (120000 + (random() * 2500000)::bigint) AS file_size_bytes,
    ('s3://aurastack-bfsi/' || c.case_code || '/doc-' || d.doc_no)::text AS storage_url,
    CASE
      WHEN c.domain = 'health' AND d.doc_no = 1 THEN 34
      WHEN c.domain = 'health' THEN (2 + (random() * 10)::int)
      WHEN c.domain = 'banking' THEN (1 + (random() * 6)::int)
      ELSE (1 + (random() * 4)::int)
    END AS pages,
    CASE
      WHEN c.domain = 'health' AND d.doc_no = 1 THEN 'discharge'
      WHEN c.domain = 'health' AND d.doc_no = 2 THEN 'invoice'
      WHEN c.domain = 'motor' THEN 'incident_photo'
      WHEN c.domain = 'banking' THEN 'policy'
      ELSE 'supporting'
    END AS doc_type,
    -- STP around ~78-83 depending on domain
    CASE
      WHEN random() < 0.11 THEN 'failed'
      WHEN random() < 0.80 THEN 'processed'
      ELSE 'uploaded'
    END AS status,
    c.created_at + ((3 + (random() * 160)::int) || ' minutes')::interval AS created_at
  FROM inserted_cases c
  CROSS JOIN LATERAL generate_series(1, CASE WHEN c.domain = 'health' THEN (4 + (random() * 6)::int) ELSE (2 + (random() * 4)::int) END) d(doc_no)
),
inserted_docs AS (
  INSERT INTO documents (
    case_id, file_name, file_type, file_size_bytes, storage_url, pages, doc_type, status, created_at
  )
  SELECT case_id, file_name, file_type, file_size_bytes, storage_url, pages, doc_type, status, created_at
  FROM docs_plan
  RETURNING id, case_id, file_name, file_type, pages, doc_type, status, created_at
),
inserted_extractions AS (
  INSERT INTO document_extractions (document_id, engine, raw_text, structured_json, confidence, created_at)
  SELECT
    d.id,
    CASE WHEN d.file_type = 'application/pdf' THEN 'gpt-5.4' ELSE 'ocr' END,
    CASE
      WHEN d.doc_type = 'discharge' THEN 'Discharge summary parsed across full pages. Admission, discharge, diagnosis, chemo cycles extracted.'
      WHEN d.doc_type = 'invoice' THEN 'Invoice and line items extracted for adjudication.'
      ELSE 'Text extracted and normalized.'
    END,
    jsonb_build_object(
      'docType', d.doc_type,
      'pages', d.pages,
      'provider', CASE WHEN d.doc_type IN ('discharge','invoice') THEN 'Apollo Hospitals' ELSE NULL END,
      'diagnosis', CASE WHEN d.doc_type = 'discharge' THEN 'Metastatic Pancreatic Adenocarcinoma' ELSE NULL END
    ),
    CASE
      WHEN d.status = 'failed' THEN round((0.22 + random() * 0.26)::numeric, 4)
      WHEN d.doc_type = 'discharge' THEN round((0.87 + random() * 0.11)::numeric, 4)
      ELSE round((0.70 + random() * 0.24)::numeric, 4)
    END,
    d.created_at + ((2 + (random() * 40)::int) || ' minutes')::interval
  FROM inserted_docs d
)
SELECT 1;

-- workflow + stage execution
WITH seeded AS (
  SELECT id, workflow_id, status, created_at, updated_at FROM cases WHERE case_code LIKE 'CAS-BFSI-2026-%'
),
wf AS (
  INSERT INTO workflow_runs (case_id, workflow_id, run_status, started_at, ended_at, latency_ms)
  SELECT
    s.id,
    s.workflow_id,
    CASE
      WHEN s.status = 'completed' THEN 'completed'
      WHEN s.status = 'rejected' THEN 'failed'
      WHEN s.status = 'review' THEN 'paused'
      WHEN s.status = 'new' THEN 'queued'
      ELSE 'running'
    END,
    s.created_at + interval '2 minutes',
    CASE WHEN s.status IN ('completed','rejected') THEN s.updated_at ELSE NULL END,
    (30000 + (random() * 520000)::int)::bigint
  FROM seeded s
  RETURNING id, case_id, run_status, started_at
),
sr AS (
  SELECT
    w.id AS workflow_run_id,
    st.stage_key,
    st.ord,
    CASE
      WHEN w.run_status = 'failed' AND st.ord >= 5 THEN 'failed'
      WHEN w.run_status = 'running' AND st.ord >= 5 THEN 'running'
      WHEN w.run_status = 'paused' AND st.ord >= 6 THEN 'pending'
      WHEN w.run_status = 'queued' AND st.ord >= 3 THEN 'pending'
      ELSE 'completed'
    END AS status,
    w.started_at + ((st.ord - 1) * 7 || ' minutes')::interval AS st_at
  FROM wf w
  CROSS JOIN LATERAL (
    VALUES
      (1, 'intake'),
      (2, 'routing'),
      (3, 'preprocessor'),
      (4, 'ocr'),
      (5, 'validation'),
      (6, 'decision'),
      (7, 'notify')
  ) st(ord, stage_key)
)
INSERT INTO stage_runs (
  workflow_run_id, stage_key, status, input_json, output_json, started_at, ended_at, error_message
)
SELECT
  s.workflow_run_id,
  s.stage_key,
  s.status,
  jsonb_build_object('stage', s.stage_key),
  jsonb_build_object('result', s.status),
  s.st_at,
  CASE WHEN s.status IN ('completed','failed') THEN s.st_at + interval '5 minutes' ELSE NULL END,
  CASE WHEN s.status = 'failed' THEN 'Demo stage failure' ELSE NULL END
FROM sr s;

-- Agent runs with fraud false positives + cost profile
WITH seeded AS (
  SELECT id, domain, status, created_at FROM cases WHERE case_code LIKE 'CAS-BFSI-2026-%'
),
ap AS (
  SELECT
    s.id AS case_id,
    a.agent_key,
    a.tool_used,
    a.ord,
    CASE
      WHEN s.status = 'rejected' AND a.ord >= 6 THEN 'failed'
      WHEN s.status IN ('new','in_progress') AND a.ord >= 6 THEN 'running'
      ELSE 'completed'
    END AS status,
    (900 + (random() * 4200)::int) AS pt,
    (500 + (random() * 3600)::int) AS ct,
    s.created_at + ((a.ord * 5) || ' minutes')::interval AS started_at
  FROM seeded s
  CROSS JOIN LATERAL (
    VALUES
      (1, 'intake_orchestrator_01', 'email_parser'),
      (2, 'workflow_router_01', 'intent_classifier'),
      (3, 'doc_preprocessor_01', 'pdf_splitter'),
      (4, 'doc_ext_01', 'vision_ocr'),
      (5, 'fraud_det_01', 'fraud_screening'),
      (6, 'decision_agent_01', 'policy_rules'),
      (7, 'notify_customer_01', 'smtp_sender')
  ) a(ord, agent_key, tool_used)
)
INSERT INTO agent_runs (
  case_id, agent_key, tool_used, status,
  prompt_tokens, completion_tokens, total_tokens, model, cost_inr,
  started_at, ended_at, result_json
)
SELECT
  ap.case_id,
  ap.agent_key,
  ap.tool_used,
  ap.status,
  ap.pt,
  ap.ct,
  ap.pt + ap.ct,
  'gpt-5.4',
  round(((ap.pt + ap.ct) * 0.00036)::numeric, 4),
  ap.started_at,
  CASE WHEN ap.status IN ('completed','failed') THEN ap.started_at + interval '4 minutes' ELSE NULL END,
  jsonb_build_object(
    'agent', ap.agent_key,
    'status', ap.status,
    -- intentionally high AML-like false positives story
    'fraudFalsePositive', CASE WHEN ap.agent_key = 'fraud_det_01' THEN (random() < 0.70) ELSE NULL END
  )
FROM ap;

-- Communications (in/out) + workflow decision visibility
WITH seeded AS (
  SELECT id, case_code, customer_email, workflow_id, status, created_at, updated_at
  FROM cases
  WHERE case_code LIKE 'CAS-BFSI-2026-%'
)
INSERT INTO communications (
  case_id, channel, direction, from_address, to_address, subject, body_text, provider_message_id, thread_id, created_at
)
SELECT
  s.id,
  'email',
  dir.direction,
  CASE WHEN dir.direction = 'in' THEN s.customer_email ELSE 'no-reply@aurastack.one' END,
  CASE WHEN dir.direction = 'in' THEN 'claims-intake@aurastack.one' ELSE s.customer_email END,
  CASE
    WHEN dir.direction = 'in' THEN 'New request: ' || s.case_code
    WHEN s.status = 'completed' THEN 'Case ' || s.case_code || ' approved'
    WHEN s.status = 'rejected' THEN 'Case ' || s.case_code || ' needs additional review'
    ELSE 'Case ' || s.case_code || ' processing update'
  END,
  CASE
    WHEN dir.direction = 'in' THEN 'Inbound submission with docs. Please process.'
    ELSE 'Workflow selected: ' || s.workflow_id || '. Current status: ' || s.status || '.'
  END,
  CASE WHEN dir.direction = 'in' THEN 'in-' || replace(s.case_code, '-', '') ELSE 'out-' || replace(s.case_code, '-', '') END,
  'thread-' || replace(s.case_code, '-', ''),
  CASE WHEN dir.direction = 'in' THEN s.created_at + interval '1 minute' ELSE s.updated_at END
FROM seeded s
CROSS JOIN LATERAL (VALUES ('in'::text), ('out'::text)) dir(direction);

-- Events timeline with stage-level breadcrumbs
WITH seeded AS (
  SELECT id, workflow_id, status, created_at, updated_at FROM cases WHERE case_code LIKE 'CAS-BFSI-2026-%'
),
e AS (
  SELECT id AS case_id, 'email_received'::text AS event_type, 'completed'::text AS event_status, 'intake'::text AS stage_key, 'intake_orchestrator_01'::text AS agent_key, created_at + interval '1 minute' AS ts FROM seeded
  UNION ALL
  SELECT id, 'workflow_selected', 'completed', 'routing', 'workflow_router_01', created_at + interval '3 minute' FROM seeded
  UNION ALL
  SELECT id, 'doc_preprocessed', 'completed', 'preprocessor', 'doc_preprocessor_01', created_at + interval '7 minute' FROM seeded
  UNION ALL
  SELECT id, 'ocr_done', 'completed', 'ocr', 'doc_ext_01', created_at + interval '14 minute' FROM seeded
  UNION ALL
  SELECT id, 'decision_made', CASE WHEN status='rejected' THEN 'failed' ELSE 'completed' END, 'decision', 'decision_agent_01', updated_at - interval '8 minute' FROM seeded
  UNION ALL
  SELECT id, 'email_sent', 'completed', 'notify', 'notify_customer_01', updated_at FROM seeded
)
INSERT INTO case_events (case_id, event_type, event_status, stage_key, agent_key, payload_json, created_at)
SELECT
  e.case_id,
  e.event_type,
  e.event_status,
  e.stage_key,
  e.agent_key,
  jsonb_build_object('workflowDecisionVisible', true, 'event', e.event_type),
  e.ts
FROM e;

-- Audit log: keep some manual interventions + compliance events
INSERT INTO audit_logs (
  actor_type, actor_id, action, resource_type, resource_id,
  before_json, after_json, ip_address, created_at
)
SELECT
  CASE WHEN random() < 0.72 THEN 'agent' ELSE 'user' END,
  CASE
    WHEN random() < 0.72 THEN (ARRAY['doc_ext_01','fraud_det_01','decision_agent_01'])[1 + (random() * 2)::int]
    ELSE (ARRAY['medical_adjuster_1','claims_manager_1','compliance_officer_1'])[1 + (random() * 2)::int]
  END,
  (ARRAY['CASE_UPDATED','WORKFLOW_EXECUTED','DOC_VERIFIED','MANUAL_OVERRIDE','COMPLIANCE_AUDIT'])[1 + (random() * 4)::int],
  'case',
  c.id::text,
  NULL::jsonb,
  jsonb_build_object('status', c.status, 'workflow', c.workflow_id),
  ('172.16.' || (1 + (random() * 200)::int)::text || '.' || (1 + (random() * 200)::int)::text)::inet,
  c.updated_at
FROM cases c
WHERE c.case_code LIKE 'CAS-BFSI-2026-%';

COMMIT;

-- Quick sanity checks:
-- SELECT count(*) FROM cases WHERE case_code LIKE 'CAS-BFSI-2026-%';
-- SELECT domain, count(*) FROM cases WHERE case_code LIKE 'CAS-BFSI-2026-%' GROUP BY 1 ORDER BY 2 DESC;
-- SELECT status, count(*) FROM cases WHERE case_code LIKE 'CAS-BFSI-2026-%' GROUP BY 1 ORDER BY 2 DESC;
-- SELECT round(100.0 * avg((status='processed')::int),2) AS processed_pct FROM documents d JOIN cases c ON c.id=d.case_id WHERE c.case_code LIKE 'CAS-BFSI-2026-%';
