import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import {
  accessGrantRequestSchema,
  accessGrantSchema,
  accessStatusSchema,
  type AccessGrant,
  type AccessGrantRequest,
  type AccessStatus,
} from "@subgate/types";
import {
  accessGrants,
  type SubgateDatabase,
} from "@subgate/db";
import { getTimedAccessExpiry, serializePricingForStorage } from "@subgate/pricing";

const mapPricingFromGrant = (grant: typeof accessGrants.$inferSelect) => {
  switch (grant.pricingType) {
    case "per_access":
      return {
        type: "per_access" as const,
        priceUsdc: Number(grant.priceUsdc ?? 0),
      };
    case "per_citation":
      return {
        type: "per_citation" as const,
        priceUsdc: Number(grant.priceUsdc ?? 0),
      };
    case "per_second":
      return {
        type: "per_second" as const,
        rateUsdc: Number(grant.ratePerSecondUsdc ?? 0),
      };
    case "timed":
      return {
        type: "timed" as const,
        priceUsdc: Number(grant.priceUsdc ?? 0),
        durationSeconds: Number(grant.durationSeconds ?? 0),
      };
    default:
      throw new Error(`Unsupported pricing type "${grant.pricingType}" on grant ${grant.id}`);
  }
};

const mapAccessGrant = (grant: typeof accessGrants.$inferSelect): AccessGrant => {
  return accessGrantSchema.parse({
    id: grant.id,
    contentId: grant.contentId,
    payerAddress: grant.payerAddress,
    pricing: mapPricingFromGrant(grant),
    grantedAt: grant.grantedAt.toISOString(),
    expiresAt: grant.expiresAt?.toISOString() ?? null,
    revokedAt: grant.revokedAt?.toISOString() ?? null,
    isActive: grant.isActive,
  });
};

export class AccessService {
  constructor(private readonly db: SubgateDatabase) {}

  async grant(input: AccessGrantRequest): Promise<AccessGrant> {
    const parsed = accessGrantRequestSchema.parse(input);
    const grantedAt = parsed.grantedAt ?? new Date();
    const expiresAt =
      parsed.pricing.type === "timed"
        ? getTimedAccessExpiry(grantedAt, parsed.pricing.durationSeconds)
        : null;

    const storage = serializePricingForStorage(parsed.pricing);

    const [grant] = await this.db
      .insert(accessGrants)
      .values({
        contentId: parsed.contentId,
        payerAddress: parsed.payerAddress,
        pricingType: storage.pricingType,
        priceUsdc: storage.priceUsdc,
        ratePerSecondUsdc: storage.ratePerSecondUsdc,
        durationSeconds: storage.durationSeconds,
        grantedAt,
        expiresAt,
        revokedAt: null,
        isActive: true,
      })
      .returning();

    if (!grant) {
      throw new Error("Failed to create access grant.");
    }

    return mapAccessGrant(grant);
  }

  async check(contentId: string, payerAddress: string): Promise<AccessStatus> {
    const now = new Date();
    const [grant] = await this.db
      .select()
      .from(accessGrants)
      .where(
        and(
          eq(accessGrants.contentId, contentId),
          eq(accessGrants.payerAddress, payerAddress),
          eq(accessGrants.isActive, true),
          isNull(accessGrants.revokedAt),
          or(isNull(accessGrants.expiresAt), gt(accessGrants.expiresAt, now)),
        ),
      )
      .orderBy(desc(accessGrants.grantedAt))
      .limit(1);

    if (!grant) {
      return accessStatusSchema.parse({
        hasAccess: false,
        activeGrantId: null,
        expiresAt: null,
      });
    }

    const isExpired = grant.expiresAt !== null && grant.expiresAt.getTime() <= now.getTime();

    if (isExpired) {
      await this.revoke(grant.id, new Date());

      return accessStatusSchema.parse({
        hasAccess: false,
        activeGrantId: null,
        expiresAt: grant.expiresAt?.toISOString() ?? null,
      });
    }

    return accessStatusSchema.parse({
      hasAccess: true,
      activeGrantId: grant.id,
      expiresAt: grant.expiresAt?.toISOString() ?? null,
    });
  }

  async revoke(grantId: string, revokedAt = new Date()): Promise<void> {
    await this.db
      .update(accessGrants)
      .set({
        isActive: false,
        revokedAt,
      })
      .where(eq(accessGrants.id, grantId));
  }

  async listForContent(contentId: string): Promise<AccessGrant[]> {
    const grants = await this.db
      .select()
      .from(accessGrants)
      .where(eq(accessGrants.contentId, contentId))
      .orderBy(desc(accessGrants.grantedAt));

    return grants.map(mapAccessGrant);
  }
}

export const createAccessService = (db: SubgateDatabase) => {
  return new AccessService(db);
};
