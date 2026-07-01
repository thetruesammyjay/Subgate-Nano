import { createAccessService } from "@subgate/access";
import {
  applyStreamingTick,
  closeStreamingSession,
  createPendingPaymentRecord,
  getContentById,
  listTickableStreamingSessions,
  markStreamingSessionSettled,
  markPaymentSettling,
  recordPlatformFeeLedgerEntry,
  settlePaymentRecord,
  type SubgateDatabase,
} from "@subgate/db";
import type { X402PaymentPayload, X402SettlementResponse } from "@subgate/types";
import type {
  StreamingSettlementInput,
  StreamingSessionUpdate,
  StreamingWorkerRepository,
} from "./streaming-worker.js";

const toAtomicUsdc = (amountUsdc: number) => {
  return String(Math.round(amountUsdc * 1_000_000));
};

const buildStreamingPaymentPayload = (
  input: StreamingSettlementInput,
): X402PaymentPayload => {
  return {
    x402Version: 2,
    resource: {
      url: `subgate:stream:${input.session.id}`,
      description: `Streaming meter settlement for ${input.session.contentId}`,
      mimeType: "application/json",
    },
    accepted: {
      scheme: "streaming-meter",
      network: "subgate-worker",
      asset: "USDC",
      payTo: "creator-streaming-balance",
      amount: toAtomicUsdc(input.amountUsdc),
      maxTimeoutSeconds: 1,
    },
    payload: {
      source: "subgate-worker",
      streamingSessionId: input.session.id,
      payer: input.session.payerAddress,
      settledAt: input.settledAt.toISOString(),
    },
  };
};

const buildStreamingSettlement = (
  input: StreamingSettlementInput,
): X402SettlementResponse => {
  return {
    success: true,
    transaction: `stream-${input.session.id}-${input.settledAt.getTime()}`,
    network: "subgate-worker",
    payer: input.session.payerAddress,
    message: "Streaming meter batch settled by worker.",
  };
};

export const createStreamingWorkerRepository = (
  db: SubgateDatabase,
  options: {
    platformFeePercent: number;
  },
): StreamingWorkerRepository => {
  const access = createAccessService(db);

  return {
    listTickableSessions(limit) {
      return listTickableStreamingSessions(db, limit);
    },
    applyTick(sessionId: string, update: StreamingSessionUpdate) {
      return applyStreamingTick(db, sessionId, update);
    },
    async recordSettlement(input) {
      const paymentPayload = buildStreamingPaymentPayload(input);
      const settlementResponse = buildStreamingSettlement(input);
      const pendingPayment = await createPendingPaymentRecord(db, {
        contentId: input.session.contentId,
        payerAddress: input.session.payerAddress,
        paymentIdentifier: `stream:${input.session.id}:${input.settledAt.toISOString()}`,
        paymentPayload,
        amountUsdc: input.amountUsdc,
        paymentType: "per_second",
        platformFeePercent: options.platformFeePercent,
      });

      if (!pendingPayment.created) {
        return;
      }

      await markPaymentSettling(db, pendingPayment.payment.id);
      const payment = await settlePaymentRecord(db, pendingPayment.payment.id, {
        accessGrantId: input.session.accessGrantId,
        payerAddress: input.session.payerAddress,
        settlementResponse,
        settledAt: input.settledAt,
      });
      const content = await getContentById(db, input.session.contentId);

      if (!content) {
        throw new Error("Streaming settlement content record is missing.");
      }

      await recordPlatformFeeLedgerEntry(db, {
        payment,
        creatorId: content.creatorId,
      });
      await markStreamingSessionSettled(
        db,
        input.session.id,
        input.amountUsdc,
      );
    },
    closeSession(sessionId, closedAt) {
      return closeStreamingSession(db, sessionId, closedAt);
    },
    revokeAccessGrant(accessGrantId) {
      return access.revoke(accessGrantId);
    },
  };
};
