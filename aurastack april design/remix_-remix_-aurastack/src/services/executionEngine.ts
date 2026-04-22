import { v4 as uuidv4 } from 'uuid';
import { Case, AuditEntry } from '../types/case';
import { WorkflowDefinition, Node } from '../types/workflow';
import { TaskInstance, ExecutionLog, ExecutionEvent, ExecutionStatus, Department } from '../types/execution';
import { AgentDefinition } from '../types/agent';
import { aiService } from './aiService';
import { apiService } from './apiService';

export class ExecutionEngine {
  private static instance: ExecutionEngine;
  
  private setCases: React.Dispatch<React.SetStateAction<Case[]>> | null = null;
  private setTasks: React.Dispatch<React.SetStateAction<TaskInstance[]>> | null = null;
  private setLogs: React.Dispatch<React.SetStateAction<ExecutionLog[]>> | null = null;
  private onNodeExecute: ((nodeId: string | null) => void) | null = null;
  
  private processedEvents: Set<string> = new Set();
  private eventQueue: ExecutionEvent[] = [];
  private isProcessing: boolean = false;

  private constructor() {}

  public static getInstance(): ExecutionEngine {
    if (!ExecutionEngine.instance) {
      ExecutionEngine.instance = new ExecutionEngine();
    }
    return ExecutionEngine.instance;
  }

  public init(
    setCases: React.Dispatch<React.SetStateAction<Case[]>>,
    setTasks: React.Dispatch<React.SetStateAction<TaskInstance[]>>,
    setLogs: React.Dispatch<React.SetStateAction<ExecutionLog[]>>,
    onNodeExecute?: (nodeId: string | null) => void
  ) {
    this.setCases = setCases;
    this.setTasks = setTasks;
    this.setLogs = setLogs;
    this.onNodeExecute = onNodeExecute || null;
  }

  private generateSignature(data: any): string {
    // Simulate a cryptographic signature (HMAC-SHA256)
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `sig_v1_${Math.abs(hash).toString(16)}_${uuidv4().split('-')[0]}`;
  }

  public async emitEvent(event: ExecutionEvent, cases: Case[], workflows: WorkflowDefinition[], agents: AgentDefinition[], tasks: TaskInstance[]) {
    if (this.processedEvents.has(event.id)) return;
    
    this.processedEvents.add(event.id);
    this.eventQueue.push(event);
    this.log('SYSTEM', `Event emitted: ${event.type}`, event.source_node_id, '');
    
    if (!this.isProcessing) {
      this.processQueue(cases, workflows, agents, tasks);
    }
  }

  private async processQueue(cases: Case[], workflows: WorkflowDefinition[], agents: AgentDefinition[], tasks: TaskInstance[]) {
    this.isProcessing = true;
    
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (!event) continue;

      // Find all nodes across all active cases that consume this event
      for (const targetCase of cases) {
        if (targetCase.execution_status === 'COMPLETED' || targetCase.execution_status === 'FAILED') continue;

        const workflow = workflows.find(w => w.workflow_id === targetCase.workflow_id);
        if (!workflow) continue;

        // Find nodes that consume this event
        const matchingNodes = workflow.nodes.filter(n => n.execution.consumes_event === event.type);
        
        for (const node of matchingNodes) {
          // Check department context
          if (node.execution.department !== targetCase.metadata?.active_department && node.execution.department !== 'SYSTEM') {
            this.log(node.execution.department, `Node skipped: Department mismatch (${node.execution.department} vs ${targetCase.metadata?.active_department})`, targetCase.id, '');
            continue;
          }

          await this.executeNode(targetCase, workflow, node, agents, workflows, tasks, cases);
        }
      }
    }

