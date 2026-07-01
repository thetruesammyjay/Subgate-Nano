import { desc, eq, sql } from "drizzle-orm";
import type {
  CreatorContentPerformance,
  CreatorPayment,
  X402PaymentPayload,
  X402SettlementResponse,
} from "@subgate/types";
import {
  creatorContentPerformanceSchema,
  creatorPaymentSchema,
} from "@subgate/types";
import type { SubgateDatabase } from "./client.js";
import { contentItems, payments } from "./schema.js";

export type CreatePaymentRecordInput = {
  contentId: string;
  accessGrantId: string | null;
  payerAddress: string;
  paymentIdentifier: string;
  paymentPayload: X402PaymentPayload;
  settlementResponse: X402SettlementResponse;
  amountUsdc: number;
  paymentType: "per_access" | "per_second" | "per_citation" | "timed";
};

export const findPaymentByIdentifier = async (
  db: SubgateDatabase,
  paymentIdentifier: string,
) => {
  const [row] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentIdentifier, paymentIdentifier))
    .limit(1);

  return row ?? null;
};

export const createPaymentRecord = async (
  db: SubgateDatabase,
  input: CreatePaymentRecordInput,
) => {
  const [row] = await db
    .insert(payments)
    .values({
      contentId: input.contentId,
      accessGrantId: input.accessGrantId,
      payerAddress: input.payerAddress,
      paymentIdentifier: input.paymentIdentifier,
      paymentPayload: JSON.stringify(input.paymentPayload),
      settlementResponse: JSON.stringify(input.settlementResponse),
      gatewayTransactionId: input.settlementResponse.transaction,
      amountUsdc: input.amountUsdc.toFixed(6),
      paymentType: input.paymentType,
      status: input.settlementResponse.success ? "settled" : "failed",
      settledAt: input.settlementResponse.success ? new Date() : null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create payment record.");
  }

  return row;
};

export const listCreatorPayments = async (
  db: SubgateDatabase,
  creatorId: string,
  limit = 25,
): Promise<CreatorPayment[]> => {
  const rows = await db
    .select({
      payment: payments,
      content: {
        id: contentItems.id,
        title: contentItems.title,
        slug: contentItems.slug,
      },
    })
    .from(payments)
    .innerJoin(contentItems, eq(payments.contentId, contentItems.id))
    .where(eq(contentItems.creatorId, creatorId))
    .orderBy(desc(payments.createdAt))
    .limit(limit);

  return rows.map(({ payment, content }) =>
    creatorPaymentSchema.parse({
      id: payment.id,
      contentId: content.id,
      contentTitle: content.title,
      contentSlug: content.slug,
      payerAddress: payment.payerAddress,
      amountUsdc: Number(payment.amountUsdc),
      paymentType: payment.paymentType,
      status: payment.status,
      gatewayTransactionId: payment.gatewayTransactionId,
      settledAt: payment.settledAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    }),
  );
};

export const listCreatorContentPerformance = async (
  db: SubgateDatabase,
  creatorId: string,
): Promise<CreatorContentPerformance[]> => {
  const rows = await db
    .select({
      contentId: contentItems.id,
      title: contentItems.title,
      slug: contentItems.slug,
      isActive: contentItems.isActive,
      paymentCount: sql<number>`count(${payments.id})::int`,
      settledPaymentCount: sql<number>`count(${payments.id}) filter (where ${payments.status} = 'settled')::int`,
      revenueUsdc: sql<string>`coalesce(sum(${payments.amountUsdc}) filter (where ${payments.status} = 'settled'), 0)::text`,
      lastPaidAt: sql<Date | null>`max(${payments.settledAt}) filter (where ${payments.status} = 'settled')`,
    })
    .from(contentItems)
    .leftJoin(payments, eq(payments.contentId, contentItems.id))
    .where(eq(contentItems.creatorId, creatorId))
    .groupBy(
      contentItems.id,
      contentItems.title,
      contentItems.slug,
      contentItems.isActive,
    )
    .orderBy(
      desc(sql`coalesce(sum(${payments.amountUsdc}) filter (where ${payments.status} = 'settled'), 0)`),
      desc(contentItems.createdAt),
    );

  return rows.map((row) => {
    const lastPaidAt =
      row.lastPaidAt instanceof Date
        ? row.lastPaidAt.toISOString()
        : typeof row.lastPaidAt === "string"
          ? new Date(row.lastPaidAt).toISOString()
          : null;

    return creatorContentPerformanceSchema.parse({
      contentId: row.contentId,
      title: row.title,
      slug: row.slug,
      isActive: row.isActive,
      paymentCount: row.paymentCount,
      settledPaymentCount: row.settledPaymentCount,
      revenueUsdc: Number(row.revenueUsdc),
      lastPaidAt,
    });
  });
};
