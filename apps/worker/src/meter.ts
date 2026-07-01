import type { StreamingSession } from "@subgate/types";

const USDC_SCALE = 1_000_000n;

const toMicros = (value: number) => {
  return BigInt(Math.round(value * Number(USDC_SCALE)));
};

const fromMicros = (value: bigint) => {
  return Number(value) / Number(USDC_SCALE);
};

export type StreamingTickDecision = {
  elapsedSeconds: number;
  accruedUsdc: number;
  pendingSettlementUsdc: number;
  totalAccruedUsdc: number;
  settleAmountUsdc: number;
  shouldSettle: boolean;
  shouldClose: boolean;
  tickedThrough: Date;
};

export const calculateStreamingTick = (
  session: StreamingSession,
  now: Date,
  batchThresholdUsdc: number,
): StreamingTickDecision | null => {
  if (session.status !== "active" && session.status !== "stopping") {
    return null;
  }

  const lastTickedAt = new Date(session.lastTickedAt);
  const elapsedSeconds = Math.floor(
    (now.getTime() - lastTickedAt.getTime()) / 1000,
  );

  if (elapsedSeconds <= 0 && session.status !== "stopping") {
    return null;
  }

  const rateMicros = toMicros(session.ratePerSecondUsdc);
  const currentAccruedMicros = toMicros(session.totalAccruedUsdc);
  const currentPendingMicros = toMicros(session.pendingSettlementUsdc);
  const thresholdMicros = toMicros(batchThresholdUsdc);
  const maxMicros =
    session.maxAmountUsdc === null ? null : toMicros(session.maxAmountUsdc);
  const uncappedAccrualMicros = rateMicros * BigInt(Math.max(elapsedSeconds, 0));
  const remainingMicros =
    maxMicros === null ? null : maxMicros - currentAccruedMicros;
  const accruedMicros =
    remainingMicros === null
      ? uncappedAccrualMicros
      : remainingMicros <= 0n
        ? 0n
        : uncappedAccrualMicros > remainingMicros
          ? remainingMicros
          : uncappedAccrualMicros;
  const pendingMicros = currentPendingMicros + accruedMicros;
  const totalAccruedMicros = currentAccruedMicros + accruedMicros;
  const reachedCap = maxMicros !== null && totalAccruedMicros >= maxMicros;
  const shouldClose = session.status === "stopping" || reachedCap;
  const shouldSettle =
    pendingMicros > 0n &&
    (pendingMicros >= thresholdMicros || shouldClose);

  return {
    elapsedSeconds,
    accruedUsdc: fromMicros(accruedMicros),
    pendingSettlementUsdc: fromMicros(pendingMicros),
    totalAccruedUsdc: fromMicros(totalAccruedMicros),
    settleAmountUsdc: shouldSettle ? fromMicros(pendingMicros) : 0,
    shouldSettle,
    shouldClose,
    tickedThrough:
      elapsedSeconds > 0
        ? new Date(lastTickedAt.getTime() + elapsedSeconds * 1000)
        : now,
  };
};
