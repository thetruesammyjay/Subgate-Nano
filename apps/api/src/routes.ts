import { createAccessService } from "@subgate/access";
import {
  consumeCreatorMagicLinkToken,
  createPaymentRecord,
  createContent,
  createCreatorMagicLinkToken,
  findPaymentByIdentifier,
  getCreatorBySessionToken,
  getCreatorById,
  getCreatorStats,
  getContentById,
  getContentBySlug,
  listCreatorContentPerformance,
  listCreatorPayments,
  listExternalAccessRules,
  listExternalContentMappings,
  listIntegrationSources,
  listCreators,
  listActiveCatalogItems,
  revokeCreatorSession,
  syncContentBySlug,
  syncExternalIntegrationMapping,
  upsertIntegrationSource,
  type SubgateDatabase,
} from "@subgate/db";
import { quotePricing, serializePricingForStorage } from "@subgate/pricing";
import {
  assertPaymentMatchesRequirement,
  buildPaymentRequired,
  encodePaymentRequired,
  encodePaymentResponse,
  getPaymentPayloadIdentifier,
  parsePaymentPayloadHeader,
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  X402FacilitatorClient,
} from "@subgate/x402";
import {
  accessGrantRequestSchema,
  contentUnlockSchema,
  createContentInputSchema,
  payerAddressSchema,
  pricingModelSchema,
} from "@subgate/types";
import type { FastifyInstance } from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { ApiEnv } from "./env.js";

export type X402SettlementService = Pick<X402FacilitatorClient, "settle">;

export type RegisterRoutesOptions = {
  facilitator?: X402SettlementService;
};

const readPayloadString = (
  payload: Record<string, unknown>,
  key: string,
): string | null => {
  const value = payload[key];

  return typeof value === "string" && value.trim() ? value : null;
};

const createMockSettlementService = (): X402SettlementService => {
  return {
    async settle(paymentPayload) {
      return {
        success: true,
        transaction: `local-x402-${getPaymentPayloadIdentifier(paymentPayload).slice(0, 16)}`,
        network: paymentPayload.accepted.network,
        payer:
          readPayloadString(paymentPayload.payload, "payer") ??
          "0x2222222222222222222222222222222222222222",
        message: "Local mock settlement accepted.",
      };
    },
  };
};

