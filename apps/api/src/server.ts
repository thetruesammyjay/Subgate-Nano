import Fastify from "fastify";
import { createDatabase, createDbPool } from "@subgate/db";
import {
  healthStatusSchema,
  type HealthStatus,
} from "@subgate/types";
import { loadApiEnv } from "./env.js";
import { registerRoutes } from "./routes.js";

const env = loadApiEnv();
const pool = createDbPool(env.DATABASE_URL);
const db = createDatabase(pool);

const app = Fastify({
  logger: true,
});

app.get("/health", async () => {
  const payload: HealthStatus = {
    service: "api",
    status: "ok",
    timestamp: new Date().toISOString(),
  };

  return healthStatusSchema.parse(payload);
});

await registerRoutes(app, db, env);

app.addHook("onClose", async () => {
  await pool.end();
});

const start = async () => {
  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
