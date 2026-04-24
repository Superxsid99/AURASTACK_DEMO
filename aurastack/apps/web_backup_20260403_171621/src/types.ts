export interface Agent {
  id: string;
  name: string;
  type: 'communication' | 'processing' | 'decision' | 'action' | 'monitoring';
  category?: string; // Industry
  role?: string;
  description: string;
  rules: string[];
  checklist: string[];
  goals: string[];
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
  avatar?: string;
  recentActivity?: {
    id: string;
    timestamp: string;
    action: string;
    status: 'success' | 'warning' | 'error';
    details: string;
  }[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'agent' | 'viewer';
  status: 'active' | 'inactive';
  avatar: string;
  lastActive: string;
}

export interface WorkflowStep {
  id: string;
  type: 'trigger' | 'agent' | 'condition' | 'action';
  label: string;
  icon?: string;
  assignedAgentId?: string;
  integration?: 'webhook' | 'mailbox' | 'api' | 'whatsapp';
  description?: string;
}

export interface Workflow {
  id: string;
  name: string;
  category?: string;
  description: string;
  agentIds: string[]; // Multiple agents per workflow
  steps: WorkflowStep[];
  status: 'active' | 'draft' | 'paused';
  createdAt: string;
  automationRate: number;
}

export interface Case {
  id: string;
  title: string;
  type: string;
  category?: string;
  status: 'new' | 'processing' | 'review' | 'completed' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  customer: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  workflowId: string;
  agentId?: string;
  stage: string;
  aiStatus: 'processing' | 'complete' | 'needs review' | 'failed';
  handlingType: 'automated' | 'human-assisted' | 'pending-automation';
  assignedTo?: string; // Human user if escalated
  aiInsights?: string;
  extractedData?: Record<string, any>;
  aiMetrics?: {
    modelConfidence?: number;
    complianceScore?: number;
    riskIndex?: number;
    processingSeconds?: number;
    workflowProgress?: number;
    completedSteps?: number;
    totalSteps?: number;
    runningStep?: string;
  };
  insights?: {
    id: string;
    type: 'warning' | 'info' | 'error' | 'success';
    title: string;
    description: string;
  }[];
  documents?: {
    id: string;
    name: string;
    status: 'uploaded' | 'pending' | 'missing' | 'error';
    pages?: number;
    type: string;
  }[];
  timeline: {
    id: string;
    timestamp: string;
    action: string;
    type: 'system' | 'agent' | 'user';
    actor: string;
    details?: string;
  }[];
}

export interface LiveEvent {
  id: string;
  timestamp: string;
  type: 'automation' | 'escalation' | 'completion' | 'data_extraction';
  title: string;
  description: string;
  caseId: string;
  agentId?: string;
  workflowId: string;
}

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  channel: 'whatsapp' | 'email' | 'chat' | 'voice' | 'app' | 'call' | 'other';
  status: 'unread' | 'read' | 'replied';
  isFlagged?: boolean;
  needsReview?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface ReviewQueueItem {
  id: string;
  caseId: string;
  title: string;
  type: 'Claims Review' | 'Eligibility Check' | 'Policy Comparison' | 'New Application';
  assignedTo?: string;
  status: 'pending' | 'in-review' | 'approved' | 'rejected' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  submittedAt: string;
  agentId: string;
  confidenceScore: number;
  reasonForReview: string;
}

export interface SecurityLog {
  id: string;
  timestamp: string;
  event: string;
  user: string;
  ipAddress: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failed' | 'blocked';
  location: string;
}

export interface Document {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'JPG' | 'PNG' | 'CSV';
  category: 'Policy' | 'Claim' | 'KYC' | 'Medical' | 'Financial';
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  caseId?: string;
  status: 'processed' | 'processing' | 'failed' | 'pending';
  tags: string[];
}
