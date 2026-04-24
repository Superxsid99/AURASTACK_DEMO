import { Worker } from "bullmq";
import { WORKFLOW_QUEUE_NAME } from "./workflow.queue.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
const internalWorkerToken = process.env.INTERNAL_WORKER_TOKEN ?? "dev-worker-token";

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

export function createWorkflowWorker(): Worker {
  return new Worker(
    WORKFLOW_QUEUE_NAME,
    async (job) => {
      const body = {
        executionId: String(job.data.executionId),
        token: internalWorkerToken
      };

      const response = await fetch(`${apiInternalUrl}/internal/workflows/process`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Workflow process call failed: ${response.status} ${text}`);
      }
    },
    {
      connection: buildRedisConnection(redisUrl),
      concurrency: 4
    }
  );
}

