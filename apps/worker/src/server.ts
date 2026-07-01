import { createDatabase, createDbPool } from "@subgate/db";
import { createStreamingWorkerRepository } from "./db-repository.js";
import { loadWorkerEnv } from "./env.js";
import { StreamingWorker } from "./streaming-worker.js";

const env = loadWorkerEnv();
const pool = createDbPool(env.DATABASE_URL);
const db = createDatabase(pool);
const worker = new StreamingWorker({
  repository: createStreamingWorkerRepository(db, {
    platformFeePercent: env.PLATFORM_FEE_PERCENT,
  }),
  batchThresholdUsdc: env.STREAMING_BATCH_THRESHOLD_USDC,
  sessionLimit: env.WORKER_STREAMING_SESSION_LIMIT,
});

let isTicking = false;

const tick = async () => {
  if (isTicking) {
    return;
  }

  isTicking = true;

  try {
    const result = await worker.tickOnce();

    if (result.ticked > 0 || result.settled > 0 || result.closed > 0) {
      console.info(
        `streaming tick: scanned=${result.scanned} ticked=${result.ticked} settled=${result.settled} closed=${result.closed}`,
      );
    }
  } catch (error) {
    console.error(error, "Streaming worker tick failed.");
  } finally {
    isTicking = false;
  }
};

const interval = setInterval(() => {
  void tick();
}, env.WORKER_POLL_INTERVAL_MS);

const shutdown = async () => {
  clearInterval(interval);
  await pool.end();
};

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

console.info("Subgate streaming worker started.");
void tick();
