import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const creators = pgTable("creators", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  arcWalletAddress: varchar("arc_wallet_address", { length: 255 }).notNull(),
  circleWalletId: varchar("circle_wallet_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const contentItems = pgTable("content_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creators.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  summary: text("summary").notNull(),
  body: text("body").notNull(),
  pricingType: varchar("pricing_type", { length: 32 }).notNull(),
  priceUsdc: numeric("price_usdc", { precision: 18, scale: 6 }),
  ratePerSecondUsdc: numeric("rate_per_second_usdc", {
    precision: 18,
    scale: 6,
  }),
  durationSeconds: numeric("duration_seconds", { precision: 18, scale: 0 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const creatorLoginTokens = pgTable(
  "creator_login_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("creator_login_tokens_token_hash_idx").on(
      table.tokenHash,
    ),
  }),
);

export const creatorSessions = pgTable(
  "creator_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    sessionTokenHash: varchar("session_token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sessionTokenHashIdx: uniqueIndex("creator_sessions_token_hash_idx").on(
      table.sessionTokenHash,
    ),
  }),
);

export const accessGrants = pgTable("access_grants", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentId: uuid("content_id")
    .notNull()
    .references(() => contentItems.id, { onDelete: "cascade" }),
  payerAddress: varchar("payer_address", { length: 255 }).notNull(),
  pricingType: varchar("pricing_type", { length: 32 }).notNull(),
  priceUsdc: numeric("price_usdc", { precision: 18, scale: 6 }),
  ratePerSecondUsdc: numeric("rate_per_second_usdc", {
    precision: 18,
    scale: 6,
  }),
  durationSeconds: numeric("duration_seconds", { precision: 18, scale: 0 }),
  grantedAt: timestamp("granted_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
});

export const streamingSessions = pgTable(
  "streaming_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    accessGrantId: uuid("access_grant_id").references(() => accessGrants.id, {
      onDelete: "set null",
    }),
    payerAddress: varchar("payer_address", { length: 255 }).notNull(),
    ratePerSecondUsdc: numeric("rate_per_second_usdc", {
      precision: 18,
      scale: 6,
    }).notNull(),
    maxAmountUsdc: numeric("max_amount_usdc", { precision: 18, scale: 6 }),
    totalAccruedUsdc: numeric("total_accrued_usdc", {
      precision: 18,
      scale: 6,
    })
      .default("0")
      .notNull(),
    totalSettledUsdc: numeric("total_settled_usdc", {
      precision: 18,
      scale: 6,
    })
      .default("0")
      .notNull(),
    pendingSettlementUsdc: numeric("pending_settlement_usdc", {
      precision: 18,
      scale: 6,
    })
      .default("0")
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastTickedAt: timestamp("last_ticked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    statusIdx: index("streaming_sessions_status_idx").on(table.status),
    contentPayerIdx: index("streaming_sessions_content_payer_idx").on(
      table.contentId,
      table.payerAddress,
    ),
  }),
);

export const integrationSources = pgTable(
  "integration_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 64 }).notNull(),
    externalSourceId: varchar("external_source_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    baseUrl: varchar("base_url", { length: 512 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sourceUniqueIdx: uniqueIndex("integration_sources_unique_idx").on(
      table.creatorId,
      table.platform,
      table.externalSourceId,
    ),
  }),
);

export const externalContentMappings = pgTable(
  "external_content_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    integrationSourceId: uuid("integration_source_id")
      .notNull()
      .references(() => integrationSources.id, { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    externalType: varchar("external_type", { length: 64 }).notNull(),
    sourceUrl: varchar("source_url", { length: 512 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    externalContentUniqueIdx: uniqueIndex(
      "external_content_mappings_unique_idx",
    ).on(table.integrationSourceId, table.externalId),
  }),
);

export const externalAccessRules = pgTable(
  "external_access_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    integrationSourceId: uuid("integration_source_id")
      .notNull()
      .references(() => integrationSources.id, { onDelete: "cascade" }),
    contentMappingId: uuid("content_mapping_id").references(
      () => externalContentMappings.id,
      { onDelete: "cascade" },
    ),
    platform: varchar("platform", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    externalType: varchar("external_type", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    ruleType: varchar("rule_type", { length: 64 }).notNull(),
    pricingType: varchar("pricing_type", { length: 32 }),
    priceUsdc: numeric("price_usdc", { precision: 18, scale: 6 }),
    ratePerSecondUsdc: numeric("rate_per_second_usdc", {
      precision: 18,
      scale: 6,
    }),
    durationSeconds: numeric("duration_seconds", { precision: 18, scale: 0 }),
    requiredGroups: jsonb("required_groups").$type<string[]>().default([]).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    externalRuleUniqueIdx: uniqueIndex("external_access_rules_unique_idx").on(
      table.integrationSourceId,
      table.externalType,
      table.externalId,
    ),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    accessGrantId: uuid("access_grant_id").references(() => accessGrants.id, {
      onDelete: "set null",
    }),
    payerAddress: varchar("payer_address", { length: 255 }).notNull(),
    paymentIdentifier: varchar("payment_identifier", { length: 255 }).notNull(),
    paymentPayload: text("payment_payload").notNull(),
    settlementResponse: text("settlement_response").notNull(),
    gatewayTransactionId: varchar("gateway_transaction_id", { length: 255 }),
    amountUsdc: numeric("amount_usdc", { precision: 18, scale: 6 }).notNull(),
    platformFeeUsdc: numeric("platform_fee_usdc", {
      precision: 18,
      scale: 6,
    })
      .default("0")
      .notNull(),
    creatorNetUsdc: numeric("creator_net_usdc", {
      precision: 18,
      scale: 6,
    })
      .default("0")
      .notNull(),
    platformFeePercent: numeric("platform_fee_percent", {
      precision: 7,
      scale: 4,
    })
      .default("0")
      .notNull(),
    paymentType: varchar("payment_type", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    paymentIdentifierIdx: uniqueIndex("payments_payment_identifier_idx").on(
      table.paymentIdentifier,
    ),
  }),
);

export const platformFeeLedgerEntries = pgTable(
  "platform_fee_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    grossAmountUsdc: numeric("gross_amount_usdc", {
      precision: 18,
      scale: 6,
    }).notNull(),
    platformFeeUsdc: numeric("platform_fee_usdc", {
      precision: 18,
      scale: 6,
    }).notNull(),
    creatorNetUsdc: numeric("creator_net_usdc", {
      precision: 18,
      scale: 6,
    }).notNull(),
    platformFeePercent: numeric("platform_fee_percent", {
      precision: 7,
      scale: 4,
    }).notNull(),
    currency: varchar("currency", { length: 16 }).default("USDC").notNull(),
    status: varchar("status", { length: 32 }).default("posted").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    paymentUniqueIdx: uniqueIndex("platform_fee_ledger_payment_idx").on(
      table.paymentId,
    ),
    creatorIdx: index("platform_fee_ledger_creator_idx").on(table.creatorId),
  }),
);
