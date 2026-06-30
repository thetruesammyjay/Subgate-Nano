import { buildSidecarApp } from "./app.js";
import type { SidecarEnv } from "./env.js";

const env: SidecarEnv = {
  SIDECAR_HOST: "127.0.0.1",
  SIDECAR_PORT: 3002,
  SUBGATE_API_URL: "http://localhost:3001",
  INTERNAL_SERVICE_SECRET: "sidecar-smoke-internal-secret",
  GHOST_WEBHOOK_SECRET: "ghost-smoke-secret",
  DISCOURSE_WEBHOOK_SECRET: "discourse-smoke-secret",
  DEFAULT_CREATOR_ID: "00000000-0000-4000-8000-000000000001",
  DEFAULT_PRICE_USDC: 0.003,
};

const synced: unknown[] = [];
const syncedCount = () => synced.length;
const app = await buildSidecarApp({
  env,
  subgateClient: {
    async syncContent(input) {
      synced.push(input);

      return {
        id: "00000000-0000-4000-8000-000000000010",
        creatorId: input.creatorId,
        title: input.title,
        slug: input.slug,
        summary: input.summary,
        body: input.body,
        pricing: input.pricing,
        isActive: input.isActive ?? true,
        createdAt: new Date().toISOString(),
      };
    },
  },
});

try {
  const unauthorized = await app.inject({
    method: "POST",
    url: "/webhooks/ghost/content",
    payload: {},
  });

  if (unauthorized.statusCode !== 401) {
    throw new Error(
      `Expected unsigned Ghost webhook to return 401, received ${unauthorized.statusCode}.`,
    );
  }

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/ghost/content",
    headers: {
      "x-subgate-webhook-secret": env.GHOST_WEBHOOK_SECRET ?? "",
    },
    payload: {
      post: {
        current: {
          id: "ghost-post-1",
          title: "Subgate Ghost Demo",
          slug: "subgate-ghost-demo",
          excerpt: "A Ghost post synced into Subgate.",
          html: "<p>Premium body</p>",
          status: "published",
          url: "https://example.com/subgate-ghost-demo",
        },
      },
    },
  });

  if (response.statusCode !== 202) {
    throw new Error(`Expected Ghost webhook 202, received ${response.statusCode}.`);
  }

  if (syncedCount() !== 1) {
    throw new Error("Expected Ghost webhook to sync exactly one content item.");
  }

  const discourseUnauthorized = await app.inject({
    method: "POST",
    url: "/webhooks/discourse/topic",
    payload: {},
  });

  if (discourseUnauthorized.statusCode !== 401) {
    throw new Error(
      `Expected unsigned Discourse webhook to return 401, received ${discourseUnauthorized.statusCode}.`,
    );
  }

  const discourseResponse = await app.inject({
    method: "POST",
    url: "/webhooks/discourse/topic",
    headers: {
      "x-subgate-webhook-secret": env.DISCOURSE_WEBHOOK_SECRET ?? "",
    },
    payload: {
      base_url: "https://forum.example.com",
      topic: {
        id: 42,
        title: "Private Alpha Thread",
        slug: "private-alpha-thread",
        excerpt: "A gated forum topic synced into Subgate.",
        category_id: 7,
        category: {
          id: 7,
          name: "Alpha Room",
          slug: "alpha-room",
        },
        visible: true,
      },
      post: {
        cooked: "<p>Premium Discourse body</p>",
      },
      groups: [{ name: "alpha-members" }],
    },
  });

  if (discourseResponse.statusCode !== 202) {
    throw new Error(
      `Expected Discourse webhook 202, received ${discourseResponse.statusCode}.`,
    );
  }

  const discourseBody = discourseResponse.json<{
    accessRules?: unknown[];
  }>();

  if (!Array.isArray(discourseBody.accessRules) || discourseBody.accessRules.length < 3) {
    throw new Error("Expected Discourse webhook to map topic, category, and group rules.");
  }

  if (syncedCount() !== 2) {
    throw new Error("Expected Ghost and Discourse webhooks to sync two content items.");
  }

  console.log(
    "Sidecar smoke passed: Ghost and Discourse webhooks -> normalized content -> Subgate sync.",
  );
} finally {
  await app.close();
}
