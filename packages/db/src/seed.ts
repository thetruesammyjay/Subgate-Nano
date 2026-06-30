import { pathToFileURL } from "node:url";
import { createDatabase, createDbPool } from "./client.js";
import { contentItems, creators } from "./schema.js";
import type { SubgateDatabase } from "./client.js";

export type SeedResult = {
  creatorId: string;
  contentIds: string[];
};

const demoCreator = {
  email: "demo@subgate.nano",
  displayName: "Subgate Demo Desk",
  arcWalletAddress: "0x1111111111111111111111111111111111111111",
  circleWalletId: "circle-demo-wallet",
};

const demoContent = [
  {
    title: "Arc Settlement Explainer",
    slug: "arc-settlement-explainer",
    summary: "A compact brief on how Arc, Gateway, and x402 settle creator access.",
    body: [
      "Arc Settlement Explainer",
      "",
      "Subgate Nano turns content unlocks into exact HTTP-native payments. A client requests gated content, receives x402 terms, signs through Circle Gateway, and retries with the payment signature.",
      "",
      "Once Gateway settlement succeeds, Subgate records the payment and grants access to the requested content item.",
    ].join("\n"),
    pricingType: "per_access",
    priceUsdc: "0.003000",
    ratePerSecondUsdc: null,
    durationSeconds: null,
  },
  {
    title: "Agent Citation Toll",
    slug: "agent-citation-toll",
    summary: "A tiny pay-per-citation content endpoint for autonomous buyer agents.",
    body: [
      "Agent Citation Toll",
      "",
      "Agents can inspect the catalog, score relevance, request a quote, and unlock only the source they need. This keeps agent retrieval auditable and priced at the actual unit of value.",
    ].join("\n"),
    pricingType: "per_citation",
    priceUsdc: "0.000100",
    ratePerSecondUsdc: null,
    durationSeconds: null,
  },
  {
    title: "Per-second Creator Stream",
    slug: "per-second-creator-stream",
    summary: "A metered stream concept priced by exact seconds of access.",
    body: [
      "Per-second Creator Stream",
      "",
      "Subgate's data model already supports per-second pricing so live drops, private streams, and time-boxed feeds can be billed by duration instead of forcing a subscription.",
    ].join("\n"),
    pricingType: "per_second",
    priceUsdc: null,
    ratePerSecondUsdc: "0.001000",
    durationSeconds: null,
  },
];

export const seedDemoData = async (db: SubgateDatabase): Promise<SeedResult> => {
  const [creator] = await db
    .insert(creators)
    .values(demoCreator)
    .onConflictDoUpdate({
      target: creators.email,
      set: {
        displayName: demoCreator.displayName,
        arcWalletAddress: demoCreator.arcWalletAddress,
        circleWalletId: demoCreator.circleWalletId,
      },
    })
    .returning();

  if (!creator) {
    throw new Error("Failed to seed demo creator.");
  }

  const contentIds: string[] = [];

  for (const item of demoContent) {
    const [content] = await db
      .insert(contentItems)
      .values({
        creatorId: creator.id,
        ...item,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: contentItems.slug,
        set: {
          creatorId: creator.id,
          title: item.title,
          summary: item.summary,
          body: item.body,
          pricingType: item.pricingType,
          priceUsdc: item.priceUsdc,
          ratePerSecondUsdc: item.ratePerSecondUsdc,
          durationSeconds: item.durationSeconds,
          isActive: true,
        },
      })
      .returning({ id: contentItems.id });

    if (!content) {
      throw new Error(`Failed to seed content item "${item.slug}".`);
    }

    contentIds.push(content.id);
  }

  return {
    creatorId: creator.id,
    contentIds,
  };
};

const isCliEntrypoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliEntrypoint) {
  const pool = createDbPool();
  const db = createDatabase(pool);

  try {
    const result = await seedDemoData(db);
    console.log(
      `Seeded demo creator ${result.creatorId} with ${result.contentIds.length} content items.`,
    );
  } finally {
    await pool.end();
  }
}
