import { NodeType, NodeConfig, ExecutionType } from './node';
import { Department } from './execution';

export type { NodeType, NodeConfig };

export interface Node {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  config: NodeConfig;
  execution: {
    execution_type: ExecutionType;
    department: Department;
    consumes_event?: string;
    produces_event: string;
    writes: string[];
    retry_policy?: {
      max_attempts: number;
      backoff_ms: number;
    };
    sla_timeout_ms?: number;
    escalation_node_id?: string;
    compensation_node_id?: string;
    escalation_rule?: string;
    fallback_node_id?: string;
    self_healing?: {
      enabled: boolean;
      supervisor_agent_id: string;
      healing_strategy: 'retry_with_new_params' | 'reroute_to_human' | 'fallback_to_previous_version';
    };
  };
  next: string[];
}

export interface WorkflowDefinition {
  workflow_id: string;
  name: string;
  description: string;
  department: Department;
  version: string;
  status: 'Active' | 'Idle' | 'Running' | 'Draft';
  nodes: Node[];
  last_updated: string;
  ab_test?: {
    enabled: boolean;
    challenger_workflow_id: string;
    traffic_split: number; // 0 to 1
  };
  versions?: {
    version: string;
    created_at: string;
    created_by: string;
    nodes: Node[];
  }[];
  stats?: {
    success?: string;
    volume?: string;
    latency?: string;
    verify?: string;
    auto?: string;
    manual?: string;
  };
}
