export const WORKFLOW_STEP_TYPES = [
  "EMAIL_INTAKE",
  "EMAIL_REPLY",
  "PRE_PROCESSOR",
  "DOCUMENT_OCR",
  "DATA_EXTRACTION",
  "VALIDATION",
  "KNOWLEDGE_CHECK",
  "DECISION",
  "HUMAN_REVIEW",
  "APPROVAL",
  "REJECTION",
  "CLAIM_CLASSIFICATION",
  "POLICY_LOOKUP",
  "NOTIFY_CUSTOMER",
  "SLA_CHECK",
  "DOCUMENT_VALIDATION",
  "FRAUD_SCREENING",
  "MEDICAL_CODING",
  "COVERAGE_RULES",
  "PROVIDER_NETWORK_CHECK",
  "SETTLEMENT_ESTIMATION",
  "HUMAN_HANDOFF",
  "CUSTOMER_COMMS",
  "AUDIT_COMPLIANCE"
] as const;

export type WorkflowStepType = (typeof WORKFLOW_STEP_TYPES)[number];

export const WORKFLOW_DECISIONS = [
  "APPROVED",
  "REVIEW_REQUIRED",
  "REJECTED"
] as const;

export type WorkflowDecision = (typeof WORKFLOW_DECISIONS)[number];

export type JsonObject = Record<string, unknown>;

export interface WorkflowRuntimeStep {
  id: string;
  name: string;
  stepType: string;
  stepOrder: number;
  nextStepId: string | null;
  config: unknown;
}

export interface WorkflowStepExecutionInput {
  executionId: string;
  caseId: string;
  workflowId: string;
  step: WorkflowRuntimeStep;
  payload: JsonObject;
  context: JsonObject;
}

export interface WorkflowStepExecutionResult {
  status: "completed" | "failed";
  output: JsonObject;
  decision?: WorkflowDecision;
  requiresHumanReview?: boolean;
  errorMessage?: string;
}

