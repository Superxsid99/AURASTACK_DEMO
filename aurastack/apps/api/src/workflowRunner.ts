import type { PrismaClient } from "@prisma/client";
import { resolveNextStepId } from "./decisionRouter.js";
import { executeWorkflowStep } from "./stepExecutor.js";
import type { AgentService } from "./agent.service.js";
import type { JsonObject, WorkflowRuntimeStep } from "./workflow.types.js";

export interface WorkflowRunnerDependencies {
  prisma: PrismaClient;
  agentService: AgentService;
  onStepLogged?: (args: {
    caseId: string;
    executionId: string;
    stepId: string;
    stepName: string;
    stepType: string;
    status: "running" | "completed" | "failed";
    message: string;
    payload?: JsonObject;
  }) => Promise<void>;
  onHumanReviewRequired?: (args: {
    caseId: string;
    executionId: string;
    reason: string;
  }) => Promise<void>;
}

function parseJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}

function appendTraceHistory(
  context: JsonObject,
  entry: {
    stepId: string;
    stepName: string;
    stepType: string;
    status: "completed" | "failed";
    durationMs: number;
    decision?: string;
    confidenceLevel?: number;
  }
): JsonObject {
  const trace = parseJsonObject(context.trace);
  const history = Array.isArray(trace.history) ? trace.history : [];
  return {
    ...context,
    trace: {
      traceId: trace.traceId ?? `trace_${Date.now().toString(36)}`,
      startedAt: trace.startedAt ?? new Date().toISOString(),
      history: [
        ...history,
        {
          ...entry,
          timestamp: new Date().toISOString()
        }
      ]
    } as JsonObject
  };
}

function mergeContext(context: JsonObject, stepName: string, output: JsonObject): JsonObject {
  return {
    ...context,
    steps: {
      ...(parseJsonObject(context.steps)),
      [stepName]: output
    }
  };
}

