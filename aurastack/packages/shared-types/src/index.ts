export type CasePriority = "critical" | "high" | "medium" | "low";
export type CaseStatus = "new" | "in_progress" | "review" | "completed" | "escalated";
export type AIStatus = "processing" | "complete" | "needs_review" | "error" | "rejected";
export type IntakeJobStatus =
  | "queued"
  | "parsing"
  | "validating"
  | "needs_review"
  | "completed"
  | "failed";
export type ReviewTaskStatus = "open" | "claimed" | "resolved";

export interface CaseSummary {
  id: string;
  caseType: string;
  workflowStage: string;
  assignedUser: string;
  aiStatus: AIStatus;
  priority: CasePriority;
  memberName: string;
  status: CaseStatus;
  createdAt: string;
  documentsTotal: number;
  documentsComplete: number;
}

export interface ReviewTask {
  id: string;
  caseId: string;
  reason: string;
  status: ReviewTaskStatus;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentFlowConfig {
  id: string;
  name: string;
  steps: AgentFlowStep[];
}

export interface AgentFlowStep {
  id: string;
  kind: "extraction" | "validation" | "human_review";
  agentName: string;
  nextOnSuccess: string | null;
  nextOnFailure: string | null;
}

export interface IntakeJobEvent {
  jobId: string;
  caseId: string;
  status: IntakeJobStatus;
  message: string;
  timestamp: string;
}

export interface AgentRunEvent {
  runId: string;
  caseId: string;
  step: string;
  status: IntakeJobStatus;
  output: string;
  timestamp: string;
}

