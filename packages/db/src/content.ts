import { eq } from "drizzle-orm";
import {
  contentItemSchema,
  contentCatalogItemSchema,
  createContentInputSchema,
  type ContentItem,
  type ContentCatalogItem,
  type CreateContentInput,
  type PricingModel,
} from "@subgate/types";
import type { SubgateDatabase } from "./client.js";
import { contentItems } from "./schema.js";

const parseNumeric = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }

  return Number(value);
};

const toPricingModel = (
  row: typeof contentItems.$inferSelect,
): PricingModel => {
  const priceUsdc = parseNumeric(row.priceUsdc);
  const ratePerSecondUsdc = parseNumeric(row.ratePerSecondUsdc);
  const durationSeconds = parseNumeric(row.durationSeconds);

  switch (row.pricingType) {
    case "per_access":
      if (priceUsdc === null) {
        throw new Error(`Missing price_usdc for content item ${row.id}`);
      }
      return { type: "per_access", priceUsdc };
    case "per_second":
      if (ratePerSecondUsdc === null) {
        throw new Error(`Missing rate_per_second_usdc for content item ${row.id}`);
      }
      return { type: "per_second", rateUsdc: ratePerSecondUsdc };
    case "per_citation":
      if (priceUsdc === null) {
        throw new Error(`Missing price_usdc for content item ${row.id}`);
      }
      return { type: "per_citation", priceUsdc };
    case "timed":
      if (priceUsdc === null || durationSeconds === null) {
        throw new Error(`Missing timed pricing fields for content item ${row.id}`);
      }
      return { type: "timed", priceUsdc, durationSeconds };
    default:
      throw new Error(`Unsupported pricing type "${row.pricingType}" for ${row.id}`);
  }
};

const mapCatalogItem = (
  row: typeof contentItems.$inferSelect,
): ContentCatalogItem => {
  return contentCatalogItemSchema.parse({
    id: row.id,
    creatorId: row.creatorId,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    pricing: toPricingModel(row),
    isActive: row.isActive,
  });
};

const mapContentItem = (
  row: typeof contentItems.$inferSelect,
): ContentItem => {
  return contentItemSchema.parse({
    id: row.id,
    creatorId: row.creatorId,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    pricing: toPricingModel(row),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  });
};

export const listActiveCatalogItems = async (
  db: SubgateDatabase,
): Promise<ContentCatalogItem[]> => {
  const rows = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.isActive, true));

  return rows.map(mapCatalogItem);
};

export const getContentById = async (
  db: SubgateDatabase,
  id: string,
): Promise<ContentItem | null> => {
  const [row] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, id))
    .limit(1);

  return row ? mapContentItem(row) : null;
};

export const getContentBySlug = async (
  db: SubgateDatabase,
  slug: string,
): Promise<ContentItem | null> => {
  const [row] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.slug, slug))
    .limit(1);

  return row ? mapContentItem(row) : null;
};

export const createContent = async (
  db: SubgateDatabase,
  input: CreateContentInput,
  serializePricing: (pricing: PricingModel) => {
    pricingType: string;
    priceUsdc: string | null;
    ratePerSecondUsdc: string | null;
    durationSeconds: string | null;
  },
): Promise<ContentItem> => {
  const parsed = createContentInputSchema.parse(input);
  const storage = serializePricing(parsed.pricing);

  const [row] = await db
    .insert(contentItems)
    .values({
      creatorId: parsed.creatorId,
      title: parsed.title,
      slug: parsed.slug,
      summary: parsed.summary,
      body: parsed.body,
      pricingType: storage.pricingType,
      priceUsdc: storage.priceUsdc,
      ratePerSecondUsdc: storage.ratePerSecondUsdc,
      durationSeconds: storage.durationSeconds,
      isActive: parsed.isActive,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create content item.");
  }

  return mapContentItem(row);
};
