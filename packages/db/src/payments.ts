import { eq } from "drizzle-orm";
import type {
  X402PaymentPayload,
  X402SettlementResponse,
} from "@subgate/types";
import type { SubgateDatabase } from "./client.js";
import { payments } from "./schema.js";

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
