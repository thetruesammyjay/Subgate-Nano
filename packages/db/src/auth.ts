import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { creatorSchema, type Creator } from "@subgate/types";
import type { SubgateDatabase } from "./client.js";
import { creatorLoginTokens, creatorSessions, creators } from "./schema.js";

const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const createOpaqueToken = () => {
  return randomBytes(32).toString("base64url");
};

const hashToken = (token: string) => {
  return createHash("sha256").update(token).digest("hex");
};

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

export type CreatorMagicLinkToken = {
  token: string;
  creator: Creator;
  expiresAt: string;
};

export type CreatorSession = {
  token: string;
  creator: Creator;
  expiresAt: string;
};

export const createCreatorMagicLinkToken = async (
  db: SubgateDatabase,
  email: string,
): Promise<CreatorMagicLinkToken | null> => {
  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.email, email.toLowerCase()))
    .limit(1);

  if (!creator) {
    return null;
  }

  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MS);

  await db.insert(creatorLoginTokens).values({
    creatorId: creator.id,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return {
    token,
    creator: mapCreator(creator),
    expiresAt: expiresAt.toISOString(),
  };
};

export const consumeCreatorMagicLinkToken = async (
  db: SubgateDatabase,
  token: string,
): Promise<CreatorSession | null> => {
  const now = new Date();
  const tokenHash = hashToken(token);
  const [loginToken] = await db
    .select()
    .from(creatorLoginTokens)
    .where(
      and(
        eq(creatorLoginTokens.tokenHash, tokenHash),
        isNull(creatorLoginTokens.usedAt),
        gt(creatorLoginTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!loginToken) {
    return null;
  }

  await db
    .update(creatorLoginTokens)
    .set({ usedAt: now })
    .where(eq(creatorLoginTokens.id, loginToken.id));

  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, loginToken.creatorId))
    .limit(1);

  if (!creator) {
    return null;
  }

  const sessionToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(creatorSessions).values({
    creatorId: creator.id,
    sessionTokenHash: hashToken(sessionToken),
    expiresAt,
  });

  return {
    token: sessionToken,
    creator: mapCreator(creator),
    expiresAt: expiresAt.toISOString(),
  };
};

export const getCreatorBySessionToken = async (
  db: SubgateDatabase,
  sessionToken: string,
): Promise<Creator | null> => {
  const now = new Date();
  const [session] = await db
    .select()
    .from(creatorSessions)
    .where(
      and(
        eq(creatorSessions.sessionTokenHash, hashToken(sessionToken)),
        isNull(creatorSessions.revokedAt),
        gt(creatorSessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!session) {
    return null;
  }

  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, session.creatorId))
    .limit(1);

  return creator ? mapCreator(creator) : null;
};

export const revokeCreatorSession = async (
  db: SubgateDatabase,
  sessionToken: string,
): Promise<void> => {
  await db
    .update(creatorSessions)
    .set({ revokedAt: new Date() })
    .where(eq(creatorSessions.sessionTokenHash, hashToken(sessionToken)));
};
