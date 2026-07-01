import { and, eq } from "drizzle-orm";
import type { PricingModel } from "@subgate/types";
import type { SubgateDatabase } from "./client.js";
import {
  externalAccessRules,
  externalContentMappings,
  integrationSources,
} from "./schema.js";

export type IntegrationSourceInput = {
  creatorId: string;
  platform: string;
  externalSourceId: string;
  name: string;
  baseUrl?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type ExternalContentMappingInput = {
  contentId: string;
  platform: string;
  externalId: string;
  externalType: string;
  sourceUrl?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type ExternalAccessRuleInput = {
  platform: string;
  externalId: string;
  externalType: string;
  name: string;
  ruleType: string;
  pricing?: PricingModel | undefined;
  requiredGroups?: string[] | undefined;
  metadata?: Record<string, unknown> | undefined;
  isActive?: boolean | undefined;
};

const serializePricing = (pricing: PricingModel | undefined) => {
  if (!pricing) {
    return {
      pricingType: null,
      priceUsdc: null,
      ratePerSecondUsdc: null,
      durationSeconds: null,
    };
  }

  switch (pricing.type) {
    case "per_access":
    case "per_citation":
      return {
        pricingType: pricing.type,
        priceUsdc: pricing.priceUsdc.toFixed(6),
        ratePerSecondUsdc: null,
        durationSeconds: null,
      };
    case "per_second":
      return {
        pricingType: pricing.type,
        priceUsdc: null,
        ratePerSecondUsdc: pricing.rateUsdc.toFixed(6),
        durationSeconds: null,
      };
    case "timed":
      return {
        pricingType: pricing.type,
        priceUsdc: pricing.priceUsdc.toFixed(6),
        ratePerSecondUsdc: null,
        durationSeconds: String(pricing.durationSeconds),
      };
  }
};

const parsePricing = (
  row: typeof externalAccessRules.$inferSelect,
): PricingModel | null => {
  switch (row.pricingType) {
    case "per_access":
      return { type: "per_access", priceUsdc: Number(row.priceUsdc ?? 0) };
    case "per_citation":
      return { type: "per_citation", priceUsdc: Number(row.priceUsdc ?? 0) };
    case "per_second":
      return {
        type: "per_second",
        rateUsdc: Number(row.ratePerSecondUsdc ?? 0),
      };
    case "timed":
      return {
        type: "timed",
        priceUsdc: Number(row.priceUsdc ?? 0),
        durationSeconds: Number(row.durationSeconds ?? 0),
      };
    default:
      return null;
  }
};

export const upsertIntegrationSource = async (
  db: SubgateDatabase,
  input: IntegrationSourceInput,
) => {
  const now = new Date();
  const [source] = await db
    .insert(integrationSources)
    .values({
      creatorId: input.creatorId,
      platform: input.platform,
      externalSourceId: input.externalSourceId,
      name: input.name,
      baseUrl: input.baseUrl ?? null,
      metadata: input.metadata ?? {},
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        integrationSources.creatorId,
        integrationSources.platform,
        integrationSources.externalSourceId,
      ],
      set: {
        name: input.name,
        baseUrl: input.baseUrl ?? null,
        metadata: input.metadata ?? {},
        updatedAt: now,
      },
    })
    .returning();

  if (!source) {
    throw new Error("Failed to upsert integration source.");
  }

  return source;
};

export const upsertExternalContentMapping = async (
  db: SubgateDatabase,
  integrationSourceId: string,
  input: ExternalContentMappingInput,
) => {
  const now = new Date();
  const [mapping] = await db
    .insert(externalContentMappings)
    .values({
      integrationSourceId,
      contentId: input.contentId,
      platform: input.platform,
      externalId: input.externalId,
      externalType: input.externalType,
      sourceUrl: input.sourceUrl ?? null,
      metadata: input.metadata ?? {},
      lastSyncedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        externalContentMappings.integrationSourceId,
        externalContentMappings.externalId,
      ],
      set: {
        contentId: input.contentId,
        externalType: input.externalType,
        sourceUrl: input.sourceUrl ?? null,
        metadata: input.metadata ?? {},
        lastSyncedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  if (!mapping) {
    throw new Error("Failed to upsert external content mapping.");
  }

  return mapping;
};

export const upsertExternalAccessRules = async (
  db: SubgateDatabase,
  integrationSourceId: string,
  contentMappingId: string,
  inputs: ExternalAccessRuleInput[],
) => {
  const now = new Date();
  const rows = [];

  for (const input of inputs) {
    const storage = serializePricing(input.pricing);
    const [rule] = await db
      .insert(externalAccessRules)
      .values({
        integrationSourceId,
        contentMappingId,
        platform: input.platform,
        externalId: input.externalId,
        externalType: input.externalType,
        name: input.name,
        ruleType: input.ruleType,
        pricingType: storage.pricingType,
        priceUsdc: storage.priceUsdc,
        ratePerSecondUsdc: storage.ratePerSecondUsdc,
        durationSeconds: storage.durationSeconds,
        requiredGroups: input.requiredGroups ?? [],
        metadata: input.metadata ?? {},
        isActive: input.isActive ?? true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          externalAccessRules.integrationSourceId,
          externalAccessRules.externalType,
          externalAccessRules.externalId,
        ],
        set: {
          contentMappingId,
          name: input.name,
          ruleType: input.ruleType,
          pricingType: storage.pricingType,
          priceUsdc: storage.priceUsdc,
          ratePerSecondUsdc: storage.ratePerSecondUsdc,
          durationSeconds: storage.durationSeconds,
          requiredGroups: input.requiredGroups ?? [],
          metadata: input.metadata ?? {},
          isActive: input.isActive ?? true,
          updatedAt: now,
        },
      })
      .returning();

    if (rule) {
      rows.push(rule);
    }
  }

  return rows;
};

export const syncExternalIntegrationMapping = async (
  db: SubgateDatabase,
  input: {
    source: IntegrationSourceInput;
    contentMapping: ExternalContentMappingInput;
    accessRules: ExternalAccessRuleInput[];
  },
) => {
  const source = await upsertIntegrationSource(db, input.source);
  const contentMapping = await upsertExternalContentMapping(
    db,
    source.id,
    input.contentMapping,
  );
  const accessRules = await upsertExternalAccessRules(
    db,
    source.id,
    contentMapping.id,
    input.accessRules,
  );

  return {
    source,
    contentMapping,
    accessRules,
  };
};

export const listIntegrationSources = async (db: SubgateDatabase) => {
  return db.select().from(integrationSources);
};

export const listExternalContentMappings = async (
  db: SubgateDatabase,
  filters?: {
    platform?: string;
    externalId?: string;
    contentId?: string;
  },
) => {
  const conditions = [
    filters?.platform
      ? eq(externalContentMappings.platform, filters.platform)
      : undefined,
    filters?.externalId
      ? eq(externalContentMappings.externalId, filters.externalId)
      : undefined,
    filters?.contentId
      ? eq(externalContentMappings.contentId, filters.contentId)
      : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> =>
    Boolean(condition),
  );

  return db
    .select()
    .from(externalContentMappings)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
};

export const listExternalAccessRules = async (
  db: SubgateDatabase,
  filters?: {
    platform?: string;
    externalId?: string;
    contentId?: string;
  },
) => {
  const conditions = [
    filters?.platform
      ? eq(externalAccessRules.platform, filters.platform)
      : undefined,
    filters?.externalId
      ? eq(externalAccessRules.externalId, filters.externalId)
      : undefined,
    filters?.contentId
      ? eq(externalContentMappings.contentId, filters.contentId)
      : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> =>
    Boolean(condition),
  );

  const rows = await db
    .select({
      rule: externalAccessRules,
      mapping: externalContentMappings,
    })
    .from(externalAccessRules)
    .leftJoin(
      externalContentMappings,
      eq(externalAccessRules.contentMappingId, externalContentMappings.id),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return rows.map(({ rule, mapping }) => ({
    ...rule,
    pricing: parsePricing(rule),
    contentId: mapping?.contentId ?? null,
  }));
};
