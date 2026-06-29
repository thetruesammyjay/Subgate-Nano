import {
  pricingQuoteSchema,
  type PricingModel,
  type PricingQuote,
} from "@subgate/types";

const roundUsdc = (amount: number): number => {
  return Number(amount.toFixed(6));
};

export const getTimedAccessExpiry = (
  grantedAt: Date,
  durationSeconds: number,
): Date => {
  return new Date(grantedAt.getTime() + durationSeconds * 1000);
};

export const quotePricing = (
  pricing: PricingModel,
  options?: {
    quantity?: number;
    grantedAt?: Date;
  },
): PricingQuote => {
  const quantity = options?.quantity ?? 1;
  const grantedAt = options?.grantedAt ?? new Date();

  if (quantity <= 0) {
    throw new Error("Pricing quantity must be greater than zero.");
  }

  switch (pricing.type) {
    case "per_access":
      return pricingQuoteSchema.parse({
        amountUsdc: roundUsdc(pricing.priceUsdc * quantity),
        pricing,
        expiresAt: null,
      });
    case "per_citation":
      return pricingQuoteSchema.parse({
        amountUsdc: roundUsdc(pricing.priceUsdc * quantity),
        pricing,
        expiresAt: null,
      });
    case "per_second":
      return pricingQuoteSchema.parse({
        amountUsdc: roundUsdc(pricing.rateUsdc * quantity),
        pricing,
        expiresAt: null,
      });
    case "timed":
      return pricingQuoteSchema.parse({
        amountUsdc: roundUsdc(pricing.priceUsdc * quantity),
        pricing,
        expiresAt: getTimedAccessExpiry(
          grantedAt,
          pricing.durationSeconds * quantity,
        ).toISOString(),
      });
  }
};

export const serializePricingForStorage = (pricing: PricingModel) => {
  switch (pricing.type) {
    case "per_access":
      return {
        pricingType: pricing.type,
        priceUsdc: roundUsdc(pricing.priceUsdc).toFixed(6),
        ratePerSecondUsdc: null,
        durationSeconds: null,
      };
    case "per_citation":
      return {
        pricingType: pricing.type,
        priceUsdc: roundUsdc(pricing.priceUsdc).toFixed(6),
        ratePerSecondUsdc: null,
        durationSeconds: null,
      };
    case "per_second":
      return {
        pricingType: pricing.type,
        priceUsdc: null,
        ratePerSecondUsdc: roundUsdc(pricing.rateUsdc).toFixed(6),
        durationSeconds: null,
      };
    case "timed":
      return {
        pricingType: pricing.type,
        priceUsdc: roundUsdc(pricing.priceUsdc).toFixed(6),
        ratePerSecondUsdc: null,
        durationSeconds: String(pricing.durationSeconds),
      };
  }
};
