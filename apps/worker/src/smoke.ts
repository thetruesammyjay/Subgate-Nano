import type { StreamingSession } from "@subgate/types";
import {
  StreamingWorker,
  type StreamingSessionUpdate,
  type StreamingWorkerRepository,
} from "./streaming-worker.js";

const startedAt = new Date("2026-01-01T00:00:00.000Z");
let now = new Date("2026-01-01T00:00:03.000Z");
let session: StreamingSession = {
  id: "00000000-0000-4000-8000-000000000101",
  contentId: "00000000-0000-4000-8000-000000000201",
  accessGrantId: "00000000-0000-4000-8000-000000000301",
  payerAddress: "0x2222222222222222222222222222222222222222",
  ratePerSecondUsdc: 0.002,
  maxAmountUsdc: null,
  totalAccruedUsdc: 0,
  totalSettledUsdc: 0,
  pendingSettlementUsdc: 0,
  startedAt: startedAt.toISOString(),
  lastTickedAt: startedAt.toISOString(),
  stoppedAt: null,
  closedAt: null,
  status: "active",
};
const settlements: number[] = [];
const revokedGrantIds: string[] = [];

const repository: StreamingWorkerRepository = {
  async listTickableSessions() {
    return session.status === "active" || session.status === "stopping"
      ? [session]
      : [];
  },
  async applyTick(_sessionId: string, update: StreamingSessionUpdate) {
    session = {
      ...session,
      totalAccruedUsdc: update.totalAccruedUsdc,
      pendingSettlementUsdc: update.pendingSettlementUsdc,
      lastTickedAt: update.lastTickedAt.toISOString(),
      ...(update.status ? { status: update.status } : {}),
      ...(update.stoppedAt !== undefined
        ? { stoppedAt: update.stoppedAt?.toISOString() ?? null }
        : {}),
      ...(update.closedAt !== undefined
        ? { closedAt: update.closedAt?.toISOString() ?? null }
        : {}),
    };

    return session;
  },
  async recordSettlement(input) {
    settlements.push(input.amountUsdc);
    session = {
      ...session,
      totalSettledUsdc: session.totalSettledUsdc + input.amountUsdc,
      pendingSettlementUsdc: Math.max(
        session.pendingSettlementUsdc - input.amountUsdc,
        0,
      ),
    };
  },
  async closeSession(_sessionId: string, closedAt: Date) {
    session = {
      ...session,
      status: "closed",
      closedAt: closedAt.toISOString(),
    };

    return session;
  },
  async revokeAccessGrant(accessGrantId: string) {
    revokedGrantIds.push(accessGrantId);
  },
};

const worker = new StreamingWorker({
  repository,
  batchThresholdUsdc: 0.005,
  sessionLimit: 10,
  now: () => now,
  logger: {
    error() {},
    info() {},
    warn() {},
  },
});

const firstTick = await worker.tickOnce();

if (firstTick.ticked !== 1 || firstTick.settled !== 1 || firstTick.closed !== 0) {
  throw new Error("Expected first tick to accrue and settle one active session.");
}

if (session.totalAccruedUsdc !== 0.006 || session.totalSettledUsdc !== 0.006) {
  throw new Error("Expected three seconds at $0.002/sec to settle $0.006.");
}

session = {
  ...session,
  status: "stopping",
  stoppedAt: now.toISOString(),
};
now = new Date("2026-01-01T00:00:04.000Z");

const finalTick = await worker.tickOnce();

if (finalTick.ticked !== 1 || finalTick.settled !== 1 || finalTick.closed !== 1) {
  throw new Error("Expected stopping session to settle the remainder and close.");
}

if (session.status !== "closed") {
  throw new Error("Expected worker to close a stopped session.");
}

if (!revokedGrantIds.includes("00000000-0000-4000-8000-000000000301")) {
  throw new Error("Expected worker to revoke the stream access grant.");
}

console.log(
  "Worker smoke passed: streaming sessions accrue, batch settle, close, and revoke access.",
);
