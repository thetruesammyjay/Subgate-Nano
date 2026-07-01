import { desc, eq, sql } from "drizzle-orm";
import type {
  CreatorContentPerformance,
  CreatorPayment,
  PricingModel,
  X402PaymentPayload,
  X402SettlementResponse,
} from "@subgate/types";
import {
  creatorContentPerformanceSchema,
  creatorPaymentSchema,
} from "@subgate/types";
import type { SubgateDatabase } from "./client.js";
import { contentItems, payments, platformFeeLedgerEntries } from "./schema.js";

export type PaymentStatus = "pending" | "settling" | "settled" | "failed";
export type PaymentType = PricingModel["type"];

export type PlatformFeeBreakdown = {
  grossAmountUsdc: number;
  platformFeeUsdc: number;
  creatorNetUsdc: number;
  platformFeePercent: number;
};

export type CreatePendingPaymentRecordInput = {
  contentId: string;
  payerAddress: string;
  paymentIdentifier: string;
  paymentPayload: X402PaymentPayload;
  amountUsdc: number;
  paymentType: PaymentType;
  platformFeePercent: number;
};

export type SettlePaymentRecordInput = {
  accessGrantId: string | null;
  payerAddress: string;
  settlementResponse: X402SettlementResponse;
  settledAt?: Date | undefined;
};

export type CreatePaymentRecordInput = CreatePendingPaymentRecordInput & {
  accessGrantId: string | null;
  settlementResponse: X402SettlementResponse;
};

const emptySettlementResponse: X402SettlementResponse = {
  success: false,
  transaction: "",
  network: "pending",
  message: "Payment has not been submitted for settlement yet.",
};

export const calculatePlatformFeeBreakdown = (
  grossAmountUsdc: number,
  platformFeePercent: number,
): PlatformFeeBreakdown => {
  const platformFeeUsdc =
    Math.round(grossAmountUsdc * (platformFeePercent / 100) * 1_000_000) /
    1_000_000;
  const creatorNetUsdc =
    Math.round((grossAmountUsdc - platformFeeUsdc) * 1_000_000) / 1_000_000;

  return {
    grossAmountUsdc,
    platformFeeUsdc,
    creatorNetUsdc,
    platformFeePercent,
  };
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

export const createPendingPaymentRecord = async (
  db: SubgateDatabase,
  input: CreatePendingPaymentRecordInput,
) => {
  const fees = calculatePlatformFeeBreakdown(
    input.amountUsdc,
    input.platformFeePercent,
  );
  const [inserted] = await db
    .insert(payments)
    .values({
      contentId: input.contentId,
      accessGrantId: null,
      payerAddress: input.payerAddress,
      paymentIdentifier: input.paymentIdentifier,
      paymentPayload: JSON.stringify(input.paymentPayload),
      settlementResponse: JSON.stringify(emptySettlementResponse),
      gatewayTransactionId: null,
      amountUsdc: fees.grossAmountUsdc.toFixed(6),
      platformFeeUsdc: fees.platformFeeUsdc.toFixed(6),
      creatorNetUsdc: fees.creatorNetUsdc.toFixed(6),
      platformFeePercent: fees.platformFeePercent.toFixed(4),
      paymentType: input.paymentType,
      status: "pending",
      settledAt: null,
    })
    .onConflictDoNothing({
      target: payments.paymentIdentifier,
    })
    .returning();

  if (inserted) {
    return {
      payment: inserted,
      created: true,
    };
  }

  const existing = await findPaymentByIdentifier(db, input.paymentIdentifier);

  if (!existing) {
    throw new Error("Failed to read existing idempotent payment record.");
  }

  return {
    payment: existing,
    created: false,
  };
};

export const markPaymentSettling = async (
  db: SubgateDatabase,
  paymentId: string,
) => {
  const [row] = await db
    .update(payments)
    .set({
      status: "settling",
    })
    .where(eq(payments.id, paymentId))
    .returning();

  if (!row) {
    throw new Error("Failed to mark payment as settling.");
  }

  return row;
};

export const settlePaymentRecord = async (
  db: SubgateDatabase,
  paymentId: string,
  input: SettlePaymentRecordInput,
) => {
  const settledAt = input.settledAt ?? new Date();
  const [row] = await db
    .update(payments)
    .set({
      accessGrantId: input.accessGrantId,
      payerAddress: input.payerAddress,
      settlementResponse: JSON.stringify(input.settlementResponse),
      gatewayTransactionId: input.settlementResponse.transaction,
      status: "settled",
      settledAt,
    })
    .where(eq(payments.id, paymentId))
    .returning();

  if (!row) {
    throw new Error("Failed to settle payment record.");
  }

  return row;
};

export const failPaymentRecord = async (
  db: SubgateDatabase,
  paymentId: string,
  settlementResponse: X402SettlementResponse,
) => {
  const [row] = await db
    .update(payments)
    .set({
      settlementResponse: JSON.stringify(settlementResponse),
      gatewayTransactionId: settlementResponse.transaction,
      status: "failed",
      settledAt: null,
    })
    .where(eq(payments.id, paymentId))
    .returning();

  if (!row) {
    throw new Error("Failed to fail payment record.");
  }

  return row;
};

export const recordPlatformFeeLedgerEntry = async (
  db: SubgateDatabase,
  input: {
    payment: typeof payments.$inferSelect;
    creatorId: string;
  },
) => {
  const [row] = await db
    .insert(platformFeeLedgerEntries)
    .values({
      paymentId: input.payment.id,
      creatorId: input.creatorId,
      contentId: input.payment.contentId,
      grossAmountUsdc: input.payment.amountUsdc,
      platformFeeUsdc: input.payment.platformFeeUsdc,
      creatorNetUsdc: input.payment.creatorNetUsdc,
      platformFeePercent: input.payment.platformFeePercent,
      currency: "USDC",
      status: "posted",
    })
    .onConflictDoNothing({
      target: platformFeeLedgerEntries.paymentId,
    })
    .returning();

  return row ?? null;
};

export const findPlatformFeeLedgerEntryByPaymentId = async (
  db: SubgateDatabase,
  paymentId: string,
) => {
  const [row] = await db
    .select()
    .from(platformFeeLedgerEntries)
    .where(eq(platformFeeLedgerEntries.paymentId, paymentId))
    .limit(1);

  return row ?? null;
};

export const createPaymentRecord = async (
  db: SubgateDatabase,
  input: CreatePaymentRecordInput,
) => {
  const pending = await createPendingPaymentRecord(db, {
    contentId: input.contentId,
    payerAddress: input.payerAddress,
    paymentIdentifier: input.paymentIdentifier,
    paymentPayload: input.paymentPayload,
    amountUsdc: input.amountUsdc,
    paymentType: input.paymentType,
    platformFeePercent: input.platformFeePercent,
  });

  if (!pending.created) {
    return pending.payment;
  }

  if (!input.settlementResponse.success) {
    return failPaymentRecord(db, pending.payment.id, input.settlementResponse);
  }

  return settlePaymentRecord(db, pending.payment.id, {
    accessGrantId: input.accessGrantId,
    payerAddress: input.payerAddress,
    settlementResponse: input.settlementResponse,
  });
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
      platformFeeUsdc: Number(payment.platformFeeUsdc),
      creatorNetUsdc: Number(payment.creatorNetUsdc),
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
      revenueUsdc: sql<string>`coalesce(sum(${payments.creatorNetUsdc}) filter (where ${payments.status} = 'settled'), 0)::text`,
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
      desc(sql`coalesce(sum(${payments.creatorNetUsdc}) filter (where ${payments.status} = 'settled'), 0)`),
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
