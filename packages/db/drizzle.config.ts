import { defineConfig } from "drizzle-kit";
import { loadDbEnv } from "./src/env.ts";

const env = loadDbEnv();

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
