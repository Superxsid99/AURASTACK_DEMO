import { Queue } from "bullmq";

export const INTAKE_QUEUE_NAME = "intake-jobs";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const queueEnabled = process.env.NODE_ENV === "test"
  ? false
  // Opt-in queueing in non-test envs. This prevents stuck jobs in local/dev
  // when Redis or a queue worker is not actively running.
  : (process.env.INTAKE_QUEUE_ENABLED ?? "false") === "true";

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

const queueConnection = buildRedisConnection(redisUrl);

export const intakeQueue = queueEnabled
  ? new Queue(INTAKE_QUEUE_NAME, { connection: queueConnection })
  : null;

export async function enqueueIntakeJob(jobId: string): Promise<boolean> {
  if (!queueEnabled) {
    return false;
  }

  try {
    if (!intakeQueue) {
      return false;
    }

    await intakeQueue.add(
      "process-intake",
      { jobId },
      {
        jobId: `intake-${jobId}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 500,
        removeOnFail: 500
      }
    );
    return true;
  } catch (error) {
    console.error("[queue] enqueue failed", error);
    return false;
  }
}

export async function closeQueue(): Promise<void> {
  if (intakeQueue) {
    await intakeQueue.close();
  }
}

