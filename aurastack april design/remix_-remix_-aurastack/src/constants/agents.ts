import { AgentDefinition } from '../types/agent';

export const INITIAL_AGENTS: AgentDefinition[] = [
  {
    agent_id: 'doc_ext_01',
    name: 'Medical Data Extractor',
    type: 'doc_intelligence',
    description: 'Extracts patient data, procedure codes (CPT/ICD-10), and billing amounts from medical records and invoices.',
    input_schema: [
      { name: 'document_url', type: 'string', description: 'URL to the medical document', required: true }
    ],
    output_schema: [
      { name: 'patient_name', type: 'string', description: 'Full name of the patient', required: true },
      { name: 'billing_amount', type: 'number', description: 'Total amount billed', required: true },
      { name: 'procedure_codes', type: 'array', description: 'List of CPT/ICD-10 codes', required: true },
      { name: 'diagnosis', type: 'string', description: 'Primary diagnosis extracted', required: true }
    ],
    instructions: 'You are a medical coding expert. Extract structured data from medical records with high precision.',
    tools: [],
    constraints: ['Strict HIPAA compliance', 'Only extract verified data'],
    confidence_score: true,
    human_override_hook: false,
    version: '2.0.0',
    status: 'active',
    last_updated: '2026-03-30T09:00:00Z'
  },
  {
    agent_id: 'fraud_det_01',
    name: 'Healthcare Fraud Sentinel',
    type: 'fraud_risk',
    description: 'Analyzes medical claims for anomalous patterns, upcoding, or unbundling.',
    input_schema: [
      { name: 'claim_data', type: 'object', description: 'Current claim details', required: true },
      { name: 'patient_history', type: 'array', description: 'Past medical history', required: true }
    ],
    output_schema: [
      { name: 'is_fraudulent', type: 'boolean', description: 'Flag for potential fraud', required: true },
      { name: 'risk_score', type: 'number', description: '0-100 risk score', required: true },
      { name: 'anomaly_type', type: 'string', description: 'Type of anomaly detected (e.g., upcoding)', required: true }
    ],
    instructions: 'Analyze claims against clinical guidelines and historical patient data. Flag inconsistencies.',
    tools: ['clinical_guidelines_db'],
    constraints: ['Flag any score above 70 for medical director review'],
    confidence_score: true,
    human_override_hook: true,
    version: '3.1.0',
    status: 'active',
    last_updated: '2026-03-30T10:15:00Z'
  },
  {
    agent_id: 'kyc_val_01',
    name: 'Patient Identity Validator',
    type: 'compliance',
    description: 'Verifies patient identity and insurance eligibility.',
    input_schema: [
      { name: 'id_document', type: 'string', description: 'ID document scan', required: true },
      { name: 'insurance_card', type: 'string', description: 'Insurance card scan', required: true }
    ],
    output_schema: [
      { name: 'verification_status', type: 'string', description: 'VERIFIED, PENDING, or REJECTED', required: true },
      { name: 'eligibility_confirmed', type: 'boolean', description: 'True if insurance is active', required: true }
    ],
    instructions: 'Verify patient identity and cross-reference with insurance provider databases.',
    tools: ['insurance_eligibility_api', 'ocr_engine'],
    constraints: ['Ensure data encryption at rest'],
    confidence_score: true,
    human_override_hook: true,
    version: '1.5.0',
    status: 'active',
    last_updated: '2026-03-29T11:45:00Z'
  },
  {
    agent_id: 'risk_model',
    name: 'Clinical Risk Modeler',
    type: 'validation',
    description: 'Predicts clinical risk and medical necessity for procedures.',
    input_schema: [
      { name: 'patient_vitals', type: 'object', description: 'Current vitals and symptoms', required: true },
      { name: 'medical_history', type: 'array', description: 'Historical medical records', required: true }
    ],
    output_schema: [
      { name: 'risk_score', type: 'number', description: 'Clinical risk score 0-100', required: true },
      { name: 'recommendation', type: 'string', description: 'AI recommendation for care path', required: true }
    ],
    instructions: 'Use evidence-based medicine to assess clinical risk and recommend the most appropriate care path.',
    tools: ['medical_knowledge_graph'],
    constraints: ['Recommendations must be reviewed by a licensed physician'],
    confidence_score: true,
    human_override_hook: false,
    version: '2.2.0',
    status: 'active',
    last_updated: '2026-03-30T12:30:00Z'
  },
  {
    agent_id: 'policy_servicer_01',
    name: 'Policy Servicing Specialist',
    type: 'compliance',
    description: 'Processes policy modification requests such as beneficiary changes, address updates, and coverage adjustments.',
    input_schema: [
      { name: 'request_type', type: 'string', description: 'Type of service request', required: true },
      { name: 'request_details', type: 'object', description: 'Details of the requested change', required: true },
      { name: 'policy_data', type: 'object', description: 'Current policy information', required: true }
    ],
    output_schema: [
      { name: 'is_valid_request', type: 'boolean', description: 'True if request meets policy terms', required: true },
      { name: 'updated_fields', type: 'object', description: 'Fields to be updated in the system', required: true },
      { name: 'requires_underwriting', type: 'boolean', description: 'True if change impacts risk', required: true }
    ],
    instructions: 'Validate service requests against policy terms and regulatory requirements. Identify changes that require re-underwriting.',
    tools: ['policy_admin_system_api'],
    constraints: ['Strict validation of legal documents for beneficiary changes'],
    confidence_score: true,
    human_override_hook: true,
    version: '1.0.0',
    status: 'active',
    last_updated: '2026-03-30T15:30:00Z'
  },
  {
    agent_id: 'renewal_analyst_01',
    name: 'Renewal Risk Analyst',
    type: 'fraud_risk',
    description: 'Evaluates policy performance and claims history to determine renewal eligibility and premium adjustments.',
    input_schema: [
      { name: 'policy_id', type: 'string', description: 'ID of the policy being renewed', required: true },
      { name: 'claims_history', type: 'array', description: 'History of claims during the policy term', required: true },
      { name: 'market_data', type: 'object', description: 'Current market trends and pricing', required: true }
    ],
    output_schema: [
      { name: 'renewal_eligible', type: 'boolean', description: 'True if policy should be renewed', required: true },
      { name: 'suggested_premium_adjustment', type: 'number', description: 'Percentage change in premium', required: true },
      { name: 'risk_summary', type: 'string', description: 'Summary of risk factors for renewal', required: true }
    ],
    instructions: 'Analyze claims frequency and severity. Compare against underwriting guidelines to suggest renewal terms.',
    tools: ['actuarial_models', 'claims_database'],
    constraints: ['Premium increases above 20% require senior management approval'],
    confidence_score: true,
    human_override_hook: false,
    version: '1.0.0',
    status: 'active',
    last_updated: '2026-03-30T15:30:00Z'
  },
  {
    agent_id: 'compliance_auditor_01',
    name: 'Healthcare Compliance Auditor',
    type: 'compliance',
    description: 'Audits workflow execution and data handling for HIPAA compliance and regulatory adherence.',
    input_schema: [
      { name: 'workflow_logs', type: 'array', description: 'Execution logs of a workflow', required: true },
      { name: 'data_access_records', type: 'array', description: 'Records of who accessed what data', required: true }
    ],
    output_schema: [
      { name: 'compliance_score', type: 'number', description: '0-100 compliance score', required: true },
      { name: 'violations_detected', type: 'array', description: 'List of potential regulatory violations', required: true },
      { name: 'remediation_steps', type: 'string', description: 'Suggested steps to fix violations', required: true }
    ],
    instructions: 'Review all logs for unauthorized data access or deviations from standard operating procedures. Ensure all HIPAA safeguards are met.',
    tools: ['regulatory_knowledge_base', 'audit_log_analyzer'],
    constraints: ['Any critical violation must trigger an immediate system lockout for the affected user'],
    confidence_score: true,
    human_override_hook: true,
    version: '1.0.0',
    status: 'active',
    last_updated: '2026-03-30T15:30:00Z'
  },
  {
    agent_id: 'intake_orchestrator_01',
    name: 'Aura Intake AI',
    type: 'workflow_control',
    description: 'Specialized in multi-channel message processing, intent classification, and automated workflow routing.',
    input_schema: [
      { name: 'message_content', type: 'string', description: 'Raw text from chat or email', required: true },
      { name: 'channel', type: 'string', description: 'Source channel (CHAT, EMAIL)', required: true }
    ],
    output_schema: [
      { name: 'intent', type: 'string', description: 'Classified intent (CLAIM, QUOTE, SERVICE, INQUIRY)', required: true },
      { name: 'confidence', type: 'number', description: 'Classification confidence 0-1', required: true },
      { name: 'target_workflow', type: 'string', description: 'ID of the workflow to trigger', required: true },
      { name: 'entities', type: 'object', description: 'Extracted entities (policy_id, patient_name, etc.)', required: false }
    ],
    instructions: 'Analyze the incoming message to determine the customer intent. Route to claims_mgmt_v1 for claims, policy_issuance_v1 for quotes, and policy_servicing_v1 for service requests.',
    tools: ['intent_classifier', 'entity_extractor'],
    constraints: ['Maintain professional tone', 'Escalate to human if confidence < 0.8'],
    confidence_score: true,
    human_override_hook: true,
    version: '1.0.0',
    status: 'active',
    last_updated: '2026-03-30T16:00:00Z'
  },
  {
    agent_id: 'hospital_coord_01',
    name: 'Hospital Exchange Coordinator',
    type: 'workflow_control',
    description: 'Manages bidirectional communication with hospitals for medical record requests and admission updates.',
    input_schema: [
      { name: 'case_id', type: 'string', description: 'The ID of the case', required: true },
      { name: 'request_type', type: 'string', description: 'Type of request (RECORDS, ADMISSION_UPDATE, DISCHARGE_PLAN)', required: true },
      { name: 'hospital_contact', type: 'string', description: 'Email or endpoint for the hospital', required: true }
    ],
    output_schema: [
      { name: 'message_sent', type: 'boolean', description: 'True if message was successfully sent', required: true },
      { name: 'response_received', type: 'boolean', description: 'True if a response was received', required: true },
      { name: 'extracted_info', type: 'object', description: 'Information extracted from hospital response', required: false }
    ],
    instructions: 'You are a professional medical coordinator. Communicate clearly with hospital intake and records departments. Track all exchanges via Case ID.',
    tools: ['email_api', 'hospital_portal_connector'],
    constraints: ['Strict adherence to medical privacy standards', 'Use professional medical terminology'],
    confidence_score: true,
    human_override_hook: true,
    version: '1.0.0',
    status: 'active',
    last_updated: '2026-03-31T02:40:00Z'
  },
  {
    agent_id: 'policy_gen_01',
    name: 'Policy Issuance Engine',
    type: 'workflow_control',
    description: 'Generates formal policy documents and activates them in the core insurance system.',
    input_schema: [
      { name: 'underwriting_decision', type: 'object', description: 'Final UW decision and terms', required: true },
      { name: 'customer_data', type: 'object', description: 'Verified customer information', required: true }
    ],
    output_schema: [
      { name: 'policy_document_url', type: 'string', description: 'Link to generated PDF', required: true },
      { name: 'activation_status', type: 'string', description: 'Status in core system', required: true }
    ],
    instructions: 'Generate policy documents based on approved underwriting terms. Ensure all legal disclosures are included.',
    tools: ['document_generator', 'core_insurance_api'],
    constraints: ['Documents must be archived in immutable storage'],
    confidence_score: true,
    human_override_hook: false,
    version: '1.0.0',
    status: 'active',
    last_updated: '2026-03-30T11:00:00Z'
  },
  {
    agent_id: 'sales_intake_01',
    name: 'Sales Intake Specialist',
    type: 'doc_intelligence',
    description: 'Processes new sales applications by extracting demographic and salary data, then generating a unique sales code via REST integration.',
    input_schema: [
      { name: 'demographics', type: 'object', description: 'User demographic information', required: true },
      { name: 'salary_info', type: 'object', description: 'Salary and financial details', required: true },
      { name: 'channel', type: 'string', description: 'Intake channel (PORTAL, EMAIL)', required: true }
    ],
    output_schema: [
      { name: 'sales_code', type: 'string', description: 'Generated unique sales code', required: true },
      { name: 'validation_status', type: 'string', description: 'Status of data validation', required: true },
      { name: 'communication_sent', type: 'boolean', description: 'True if code was sent to user', required: true }
    ],
    instructions: 'Extract and validate demographic and salary data. Use the integrated REST service to generate a unique sales code. Ensure the code is communicated back via the appropriate channel.',
    tools: ['sales_code_generator_api', 'communication_service'],
    constraints: ['Strict data privacy for salary information', 'Codes must be unique and time-bound'],
    confidence_score: true,
    human_override_hook: true,
    version: '1.0.0',
    status: 'active',
    last_updated: '2026-03-31T07:27:00Z'
  }
];
