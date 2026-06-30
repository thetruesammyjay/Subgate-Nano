import { createDatabase, createDbPool } from "@subgate/db";
import { buildApiApp } from "./app.js";
import { loadApiEnv } from "./env.js";

const env = loadApiEnv();
const pool = createDbPool(env.DATABASE_URL);
const db = createDatabase(pool);

const app = await buildApiApp({ db, env });

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