export async function runWorkflowExecution(
  executionId: string,
  deps: WorkflowRunnerDependencies
): Promise<void> {
  const { prisma, agentService, onStepLogged, onHumanReviewRequired } = deps;
  const requireWorkflowLogging = (process.env.REQUIRE_WORKFLOW_LOGGING ?? "true") === "true";
  if (requireWorkflowLogging && !onStepLogged) {
    throw new Error("Workflow logging is required but onStepLogged callback is not configured.");
  }

  const execution = await prisma.workflowExecution.findUnique({
    where: { id: executionId },
    include: {
      workflow: {
        include: {
          steps: {
            orderBy: { stepOrder: "asc" }
          }
        }
      },
      case: true
    }
  });

  if (!execution) {
    throw new Error(`Workflow execution not found: ${executionId}`);
  }

  if (execution.workflow.steps.length === 0) {
    throw new Error(`Workflow ${execution.workflowId} has no steps`);
  }

  const stepMap = new Map<string, WorkflowRuntimeStep>(
    execution.workflow.steps.map((step: (typeof execution.workflow.steps)[number]) => [
      step.id,
      {
        id: step.id,
        name: step.name,
        stepType: step.stepType,
        stepOrder: step.stepOrder,
        nextStepId: step.nextStepId,
        config: step.config
      }
    ])
  );
  const orderedSteps: WorkflowRuntimeStep[] = execution.workflow.steps.map((step) => ({
    id: step.id,
    name: step.name,
    stepType: step.stepType,
    stepOrder: step.stepOrder,
    nextStepId: step.nextStepId,
    config: step.config
  }));
  const workflowHasNotifyStep = orderedSteps.some((step) => step.stepType === "NOTIFY_CUSTOMER");

  let currentStep = execution.currentStep
    ? stepMap.get(execution.currentStep) ?? execution.workflow.steps[0]
    : execution.workflow.steps[0];
  let context = parseJsonObject(execution.context);
  const payload = parseJsonObject(execution.input);
  let guard = 0;
  let finalStatus: "completed" | "failed" = "completed";

  await prisma.workflowExecution.update({
    where: { id: execution.id },
    data: {
      status: "running",
      currentStep: currentStep.id
    }
  });

  while (currentStep) {
    guard += 1;
    if (guard > 200) {
      finalStatus = "failed";
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: "failed",
          errorMessage: "Workflow exceeded maximum step iterations",
          finishedAt: new Date()
        }
      });
      break;
    }

    await onStepLogged?.({
      caseId: execution.caseId,
      executionId: execution.id,
      stepId: currentStep.id,
      stepName: currentStep.name,
      stepType: currentStep.stepType,
      status: "running",
      message: `${currentStep.name} started`
    });

    const stepRecord = await prisma.workflowExecutionStep.create({
      data: {
        executionId: execution.id,
        stepId: currentStep.id,
        stepName: currentStep.name,
        stepType: currentStep.stepType,
        status: "running",
        input: {
          payload,
          context
        } as any
      }
    });

    const startedAt = Date.now();
    const result = await executeWorkflowStep({
      executionId: execution.id,
      caseId: execution.caseId,
      workflowId: execution.workflowId,
      step: currentStep,
      payload,
      context
    }, agentService);
    const durationMs = Date.now() - startedAt;

    await prisma.workflowExecutionStep.update({
      where: { id: stepRecord.id },
      data: {
        status: result.status,
        output: result.output as any,
        decision: result.decision ?? null,
        errorMessage: result.errorMessage ?? null,
        finishedAt: new Date(),
        durationMs
      }
    });

    await onStepLogged?.({
      caseId: execution.caseId,
      executionId: execution.id,
      stepId: currentStep.id,
      stepName: currentStep.name,
      stepType: currentStep.stepType,
      status: result.status,
      message: result.status === "completed"
        ? `${currentStep.name} completed`
        : `${currentStep.name} failed`,
      payload: result.output
    });

    if (result.status === "failed") {
      finalStatus = "failed";
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: "failed",
          currentStep: currentStep.id,
          context: context as any,
          errorMessage: result.errorMessage ?? "Workflow step failed",
          finishedAt: new Date()
        }
      });
      await prisma.caseRecord.update({
        where: { id: execution.caseId },
        data: {
          aiStatus: "error",
          status: "escalated",
          workflowStage: `Failed at ${currentStep.name}`
        }
      });
      break;
    }

    context = mergeContext(context, currentStep.name, result.output);
    const confidenceLevel = typeof result.output.confidence_level === "number"
      ? result.output.confidence_level
      : undefined;
    context = appendTraceHistory(context, {
      stepId: currentStep.id,
      stepName: currentStep.name,
      stepType: currentStep.stepType,
      status: result.status,
      durationMs,
      decision: result.decision,
      confidenceLevel
    });
    if (result.decision) {
      context.decision = result.decision;
      if (!context.decisionReason) {
        context.decisionReason = `Decision ${result.decision} at step ${currentStep.name}`;
      }
    }
    if (result.output.reason && typeof result.output.reason === "string") {
      context.decisionReason = result.output.reason;
    }

    if (result.requiresHumanReview || currentStep.stepType === "HUMAN_REVIEW") {
      const reason = typeof result.output.reason === "string"
        ? result.output.reason
        : "Workflow requested human review";
      await onHumanReviewRequired?.({
        caseId: execution.caseId,
        executionId: execution.id,
        reason
      });
    }

    let nextStepId = resolveNextStepId(currentStep, result);
    if (!nextStepId) {
      const currentIndex = orderedSteps.findIndex((step) => step.id === currentStep.id);
      if (currentIndex >= 0 && currentIndex + 1 < orderedSteps.length) {
        nextStepId = orderedSteps[currentIndex + 1].id;
      }
    }
    if (!nextStepId) {
      const finalDecision = result.decision ?? (context.decision as string | undefined);
      let caseStatus: "completed" | "review" | "escalated" = "completed";
      let aiStatus: "complete" | "needs_review" | "error" = "complete";
      let workflowStage = "Workflow Completed";

      if (finalDecision === "REVIEW_REQUIRED") {
        caseStatus = "review";
        aiStatus = "needs_review";
        workflowStage = "Human Review";
      } else if (finalDecision === "REJECTED") {
        caseStatus = "escalated";
        aiStatus = "error";
        workflowStage = "Rejected";
      } else if (finalDecision === "APPROVED") {
        workflowStage = "Approved";
      }

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: "completed",
          currentStep: currentStep.id,
          output: result.output as any,
          context: context as any,
          finishedAt: new Date()
        }
      });
      await prisma.caseRecord.update({
        where: { id: execution.caseId },
        data: {
          status: caseStatus,
          aiStatus,
          workflowStage
        }
      });

      // Keep case/document counters consistent with workflow completion.
      const docAggregate = await prisma.document.groupBy({
        by: ["status"],
        where: { caseId: execution.caseId },
        _count: { _all: true }
      });
      const totalDocs = docAggregate.reduce((sum, row) => sum + row._count._all, 0);

      if (totalDocs > 0) {
        // For successful workflow completion (approved/review), mark pending docs as uploaded.
        if (caseStatus !== "escalated") {
          await prisma.document.updateMany({
            where: { caseId: execution.caseId, status: "pending" },
            data: { status: "uploaded" }
          });
        }

        const uploadedCount = await prisma.document.count({
          where: { caseId: execution.caseId, status: "uploaded" }
        });

        await prisma.caseRecord.update({
          where: { id: execution.caseId },
          data: {
            documentsTotal: totalDocs,
            documentsComplete: uploadedCount
          }
        });
      }

      const customerEmail = typeof payload.customerEmail === "string" ? payload.customerEmail : "";
      if (customerEmail.length > 0 && !workflowHasNotifyStep) {
        try {
          await agentService.executeStep({
            executionId: execution.id,
            caseId: execution.caseId,
            workflowId: execution.workflowId,
            stepId: "auto_notify_customer",
            stepName: "Auto Notify Customer",
            stepType: "NOTIFY_CUSTOMER",
            payload: {
              ...payload,
              customerEmail,
              memberName: payload.memberName,
              caseId: execution.caseId
            },
            context: {
              ...context,
              decision: finalDecision ?? "REVIEW_REQUIRED",
              decisionReason: typeof context.decisionReason === "string" ? context.decisionReason : undefined
            },
            config: {}
          });
        } catch {
          // Notification failure should not fail workflow completion.
        }
      }
      break;
    }

    const nextStep = stepMap.get(nextStepId);
    if (!nextStep) {
      finalStatus = "failed";
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: "failed",
          currentStep: currentStep.id,
          context: context as any,
          errorMessage: `Next step ${nextStepId} not found`,
          finishedAt: new Date()
        }
      });
      await prisma.caseRecord.update({
        where: { id: execution.caseId },
        data: {
          status: "escalated",
          aiStatus: "error",
          workflowStage: `Invalid route from ${currentStep.name}`
        }
      });
      break;
    }

    currentStep = nextStep;
    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        currentStep: currentStep.id,
        context: context as any
      }
    });
  }

  if (finalStatus === "completed") {
    await onStepLogged?.({
      caseId: execution.caseId,
      executionId: execution.id,
      stepId: currentStep?.id ?? "final",
      stepName: currentStep?.name ?? "final",
      stepType: currentStep?.stepType ?? "FINAL",
      status: "completed",
      message: "Workflow execution completed"
    });
  }
}

