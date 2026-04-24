import { AgentService } from "./agent.service.js";
import type {
  JsonObject,
  WorkflowDecision,
  WorkflowStepExecutionInput,
  WorkflowStepExecutionResult,
  WorkflowStepType
} from "./workflow.types.js";

function parseStepType(value: string): WorkflowStepType | null {
  const supported: WorkflowStepType[] = [
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
  ];
  return supported.includes(value as WorkflowStepType) ? (value as WorkflowStepType) : null;
}

function parseConfig(config: unknown): JsonObject {
  if (!config || typeof config !== "object") {
    return {};
  }
  return config as JsonObject;
}

function normalizeDecision(value: unknown): WorkflowDecision {
  if (value === "APPROVED" || value === "REJECTED" || value === "REVIEW_REQUIRED") {
    return value;
  }
  return "REVIEW_REQUIRED";
}

function getRequiredSchemaFields(config: JsonObject, key: "inputSchema" | "outputSchema"): string[] {
  const schema = config[key];
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return [];
  }
  const required = (schema as { required?: unknown }).required;
  if (!Array.isArray(required)) {
    return [];
  }
  return required.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function findMissingRequiredFields(source: JsonObject, required: string[]): string[] {
  return required.filter((field) => {
    const value = source[field];
    return (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length === 0)
    );
  });
}

function normalizeConfidence(output: JsonObject): number {
  const confidence =
    typeof output.confidence_level === "number"
      ? output.confidence_level
      : typeof output.confidence === "number"
        ? output.confidence
        : 0.75;

  if (Number.isNaN(confidence)) {
    return 0.75;
  }
  return Math.max(0, Math.min(1, confidence));
}

export async function executeWorkflowStep(
  input: WorkflowStepExecutionInput,
  agentService: AgentService
): Promise<WorkflowStepExecutionResult> {
  const stepType = parseStepType(input.step.stepType);
  if (!stepType) {
    return {
      status: "failed",
      output: {},
      errorMessage: `Unsupported workflow step type: ${input.step.stepType}`
    };
  }

  const config = parseConfig(input.step.config);
  const requiredInputFields = getRequiredSchemaFields(config, "inputSchema");
  const missingInputFields = findMissingRequiredFields(input.payload, requiredInputFields);
  if (missingInputFields.length > 0) {
    return {
      status: "failed",
      output: {
        error: "Missing required input fields",
        missingInputFields
      },
      errorMessage: `Schema input validation failed. Missing: ${missingInputFields.join(", ")}`
    };
  }

  try {
    switch (stepType) {
      case "EMAIL_INTAKE": {
        const result = await agentService.executeStep({
          executionId: input.executionId,
          caseId: input.caseId,
          workflowId: input.workflowId,
          stepId: input.step.id,
          stepName: input.step.name,
          stepType,
          payload: input.payload,
          context: input.context,
          config
        });
        return {
          status: "completed",
          output: result.output
        };
      }
      case "HUMAN_REVIEW": {
        return {
          status: "completed",
          requiresHumanReview: true,
          decision: "REVIEW_REQUIRED",
          output: {
            reason: typeof config.reason === "string"
              ? config.reason
              : "Workflow routed to human review step."
          }
        };
      }
      case "APPROVAL": {
        return {
          status: "completed",
          decision: "APPROVED",
          output: {
            status: "approved",
            approvedAt: new Date().toISOString()
          }
        };
      }
      case "REJECTION": {
        return {
          status: "completed",
          decision: "REJECTED",
          output: {
            status: "rejected",
            reason: input.context.decisionReason ?? "Rejected by workflow decision step",
            rejectedAt: new Date().toISOString()
          }
        };
      }
      case "SLA_CHECK": {
        const slaHours = typeof config.slaHours === "number" ? config.slaHours : 48;
        const caseCreatedAt = typeof input.payload.caseCreatedAt === "string"
          ? new Date(input.payload.caseCreatedAt)
          : new Date();
        const deadline = new Date(caseCreatedAt.getTime() + slaHours * 60 * 60 * 1000);
        const now = new Date();
        const breached = now > deadline;
        const remainingHours = Math.max(0, Math.round((deadline.getTime() - now.getTime()) / 3_600_000));
        return {
          status: "completed",
          output: {
            slaStatus: breached ? "breached" : "active",
            deadlineAt: deadline.toISOString(),
            checkedAt: now.toISOString(),
            breached,
            remainingHours
          }
        };
      }
      default: {
        const result = await agentService.executeStep({
          executionId: input.executionId,
          caseId: input.caseId,
          workflowId: input.workflowId,
          stepId: input.step.id,
          stepName: input.step.name,
          stepType,
          payload: input.payload,
          context: input.context,
          config
        });

        const normalizedOutput: JsonObject = {
          ...result.output,
          confidence_level: normalizeConfidence(result.output)
        };

        const requiredOutputFields = getRequiredSchemaFields(config, "outputSchema");
        const missingOutputFields = findMissingRequiredFields(normalizedOutput, requiredOutputFields);
        if (missingOutputFields.length > 0) {
          return {
            status: "failed",
            output: {
              ...normalizedOutput,
              error: "Missing required output fields",
              missingOutputFields
            },
            errorMessage: `Schema output validation failed. Missing: ${missingOutputFields.join(", ")}`
          };
        }

        const decision = stepType === "DECISION"
          ? normalizeDecision(result.decision ?? normalizedOutput.decision)
          : undefined;
        const minConfidence = typeof config.minConfidence === "number" ? config.minConfidence : 0.8;
        const confidenceLevel =
          typeof normalizedOutput.confidence_level === "number"
            ? normalizedOutput.confidence_level
            : normalizeConfidence(normalizedOutput);
        const requiresHumanReview = (
          decision === "REVIEW_REQUIRED" ||
          Boolean(normalizedOutput.requiresHumanReview) ||
          confidenceLevel < minConfidence
        );

        return {
          status: "completed",
          output: normalizedOutput,
          decision,
          requiresHumanReview
        };
      }
    }
  } catch (error) {
    return {
      status: "failed",
      output: {
        error: error instanceof Error ? error.message : "Unknown step execution error"
      },
      errorMessage: error instanceof Error ? error.message : "Unknown step execution error"
    };
  }
}

