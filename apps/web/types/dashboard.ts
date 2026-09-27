import type { Stream } from "./stream";

export type DashboardPage<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type CreatorDashboardOverview = {
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  streams_total: number;
  streams_published: number;
  streams_live: number;
  sessions_total: number;
  watch_seconds: number;
  settled_atomic: number;
  generated_at: string;
};

export type CreatorWorkspaceSession = {
  id: string;
  stream_id: string;
  stream_title: string;
  stream_slug: string;
  viewer_wallet: string;
  status: "active" | "completed";
  consumed_seconds: number;
  accrued_atomic: number;
  settled_atomic: number;
  started_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
  settlement: {
    status: string;
    amount_atomic: number;
    transaction_reference: string;
    settled_at: string;
  } | null;
};

export type CreatorReceipt = {
  id: string;
  session_id: string;
  stream_id: string;
  stream_title: string;
  stream_slug: string;
  viewer_wallet: string;
  duration_seconds: number;
  amount_atomic: number;
  status: string;
  transaction_reference: string;
  settled_at: string;
};

export type CreatorSettings = {
  default_preview_seconds: number;
  email_notifications: boolean;
  session_notifications: boolean;
  settlement_notifications: boolean;
};

export type AdminOverviewData = {
  creators_total: number;
  creators_pending: number;
  streams_published: number;
  sessions_active: number;
  settlements_count: number;
  settlements_atomic: number;
  health: string;
  generated_at: string;
};

export type AdminCreatorSummary = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string;
  wallet_address: string | null;
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  created_at: string;
  stream_count: number;
};

export type AdminCreatorDetail = AdminCreatorSummary & {
  social_links: Record<string, string>;
  sessions_count: number;
  streams: Array<Pick<Stream, "id" | "slug" | "title" | "stream_type" | "is_published" | "created_at">>;
};

export type AdminStream = {
  id: string;
  slug: string;
  title: string;
  description: string;
  playback_url: string;
  stream_type: Stream["stream_type"];
  pricing_model: Stream["pricing"]["model"];
  price_atomic: number | null;
  rate_atomic_per_minute: number | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  creator: Pick<AdminCreatorSummary, "id" | "email" | "username" | "display_name" | "wallet_address" | "approval_status">;
};

export type AdminSession = {
  id: string;
  stream_id: string;
  stream_title: string;
  stream_slug: string;
  creator_id: string;
  creator_name: string;
  viewer_wallet: string;
  status: "active" | "completed";
  consumed_seconds: number;
  accrued_atomic: number;
  settled_atomic: number;
  started_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
  settlement_status: string | null;
};

export type AdminSettlement = {
  id: string;
  session_id: string;
  stream_id: string;
  stream_title: string;
  creator_id: string;
  creator_name: string;
  viewer_wallet: string;
  amount_atomic: number;
  status: string;
  transaction_reference: string;
  settled_at: string;
};

export type AdminAuditEvent = {
  id: string;
  actor: { id: string; email: string; username: string } | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type AdminRevenueReport = {
  period_days: number;
  since: string;
  totals: { settlements: number; amount_atomic: number };
  daily: Array<{ date: string; settlements: number; amount_atomic: number }>;
};

export type AdminSettings = {
  settlement_mode: string;
  network: string;
  chain_id: number;
  platform_fee_percent: number;
  asset: string;
  gateway_wallet_address: string;
  facilitator_url: string;
  max_timeout_seconds: number;
  editable_in_dashboard: false;
};

export type CreatorDashboardData = {
  streams: Stream[];
  liveCount: number;
  publishedCount: number;
};