    this.isProcessing = false;
  }

  public async executeNode(targetCase: Case, workflow: WorkflowDefinition, node: Node, agents: AgentDefinition[], workflows: WorkflowDefinition[], tasks: TaskInstance[], cases: Case[], parentTaskId?: string) {
    this.onNodeExecute?.(node.id);
    const taskId = uuidv4();
    const department = node.execution.department;
    const startTime = Date.now();

    // 1. Create Task Instance (MANDATORY)
    const input = this.resolveInput(node, targetCase);
    const actor = this.determineActor(node, agents);
    const newTask: TaskInstance = {
      id: taskId,
      case_id: targetCase.id,
      workflow_id: workflow.workflow_id,
      node_id: node.id,
      parent_task_id: parentTaskId,
      actor,
      status: 'IN_PROGRESS',
      input,
      started_at: new Date().toISOString(),
      retry_count: 0
    };

    this.setTasks?.(prev => [...prev, newTask]);
    this.log(department, `Task created for node: ${node.label} (${node.execution.execution_type})`, targetCase.id, taskId);

    // 2. Perform Action (Real Execution)
    try {
      if (node.execution.execution_type === 'human_task') {
        this.log(department, `Awaiting human action: ${node.label}`, targetCase.id, taskId);
        return;
      }

      // Execute logic based on type
      let output: any = null;
      if (node.execution.execution_type === 'agent_processing') {
        output = await this.executeAgentLogic(node, targetCase, input, agents);
      } else if (node.execution.execution_type === 'system_action') {
        output = await this.executeSystemAction(node, targetCase, input);
      } else if (node.execution.execution_type === 'api_call') {
        output = await this.executeApiCall(node, targetCase, input);
      }

      // 3. Write Output (MANDATORY)
      if (!output) throw new Error(`Node ${node.id} failed to produce output`);
      
      const updatedMetadata = this.applyWrites(node, targetCase, output);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 4. Update Task
      this.setTasks?.(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        status: 'COMPLETED', 
        output, 
        completed_at: new Date(endTime).toISOString() 
      } : t));

      // 5. Create Audit Entry (HIPAA Compliance)
      const auditEntry: AuditEntry = {
        id: uuidv4(),
        timestamp: new Date(endTime).toISOString(),
        actor: {
          id: actor.id,
          name: actor.type === 'agent' ? agents.find(a => a.agent_id === actor.id)?.name || actor.id : actor.id,
          type: actor.type,
          role: actor.type === 'human' ? node.config.role : undefined
        },
        action: `Executed node: ${node.label}`,
        node_id: node.id,
        duration_ms: duration,
        signature: this.generateSignature({ taskId, caseId: targetCase.id, actor, output }),
        metadata: {
          node_type: node.type,
          workflow_id: workflow.workflow_id
        }
      };

      apiService.logAudit('NODE_EXECUTION', targetCase.id, { node_id: node.id, status: 'COMPLETED' });

      // 6. Update Case State
      this.setCases?.(prev => prev.map(c => c.id === targetCase.id ? {
        ...c,
        current_node_id: node.id,
        last_updated: new Date().toISOString(),
        metadata: updatedMetadata,
        audit_trail: [...(c.audit_trail || []), auditEntry],
        timeline: [
          ...c.timeline,
          {
            title: `Step Completed: ${node.label}`,
            description: `Executed by ${newTask.actor.type} (${newTask.actor.id})`,
            timestamp: new Date().toISOString(),
            type: newTask.actor.type === 'agent' ? 'ai' : newTask.actor.type === 'human' ? 'human' : 'system'
          }
        ]
      } : c));

      this.log(department, `Node execution successful: ${node.label}`, targetCase.id, taskId);

      // 7. Emit Event (MANDATORY)
      const nextEvent: ExecutionEvent = {
        id: uuidv4(),
        type: node.execution.produces_event,
        source_node_id: node.id,
        target_node_id: '', // Event-driven, target determined by consumers
        payload: output,
        timestamp: new Date().toISOString()
      };
      
      this.emitEvent(nextEvent, cases, workflows, agents, tasks);

    } catch (error: any) {
      this.handleFailure(targetCase, workflow, node, taskId, error.message, agents, workflows, tasks, cases);
    }
  }

  private async executeAgentLogic(node: Node, targetCase: Case, input: any, agents: AgentDefinition[]): Promise<any> {
    const agent = agents.find(a => a.agent_id === node.config.agent_id);
    if (!agent) {
      throw new Error(`Agent ${node.config.agent_id} not found`);
    }

    this.log(node.execution.department, `Agent ${agent.name} starting execution...`, targetCase.id, '');
    
    try {
      const result = await aiService.executeAgent(agent, targetCase, input);
      this.log(node.execution.department, `Agent ${agent.name} completed with confidence ${result.confidence}`, targetCase.id, '');
      
      // Update case with AI insights and risk markers from agent result
      const newInsight = {
        id: uuidv4(),
        type: 'RISK' as const,
        title: `${agent.name} Analysis`,
        description: result.data.summary || result.data.description || `Agent ${agent.name} completed analysis of current case context.`,
        confidence: result.confidence,
        agent_id: agent.agent_id,
        timestamp: new Date().toISOString()
      };

      const newMarker = {
        id: uuidv4(),
        type: agent.type,
        status: result.confidence > 0.9 ? 'INFO' as const : 'WARNING' as const,
        description: `Analysis completed by ${agent.name} with ${Math.round(result.confidence * 100)}% confidence.`
      };

      this.setCases?.(prev => prev.map(c => c.id === targetCase.id ? {
        ...c,
        ai_insights: [newInsight, ...(c.ai_insights || [])],
        risk_markers: [newMarker, ...(c.risk_markers || [])],
        compliance_score: result.data.compliance_score || c.compliance_score,
        risk_score: result.data.risk_score || c.risk_score
      } : c));

      // Special handling for Hospital Exchange Coordinator
      if (agent.agent_id === 'hospital_coord_01') {
        const event = new CustomEvent('hospital-message-sent', {
          detail: {
            caseId: targetCase.id,
            content: `[OUTBOUND TO HOSPITAL] Requesting further medical records for patient ${targetCase.claimant?.name || 'N/A'}. Case ID: ${targetCase.id}`,
            sender: 'AI'
          }
        });
        window.dispatchEvent(event);
      }

      return result;
    } catch (error: any) {
      this.log(node.execution.department, `Agent ${agent.name} execution failed: ${error.message}`, targetCase.id, '');
      throw error;
    }
  }

  private async executeSystemAction(node: Node, targetCase: Case, input: any): Promise<any> {
    // Simulate system action (API call, DB update)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < 0.02) reject(new Error('System integration failure'));
        resolve({ 
          status: 'success', 
          data: { 
            action_performed: node.config.action || 'system_update',
            timestamp: new Date().toISOString(),
            ...input 
          } 
        });
      }, 500);
    });
  }

  private async executeApiCall(node: Node, targetCase: Case, input: any): Promise<any> {
    const endpoint = node.config.endpoint || '/api/v1/generic';
    this.log(node.execution.department, `Calling REST API: ${endpoint}`, targetCase.id, '');

    // Simulate REST API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < 0.02) reject(new Error(`API Call failed: ${endpoint}`));
        
        let data: any = { 
          status: 'success', 
          timestamp: new Date().toISOString(),
          endpoint
        };

        // Special logic for sales code generation
        if (endpoint === '/api/v1/generate-sales-code') {
          const prefix = input.channel === 'CHAT' ? 'CH' : 'EM';
          const random = Math.floor(1000 + Math.random() * 9000);
          const zip = input.demographics?.zip || '00000';
          data.sales_code = `${prefix}-${random}-${zip}`;
          this.log(node.execution.department, `Generated Sales Code: ${data.sales_code}`, targetCase.id, '');
        } else if (endpoint === '/api/v1/send-communication') {
          data.communication_sent = true;
          this.log(node.execution.department, `Communication sent via ${input.channel}`, targetCase.id, '');
          
          // Dispatch event for UI feedback
          const event = new CustomEvent('aura-communication-sent', {
            detail: {
              caseId: targetCase.id,
              content: `[SYSTEM] Your sales application has been processed. Your unique code is: ${input.sales_code || 'PENDING'}.`,
              channel: input.channel
            }
          });
          window.dispatchEvent(event);
        }

        resolve({ status: 'success', data });
      }, 1000);
    });
  }

  private applyWrites(node: Node, targetCase: Case, output: any): any {
    const writes = node.execution.writes;
    if (!writes || writes.length === 0) return targetCase.metadata || {};

    const updatedMetadata = { ...(targetCase.metadata || {}) };
    const outputData = output?.data || {};

    writes.forEach(field => {
      // If the field exists in outputData, write it to metadata
      if (outputData[field] !== undefined) {
        updatedMetadata[field] = outputData[field];
      } else {
        // Fallback: just mark that the node wrote something
        updatedMetadata[`${node.id}_completed`] = true;
      }
    });

    return updatedMetadata;
  }

  public async completeHumanTask(taskId: string, output: any, cases: Case[], workflows: WorkflowDefinition[], agents: AgentDefinition[], tasks: TaskInstance[]) {
    const task = tasks?.find((t: TaskInstance) => t.id === taskId);
    if (!task || task.status !== 'IN_PROGRESS') return;

    const targetCase = cases.find(c => c.id === task.case_id);
    const workflow = workflows.find(w => w.workflow_id === task.workflow_id);
    if (!targetCase || !workflow) return;

    const node = workflow.nodes.find(n => n.id === task.node_id);
    if (!node) return;

    const department = node.execution.department;
    const endTime = Date.now();
    const startTime = new Date(task.started_at).getTime();
    const duration = endTime - startTime;

    // 1. Update Task
    this.setTasks?.(prev => prev.map(t => t.id === taskId ? { 
      ...t, 
      status: 'COMPLETED', 
      output, 
      completed_at: new Date(endTime).toISOString() 
    } : t));

    // 2. Write Output
    const updatedMetadata = this.applyWrites(node, targetCase, output);

    // 3. Create Audit Entry
    const auditEntry: AuditEntry = {
      id: uuidv4(),
      timestamp: new Date(endTime).toISOString(),
      actor: {
        id: task.actor.id,
        name: task.actor.id,
        type: 'human',
        role: node.config.role
      },
      action: `Human action completed: ${node.label}`,
      node_id: node.id,
      duration_ms: duration,
      signature: this.generateSignature({ taskId, caseId: targetCase.id, actor: task.actor, output }),
      metadata: {
        node_type: node.type,
        workflow_id: workflow.workflow_id
      }
    };

    apiService.logAudit('HUMAN_ACTION_COMPLETED', targetCase.id, { node_id: node.id });

    // 4. Update Case State
    this.setCases?.(prev => prev.map(c => c.id === targetCase.id ? {
      ...c,
      last_updated: new Date().toISOString(),
      metadata: updatedMetadata,
      audit_trail: [...(c.audit_trail || []), auditEntry],
      timeline: [
        ...c.timeline,
        {
          title: `Human Action Completed: ${node.label}`,
          description: `Action taken by ${task.actor.id}`,
          timestamp: new Date().toISOString(),
          type: 'human'
        }
      ]
    } : c));

    this.log(department, `Human task completed: ${node.label}`, targetCase.id, taskId);

    // 5. Emit Event
    const nextEvent: ExecutionEvent = {
      id: uuidv4(),
      type: node.execution.produces_event,
      source_node_id: node.id,
      target_node_id: '',
      payload: output,
      timestamp: new Date().toISOString()
    };
    
    this.emitEvent(nextEvent, cases, workflows, agents, tasks);
  }

  private resolveInput(node: Node, targetCase: Case): any {
    const inputMapping = node.config.input_mapping;
    if (!inputMapping) return {};

    const resolvedInput: any = {};
    const context = {
      case: targetCase,
      metadata: targetCase.metadata || {},
      documents: targetCase.documents || []
    };

    Object.entries(inputMapping).forEach(([targetKey, sourcePath]) => {
      // Simple path resolver (e.g., "metadata.claim_amount")
      const parts = sourcePath.split('.');
      let current: any = context;
      for (const part of parts) {
        if (current && typeof current === 'object') {
          current = current[part];
        } else {
          current = undefined;
          break;
        }
      }
      resolvedInput[targetKey] = current;
    });

    return resolvedInput;
  }

  private applyOutputMapping(node: Node, targetCase: Case, output: any): any {
    const outputMapping = node.config.output_mapping;
    if (!outputMapping) return targetCase.metadata || {};

    const updatedMetadata = { ...(targetCase.metadata || {}) };
    const outputData = output?.data || {};

    Object.entries(outputMapping).forEach(([sourceKey, targetPath]) => {
      // Simple path setter (e.g., "claim_amount")
      // For now, we only support top-level metadata keys
      updatedMetadata[targetPath] = outputData[sourceKey];
    });

    return updatedMetadata;
  }

  private evaluateCondition(expression: string, targetCase: Case, lastOutput: any): boolean {
    // Simple expression evaluator for simulation
    // In a real system, this would use a safe expression parser
    try {
      // Example expressions: "fraud_score < 0.1", "status === 'valid'", "risk == 'low'"
      // We'll mock some common insurance variables for the simulation
      const context = {
        fraud_score: Math.random(),
        risk: Math.random() > 0.5 ? 'low' : 'high',
        status: 'valid',
        amount: targetCase.metadata?.amount || 5000,
        ...lastOutput?.data
      };

      // Very basic evaluation for simulation purposes
      if (expression.includes('<')) {
        const [prop, val] = expression.split('<').map(s => s.trim());
        return (context as any)[prop] < parseFloat(val);
      }
      if (expression.includes('>')) {
        const [prop, val] = expression.split('>').map(s => s.trim());
        return (context as any)[prop] > parseFloat(val);
      }
      if (expression.includes('===')) {
        const [prop, val] = expression.split('===').map(s => s.trim());
        return (context as any)[prop] === val.replace(/['"]/g, '');
      }
      if (expression.includes('==')) {
        const [prop, val] = expression.split('==').map(s => s.trim());
        return (context as any)[prop] == val.replace(/['"]/g, '');
      }

      return true; // Default to true if we can't parse it yet
    } catch (e) {
      return false;
    }
  }

  private determineActor(node: Node, agents: AgentDefinition[]): { type: 'agent' | 'human' | 'system', id: string } {
    if (node.type === 'ai_task' && node.config.agent_id) {
      return { type: 'agent', id: node.config.agent_id };
    }
    if (node.type === 'human_task') {
      return { type: 'human', id: node.config.role || 'unassigned' };
    }
    return { type: 'system', id: 'aurastack_core' };
  }

  private async performAction(node: Node, targetCase: Case, input: any): Promise<any> {
    // Simulate real execution logic
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Randomly fail for simulation (5% chance)
        if (Math.random() < 0.05) {
          reject(new Error('Network timeout or validation failure'));
        } else {
          resolve({ status: 'success', data: { case_id: targetCase.id, node_type: node.type, ...input } });
        }
      }, 1000);
    });
  }

  private handleFailure(targetCase: Case, workflow: WorkflowDefinition, node: Node, taskId: string, error: string, agents: AgentDefinition[], workflows: WorkflowDefinition[], tasks: TaskInstance[], cases: Case[]) {
    const department = node.execution.department;
    
    this.setTasks?.(prev => prev.map(t => t.id === taskId ? { ...t, status: 'FAILED', error } : t));
    this.log(department, `Execution failed: ${error}`, targetCase.id, taskId);

    // Handle On-Failure Behavior
    if (node.execution.fallback_node_id) {
      const fallbackNode = workflow.nodes.find(n => n.id === node.execution.fallback_node_id);
      if (fallbackNode) {
        this.log(department, `Triggering fallback to node: ${fallbackNode.label}`, targetCase.id, taskId);
        this.executeNode(targetCase, workflow, fallbackNode, agents, workflows, tasks, cases, taskId);
        return;
      }
    }

    // Update Case
    this.setCases?.(prev => prev.map(c => c.id === targetCase.id ? {
      ...c,
      execution_status: 'FAILED',
      timeline: [
        ...c.timeline,
        {
          title: `Execution Failed: ${node.label}`,
          description: error,
          timestamp: new Date().toISOString(),
          type: 'system'
        }
      ]
    } : c));
  }

  private log(department: Department, details: string, caseId: string, taskId: string) {
    const newLog: ExecutionLog = {
      id: uuidv4(),
      case_id: caseId,
      task_id: taskId,
      event: 'EXECUTION_STEP',
      details,
      timestamp: new Date().toISOString(),
      department
    };
    this.setLogs?.(prev => [newLog, ...prev]);
  }
}
