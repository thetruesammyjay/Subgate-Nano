import Fastify from "fastify";
import { healthStatusSchema, type HealthStatus } from "@subgate/types";
import type { SubgateDatabase } from "@subgate/db";
import type { ApiEnv } from "./env.js";
import { registerRoutes, type X402SettlementService } from "./routes.js";

export type BuildApiAppOptions = {
  db: SubgateDatabase;
  env: ApiEnv;
  facilitator?: X402SettlementService;
};

export const buildApiApp = async ({
  db,
  env,
  facilitator,
}: BuildApiAppOptions) => {
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

  await registerRoutes(
    app,
    db,
    env,
    facilitator ? { facilitator } : {},
  );

  return app;
};
