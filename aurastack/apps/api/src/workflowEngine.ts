import type { PrismaClient } from "@prisma/client";
import { AgentService } from "./agent.service.js";
import { runWorkflowExecution } from "./workflowRunner.js";
import { enqueueWorkflowExecution } from "./workflow.queue.js";
import type { JsonObject } from "./workflow.types.js";

export interface WorkflowEngineDependencies {
  prisma: PrismaClient;
  agentsServiceUrl: string;
  onStepLogged?: Parameters<typeof runWorkflowExecution>[1]["onStepLogged"];
  onHumanReviewRequired?: Parameters<typeof runWorkflowExecution>[1]["onHumanReviewRequired"];
}

export interface StartWorkflowExecutionInput {
  workflowId: string;
  caseId: string;
  input?: JsonObject;
  source?: string;
}

export class WorkflowEngine {
  private readonly agentService: AgentService;
  private readonly fallbackDelayMs = Number(process.env.WORKFLOW_INLINE_FALLBACK_DELAY_MS ?? "2000");

  constructor(private readonly deps: WorkflowEngineDependencies) {
    this.agentService = new AgentService(deps.agentsServiceUrl);
  }

  private scheduleInlineFallback(executionId: string): void {
    const delay = Number.isFinite(this.fallbackDelayMs) && this.fallbackDelayMs > 0
      ? this.fallbackDelayMs
      : 2000;

    setTimeout(async () => {
      try {
        const execution = await this.deps.prisma.workflowExecution.findUnique({
          where: { id: executionId },
          select: { status: true }
        });

        // Queue worker may be disabled/unavailable in local environments.
        // If still queued after a short delay, process inline to avoid stuck cases.
        if (execution?.status === "queued") {
          await this.processExecution(executionId);
        }
      } catch {
        // Best-effort safety net; failures are handled by normal API monitoring.
      }
    }, delay);
  }

  async startExecution(input: StartWorkflowExecutionInput): Promise<{
    executionId: string;
    queued: boolean;
  }> {
    const firstStep = await this.deps.prisma.workflowStep.findFirst({
      where: { workflowId: input.workflowId },
      orderBy: { stepOrder: "asc" }
    });

    if (!firstStep) {
      throw new Error(`Workflow ${input.workflowId} has no steps`);
    }

    const execution = await this.deps.prisma.workflowExecution.create({
      data: {
        workflowId: input.workflowId,
        caseId: input.caseId,
        source: input.source ?? "api",
        status: "queued",
        currentStep: firstStep.id,
        input: (input.input ?? {}) as any,
        context: {} as any
      }
    });

    const queued = await enqueueWorkflowExecution(execution.id);
    if (queued) {
      this.scheduleInlineFallback(execution.id);
    }
    return {
      executionId: execution.id,
      queued
    };
  }

  async processExecution(executionId: string): Promise<void> {
    await runWorkflowExecution(executionId, {
      prisma: this.deps.prisma,
      agentService: this.agentService,
      onStepLogged: this.deps.onStepLogged,
      onHumanReviewRequired: this.deps.onHumanReviewRequired
    });
  }
}

