import { createAccessService } from "@subgate/access";
import {
  consumeCreatorMagicLinkToken,
  createContent,
  createCreatorMagicLinkToken,
  createPendingPaymentRecord,
  findPaymentByIdentifier,
  failPaymentRecord,
  getCreatorBySessionToken,
  getCreatorById,
  getCreatorStats,
  getContentById,
  getContentBySlug,
  getStreamingSessionById,
  listCreatorContentPerformance,
  listCreatorPayments,
  listExternalAccessRules,
  listExternalContentMappings,
  listIntegrationSources,
  listCreators,
  listActiveCatalogItems,
  markPaymentSettling,
  recordPlatformFeeLedgerEntry,
  revokeCreatorSession,
  settlePaymentRecord,
  stopStreamingSession,
  syncContentBySlug,
  syncExternalIntegrationMapping,
  createStreamingSession,
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
  startStreamingSessionInputSchema,
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

const paymentIdentifierPrefix = (paymentIdentifier: string) => {
  return paymentIdentifier.slice(0, 16);
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
  const logPaymentEvent = (
    event: string,
    details: Record<string, unknown>,
    level: "info" | "warn" | "error" = "info",
  ) => {
    app.log[level](
      {
        event: `x402.payment.${event}`,
        ...details,
      },
      `x402.payment.${event}`,
    );
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
    const paymentContext = {
      requestId: request.id,
      contentId: content.id,
      slug: content.slug,
      creatorId: content.creatorId,
      pricingType: content.pricing.type,
      amountUsdc: quote.amountUsdc,
      network: env.X402_NETWORK,
    };

    const paymentPayload = parsePaymentPayloadHeader(
      request.headers[PAYMENT_SIGNATURE_HEADER.toLowerCase()],
    );

    if (!paymentPayload) {
      logPaymentEvent("terms_issued", paymentContext);

      return reply
        .code(402)
        .header(PAYMENT_REQUIRED_HEADER, encodePaymentRequired(paymentRequired))
        .send(paymentRequired);
    }

    const paymentIdentifier = getPaymentPayloadIdentifier(paymentPayload);
    const existingPayment = await findPaymentByIdentifier(db, paymentIdentifier);
    const identifiedPaymentContext = {
      ...paymentContext,
      paymentIdentifier: paymentIdentifierPrefix(paymentIdentifier),
    };

    if (existingPayment?.status === "settled" && existingPayment.accessGrantId) {
      const access = await accessService.check(content.id, existingPayment.payerAddress);

      if (access.hasAccess) {
        const paymentResponse = JSON.parse(existingPayment.settlementResponse);
        logPaymentEvent("idempotent_replay_settled", {
          ...identifiedPaymentContext,
          paymentId: existingPayment.id,
          accessGrantId: existingPayment.accessGrantId,
          gatewayTransactionId: existingPayment.gatewayTransactionId,
        });

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

    if (existingPayment?.status === "failed") {
      const paymentResponse = JSON.parse(existingPayment.settlementResponse);
      logPaymentEvent(
        "idempotent_replay_failed",
        {
          ...identifiedPaymentContext,
          paymentId: existingPayment.id,
          gatewayTransactionId: existingPayment.gatewayTransactionId,
        },
        "warn",
      );

      return reply
        .code(402)
        .header(PAYMENT_REQUIRED_HEADER, encodePaymentRequired(paymentRequired))
        .header(PAYMENT_RESPONSE_HEADER, encodePaymentResponse(paymentResponse))
        .send({
          message: paymentResponse.message ?? "Payment was not verified.",
          payment: paymentResponse,
        });
    }

    if (
      existingPayment?.status === "pending" ||
      existingPayment?.status === "settling"
    ) {
      logPaymentEvent("idempotent_replay_processing", {
        ...identifiedPaymentContext,
        paymentId: existingPayment.id,
        status: existingPayment.status,
      });

      return reply.code(409).send({
        message: "Payment is already being processed.",
        paymentId: existingPayment.id,
        status: existingPayment.status,
      });
    }

    try {
      assertPaymentMatchesRequirement(paymentPayload, paymentRequired);
    } catch (error) {
      logPaymentEvent(
        "payload_rejected",
        {
          ...identifiedPaymentContext,
          reason:
            error instanceof Error ? error.message : "Invalid payment payload.",
        },
        "warn",
      );

      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Invalid payment payload.",
      });
    }

    const pendingPayment = await createPendingPaymentRecord(db, {
      contentId: content.id,
      payerAddress:
        readPayloadString(paymentPayload.payload, "payer") ?? "pending",
      paymentIdentifier,
      paymentPayload,
      amountUsdc: quote.amountUsdc,
      paymentType: content.pricing.type,
      platformFeePercent: env.PLATFORM_FEE_PERCENT,
    });
    logPaymentEvent("record_observed", {
      ...identifiedPaymentContext,
      paymentId: pendingPayment.payment.id,
      status: pendingPayment.payment.status,
      created: pendingPayment.created,
    });

    if (!pendingPayment.created) {
      if (
        pendingPayment.payment.status === "settled" &&
        pendingPayment.payment.accessGrantId
      ) {
        const access = await accessService.check(
          content.id,
          pendingPayment.payment.payerAddress,
        );

        if (access.hasAccess) {
          const paymentResponse = JSON.parse(
            pendingPayment.payment.settlementResponse,
          );
          logPaymentEvent("idempotent_record_settled", {
            ...identifiedPaymentContext,
            paymentId: pendingPayment.payment.id,
            accessGrantId: pendingPayment.payment.accessGrantId,
            gatewayTransactionId: pendingPayment.payment.gatewayTransactionId,
          });

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
                accessGrantId: pendingPayment.payment.accessGrantId,
                paymentId: pendingPayment.payment.id,
                paymentResponse,
              }),
            );
        }
      }

      if (pendingPayment.payment.status === "failed") {
        const paymentResponse = JSON.parse(
          pendingPayment.payment.settlementResponse,
        );
        logPaymentEvent(
          "idempotent_record_failed",
          {
            ...identifiedPaymentContext,
            paymentId: pendingPayment.payment.id,
            gatewayTransactionId: pendingPayment.payment.gatewayTransactionId,
          },
          "warn",
        );

        return reply
          .code(402)
          .header(PAYMENT_REQUIRED_HEADER, encodePaymentRequired(paymentRequired))
          .header(PAYMENT_RESPONSE_HEADER, encodePaymentResponse(paymentResponse))
          .send({
            message: paymentResponse.message ?? "Payment was not verified.",
            payment: paymentResponse,
          });
      }

      logPaymentEvent("idempotent_record_processing", {
        ...identifiedPaymentContext,
        paymentId: pendingPayment.payment.id,
        status: pendingPayment.payment.status,
      });

      return reply.code(409).send({
        message: "Payment is already being processed.",
        paymentId: pendingPayment.payment.id,
        status: pendingPayment.payment.status,
      });
    }

    await markPaymentSettling(db, pendingPayment.payment.id);
    logPaymentEvent("settling_started", {
      ...identifiedPaymentContext,
      paymentId: pendingPayment.payment.id,
    });

    let settlement;

    try {
      logPaymentEvent("settlement_requested", {
        ...identifiedPaymentContext,
        paymentId: pendingPayment.payment.id,
      });
      settlement = await facilitator.settle(paymentPayload, paymentRequired);
    } catch (error) {
      const failedSettlement = {
        success: false,
        transaction: "",
        network: paymentPayload.accepted.network,
        message:
          error instanceof Error
            ? error.message
            : "Gateway settlement request failed.",
      };

      await failPaymentRecord(db, pendingPayment.payment.id, failedSettlement);
      logPaymentEvent(
        "settlement_request_failed",
        {
          ...identifiedPaymentContext,
          paymentId: pendingPayment.payment.id,
          reason: failedSettlement.message,
        },
        "error",
      );

      return reply.code(502).send({
        message: failedSettlement.message,
        payment: failedSettlement,
      });
    }

    if (!settlement.success) {
      await failPaymentRecord(db, pendingPayment.payment.id, settlement);
      logPaymentEvent(
        "settlement_declined",
        {
          ...identifiedPaymentContext,
          paymentId: pendingPayment.payment.id,
          gatewayTransactionId: settlement.transaction,
          reason: settlement.message ?? settlement.errorReason,
        },
        "warn",
      );

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
      const failedSettlement = {
        ...settlement,
        success: false,
        message: "Gateway settlement succeeded but did not include a payer address.",
      };

      await failPaymentRecord(db, pendingPayment.payment.id, failedSettlement);
      logPaymentEvent(
        "settlement_missing_payer",
        {
          ...identifiedPaymentContext,
          paymentId: pendingPayment.payment.id,
          gatewayTransactionId: settlement.transaction,
        },
        "error",
      );

      return reply.code(502).send({
        message: "Gateway settlement succeeded but did not include a payer address.",
      });
    }

    const grant = await accessService.grant({
      contentId: content.id,
      payerAddress: settlement.payer,
      pricing: content.pricing,
    });
    logPaymentEvent("access_granted", {
      ...identifiedPaymentContext,
      paymentId: pendingPayment.payment.id,
      accessGrantId: grant.id,
      payerAddress: settlement.payer,
    });

    const payment = await settlePaymentRecord(db, pendingPayment.payment.id, {
      accessGrantId: grant.id,
      payerAddress: settlement.payer,
      settlementResponse: settlement,
    });
    logPaymentEvent("settled", {
      ...identifiedPaymentContext,
      paymentId: payment.id,
      accessGrantId: grant.id,
      payerAddress: settlement.payer,
      gatewayTransactionId: settlement.transaction,
    });
    const ledgerEntry = await recordPlatformFeeLedgerEntry(db, {
      payment,
      creatorId: content.creatorId,
    });
    logPaymentEvent(ledgerEntry ? "fee_ledger_posted" : "fee_ledger_exists", {
      ...identifiedPaymentContext,
      paymentId: payment.id,
      ledgerEntryId: ledgerEntry?.id ?? null,
      grossAmountUsdc: Number(payment.amountUsdc),
      platformFeeUsdc: Number(payment.platformFeeUsdc),
      creatorNetUsdc: Number(payment.creatorNetUsdc),
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

  app.post("/stream/:contentId/start", async (request, reply) => {
    const params = request.params as { contentId: string };
    const parsedContentId = z.string().uuid().safeParse(params.contentId);

    if (!parsedContentId.success) {
      return reply.code(400).send({
        message: "A valid content id is required.",
      });
    }

    const content = await getContentById(db, parsedContentId.data);

    if (!content || !content.isActive) {
      return reply.code(404).send({ message: "Content not found." });
    }

    if (content.pricing.type !== "per_second") {
      return reply.code(400).send({
        message: "Content is not configured for per-second streaming.",
      });
    }

    const parsed = startStreamingSessionInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid streaming session payload.",
        issues: parsed.error.issues,
      });
    }

    const ratePerSecondUsdc =
      parsed.data.ratePerSecondUsdc ?? content.pricing.rateUsdc;

    if (ratePerSecondUsdc < content.pricing.rateUsdc) {
      return reply.code(400).send({
        message: "Approved rate is below the creator's streaming price.",
      });
    }

    const grant = await accessService.grant({
      contentId: content.id,
      payerAddress: parsed.data.payerAddress,
      pricing: content.pricing,
    });
    const session = await createStreamingSession(db, {
      contentId: content.id,
      accessGrantId: grant.id,
      payerAddress: parsed.data.payerAddress,
      ratePerSecondUsdc,
      maxAmountUsdc: parsed.data.maxAmountUsdc,
    });

    return reply.code(201).send(session);
  });

  app.get("/stream/sessions/:sessionId", async (request, reply) => {
    const params = request.params as { sessionId: string };
    const parsedSessionId = z.string().uuid().safeParse(params.sessionId);

    if (!parsedSessionId.success) {
      return reply.code(400).send({
        message: "A valid streaming session id is required.",
      });
    }

    const session = await getStreamingSessionById(db, parsedSessionId.data);

    if (!session) {
      return reply.code(404).send({ message: "Streaming session not found." });
    }

    return session;
  });

  app.post("/stream/sessions/:sessionId/stop", async (request, reply) => {
    const params = request.params as { sessionId: string };
    const parsedSessionId = z.string().uuid().safeParse(params.sessionId);

    if (!parsedSessionId.success) {
      return reply.code(400).send({
        message: "A valid streaming session id is required.",
      });
    }

    const session = await stopStreamingSession(db, parsedSessionId.data);

    if (!session) {
      return reply.code(404).send({ message: "Streaming session not found." });
    }

    return session;
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
