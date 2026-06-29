import { createAccessService } from "@subgate/access";
import {
  createPaymentRecord,
  createContent,
  findPaymentByIdentifier,
  getCreatorById,
  getContentById,
  getContentBySlug,
  listActiveCatalogItems,
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
} from "@subgate/types";
import type { FastifyInstance } from "fastify";
import type { ApiEnv } from "./env.js";

export const registerRoutes = async (
  app: FastifyInstance,
  db: SubgateDatabase,
  env: ApiEnv,
) => {
  const accessService = createAccessService(db);
  const facilitator = new X402FacilitatorClient({
    facilitatorUrl: env.X402_FACILITATOR_URL,
  });

  app.get("/catalog", async () => {
    return listActiveCatalogItems(db);
  });

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
        return contentUnlockSchema.parse({
          id: content.id,
          creatorId: content.creatorId,
          title: content.title,
          slug: content.slug,
          summary: content.summary,
          body: content.body,
          pricing: content.pricing,
          accessGrantId: existingPayment.accessGrantId,
          paymentId: existingPayment.id,
          paymentResponse: JSON.parse(existingPayment.settlementResponse),
        });
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

  app.get("/content/:contentId/access-grants", async (request, reply) => {
    const params = request.params as { contentId: string };
    const content = await getContentById(db, params.contentId);

    if (!content) {
      return reply.code(404).send({ message: "Content not found." });
    }

    return accessService.listForContent(content.id);
  });

  app.post("/content", async (request, reply) => {
    const parsed = createContentInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid content payload.",
        issues: parsed.error.issues,
      });
    }

    const content = await createContent(db, parsed.data, serializePricingForStorage);

    return reply.code(201).send(content);
  });

  app.post("/content/:contentId/access-grants", async (request, reply) => {
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
  });
};
