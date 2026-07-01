import { and, asc, eq, inArray } from "drizzle-orm";
import {
  streamingSessionSchema,
  type StreamingSession,
} from "@subgate/types";
import type { SubgateDatabase } from "./client.js";
import { streamingSessions } from "./schema.js";

export type CreateStreamingSessionInput = {
  contentId: string;
  accessGrantId?: string | null | undefined;
  payerAddress: string;
  ratePerSecondUsdc: number;
  maxAmountUsdc?: number | null | undefined;
  startedAt?: Date | undefined;
};

export type ApplyStreamingTickInput = {
  accruedUsdc: number;
  pendingSettlementUsdc: number;
  totalAccruedUsdc: number;
  lastTickedAt: Date;
  status?: "active" | "stopping" | "closed" | "paused" | undefined;
  stoppedAt?: Date | null | undefined;
  closedAt?: Date | null | undefined;
};

const parseNumeric = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }

  return Number(value);
};

const mapStreamingSession = (
  row: typeof streamingSessions.$inferSelect,
): StreamingSession => {
  return streamingSessionSchema.parse({
    id: row.id,
    contentId: row.contentId,
    accessGrantId: row.accessGrantId,
    payerAddress: row.payerAddress,
    ratePerSecondUsdc: Number(row.ratePerSecondUsdc),
    maxAmountUsdc: parseNumeric(row.maxAmountUsdc),
    totalAccruedUsdc: Number(row.totalAccruedUsdc),
    totalSettledUsdc: Number(row.totalSettledUsdc),
    pendingSettlementUsdc: Number(row.pendingSettlementUsdc),
    startedAt: row.startedAt.toISOString(),
    lastTickedAt: row.lastTickedAt.toISOString(),
    stoppedAt: row.stoppedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    status: row.status,
  });
};

export const createStreamingSession = async (
  db: SubgateDatabase,
  input: CreateStreamingSessionInput,
): Promise<StreamingSession> => {
  const startedAt = input.startedAt ?? new Date();
  const [row] = await db
    .insert(streamingSessions)
    .values({
      contentId: input.contentId,
      accessGrantId: input.accessGrantId ?? null,
      payerAddress: input.payerAddress,
      ratePerSecondUsdc: input.ratePerSecondUsdc.toFixed(6),
      maxAmountUsdc: input.maxAmountUsdc?.toFixed(6) ?? null,
      startedAt,
      lastTickedAt: startedAt,
      status: "active",
      updatedAt: startedAt,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create streaming session.");
  }

  return mapStreamingSession(row);
};

export const getStreamingSessionById = async (
  db: SubgateDatabase,
  id: string,
): Promise<StreamingSession | null> => {
  const [row] = await db
    .select()
    .from(streamingSessions)
    .where(eq(streamingSessions.id, id))
    .limit(1);

  return row ? mapStreamingSession(row) : null;
};

export const listTickableStreamingSessions = async (
  db: SubgateDatabase,
  limit = 50,
): Promise<StreamingSession[]> => {
  const rows = await db
    .select()
    .from(streamingSessions)
    .where(
      inArray(streamingSessions.status, ["active", "stopping"]),
    )
    .orderBy(asc(streamingSessions.lastTickedAt))
    .limit(limit);

  return rows.map(mapStreamingSession);
};

export const applyStreamingTick = async (
  db: SubgateDatabase,
  sessionId: string,
  input: ApplyStreamingTickInput,
): Promise<StreamingSession> => {
  const [row] = await db
    .update(streamingSessions)
    .set({
      totalAccruedUsdc: input.totalAccruedUsdc.toFixed(6),
      pendingSettlementUsdc: input.pendingSettlementUsdc.toFixed(6),
      lastTickedAt: input.lastTickedAt,
      ...(input.status ? { status: input.status } : {}),
      ...(input.stoppedAt !== undefined ? { stoppedAt: input.stoppedAt } : {}),
      ...(input.closedAt !== undefined ? { closedAt: input.closedAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(streamingSessions.id, sessionId))
    .returning();

  if (!row) {
    throw new Error("Failed to update streaming session tick.");
  }

  return mapStreamingSession(row);
};

export const markStreamingSessionSettled = async (
  db: SubgateDatabase,
  sessionId: string,
  amountUsdc: number,
): Promise<StreamingSession> => {
  const session = await getStreamingSessionById(db, sessionId);

  if (!session) {
    throw new Error("Streaming session not found.");
  }

  const totalSettledUsdc = session.totalSettledUsdc + amountUsdc;
  const pendingSettlementUsdc = Math.max(
    session.pendingSettlementUsdc - amountUsdc,
    0,
  );
  const [row] = await db
    .update(streamingSessions)
    .set({
      totalSettledUsdc: totalSettledUsdc.toFixed(6),
      pendingSettlementUsdc: pendingSettlementUsdc.toFixed(6),
      updatedAt: new Date(),
    })
    .where(eq(streamingSessions.id, sessionId))
    .returning();

  if (!row) {
    throw new Error("Failed to mark streaming session settled.");
  }

  return mapStreamingSession(row);
};

export const stopStreamingSession = async (
  db: SubgateDatabase,
  sessionId: string,
  stoppedAt = new Date(),
): Promise<StreamingSession | null> => {
  const [row] = await db
    .update(streamingSessions)
    .set({
      status: "stopping",
      stoppedAt,
      updatedAt: stoppedAt,
    })
    .where(
      and(
        eq(streamingSessions.id, sessionId),
        inArray(streamingSessions.status, ["active", "paused"]),
      ),
    )
    .returning();

  return row ? mapStreamingSession(row) : getStreamingSessionById(db, sessionId);
};

export const closeStreamingSession = async (
  db: SubgateDatabase,
  sessionId: string,
  closedAt = new Date(),
): Promise<StreamingSession> => {
  const [row] = await db
    .update(streamingSessions)
    .set({
      status: "closed",
      closedAt,
      updatedAt: closedAt,
    })
    .where(eq(streamingSessions.id, sessionId))
    .returning();

  if (!row) {
    throw new Error("Failed to close streaming session.");
  }

  return mapStreamingSession(row);
};
