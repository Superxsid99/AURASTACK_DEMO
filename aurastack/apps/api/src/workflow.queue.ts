import { Queue } from "bullmq";

export const WORKFLOW_QUEUE_NAME = "workflow-executions";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const queueEnabled = process.env.NODE_ENV === "test"
  ? false
  // Opt-in queueing in non-test envs. This keeps workflow execution reliable
  // in local/dev without requiring a dedicated BullMQ worker process.
  : (process.env.WORKFLOW_QUEUE_ENABLED ?? "false") === "true";

function buildRedisConnection(url: string): {
  host: string;
  port: number;
  password?: string;
  username?: string;
  maxRetriesPerRequest: null;
} {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || "6379"),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      maxRetriesPerRequest: null
    };
  } catch {
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null };
  }
}

const workflowQueue = queueEnabled
  ? new Queue(WORKFLOW_QUEUE_NAME, { connection: buildRedisConnection(redisUrl) })
  : null;

export async function enqueueWorkflowExecution(executionId: string): Promise<boolean> {
  if (!queueEnabled) {
    return false;
  }

  try {
    if (!workflowQueue) {
      return false;
    }

    await workflowQueue.add(
      "process-workflow",
      { executionId },
      {
        jobId: `workflow-${executionId}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 500,
        removeOnFail: 500
      }
    );
    return true;
  } catch (error) {
    console.error("[workflow-queue] enqueue failed", error);
    return false;
  }
}

export async function closeWorkflowQueue(): Promise<void> {
  if (workflowQueue) {
    await workflowQueue.close();
  }
}

