import { Case } from '../types/case';
import { WorkflowDefinition } from '../types/workflow';
import { AgentDefinition } from '../types/agent';
import { RoleId } from '../types/auth';

class ApiService {
  private static instance: ApiService;
  private currentRole: RoleId = 'ADMIN';

  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  public setRole(role: RoleId) {
    this.currentRole = role;
    window.dispatchEvent(new CustomEvent('role-changed', { detail: role }));
  }

  public getRole(): RoleId {
    return this.currentRole;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-user-role': this.currentRole
    };
  }

  public async getCases(): Promise<Case[]> {
    const response = await fetch('/api/cases', { headers: this.getHeaders() });
    return response.json();
  }

  public async getWorkflows(): Promise<WorkflowDefinition[]> {
    const response = await fetch('/api/workflows', { headers: this.getHeaders() });
    return response.json();
  }

  public async getAgents(): Promise<AgentDefinition[]> {
    const response = await fetch('/api/agents', { headers: this.getHeaders() });
    return response.json();
  }

  public async logAudit(action: string, resourceId: string, metadata?: any) {
    await fetch('/api/audit', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ action, resourceId, metadata })
    });
  }
}

export const apiService = ApiService.getInstance();
