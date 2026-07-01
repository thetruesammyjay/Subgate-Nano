import { z } from "zod";

const workerEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  WORKER_STREAMING_SESSION_LIMIT: z.coerce.number().int().positive().default(50),
  STREAMING_BATCH_THRESHOLD_USDC: z.coerce.number().positive().default(0.01),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(5),
  WORKER_HEALTH_FILE: z.string().min(1).default(".subgate-worker-health.json"),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export const loadWorkerEnv = (
  source: NodeJS.ProcessEnv = process.env,
): WorkerEnv => {
  return workerEnvSchema.parse(source);
};
