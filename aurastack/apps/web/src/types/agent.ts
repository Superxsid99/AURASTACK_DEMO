export type AgentType = 
  | 'doc_intelligence'
  | 'validation'
  | 'fraud_risk'
  | 'compliance'
  | 'decision'
  | 'human_interface'
  | 'integration'
  | 'workflow_control';

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  description: string;
  required: boolean;
}

export interface AgentDefinition {
  agent_id: string;
  name: string;
  type: AgentType;
  description: string;
  input_schema: SchemaField[];
  output_schema: SchemaField[];
  instructions: string;
  tools: string[];
  constraints: string[];
  confidence_score: boolean;
  human_override_hook: boolean;
  version: string;
  status: 'active' | 'draft' | 'archived';
  last_updated: string;
}

export const AGENT_TYPES: { value: AgentType; label: string; description: string }[] = [
  {
    value: 'doc_intelligence',
    label: 'Document Intelligence',
    description: 'Turn raw docs (PDFs, images) into structured data.'
  },
  {
    value: 'validation',
    label: 'Validation',
    description: 'Check correctness and policy alignment.'
  },
  {
    value: 'fraud_risk',
    label: 'Fraud & Risk',
    description: 'Detect anomalies and calculate risk scores.'
  },
  {
    value: 'compliance',
    label: 'Compliance',
    description: 'Regulatory checks (KYC, AML, Sanctions).'
  },
  {
    value: 'decision',
    label: 'Decision',
    description: 'Assistive decision making for claims/underwriting.'
  },
  {
    value: 'human_interface',
    label: 'Human Interface',
    description: 'Bridge AI and human adjusters with summaries.'
  },
  {
    value: 'integration',
    label: 'Integration',
    description: 'Talk to external CRMs, payments, and APIs.'
  },
  {
    value: 'workflow_control',
    label: 'Workflow Control',
    description: 'Optimize routing, SLAs, and retries.'
  }
];
