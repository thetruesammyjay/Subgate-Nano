import type { StreamingSession } from "@subgate/types";
import { calculateStreamingTick } from "./meter.js";

export type StreamingSessionUpdate = {
  accruedUsdc: number;
  pendingSettlementUsdc: number;
  totalAccruedUsdc: number;
  lastTickedAt: Date;
  status?: "active" | "stopping" | "closed" | "paused";
  stoppedAt?: Date | null;
  closedAt?: Date | null;
};

export type StreamingSettlementInput = {
  session: StreamingSession;
  amountUsdc: number;
  settledAt: Date;
};

export type StreamingWorkerRepository = {
  listTickableSessions: (limit: number) => Promise<StreamingSession[]>;
  applyTick: (
    sessionId: string,
    update: StreamingSessionUpdate,
  ) => Promise<StreamingSession>;
  recordSettlement: (input: StreamingSettlementInput) => Promise<void>;
  closeSession: (
    sessionId: string,
    closedAt: Date,
  ) => Promise<StreamingSession>;
  revokeAccessGrant: (accessGrantId: string) => Promise<void>;
};

export type StreamingWorkerOptions = {
  repository: StreamingWorkerRepository;
  batchThresholdUsdc: number;
  sessionLimit: number;
  now?: () => Date;
  logger?: Pick<typeof console, "error" | "info" | "warn">;
};

export type StreamingWorkerTickResult = {
  scanned: number;
  ticked: number;
  settled: number;
  closed: number;
};

export class StreamingWorker {
  private readonly repository: StreamingWorkerRepository;
  private readonly batchThresholdUsdc: number;
  private readonly sessionLimit: number;
  private readonly now: () => Date;
  private readonly logger: Pick<typeof console, "error" | "info" | "warn">;

  constructor(options: StreamingWorkerOptions) {
    this.repository = options.repository;
    this.batchThresholdUsdc = options.batchThresholdUsdc;
    this.sessionLimit = options.sessionLimit;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger ?? console;
  }

  async tickOnce(): Promise<StreamingWorkerTickResult> {
    const sessions = await this.repository.listTickableSessions(
      this.sessionLimit,
    );
    const result: StreamingWorkerTickResult = {
      scanned: sessions.length,
      ticked: 0,
      settled: 0,
      closed: 0,
    };

    for (const session of sessions) {
      try {
        const decision = calculateStreamingTick(
          session,
          this.now(),
          this.batchThresholdUsdc,
        );

        if (!decision) {
          continue;
        }

        const updatedSession = await this.repository.applyTick(session.id, {
          accruedUsdc: decision.accruedUsdc,
          pendingSettlementUsdc: decision.pendingSettlementUsdc,
          totalAccruedUsdc: decision.totalAccruedUsdc,
          lastTickedAt: decision.tickedThrough,
        });
        result.ticked += 1;

        if (decision.shouldSettle) {
          await this.repository.recordSettlement({
            session: updatedSession,
            amountUsdc: decision.settleAmountUsdc,
            settledAt: decision.tickedThrough,
          });
          result.settled += 1;
        }

        if (decision.shouldClose) {
          const closedSession = await this.repository.closeSession(
            session.id,
            decision.tickedThrough,
          );

          if (closedSession.accessGrantId) {
            await this.repository.revokeAccessGrant(closedSession.accessGrantId);
          }

          result.closed += 1;
        }
      } catch (error) {
        this.logger.error(
          {
            error,
            sessionId: session.id,
          },
          "Failed to tick streaming session.",
        );
      }
    }

    return result;
  }
}