export const registerRoutes = async (
  app: FastifyInstance,
  db: SubgateDatabase,
  env: ApiEnv,
  options: RegisterRoutesOptions = {},
) => {
  const accessService = createAccessService(db);
  const facilitator =
    options.facilitator ??
    (env.X402_FACILITATOR_MODE === "mock"
      ? createMockSettlementService()
      : new X402FacilitatorClient({
          facilitatorUrl: env.X402_FACILITATOR_URL,
        }));
  const requireInternalService = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const providedSecret = request.headers["x-subgate-internal-secret"];
    const secret = Array.isArray(providedSecret)
      ? providedSecret[0]
      : providedSecret;

    if (secret !== env.INTERNAL_SERVICE_SECRET) {
      return reply.code(401).send({
        message: "Internal service credentials are required.",
      });
    }
  };

  app.get("/catalog", async () => {
    return listActiveCatalogItems(db);
  });

  app.post("/auth/creator/magic-link", async (request, reply) => {
    const parsed = z
      .object({
        email: z.string().email(),
      })
      .safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "A valid creator email is required.",
        issues: parsed.error.issues,
      });
    }

    const result = await createCreatorMagicLinkToken(db, parsed.data.email);
    const response: {
      message: string;
      expiresAt?: string;
      devMagicLinkToken?: string;
    } = {
      message:
        "If a creator account exists for that email, a magic link has been issued.",
    };

    if (result) {
      response.expiresAt = result.expiresAt;

      if (process.env.NODE_ENV !== "production") {
        response.devMagicLinkToken = result.token;
        app.log.info(
          {
            creatorId: result.creator.id,
            email: result.creator.email,
            token: result.token,
          },
          "Development creator magic-link token issued.",
        );
      }
    }

    return response;
  });

  app.post("/auth/creator/session", async (request, reply) => {
    const parsed = z
      .object({
        token: z.string().min(16),
      })
      .safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "A valid magic-link token is required.",
        issues: parsed.error.issues,
      });
    }

    const session = await consumeCreatorMagicLinkToken(db, parsed.data.token);

    if (!session) {
      return reply.code(401).send({
        message: "Magic link is invalid, expired, or already used.",
      });
    }

    return session;
  });

  app.get("/auth/creator/session", async (request, reply) => {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";

    if (!token) {
      return reply.code(401).send({
        message: "Creator session token is required.",
      });
    }

    const creator = await getCreatorBySessionToken(db, token);

    if (!creator) {
      return reply.code(401).send({
        message: "Creator session is invalid or expired.",
      });
    }

    return { creator };
  });

  app.post("/auth/creator/logout", async (request) => {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";

    if (token) {
      await revokeCreatorSession(db, token);
    }

    return { ok: true };
  });

  app.get(
    "/creators",
    {
      preHandler: requireInternalService,
    },
    async () => {
      return listCreators(db);
    },
  );

  app.get(
    "/creators/:creatorId/stats",
    {
      preHandler: requireInternalService,
    },
    async (request, reply) => {
      const params = request.params as { creatorId: string };
      const parsed = z.string().uuid().safeParse(params.creatorId);

      if (!parsed.success) {
        return reply.code(400).send({
          message: "A valid creator id is required.",
        });
      }

      const creator = await getCreatorById(db, parsed.data);

      if (!creator) {
        return reply.code(404).send({
          message: "Creator not found.",
        });
      }

      return getCreatorStats(db, parsed.data);
    },
  );

  app.get(
    "/creators/:creatorId/payments",
    {
      preHandler: requireInternalService,
    },
    async (request, reply) => {
      const params = request.params as { creatorId: string };
      const parsed = z.string().uuid().safeParse(params.creatorId);

      if (!parsed.success) {
        return reply.code(400).send({
          message: "A valid creator id is required.",
        });
      }

      const creator = await getCreatorById(db, parsed.data);

      if (!creator) {
        return reply.code(404).send({
          message: "Creator not found.",
        });
      }

      const query = z
        .object({
          limit: z.coerce.number().int().min(1).max(100).default(25),
        })
        .parse(request.query);

      return listCreatorPayments(db, parsed.data, query.limit);
    },
  );

  app.get(
    "/creators/:creatorId/content-performance",
    {
      preHandler: requireInternalService,
    },
    async (request, reply) => {
      const params = request.params as { creatorId: string };
      const parsed = z.string().uuid().safeParse(params.creatorId);

      if (!parsed.success) {
        return reply.code(400).send({
          message: "A valid creator id is required.",
        });
      }

      const creator = await getCreatorById(db, parsed.data);

      if (!creator) {
        return reply.code(404).send({
          message: "Creator not found.",
        });
      }

      return listCreatorContentPerformance(db, parsed.data);
    },
  );

  app.get(
    "/integrations/sources",
    {
      preHandler: requireInternalService,
    },
    async (request) => {
      const query = request.query as {
        creatorId?: string;
        platform?: string;
        externalSourceId?: string;
      };

      return listIntegrationSources(db, query);
    },
  );

  app.post(
    "/integrations/sources",
    {
      preHandler: requireInternalService,
    },
    async (request, reply) => {
      const parsed = z
        .object({
          creatorId: z.string().uuid(),
          platform: z.string().min(1),
          externalSourceId: z.string().min(1),
          name: z.string().min(1),
          baseUrl: z.string().url().nullable().optional(),
          metadata: z.record(z.unknown()).optional(),
        })
        .safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid integration source payload.",
          issues: parsed.error.issues,
        });
      }

      return upsertIntegrationSource(db, parsed.data);
    },
  );

  app.get(
    "/integrations/mappings",
    {
      preHandler: requireInternalService,
    },
    async (request) => {
      const query = request.query as {
        platform?: string;
        externalId?: string;
        contentId?: string;
      };

      return listExternalContentMappings(db, query);
    },
  );

  app.get(
    "/integrations/rules",
    {
      preHandler: requireInternalService,
    },
    async (request) => {
      const query = request.query as {
        platform?: string;
        externalId?: string;
        contentId?: string;
      };

      return listExternalAccessRules(db, query);
    },
  );

  app.post(
    "/integrations/mappings/sync",
    {
      preHandler: requireInternalService,
    },
    async (request, reply) => {
      const parsed = z
        .object({
          source: z.object({
            creatorId: z.string().uuid(),
            platform: z.string().min(1),
            externalSourceId: z.string().min(1),
            name: z.string().min(1),
            baseUrl: z.string().url().nullable().optional(),
            metadata: z.record(z.unknown()).optional(),
          }),
          contentMapping: z.object({
            contentId: z.string().uuid(),
            platform: z.string().min(1),
            externalId: z.string().min(1),
            externalType: z.string().min(1),
            sourceUrl: z.string().url().nullable().optional(),
            metadata: z.record(z.unknown()).optional(),
          }),
          accessRules: z.array(
            z.object({
              platform: z.string().min(1),
              externalId: z.string().min(1),
              externalType: z.string().min(1),
              name: z.string().min(1),
              ruleType: z.string().min(1),
              pricing: pricingModelSchema.optional(),
              requiredGroups: z.array(z.string().min(1)).optional(),
              metadata: z.record(z.unknown()).optional(),
              isActive: z.boolean().optional(),
            }),
          ),
        })
        .safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid integration mapping sync payload.",
          issues: parsed.error.issues,
        });
      }

      return syncExternalIntegrationMapping(db, parsed.data);
    },
  );

  app.get("/content/:slug", async (request, reply) => {
    const params = request.params as { slug: string };
    const content = await getContentBySlug(db, params.slug);

    if (!content) {
      return reply.code(404).send({ message: "Content not found." });
    }

    if (!content.isActive) {
      return reply.code(404).send({ message: "Content not found." });
    }

    const creator = await getCreatorById(db, content.creatorId);

    if (!creator) {
      app.log.error({ contentId: content.id }, "Content creator record is missing.");

      return reply.code(500).send({
        message: "Content is not currently payable.",
      });
    }

    const quote = quotePricing(content.pricing);
    const resource = `${request.protocol}://${request.hostname}${request.url}`;
    const paymentRequired = buildPaymentRequired({
      resourceUrl: resource,
      amountUsdc: quote.amountUsdc,
      payTo: creator.arcWalletAddress,
      description: `Unlock Subgate content: ${content.title}`,
      network: env.X402_NETWORK,
      scheme: env.X402_SCHEME,
      asset: env.X402_ASSET,
      gatewayWalletAddress: env.X402_GATEWAY_WALLET_ADDRESS,
      maxTimeoutSeconds: env.X402_MAX_TIMEOUT_SECONDS,
    });

    const paymentPayload = parsePaymentPayloadHeader(
      request.headers[PAYMENT_SIGNATURE_HEADER.toLowerCase()],
    );

    if (!paymentPayload) {
      return reply
        .code(402)
        .header(PAYMENT_REQUIRED_HEADER, encodePaymentRequired(paymentRequired))
        .send(paymentRequired);
    }

    const paymentIdentifier = getPaymentPayloadIdentifier(paymentPayload);
    const existingPayment = await findPaymentByIdentifier(db, paymentIdentifier);

    if (existingPayment?.accessGrantId) {
      const access = await accessService.check(content.id, existingPayment.payerAddress);

      if (access.hasAccess) {
        const paymentResponse = JSON.parse(existingPayment.settlementResponse);

        return reply
          .header(PAYMENT_RESPONSE_HEADER, encodePaymentResponse(paymentResponse))
          .send(
            contentUnlockSchema.parse({
              id: content.id,
              creatorId: content.creatorId,
              title: content.title,
              slug: content.slug,
              summary: content.summary,
              body: content.body,
              pricing: content.pricing,
              accessGrantId: existingPayment.accessGrantId,
              paymentId: existingPayment.id,
              paymentResponse,
            }),
          );
      }
    }

    try {
      assertPaymentMatchesRequirement(paymentPayload, paymentRequired);
    } catch (error) {
      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Invalid payment payload.",
      });
    }

    const settlement = await facilitator.settle(paymentPayload, paymentRequired);

    if (!settlement.success) {
      return reply
        .code(402)
        .header(PAYMENT_REQUIRED_HEADER, encodePaymentRequired(paymentRequired))
        .header(PAYMENT_RESPONSE_HEADER, encodePaymentResponse(settlement))
        .send({
          message: settlement.message ?? "Payment was not verified.",
          payment: settlement,
        });
    }

    if (!settlement.payer) {
      return reply.code(502).send({
        message: "Gateway settlement succeeded but did not include a payer address.",
      });
    }

    const grant = await accessService.grant({
      contentId: content.id,
      payerAddress: settlement.payer,
      pricing: content.pricing,
    });

    const payment = await createPaymentRecord(db, {
      contentId: content.id,
      accessGrantId: grant.id,
      payerAddress: settlement.payer,
      paymentIdentifier,
      paymentPayload,
      settlementResponse: settlement,
      amountUsdc: quote.amountUsdc,
      paymentType: content.pricing.type,
    });

    return reply
      .header(PAYMENT_RESPONSE_HEADER, encodePaymentResponse(settlement))
      .send(
        contentUnlockSchema.parse({
          id: content.id,
          creatorId: content.creatorId,
          title: content.title,
          slug: content.slug,
          summary: content.summary,
          body: content.body,
          pricing: content.pricing,
          accessGrantId: grant.id,
          paymentId: payment.id,
          paymentResponse: settlement,
        }),
      );
  });

  app.get("/content/:slug/quote", async (request, reply) => {
    const params = request.params as { slug: string };
    const quantity = Number((request.query as { quantity?: string }).quantity ?? "1");

    const content = await getContentBySlug(db, params.slug);

    if (!content) {
      return reply.code(404).send({ message: "Content not found." });
    }

    return quotePricing(content.pricing, { quantity });
  });

  app.get("/content/:contentId/access", async (request, reply) => {
    const params = request.params as { contentId: string };
    const query = request.query as { payerAddress?: string };
    const payerAddress = payerAddressSchema.safeParse(query.payerAddress);

    if (!payerAddress.success) {
      return reply.code(400).send({
        message: "payerAddress query parameter is required.",
      });
    }

    const content = await getContentById(db, params.contentId);

    if (!content) {
      return reply.code(404).send({ message: "Content not found." });
    }

    return accessService.check(content.id, payerAddress.data);
  });

  app.get(
    "/content/:contentId/access-grants",
    {
      preHandler: requireInternalService,
    },
    async (request, reply) => {
      const params = request.params as { contentId: string };
      const content = await getContentById(db, params.contentId);

      if (!content) {
        return reply.code(404).send({ message: "Content not found." });
      }

      return accessService.listForContent(content.id);
    },
  );

  app.post(
    "/content",
    {
      preHandler: requireInternalService,
    },
    async (request, reply) => {
      const parsed = createContentInputSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid content payload.",
          issues: parsed.error.issues,
        });
      }

      const content = await createContent(db, parsed.data, serializePricingForStorage);

      return reply.code(201).send(content);
    },
  );

  app.post(
    "/content/sync",
    {
      preHandler: requireInternalService,
    },
    async (request, reply) => {
      const parsed = createContentInputSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid content sync payload.",
          issues: parsed.error.issues,
        });
      }

      const content = await syncContentBySlug(
        db,
        parsed.data,
        serializePricingForStorage,
      );

      return reply.send(content);
    },
  );

  app.post(
    "/content/:contentId/access-grants",
    {
      preHandler: requireInternalService,
    },
    async (request, reply) => {
      const params = request.params as { contentId: string };
      const content = await getContentById(db, params.contentId);

      if (!content) {
        return reply.code(404).send({ message: "Content not found." });
      }

      const parsed = accessGrantRequestSchema.safeParse({
        ...(request.body as Record<string, unknown>),
        contentId: params.contentId,
      });

      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid access-grant payload.",
          issues: parsed.error.issues,
        });
      }

      const grant = await accessService.grant(parsed.data);

      return reply.code(201).send(grant);
    },
  );
};
