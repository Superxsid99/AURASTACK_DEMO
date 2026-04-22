import { Department, ExecutionStatus } from './execution';

export type CaseStatus = 'CRITICAL' | 'ELEVATED' | 'STABLE' | 'IN_REVIEW' | 'RESOLVED';

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: {
    id: string;
    name: string;
    type: 'agent' | 'human' | 'system';
    role?: string;
  };
  action: string;
  node_id?: string;
  duration_ms?: number;
  signature: string; // Cryptographic hash for HIPAA accountability
  metadata?: Record<string, any>;
}

export interface Case {
  id: string;
  title: string;
  description: string;
  category?: 'MEDICAL' | 'AUTO' | 'PROPERTY' | 'LIFE' | 'GENERAL';
  status: CaseStatus;
  execution_status?: ExecutionStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  type: 'CLAIM' | 'UNDERWRITING' | 'KYC' | 'COMPLIANCE' | 'ADMISSION' | 'DIAGNOSTIC' | 'DISCHARGE' | 'RENEWAL' | 'POLICY_SERVICING' | 'SALES';
  department: Department;
  
  // Structured Business Data
  claimant?: {
    name: string;
    dob: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    id: string;
    email?: string;
  };
  
  financials?: {
    total_billed: number;
    total_paid: number;
    reserve_amount: number;
    currency: string;
  };
  
  dates?: {
    incident_date: string;
    service_date: string;
    closed_at?: string;
  };
  
  policy?: {
    policy_number: string;
    policy_type: string;
    carrier: string;
  };
  
  sla?: {
    due_date: string;
    status: 'ON_TRACK' | 'AT_RISK' | 'BREACHED';
  };

  created_at: string;
  last_updated: string;
  assigned_to?: string;
  workflow_id?: string;
  current_node_id?: string;
  risk_score?: number;
  compliance_score?: number;
  summary?: string;
  metadata?: Record<string, any>;
  audit_trail?: AuditEntry[];
  documents?: {
    id: string;
    name: string;
    type: string;
    status: 'VERIFIED' | 'PENDING' | 'REJECTED';
    uploaded_at: string;
    size: string;
    url?: string;
    extraction_data?: Record<string, any>;
  }[];
  timeline: {
    title: string;
    description: string;
    timestamp: string;
    type: 'system' | 'ai' | 'human';
  }[];
  ai_insights?: {
    id: string;
    type: 'RISK' | 'OPPORTUNITY' | 'ANOMALY' | 'COMPLIANCE';
    title: string;
    description: string;
    confidence: number;
    agent_id: string;
    timestamp: string;
  }[];
  risk_markers?: {
    id: string;
    type: string;
    status: 'CRITICAL' | 'WARNING' | 'INFO';
    description: string;
  }[];
  document_extraction_status?: {
    id: string;
    type: string;
    progress: number;
    status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'FAILED';
  }[];
}
