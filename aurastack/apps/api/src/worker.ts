import "dotenv/config";
import { Worker } from "bullmq";
import { INTAKE_QUEUE_NAME } from "./queue.js";
import { createWorkflowWorker } from "./workflow.worker.js";

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

const connection = buildRedisConnection(redisUrl);

const intakeWorker = new Worker(
  INTAKE_QUEUE_NAME,
  async (job) => {
    const body = {
      jobId: String(job.data.jobId),
      token: internalWorkerToken
    };

    const response = await fetch(`${apiInternalUrl}/internal/intake/process`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Internal process call failed: ${response.status} ${text}`);
    }
  },
  {
    connection,
    concurrency: 4
  }
);
const workflowWorker = createWorkflowWorker();
const workers = [intakeWorker, workflowWorker];

for (const queueWorker of workers) {
  queueWorker.on("completed", (job) => {
    console.log(`[worker] completed ${job.id}`);
  });

  queueWorker.on("failed", (job, error) => {
    console.error(`[worker] failed ${job?.id}`, error);
  });
}

async function closeWorkers(): Promise<void> {
  await Promise.all(workers.map((queueWorker) => queueWorker.close()));
}

process.on("SIGINT", async () => {
  await closeWorkers();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeWorkers();
  process.exit(0);
});

