import { z } from "zod";

export const pricingModelSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("per_access"),
    priceUsdc: z.number().nonnegative(),
  }),
  z.object({
    type: z.literal("per_second"),
    rateUsdc: z.number().nonnegative(),
  }),
  z.object({
    type: z.literal("per_citation"),
    priceUsdc: z.number().nonnegative(),
  }),
  z.object({
    type: z.literal("timed"),
    priceUsdc: z.number().nonnegative(),
    durationSeconds: z.number().int().positive(),
  }),
]);

export type PricingModel = z.infer<typeof pricingModelSchema>;

export const contentCatalogItemSchema = z.object({
  id: z.string().uuid(),
  creatorId: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  pricing: pricingModelSchema,
  isActive: z.boolean(),
});

export type ContentCatalogItem = z.infer<typeof contentCatalogItemSchema>;

export const creatorSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1),
  email: z.string().email(),
  arcWalletAddress: z.string().min(1),
  circleWalletId: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type Creator = z.infer<typeof creatorSchema>;

export const creatorStatsSchema = z.object({
  creatorId: z.string().uuid(),
  contentCount: z.number().int().nonnegative(),
  activeContentCount: z.number().int().nonnegative(),
  paymentCount: z.number().int().nonnegative(),
  settledPaymentCount: z.number().int().nonnegative(),
  revenueUsdc: z.number().nonnegative(),
});

export type CreatorStats = z.infer<typeof creatorStatsSchema>;

export const creatorPaymentSchema = z.object({
  id: z.string().uuid(),
  contentId: z.string().uuid(),
  contentTitle: z.string().min(1),
  contentSlug: z.string().min(1),
  payerAddress: z.string().min(3).max(255),
  amountUsdc: z.number().nonnegative(),
  paymentType: z.string().min(1),
  status: z.string().min(1),
  gatewayTransactionId: z.string().nullable(),
  settledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type CreatorPayment = z.infer<typeof creatorPaymentSchema>;

export const creatorContentPerformanceSchema = z.object({
  contentId: z.string().uuid(),
  title: z.string().min(1),
  slug: z.string().min(1),
  isActive: z.boolean(),
  paymentCount: z.number().int().nonnegative(),
  settledPaymentCount: z.number().int().nonnegative(),
  revenueUsdc: z.number().nonnegative(),
  lastPaidAt: z.string().datetime().nullable(),
});

export type CreatorContentPerformance = z.infer<
  typeof creatorContentPerformanceSchema
>;

export const contentUnlockSchema = z.object({
  id: z.string().uuid(),
  creatorId: z.string().uuid(),
  title: z.string().min(1),
  slug: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  pricing: pricingModelSchema,
  accessGrantId: z.string().uuid(),
  paymentId: z.string().uuid(),
  paymentResponse: z.unknown(),
});

export type ContentUnlock = z.infer<typeof contentUnlockSchema>;

export const contentItemSchema = z.object({
  id: z.string().uuid(),
  creatorId: z.string().uuid(),
  title: z.string().min(1),
  slug: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  pricing: pricingModelSchema,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});

export type ContentItem = z.infer<typeof contentItemSchema>;

export const createContentInputSchema = z.object({
  creatorId: z.string().uuid(),
  title: z.string().min(1).max(160),
  slug: z.string().min(1).max(180),
  summary: z.string().min(1),
  body: z.string().min(1),
  pricing: pricingModelSchema,
  isActive: z.boolean().optional().default(true),
});

export type CreateContentInput = z.infer<typeof createContentInputSchema>;

export const payerAddressSchema = z.string().min(3).max(255);

export const accessGrantSchema = z.object({
  id: z.string().uuid(),
  contentId: z.string().uuid(),
  payerAddress: payerAddressSchema,
  pricing: pricingModelSchema,
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
});

export type AccessGrant = z.infer<typeof accessGrantSchema>;

export const accessGrantRequestSchema = z.object({
  contentId: z.string().uuid(),
  payerAddress: payerAddressSchema,
  pricing: pricingModelSchema,
  grantedAt: z.date().optional(),
});

export type AccessGrantRequest = z.infer<typeof accessGrantRequestSchema>;

export const accessStatusSchema = z.object({
  hasAccess: z.boolean(),
  activeGrantId: z.string().uuid().nullable(),
  expiresAt: z.string().datetime().nullable(),
});

export type AccessStatus = z.infer<typeof accessStatusSchema>;

export const pricingQuoteSchema = z.object({
  amountUsdc: z.number().nonnegative(),
  pricing: pricingModelSchema,
  expiresAt: z.string().datetime().nullable(),
});

export type PricingQuote = z.infer<typeof pricingQuoteSchema>;

export const x402PaymentRequiredSchema = z.object({
  x402Version: z.literal(2),
  resource: z.object({
    url: z.string().min(1),
    description: z.string().min(1),
    mimeType: z.string().min(1),
  }),
  accepts: z.array(
    z.object({
      scheme: z.string().min(1),
      network: z.string().min(1),
      asset: z.string().min(1),
      payTo: z.string().min(1),
      amount: z.string().min(1),
      maxTimeoutSeconds: z.number().int().positive(),
      extra: z
        .object({
          name: z.string().min(1),
          version: z.string().min(1),
          verifyingContract: z.string().min(1),
        })
        .passthrough()
        .optional(),
    }),
  ).min(1),
});

export type X402PaymentRequired = z.infer<typeof x402PaymentRequiredSchema>;

export const x402PaymentPayloadSchema = z.object({
  x402Version: z.number().int(),
  resource: z
    .object({
      url: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      mimeType: z.string().min(1).optional(),
    })
    .passthrough()
    .optional(),
  accepted: z.object({
    scheme: z.string().min(1),
    network: z.string().min(1),
    asset: z.string().min(1),
    payTo: z.string().min(1),
    amount: z.string().min(1),
    maxTimeoutSeconds: z.number().int().positive(),
    extra: z.record(z.unknown()).optional(),
  }),
  payload: z.record(z.unknown()),
  extensions: z.record(z.unknown()).optional(),
});

export type X402PaymentPayload = z.infer<typeof x402PaymentPayloadSchema>;

export const x402SettlementResponseSchema = z.object({
  success: z.boolean(),
  transaction: z.string(),
  network: z.string().min(1),
  payer: z.string().min(1).optional(),
  errorReason: z.string().optional(),
  message: z.string().optional(),
  raw: z.unknown().optional(),
});

export type X402SettlementResponse = z.infer<typeof x402SettlementResponseSchema>;

export const healthStatusSchema = z.object({
  service: z.literal("api"),
  status: z.literal("ok"),
  timestamp: z.string().datetime(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
