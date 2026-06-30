import {
  boolean,
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
