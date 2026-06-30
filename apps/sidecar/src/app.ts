import Fastify from "fastify";
import {
  discourseAdapter,
  ghostAdapter,
  toCreateContentInput,
  verifySharedSecretHeader,
} from "@subgate/integrations";
import type { PricingModel } from "@subgate/types";
import type { SidecarEnv } from "./env.js";
import { SubgateClient } from "./subgate-client.js";

export type BuildSidecarAppOptions = {
  env: SidecarEnv;
  subgateClient?: Pick<SubgateClient, "syncContent">;
};

export const buildSidecarApp = async ({
  env,
  subgateClient,
}: BuildSidecarAppOptions) => {
  const app = Fastify({
    logger: true,
  });
  const client =
    subgateClient ??
    new SubgateClient({
      apiUrl: env.SUBGATE_API_URL,
      internalServiceSecret: env.INTERNAL_SERVICE_SECRET,
    });
  const defaultPricing: PricingModel = {
    type: "per_access",
    priceUsdc: env.DEFAULT_PRICE_USDC,
  };

  app.get("/health", async () => {
    return {
      service: "sidecar",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  });

  app.post("/webhooks/ghost/content", async (request, reply) => {
    const providedSecret = request.headers["x-subgate-webhook-secret"];
    const secret = Array.isArray(providedSecret)
      ? providedSecret[0]
      : providedSecret;

    if (!verifySharedSecretHeader(secret, env.GHOST_WEBHOOK_SECRET)) {
      return reply.code(401).send({
        message: "Invalid Ghost webhook credentials.",
      });
    }

    const normalized = ghostAdapter.normalizeContentWebhook(request.body, {
      creatorId: env.DEFAULT_CREATOR_ID,
      defaultPricing,
    });

    if (!normalized) {
      return reply.code(400).send({
        message: "Ghost webhook payload did not contain a supported content object.",
      });
    }

    const content = await client.syncContent(toCreateContentInput(normalized));

    return reply.code(202).send({
      status: "synced",
      platform: normalized.platform,
      externalId: normalized.externalId,
      content,
    });
  });

  app.post("/webhooks/discourse/topic", async (request, reply) => {
    const providedSecret = request.headers["x-subgate-webhook-secret"];
    const secret = Array.isArray(providedSecret)
      ? providedSecret[0]
      : providedSecret;

    if (!verifySharedSecretHeader(secret, env.DISCOURSE_WEBHOOK_SECRET)) {
      return reply.code(401).send({
        message: "Invalid Discourse webhook credentials.",
      });
    }

    const mapping = discourseAdapter.normalizeWebhook?.(request.body, {
      creatorId: env.DEFAULT_CREATOR_ID,
      defaultPricing,
    });

    if (!mapping) {
      return reply.code(400).send({
        message: "Discourse webhook payload did not contain a supported topic.",
      });
    }

    const content = await client.syncContent(toCreateContentInput(mapping.content));

    return reply.code(202).send({
      status: "synced",
      platform: mapping.content.platform,
      externalId: mapping.content.externalId,
      content,
      accessRules: mapping.accessRules,
    });
  });

  return app;
};
