export type Department = 
  | 'CLAIMS' 
  | 'POLICY_ISSUANCE' 
  | 'KYC_ONBOARDING' 
  | 'UNDERWRITING' 
  | 'POLICY_SERVICING' 
  | 'RENEWALS' 
  | 'COMPLIANCE'
  | 'SYSTEM'
  | 'SALES'
  | 'EMERGENCY'
  | 'RADIOLOGY'
  | 'NURSING'
  | 'FINANCE'
  | 'GENERAL';

export type ExecutionStatus = 
  | 'PENDING' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'RETRYING' 
  | 'ESCALATED';

export interface ExecutionEvent {
  id: string;
  type: string;
  source_node_id: string;
  target_node_id: string;
  payload: any;
  timestamp: string;
}

export interface TaskInstance {
  id: string;
  case_id: string;
  workflow_id: string;
  node_id: string;
  parent_task_id?: string;
  actor: {
    type: 'agent' | 'human' | 'system';
    id: string;
  };
  status: ExecutionStatus;
  input: any;
  output?: any;
  error?: string;
  started_at: string;
  completed_at?: string;
  retry_count: number;
}

export interface ExecutionLog {
  id: string;
  case_id: string;
  task_id: string;
  event: string;
  details: string;
  timestamp: string;
  department: Department;
}
