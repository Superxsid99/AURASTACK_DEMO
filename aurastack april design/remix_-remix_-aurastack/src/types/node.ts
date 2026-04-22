export type NodeType = 
  | 'input' 
  | 'ai_task' 
  | 'validation' 
  | 'decision' 
  | 'human_task' 
  | 'api_call' 
  | 'delay' 
  | 'sub_workflow'
  | 'fork'
  | 'join'
  | 'dmn'
  | 'transform'
  | 'end';

export type ExecutionType = 'agent_processing' | 'system_action' | 'human_task' | 'api_call';

export interface NodeConfig {
  agent_id?: string;
  rules?: string[];
  conditions?: { if: string; go_to: string }[];
  role?: string;
  action?: string;
  endpoint?: string;
  duration?: string;
  workflow_ref?: string;
  retry?: {
    max_attempts: number;
    on_fail: string;
    fallback_node_id?: string;
  };
  input_mapping?: Record<string, string>;
  output_mapping?: Record<string, string>;
  output_schema?: string;
  join_type?: 'wait_all' | 'wait_any';
  dmn_table?: {
    inputs: string[];
    outputs: string[];
    rules: {
      inputs: string[];
      outputs: string[];
    }[];
  };
  transform_mapping?: {
    source: string;
    target: string;
    expression?: string;
  }[];
}
