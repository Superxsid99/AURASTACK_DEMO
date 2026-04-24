import { WorkflowDefinition } from '../types/workflow';

export const INITIAL_WORKFLOWS: WorkflowDefinition[] = [
  {
    workflow_id: 'claims_mgmt_v1',
    name: 'Healthcare Claims Management',
    description: 'Medical Invoice → AI Extraction → Policy Validation → Fraud Detection → Settlement.',
    department: 'CLAIMS',
    version: '3.0.0',
    status: 'Active',
    last_updated: '2026-03-30T10:00:00Z',
    stats: { success: '99.1%', volume: '25k/day' },
    nodes: [
      { id: 'fnol', type: 'input', label: 'Medical Claim Intake', x: 50, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'CLAIMS', consumes_event: 'external.claim_submitted', produces_event: 'claims.intake_complete', writes: ['claim_data', 'status'] }, next: ['extract'] },
      { id: 'extract', type: 'ai_task', label: 'Medical Data Extraction', x: 280, y: 150, config: { agent_id: 'doc_ext_01' }, execution: { execution_type: 'agent_processing', department: 'CLAIMS', consumes_event: 'claims.intake_complete', produces_event: 'claims.extraction_complete', writes: ['extracted_data'] }, next: ['validate'] },
      { id: 'validate', type: 'validation', label: 'Coverage Validation', x: 510, y: 150, config: { agent_id: 'policy_val_01' }, execution: { execution_type: 'agent_processing', department: 'SYSTEM', consumes_event: 'claims.extraction_complete', produces_event: 'claims.validation_complete', writes: ['is_covered', 'coverage_details'] }, next: ['fraud'] },
      { id: 'fraud', type: 'ai_task', label: 'Fraud Pattern Analysis', x: 740, y: 150, config: { agent_id: 'fraud_det_01' }, execution: { execution_type: 'agent_processing', department: 'SYSTEM', consumes_event: 'claims.validation_complete', produces_event: 'claims.fraud_check_complete', writes: ['fraud_score', 'fraud_flags'] }, next: ['decision'] },
      { id: 'decision', type: 'decision', label: 'Auto-Adjudicate?', x: 970, y: 150, config: { conditions: [{ if: 'fraud_score < 15 && is_covered', go_to: 'settle' }, { if: 'else', go_to: 'review' }] }, execution: { execution_type: 'system_action', department: 'CLAIMS', consumes_event: 'claims.fraud_check_complete', produces_event: 'claims.decision_made', writes: ['decision_path'] }, next: [] },
      { id: 'review', type: 'human_task', label: 'Medical Adjuster Review', x: 1200, y: 250, config: { role: 'medical_adjuster', action: 'manual_review' }, execution: { execution_type: 'human_task', department: 'CLAIMS', consumes_event: 'claims.manual_review_required', produces_event: 'claims.manual_review_complete', writes: ['adjuster_notes', 'manual_approval'] }, next: ['settle'] },
      { id: 'settle', type: 'api_call', label: 'Payment Settlement', x: 1200, y: 50, config: { endpoint: '/api/v1/settle' }, execution: { execution_type: 'system_action', department: 'FINANCE', consumes_event: 'claims.approved', produces_event: 'claims.settled', writes: ['payment_id', 'settlement_status'] }, next: ['end'] },
      { id: 'end', type: 'end', label: 'Claim Finalized', x: 1430, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'CLAIMS', consumes_event: 'claims.settled', produces_event: 'claims.finalized', writes: ['final_status'] }, next: [] },
    ]
  },
  {
    workflow_id: 'policy_issuance_v1',
    name: 'Healthcare Policy Issuance',
    description: 'Patient Application → Identity Verification → Medical History Review → Underwriting → Policy Active.',
    department: 'POLICY_ISSUANCE',
    version: '2.1.0',
    status: 'Active',
    last_updated: '2026-03-30T11:00:00Z',
    stats: { success: '97.5%', volume: '5k/day' },
    nodes: [
      { id: 'proposal', type: 'input', label: 'Patient Application', x: 50, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'POLICY_ISSUANCE', consumes_event: 'external.policy_applied', produces_event: 'policy.intake_complete', writes: ['application_data'] }, next: ['kyc'] },
      { id: 'kyc', type: 'ai_task', label: 'Identity Verification', x: 280, y: 150, config: { agent_id: 'kyc_val_01' }, execution: { execution_type: 'agent_processing', department: 'SYSTEM', consumes_event: 'policy.intake_complete', produces_event: 'policy.kyc_complete', writes: ['kyc_status', 'identity_verified'] }, next: ['risk'] },
      { id: 'risk', type: 'ai_task', label: 'Medical Risk Assessment', x: 510, y: 150, config: { agent_id: 'risk_model' }, execution: { execution_type: 'agent_processing', department: 'UNDERWRITING', consumes_event: 'policy.kyc_complete', produces_event: 'policy.risk_assessed', writes: ['risk_score', 'risk_factors'] }, next: ['uw'] },
      { id: 'uw', type: 'decision', label: 'Underwriting Decision', x: 740, y: 150, config: { conditions: [{ if: 'risk_score < 30', go_to: 'approve' }, { if: 'else', go_to: 'manual_uw' }] }, execution: { execution_type: 'system_action', department: 'UNDERWRITING', consumes_event: 'policy.risk_assessed', produces_event: 'policy.uw_decision_made', writes: ['uw_path'] }, next: [] },
      { id: 'manual_uw', type: 'human_task', label: 'Underwriter Review', x: 970, y: 250, config: { role: 'medical_underwriter' }, execution: { execution_type: 'human_task', department: 'UNDERWRITING', consumes_event: 'policy.manual_uw_required', produces_event: 'policy.manual_uw_complete', writes: ['underwriter_notes', 'manual_approval'] }, next: ['approve'] },
      { id: 'approve', type: 'api_call', label: 'Policy Generation', x: 970, y: 50, config: { endpoint: '/api/v1/generate' }, execution: { execution_type: 'system_action', department: 'POLICY_ISSUANCE', consumes_event: 'policy.approved', produces_event: 'policy.generated', writes: ['policy_document_id'] }, next: ['issue'] },
      { id: 'issue', type: 'api_call', label: 'Issuance & Activation', x: 1200, y: 150, config: { endpoint: '/api/v1/issue' }, execution: { execution_type: 'system_action', department: 'POLICY_ISSUANCE', consumes_event: 'policy.generated', produces_event: 'policy.issued', writes: ['policy_status', 'activation_date'] }, next: ['end'] },
      { id: 'end', type: 'end', label: 'Policy Active', x: 1430, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'POLICY_ISSUANCE', consumes_event: 'policy.issued', produces_event: 'policy.finalized', writes: ['final_status'] }, next: [] },
    ]
  },
  {
    workflow_id: 'kyc_onboarding_v1',
    name: 'KYC & Patient Onboarding',
    description: 'ID Verification → Insurance Eligibility → Patient Profile Creation → Welcome Kit.',
    department: 'KYC_ONBOARDING',
    version: '1.0.0',
    status: 'Active',
    last_updated: '2026-03-30T15:30:00Z',
    stats: { success: '98.2%', volume: '1.2k/day' },
    nodes: [
      { id: 'start', type: 'input', label: 'Onboarding Request', x: 50, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'KYC_ONBOARDING', consumes_event: 'onboarding.start', produces_event: 'onboarding.intake_complete', writes: ['onboarding_data'] }, next: ['verify_id'] },
      { id: 'verify_id', type: 'ai_task', label: 'Identity Verification', x: 280, y: 150, config: { agent_id: 'kyc_val_01' }, execution: { execution_type: 'agent_processing', department: 'SYSTEM', consumes_event: 'onboarding.intake_complete', produces_event: 'onboarding.id_verified', writes: ['id_verification_status'] }, next: ['check_eligibility'] },
      { id: 'check_eligibility', type: 'api_call', label: 'Insurance Eligibility', x: 510, y: 150, config: { endpoint: '/api/v1/check-eligibility' }, execution: { execution_type: 'system_action', department: 'KYC_ONBOARDING', consumes_event: 'onboarding.id_verified', produces_event: 'onboarding.eligible', writes: ['eligibility_status'] }, next: ['create_profile'] },
      { id: 'create_profile', type: 'api_call', label: 'Create Patient Profile', x: 740, y: 150, config: { endpoint: '/api/v1/create-patient' }, execution: { execution_type: 'system_action', department: 'KYC_ONBOARDING', consumes_event: 'onboarding.eligible', produces_event: 'onboarding.profile_created', writes: ['patient_id'] }, next: ['welcome_kit'] },
      { id: 'welcome_kit', type: 'api_call', label: 'Send Welcome Kit', x: 970, y: 150, config: { endpoint: '/api/v1/send-welcome' }, execution: { execution_type: 'system_action', department: 'KYC_ONBOARDING', consumes_event: 'onboarding.profile_created', produces_event: 'onboarding.kit_sent', writes: ['kit_status'] }, next: ['end'] },
      { id: 'end', type: 'end', label: 'Onboarding Complete', x: 1200, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'KYC_ONBOARDING', consumes_event: 'onboarding.kit_sent', produces_event: 'onboarding.finalized', writes: ['final_status'] }, next: [] }
    ]
  },
  {
    workflow_id: 'medical_uw_v1',
    name: 'Medical Underwriting',
    description: 'Health History Analysis → Risk Modeling → Premium Calculation → Final Decision.',
    department: 'UNDERWRITING',
    version: '1.0.0',
    status: 'Active',
    last_updated: '2026-03-30T16:00:00Z',
    stats: { success: '94.5%', volume: '800/day' },
    nodes: [
      { id: 'start', type: 'input', label: 'Health History Intake', x: 50, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'UNDERWRITING', consumes_event: 'uw.start', produces_event: 'uw.intake_complete', writes: ['health_history'] }, next: ['analyze'] },
      { id: 'analyze', type: 'ai_task', label: 'History Analysis', x: 280, y: 150, config: { agent_id: 'med_analyst_01' }, execution: { execution_type: 'agent_processing', department: 'UNDERWRITING', consumes_event: 'uw.intake_complete', produces_event: 'uw.analysis_complete', writes: ['clinical_summary', 'risk_indicators'] }, next: ['model'] },
      { id: 'model', type: 'ai_task', label: 'Risk Modeling', x: 510, y: 150, config: { agent_id: 'risk_model' }, execution: { execution_type: 'agent_processing', department: 'SYSTEM', consumes_event: 'uw.analysis_complete', produces_event: 'uw.risk_modeled', writes: ['risk_score', 'mortality_rating'] }, next: ['calc'] },
      { id: 'calc', type: 'api_call', label: 'Premium Calculation', x: 740, y: 150, config: { endpoint: '/api/v1/calc-premium' }, execution: { execution_type: 'system_action', department: 'FINANCE', consumes_event: 'uw.risk_modeled', produces_event: 'uw.premium_calculated', writes: ['base_premium', 'loadings'] }, next: ['decision'] },
      { id: 'decision', type: 'human_task', label: 'Final Decision', x: 970, y: 150, config: { role: 'senior_underwriter' }, execution: { execution_type: 'human_task', department: 'UNDERWRITING', consumes_event: 'uw.premium_calculated', produces_event: 'uw.decision_complete', writes: ['final_decision', 'underwriter_notes'] }, next: ['end'] },
      { id: 'end', type: 'end', label: 'Underwriting Complete', x: 1200, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'UNDERWRITING', consumes_event: 'uw.decision_complete', produces_event: 'uw.finalized', writes: ['final_status'] }, next: [] }
    ]
  },
  {
    workflow_id: 'policy_servicing_v1',
    name: 'Policy Servicing',
    description: 'Request Intake → Validation → Record Update → Confirmation.',
    department: 'POLICY_SERVICING',
    version: '1.0.0',
    status: 'Active',
    last_updated: '2026-03-30T17:00:00Z',
    stats: { success: '99.5%', volume: '3k/day' },
    nodes: [
      { id: 'start', type: 'input', label: 'Service Request', x: 50, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'POLICY_SERVICING', consumes_event: 'service.request', produces_event: 'service.intake_complete', writes: ['request_details'] }, next: ['validate'] },
      { id: 'validate', type: 'validation', label: 'Policy Validation', x: 280, y: 150, config: { rules: ['policy_active', 'owner_verified'] }, execution: { execution_type: 'agent_processing', department: 'SYSTEM', consumes_event: 'service.intake_complete', produces_event: 'service.validated', writes: ['validation_status'] }, next: ['update'] },
      { id: 'update', type: 'api_call', label: 'Record Update', x: 510, y: 150, config: { endpoint: '/api/v1/update-policy' }, execution: { execution_type: 'system_action', department: 'POLICY_SERVICING', consumes_event: 'service.validated', produces_event: 'service.updated', writes: ['update_confirmation'] }, next: ['notify'] },
      { id: 'notify', type: 'api_call', label: 'Confirmation', x: 740, y: 150, config: { endpoint: '/api/v1/notify' }, execution: { execution_type: 'system_action', department: 'POLICY_SERVICING', consumes_event: 'service.updated', produces_event: 'service.notified', writes: ['notification_id'] }, next: ['end'] },
      { id: 'end', type: 'end', label: 'Service Complete', x: 970, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'POLICY_SERVICING', consumes_event: 'service.notified', produces_event: 'service.finalized', writes: ['final_status'] }, next: [] }
    ]
  },
  {
    workflow_id: 'policy_renewals_v1',
    name: 'Policy Renewals',
    description: 'Eligibility Review → Usage Analysis → Premium Adjustment → Renewal Offer.',
    department: 'RENEWALS',
    version: '1.0.0',
    status: 'Active',
    last_updated: '2026-03-30T18:00:00Z',
    stats: { success: '92.1%', volume: '2k/day' },
    nodes: [
      { id: 'start', type: 'input', label: 'Renewal Trigger', x: 50, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'RENEWALS', consumes_event: 'renewal.trigger', produces_event: 'renewal.intake_complete', writes: ['renewal_data'] }, next: ['eligibility'] },
      { id: 'eligibility', type: 'validation', label: 'Eligibility Review', x: 280, y: 150, config: { rules: ['no_pending_claims', 'payment_history'] }, execution: { execution_type: 'agent_processing', department: 'SYSTEM', consumes_event: 'renewal.intake_complete', produces_event: 'renewal.eligible', writes: ['eligibility_status'] }, next: ['usage'] },
      { id: 'usage', type: 'ai_task', label: 'Usage Analysis', x: 510, y: 150, config: { agent_id: 'usage_analyst' }, execution: { execution_type: 'agent_processing', department: 'UNDERWRITING', consumes_event: 'renewal.eligible', produces_event: 'renewal.usage_analyzed', writes: ['usage_metrics', 'risk_trend'] }, next: ['adjust'] },
      { id: 'adjust', type: 'api_call', label: 'Premium Adjustment', x: 740, y: 150, config: { endpoint: '/api/v1/adjust-premium' }, execution: { execution_type: 'system_action', department: 'FINANCE', consumes_event: 'renewal.usage_analyzed', produces_event: 'renewal.adjusted', writes: ['new_premium'] }, next: ['offer'] },
      { id: 'offer', type: 'api_call', label: 'Renewal Offer', x: 970, y: 150, config: { endpoint: '/api/v1/send-offer' }, execution: { execution_type: 'system_action', department: 'RENEWALS', consumes_event: 'renewal.adjusted', produces_event: 'renewal.offered', writes: ['offer_id'] }, next: ['end'] },
      { id: 'end', type: 'end', label: 'Renewal Processed', x: 1200, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'RENEWALS', consumes_event: 'renewal.offered', produces_event: 'renewal.finalized', writes: ['final_status'] }, next: [] }
    ]
  },
  {
    workflow_id: 'compliance_audit_v1',
    name: 'Compliance Audit',
    description: 'Log Collection → Regulatory Check → Violation Detection → Remediation.',
    department: 'COMPLIANCE',
    version: '1.0.0',
    status: 'Active',
    last_updated: '2026-03-30T19:00:00Z',
    stats: { success: '100%', volume: '500/day' },
    nodes: [
      { id: 'start', type: 'input', label: 'Audit Trigger', x: 50, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'COMPLIANCE', consumes_event: 'audit.trigger', produces_event: 'audit.intake_complete', writes: ['audit_scope'] }, next: ['collect'] },
      { id: 'collect', type: 'api_call', label: 'Log Collection', x: 280, y: 150, config: { endpoint: '/api/v1/logs' }, execution: { execution_type: 'system_action', department: 'SYSTEM', consumes_event: 'audit.intake_complete', produces_event: 'audit.logs_collected', writes: ['raw_logs'] }, next: ['check'] },
      { id: 'check', type: 'ai_task', label: 'Regulatory Check', x: 510, y: 150, config: { agent_id: 'compliance_bot' }, execution: { execution_type: 'agent_processing', department: 'COMPLIANCE', consumes_event: 'audit.logs_collected', produces_event: 'audit.checked', writes: ['compliance_report'] }, next: ['detect'] },
      { id: 'detect', type: 'ai_task', label: 'Violation Detection', x: 740, y: 150, config: { agent_id: 'fraud_det_01' }, execution: { execution_type: 'agent_processing', department: 'SYSTEM', consumes_event: 'audit.checked', produces_event: 'audit.violations_detected', writes: ['violations_list'] }, next: ['remediate'] },
      { id: 'remediate', type: 'human_task', label: 'Remediation', x: 970, y: 150, config: { role: 'compliance_officer' }, execution: { execution_type: 'human_task', department: 'COMPLIANCE', consumes_event: 'audit.violations_detected', produces_event: 'audit.remediated', writes: ['remediation_actions'] }, next: ['end'] },
      { id: 'end', type: 'end', label: 'Audit Complete', x: 1200, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'COMPLIANCE', consumes_event: 'audit.remediated', produces_event: 'audit.finalized', writes: ['final_status'] }, next: [] }
    ]
  },
  {
    workflow_id: 'omnichannel_routing_v1',
    name: 'Omnichannel Intake & Routing',
    description: 'Centralized intake for all customer channels. Classifies intent and triggers the appropriate backend workflow.',
    department: 'SYSTEM',
    version: '1.0.0',
    status: 'Active',
    last_updated: '2026-03-30T20:00:00Z',
    stats: { success: '99.8%', volume: '10k/day' },
    nodes: [
      { id: 'start', type: 'input', label: 'Omnichannel Intake', x: 50, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'SYSTEM', consumes_event: 'external.message_received', produces_event: 'intake.received', writes: ['raw_message', 'channel_source'] }, next: ['classify'] },
      { id: 'classify', type: 'ai_task', label: 'Intent Classification', x: 280, y: 150, config: { agent_id: 'router_agent' }, execution: { execution_type: 'agent_processing', department: 'SYSTEM', consumes_event: 'intake.received', produces_event: 'intake.classified', writes: ['intent', 'confidence_score'] }, next: ['route'] },
      { id: 'route', type: 'decision', label: 'Route to Workflow', x: 510, y: 150, config: { conditions: [{ if: 'intent == claim', go_to: 'trigger_claim' }, { if: 'intent == service', go_to: 'trigger_service' }, { if: 'else', go_to: 'human_support' }] }, execution: { execution_type: 'system_action', department: 'SYSTEM', consumes_event: 'intake.classified', produces_event: 'intake.routed', writes: ['routing_decision'] }, next: [] },
      { id: 'trigger_claim', type: 'api_call', label: 'Trigger Claim WF', x: 740, y: 50, config: { endpoint: '/api/v1/trigger-claims' }, execution: { execution_type: 'system_action', department: 'CLAIMS', consumes_event: 'intake.routed', produces_event: 'external.claim_submitted', writes: ['workflow_trigger_id'] }, next: ['end'] },
      { id: 'trigger_service', type: 'api_call', label: 'Trigger Service WF', x: 740, y: 150, config: { endpoint: '/api/v1/trigger-service' }, execution: { execution_type: 'system_action', department: 'POLICY_ISSUANCE', consumes_event: 'intake.routed', produces_event: 'service.request', writes: ['workflow_trigger_id'] }, next: ['end'] },
      { id: 'human_support', type: 'human_task', label: 'Human Support', x: 740, y: 250, config: { role: 'support_agent' }, execution: { execution_type: 'human_task', department: 'SYSTEM', consumes_event: 'intake.routed', produces_event: 'intake.human_handled', writes: ['support_notes'] }, next: ['end'] },
      { id: 'end', type: 'end', label: 'Routing Complete', x: 970, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'SYSTEM', consumes_event: 'intake.routed', produces_event: 'intake.finalized', writes: ['final_status'] }, next: [] }
    ]
  },
  {
    workflow_id: 'hospital_intake_v1',
    name: 'Hospital Intake & Exchange',
    description: 'Hospital Admission → Medical Record Extraction → Eligibility Check → Hospital Exchange → Approval.',
    department: 'CLAIMS',
    version: '1.0.0',
    status: 'Active',
    last_updated: '2026-03-31T02:40:00Z',
    stats: { success: '96.8%', volume: '400/day' },
    nodes: [
      { id: 'start', type: 'input', label: 'Hospital Intake', x: 50, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'CLAIMS', consumes_event: 'hospital.intake_received', produces_event: 'hospital.intake_complete', writes: ['admission_data'] }, next: ['extract'] },
      { id: 'extract', type: 'ai_task', label: 'Medical Extraction', x: 280, y: 150, config: { agent_id: 'doc_ext_01' }, execution: { execution_type: 'agent_processing', department: 'CLAIMS', consumes_event: 'hospital.intake_complete', produces_event: 'hospital.extraction_complete', writes: ['extracted_medical_data'] }, next: ['eligibility'] },
      { id: 'eligibility', type: 'api_call', label: 'Eligibility Check', x: 510, y: 150, config: { endpoint: '/api/v1/check-eligibility' }, execution: { execution_type: 'system_action', department: 'POLICY_ISSUANCE', consumes_event: 'hospital.extraction_complete', produces_event: 'hospital.eligible', writes: ['eligibility_status'] }, next: ['exchange_check'] },
      { id: 'exchange_check', type: 'decision', label: 'More Info Needed?', x: 740, y: 150, config: { conditions: [{ if: 'eligibility_status == "PENDING_INFO"', go_to: 'hospital_exchange' }, { if: 'else', go_to: 'approve' }] }, execution: { execution_type: 'system_action', department: 'CLAIMS', consumes_event: 'hospital.eligible', produces_event: 'hospital.exchange_decided', writes: ['exchange_path'] }, next: [] },
      { id: 'hospital_exchange', type: 'ai_task', label: 'Hospital Exchange', x: 970, y: 250, config: { agent_id: 'hospital_coord_01' }, execution: { execution_type: 'agent_processing', department: 'CLAIMS', consumes_event: 'hospital.exchange_decided', produces_event: 'hospital.exchange_complete', writes: ['hospital_response'] }, next: ['extract'] },
      { id: 'approve', type: 'human_task', label: 'Admission Approval', x: 970, y: 50, config: { role: 'medical_director' }, execution: { execution_type: 'human_task', department: 'CLAIMS', consumes_event: 'hospital.eligible', produces_event: 'hospital.approved', writes: ['approval_status'] }, next: ['end'] },
      { id: 'end', type: 'end', label: 'Intake Finalized', x: 1200, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'CLAIMS', consumes_event: 'hospital.approved', produces_event: 'hospital.finalized', writes: ['final_status'] }, next: [] }
    ]
  },
  {
    workflow_id: 'sales_intake_v1',
    name: 'Sales Application Intake',
    description: 'Application Intake (Portal/Email) → AI Extraction (Demographics/Salary) → Generate Sales Code (REST) → Send Communication.',
    department: 'SALES',
    version: '1.0.0',
    status: 'Active',
    last_updated: '2026-03-31T07:27:00Z',
    stats: { success: '99.5%', volume: '2k/day' },
    nodes: [
      { id: 'start', type: 'input', label: 'Application Intake', x: 50, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'SALES', consumes_event: 'sales.intake_received', produces_event: 'sales.intake_complete', writes: ['raw_application_data', 'channel'] }, next: ['extract'] },
      { id: 'extract', type: 'ai_task', label: 'AI Data Extraction', x: 280, y: 150, config: { agent_id: 'sales_intake_01' }, execution: { execution_type: 'agent_processing', department: 'SALES', consumes_event: 'sales.intake_complete', produces_event: 'sales.extraction_complete', writes: ['demographics', 'salary_info'] }, next: ['generate_code'] },
      { id: 'generate_code', type: 'api_call', label: 'Generate Sales Code', x: 510, y: 150, config: { endpoint: '/api/v1/generate-sales-code' }, execution: { execution_type: 'system_action', department: 'SALES', consumes_event: 'sales.extraction_complete', produces_event: 'sales.code_generated', writes: ['sales_code'] }, next: ['communicate'] },
      { id: 'communicate', type: 'api_call', label: 'Send Communication', x: 740, y: 150, config: { endpoint: '/api/v1/send-communication' }, execution: { execution_type: 'system_action', department: 'SALES', consumes_event: 'sales.code_generated', produces_event: 'sales.communication_sent', writes: ['communication_status'] }, next: ['end'] },
      { id: 'end', type: 'end', label: 'Intake Complete', x: 970, y: 150, config: {}, execution: { execution_type: 'system_action', department: 'SALES', consumes_event: 'sales.communication_sent', produces_event: 'sales.finalized', writes: ['final_status'] }, next: [] }
    ]
  }
];
