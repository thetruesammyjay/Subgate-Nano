import { sql } from "drizzle-orm";
import type {
  PipelineCount,
  StreamingSessionCount,
} from "@subgate/types";
import type { SubgateDatabase } from "./client.js";
import {
  payments,
  platformFeeLedgerEntries,
  streamingSessions,
} from "./schema.js";

export type PaymentPipelineDatabaseDiagnostics = {
  payments: PipelineCount;
  platformFees: {
    posted: number;
    missingForSettledPayments: number;
    totalPlatformFeeUsdc: number;
  };
  streaming: {
    sessions: StreamingSessionCount;
    pendingSettlementUsdc: number;
  };
};

const toCount = (value: unknown) => Number(value ?? 0);

export const getPaymentPipelineDatabaseDiagnostics = async (
  db: SubgateDatabase,
): Promise<PaymentPipelineDatabaseDiagnostics> => {
  const [paymentCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${payments.status} = 'pending')::int`,
      settling: sql<number>`count(*) filter (where ${payments.status} = 'settling')::int`,
      settled: sql<number>`count(*) filter (where ${payments.status} = 'settled')::int`,
      failed: sql<number>`count(*) filter (where ${payments.status} = 'failed')::int`,
      missingForSettledPayments: sql<number>`count(*) filter (
        where ${payments.status} = 'settled'
        and not exists (
          select 1
          from ${platformFeeLedgerEntries}
          where ${platformFeeLedgerEntries.paymentId} = ${payments.id}
        )
      )::int`,
    })
    .from(payments);

  const [feeLedgerCounts] = await db
    .select({
      posted: sql<number>`count(*) filter (where ${platformFeeLedgerEntries.status} = 'posted')::int`,
      totalPlatformFeeUsdc: sql<string>`coalesce(sum(${platformFeeLedgerEntries.platformFeeUsdc}) filter (where ${platformFeeLedgerEntries.status} = 'posted'), 0)::text`,
    })
    .from(platformFeeLedgerEntries);

  const [streamingCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${streamingSessions.status} = 'active')::int`,
      stopping: sql<number>`count(*) filter (where ${streamingSessions.status} = 'stopping')::int`,
      paused: sql<number>`count(*) filter (where ${streamingSessions.status} = 'paused')::int`,
      closed: sql<number>`count(*) filter (where ${streamingSessions.status} = 'closed')::int`,
      pendingSettlementUsdc: sql<string>`coalesce(sum(${streamingSessions.pendingSettlementUsdc}) filter (where ${streamingSessions.status} in ('active', 'stopping', 'paused')), 0)::text`,
    })
    .from(streamingSessions);

  return {
    payments: {
      total: toCount(paymentCounts?.total),
      pending: toCount(paymentCounts?.pending),
      settling: toCount(paymentCounts?.settling),
      settled: toCount(paymentCounts?.settled),
      failed: toCount(paymentCounts?.failed),
    },
    platformFees: {
      posted: toCount(feeLedgerCounts?.posted),
      missingForSettledPayments: toCount(
        paymentCounts?.missingForSettledPayments,
      ),
      totalPlatformFeeUsdc: Number(feeLedgerCounts?.totalPlatformFeeUsdc ?? 0),
    },
    streaming: {
      sessions: {
        total: toCount(streamingCounts?.total),
        active: toCount(streamingCounts?.active),
        stopping: toCount(streamingCounts?.stopping),
        paused: toCount(streamingCounts?.paused),
        closed: toCount(streamingCounts?.closed),
      },
      pendingSettlementUsdc: Number(streamingCounts?.pendingSettlementUsdc ?? 0),
    },
  };
};
