import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createContentInputSchema,
  pricingModelSchema,
  type CreateContentInput,
  type PricingModel,
} from "@subgate/types";
import { z } from "zod";

export const integrationPlatformSchema = z.enum([
  "ghost",
  "discourse",
  "immich",
  "jellyfin",
  "navidrome",
]);

export type IntegrationPlatform = z.infer<typeof integrationPlatformSchema>;

export const normalizedExternalContentSchema = z.object({
  platform: integrationPlatformSchema,
  externalId: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  creatorId: z.string().uuid(),
  title: z.string().min(1).max(160),
  slug: z.string().min(1).max(180),
  summary: z.string().min(1),
  body: z.string().min(1),
  pricing: pricingModelSchema,
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
});

export type NormalizedExternalContent = z.infer<
  typeof normalizedExternalContentSchema
>;

export const normalizedExternalAccessRuleSchema = z.object({
  platform: integrationPlatformSchema,
  externalId: z.string().min(1),
  externalType: z.enum(["topic", "category", "group"]),
  name: z.string().min(1),
  ruleType: z.enum(["public", "gated", "members_only"]),
  pricing: pricingModelSchema.optional(),
  requiredGroups: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export type NormalizedExternalAccessRule = z.infer<
  typeof normalizedExternalAccessRuleSchema
>;

export const normalizedExternalMappingSchema = z.object({
  content: normalizedExternalContentSchema,
  accessRules: z.array(normalizedExternalAccessRuleSchema).default([]),
});

export type NormalizedExternalMapping = z.infer<
  typeof normalizedExternalMappingSchema
>;

export type AdapterContext = {
  creatorId: string;
  defaultPricing: PricingModel;
};

export type IntegrationAdapter = {
  platform: IntegrationPlatform;
  normalizeContentWebhook: (
    payload: unknown,
    context: AdapterContext,
  ) => NormalizedExternalContent | null;
  normalizeWebhook?: (
    payload: unknown,
    context: AdapterContext,
  ) => NormalizedExternalMapping | null;
};

const slugify = (value: string): string => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "untitled";
};

const readRecord = (value: unknown): Record<string, unknown> | null => {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
};

const readString = (value: unknown): string | null => {
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const stripHtml = (value: string): string => {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const firstParagraph = (value: string): string => {
  return stripHtml(value).slice(0, 280) || "Gated content synced by Subgate.";
};

const readNumber = (value: unknown): number | null => {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const readArray = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : [];
};

const readNestedRecord = (
  value: Record<string, unknown> | null,
  path: string[],
): Record<string, unknown> | null => {
  let current: unknown = value;

  for (const segment of path) {
    const record = readRecord(current);

    if (!record) {
      return null;
    }

    current = record[segment];
  }

  return readRecord(current);
};

const readNestedString = (
  value: Record<string, unknown> | null,
  path: string[],
): string | null => {
  let current: unknown = value;

  for (const segment of path) {
    const record = readRecord(current);

    if (!record) {
      return null;
    }

    current = record[segment];
  }

  return readString(current);
};

export const toCreateContentInput = (
  content: NormalizedExternalContent,
): CreateContentInput => {
  return createContentInputSchema.parse({
    creatorId: content.creatorId,
    title: content.title,
    slug: content.slug,
    summary: content.summary,
    body: content.body,
    pricing: content.pricing,
    isActive: content.isActive,
  });
};

export const verifySharedSecretHeader = (
  providedSecret: string | undefined,
  expectedSecret: string | undefined,
): boolean => {
  if (!expectedSecret) {
    return true;
  }

  if (!providedSecret) {
    return false;
  }

  const provided = Buffer.from(providedSecret);
  const expected = Buffer.from(expectedSecret);

  return (
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  );
};

export const verifyHmacSha256 = (
  body: string,
  signature: string | undefined,
  secret: string | undefined,
): boolean => {
  if (!secret) {
    return true;
  }

  if (!signature) {
    return false;
  }

  const normalizedSignature = signature.replace(/^sha256=/, "");
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const provided = Buffer.from(normalizedSignature);
  const expectedBuffer = Buffer.from(expected);

  return (
    provided.length === expectedBuffer.length &&
    timingSafeEqual(provided, expectedBuffer)
  );
};

const readGhostCurrentPost = (payload: unknown): Record<string, unknown> | null => {
  const root = readRecord(payload);
  const post = readRecord(root?.post);
  const current = readRecord(post?.current);

  return current ?? post ?? root;
};

export const ghostAdapter: IntegrationAdapter = {
  platform: "ghost",
  normalizeContentWebhook(payload, context) {
    const post = readGhostCurrentPost(payload);

    if (!post) {
      return null;
    }

    const title = readString(post.title) ?? "Untitled Ghost post";
    const externalId = readString(post.id) ?? readString(post.uuid) ?? slugify(title);
    const sourceSlug = readString(post.slug) ?? slugify(title);
    const html = readString(post.html);
    const plaintext = readString(post.plaintext);
    const excerpt = readString(post.excerpt);
    const canonicalUrl = readString(post.url) ?? undefined;
    const status = readString(post.status);
    const body = html ?? plaintext ?? excerpt ?? title;

    return normalizedExternalContentSchema.parse({
      platform: "ghost",
      externalId,
      sourceUrl: canonicalUrl,
      creatorId: context.creatorId,
      title: title.slice(0, 160),
      slug: `ghost-${sourceSlug}`.slice(0, 180),
      summary: excerpt ?? firstParagraph(body),
      body,
      pricing: context.defaultPricing,
      isActive: status ? status === "published" : true,
      metadata: {
        canonicalUrl,
        status,
        originalSlug: sourceSlug,
      },
    });
  },
};

const readDiscourseTopic = (payload: unknown): Record<string, unknown> | null => {
  const root = readRecord(payload);
  const topic = readRecord(root?.topic);

  return topic ?? root;
};

const readDiscourseCategory = (
  payload: unknown,
  topic: Record<string, unknown>,
): Record<string, unknown> | null => {
  const root = readRecord(payload);

  return (
    readRecord(topic.category) ??
    readRecord(root?.category) ??
    readNestedRecord(root, ["topic", "category"])
  );
};

const readDiscourseGroups = (payload: unknown): string[] => {
  const root = readRecord(payload);
  const rawGroups = [
    ...readArray(root?.groups),
    ...readArray(root?.allowed_groups),
    ...readArray(root?.group_names),
    ...readArray(readNestedRecord(root, ["topic"])?.groups),
    ...readArray(readNestedRecord(root, ["topic"])?.allowed_groups),
  ];

  return Array.from(
    new Set(
      rawGroups
        .map((group) => {
          if (typeof group === "string") {
            return group;
          }

          const record = readRecord(group);

          return readString(record?.name) ?? readString(record?.slug);
        })
        .filter((group): group is string => Boolean(group)),
    ),
  );
};

const readDiscourseBody = (
  payload: unknown,
  topic: Record<string, unknown>,
): string => {
  const root = readRecord(payload);
  const post = readRecord(root?.post);
  const firstPost =
    post ??
    readRecord(readArray(readNestedRecord(topic, ["post_stream"])?.posts)[0]) ??
    readRecord(readArray(readNestedRecord(root, ["post_stream"])?.posts)[0]);

  return (
    readString(firstPost?.cooked) ??
    readString(firstPost?.raw) ??
    readString(topic.excerpt) ??
    readString(topic.title) ??
    "Discourse topic synced by Subgate."
  );
};

const readDiscourseSourceUrl = (
  payload: unknown,
  topic: Record<string, unknown>,
): string | undefined => {
  const root = readRecord(payload);
  const directUrl =
    readString(topic.url) ??
    readString(root?.url) ??
    readNestedString(root, ["topic", "url"]);

  if (directUrl) {
    return directUrl;
  }

  const baseUrl = readString(root?.base_url) ?? readString(root?.discourse_url);
  const slug = readString(topic.slug);
  const id = readNumber(topic.id);

  return baseUrl && slug && id
    ? `${baseUrl.replace(/\/$/, "")}/t/${slug}/${id}`
    : undefined;
};

export const discourseAdapter: IntegrationAdapter = {
  platform: "discourse",
  normalizeContentWebhook(payload, context) {
    return this.normalizeWebhook?.(payload, context)?.content ?? null;
  },
  normalizeWebhook(payload, context) {
    const topic = readDiscourseTopic(payload);

    if (!topic) {
      return null;
    }

    const category = readDiscourseCategory(payload, topic);
    const groups = readDiscourseGroups(payload);
    const title =
      readString(topic.title) ??
      readString(topic.fancy_title) ??
      "Untitled Discourse topic";
    const topicId = readNumber(topic.id);
    const externalId = topicId ? String(topicId) : readString(topic.slug) ?? slugify(title);
    const topicSlug = readString(topic.slug) ?? slugify(title);
    const categorySlug =
      readString(category?.slug) ??
      (readString(category?.name) ? slugify(readString(category?.name) ?? "") : null);
    const categoryId =
      readNumber(category?.id) ?? readNumber(topic.category_id) ?? null;
    const body = readDiscourseBody(payload, topic);
    const sourceUrl = readDiscourseSourceUrl(payload, topic);
    const isVisible = topic.visible === false ? false : true;
    const isClosed = topic.closed === true;
    const isArchived = topic.archived === true;
    const ruleType = groups.length > 0 ? "members_only" : "gated";
    const content = normalizedExternalContentSchema.parse({
      platform: "discourse",
      externalId,
      sourceUrl,
      creatorId: context.creatorId,
      title: title.slice(0, 160),
      slug: `discourse-${categorySlug ? `${categorySlug}-` : ""}${topicSlug}`.slice(
        0,
        180,
      ),
      summary:
        readString(topic.excerpt) ??
        readString(topic.excerpt_text) ??
        firstParagraph(body),
      body,
      pricing: context.defaultPricing,
      isActive: isVisible && !isArchived,
      metadata: {
        sourceUrl,
        topicId,
        topicSlug,
        categoryId,
        categorySlug,
        closed: isClosed,
        archived: isArchived,
        visible: isVisible,
        requiredGroups: groups,
      },
    });
    const accessRules = [
      normalizedExternalAccessRuleSchema.parse({
        platform: "discourse",
        externalId: externalId,
        externalType: "topic",
        name: title,
        ruleType,
        pricing: context.defaultPricing,
        requiredGroups: groups,
        metadata: {
          topicId,
          topicSlug,
          sourceUrl,
        },
      }),
      ...(category
        ? [
            normalizedExternalAccessRuleSchema.parse({
              platform: "discourse",
              externalId: categoryId ? String(categoryId) : categorySlug ?? "category",
              externalType: "category",
              name:
                readString(category.name) ??
                readString(categorySlug) ??
                "Discourse category",
              ruleType,
              pricing: context.defaultPricing,
              requiredGroups: groups,
              metadata: {
                categoryId,
                categorySlug,
              },
            }),
          ]
        : []),
      ...groups.map((group) =>
        normalizedExternalAccessRuleSchema.parse({
          platform: "discourse",
          externalId: group,
          externalType: "group",
          name: group,
          ruleType: "members_only",
          pricing: context.defaultPricing,
          requiredGroups: [group],
          metadata: {
            group,
          },
        }),
      ),
    ];

    return normalizedExternalMappingSchema.parse({
      content,
      accessRules,
    });
  },
};

export const adapters = {
  ghost: ghostAdapter,
  discourse: discourseAdapter,
} satisfies Partial<Record<IntegrationPlatform, IntegrationAdapter>>;
