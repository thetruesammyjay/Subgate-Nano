import { eq } from "drizzle-orm";
import { creatorSchema, type Creator } from "@subgate/types";
import type { SubgateDatabase } from "./client.js";
import { creators } from "./schema.js";

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

export const getCreatorById = async (
  db: SubgateDatabase,
  id: string,
): Promise<Creator | null> => {
  const [row] = await db.select().from(creators).where(eq(creators.id, id)).limit(1);

  return row ? mapCreator(row) : null;
};
