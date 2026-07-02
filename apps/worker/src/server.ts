import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createDatabase, createDbPool } from "@subgate/db";
import { workerHeartbeatSchema, type WorkerHeartbeat } from "@subgate/types";
import { createStreamingWorkerRepository } from "./db-repository.js";
import { loadWorkerEnv } from "./env.js";
import { loadWorkerLocalEnvFiles } from "./local-env.js";
import type { StreamingWorkerTickResult } from "./streaming-worker.js";
import { StreamingWorker } from "./streaming-worker.js";

loadWorkerLocalEnvFiles();
const env = loadWorkerEnv();
const pool = createDbPool(env.DATABASE_URL);
const db = createDatabase(pool);
const startedAt = new Date();
const healthFile = resolve(env.WORKER_HEALTH_FILE);
let tickCount = 0;
let lastTickAt: string | null = null;
let lastTick: StreamingWorkerTickResult | null = null;
let lastErrorAt: string | null = null;
let lastError: string | null = null;
const worker = new StreamingWorker({
  repository: createStreamingWorkerRepository(db, {
    platformFeePercent: env.PLATFORM_FEE_PERCENT,
    logger: console,
  }),
  batchThresholdUsdc: env.STREAMING_BATCH_THRESHOLD_USDC,
  sessionLimit: env.WORKER_STREAMING_SESSION_LIMIT,
});

let isTicking = false;

const writeHeartbeat = async (status: WorkerHeartbeat["status"]) => {
  const heartbeat = workerHeartbeatSchema.parse({
    service: "worker",
    status,
    timestamp: new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    lastTickAt,
    lastErrorAt,
    lastError,
    tickCount,
    lastTick,
    pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
    batchThresholdUsdc: env.STREAMING_BATCH_THRESHOLD_USDC,
    sessionLimit: env.WORKER_STREAMING_SESSION_LIMIT,
  });

  await mkdir(dirname(healthFile), { recursive: true });
  await writeFile(healthFile, JSON.stringify(heartbeat, null, 2), "utf8");
};

const safeWriteHeartbeat = async (status: WorkerHeartbeat["status"]) => {
  try {
    await writeHeartbeat(status);
  } catch (error) {
    console.warn(
      {
        event: "streaming_worker.heartbeat_write_failed",
        error,
        healthFile,
      },
      "streaming_worker.heartbeat_write_failed",
    );
  }
};

const tick = async () => {
  if (isTicking) {
    return;
  }

  isTicking = true;

  try {
    const result = await worker.tickOnce();
    tickCount += 1;
    lastTickAt = new Date().toISOString();
    lastTick = result;

    if (result.ticked > 0 || result.settled > 0 || result.closed > 0) {
      console.info(
        {
          event: "streaming_worker.tick_completed",
          ...result,
        },
        "streaming_worker.tick_completed",
      );
    }

    await safeWriteHeartbeat("ok");
  } catch (error) {
    lastErrorAt = new Date().toISOString();
    lastError =
      error instanceof Error ? error.message : "Streaming worker tick failed.";
    console.error(
      {
        event: "streaming_worker.tick_failed",
        error,
      },
      "streaming_worker.tick_failed",
    );
    await safeWriteHeartbeat("error");
  } finally {
    isTicking = false;
  }
};

const interval = setInterval(() => {
  void tick();
}, env.WORKER_POLL_INTERVAL_MS);

const shutdown = async () => {
  clearInterval(interval);
  await safeWriteHeartbeat("stopped");
  await pool.end();
};

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

console.info("Subgate streaming worker started.");
await safeWriteHeartbeat("starting");
void tick();
