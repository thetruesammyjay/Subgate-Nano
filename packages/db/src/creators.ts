import { and, eq, sql } from "drizzle-orm";
import {
  creatorSchema,
  creatorStatsSchema,
  type Creator,
  type CreatorStats,
} from "@subgate/types";
import type { SubgateDatabase } from "./client.js";
import { contentItems, creators, payments } from "./schema.js";

const mapCreator = (row: typeof creators.$inferSelect): Creator => {
  return creatorSchema.parse({
    id: row.id,
    displayName: row.displayName,
    email: row.email,
    arcWalletAddress: row.arcWalletAddress,
    circleWalletId: row.circleWalletId,
    createdAt: row.createdAt.toISOString(),
  });
};

export const getCreatorById = async (
  db: SubgateDatabase,
  id: string,
): Promise<Creator | null> => {
  const [row] = await db.select().from(creators).where(eq(creators.id, id)).limit(1);

  return row ? mapCreator(row) : null;
};

export const getCreatorByEmail = async (
  db: SubgateDatabase,
  email: string,
): Promise<Creator | null> => {
  const [row] = await db
    .select()
    .from(creators)
    .where(eq(creators.email, email.toLowerCase()))
    .limit(1);

  return row ? mapCreator(row) : null;
};

export const listCreators = async (db: SubgateDatabase): Promise<Creator[]> => {
  const rows = await db.select().from(creators);

  return rows.map(mapCreator);
};

export const getCreatorStats = async (
  db: SubgateDatabase,
  creatorId: string,
): Promise<CreatorStats> => {
  const [contentStats] = await db
    .select({
      contentCount: sql<number>`count(*)::int`,
      activeContentCount: sql<number>`count(*) filter (where ${contentItems.isActive} = true)::int`,
    })
    .from(contentItems)
    .where(eq(contentItems.creatorId, creatorId));
  const [paymentStats] = await db
    .select({
      paymentCount: sql<number>`count(${payments.id})::int`,
      settledPaymentCount: sql<number>`count(${payments.id}) filter (where ${payments.status} = 'settled')::int`,
      revenueUsdc: sql<string>`coalesce(sum(${payments.amountUsdc}) filter (where ${payments.status} = 'settled'), 0)::text`,
    })
    .from(payments)
    .innerJoin(contentItems, eq(payments.contentId, contentItems.id))
    .where(and(eq(contentItems.creatorId, creatorId)));

  return creatorStatsSchema.parse({
    creatorId,
    contentCount: contentStats?.contentCount ?? 0,
    activeContentCount: contentStats?.activeContentCount ?? 0,
    paymentCount: paymentStats?.paymentCount ?? 0,
    settledPaymentCount: paymentStats?.settledPaymentCount ?? 0,
    revenueUsdc: Number(paymentStats?.revenueUsdc ?? 0),
  });
};
