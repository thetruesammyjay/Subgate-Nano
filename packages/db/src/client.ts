import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadDbEnv } from "./env.js";
import * as schema from "./schema.js";

export type SubgateDatabase = NodePgDatabase<typeof schema>;

export const createDbPool = (connectionString?: string) => {
  const env = loadDbEnv();

  return new Pool({
    connectionString: connectionString ?? env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: env.DATABASE_URL.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  });
};

export const createDatabase = (pool = createDbPool()): SubgateDatabase => {
  return drizzle(pool, { schema });
};
