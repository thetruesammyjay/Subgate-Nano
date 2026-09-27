export type ViewingSession = {
  id: string;
  stream_id: string;
  viewer_wallet: string;
  status: "active" | "completed";
  max_spend_atomic: number | null;
  consumed_seconds: number;
  accrued_atomic: number;
  settled_atomic: number;
  started_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
  playback_token?: string | null;
  playback_url?: string | null;
};

export type Receipt = {
  session_id: string;
  stream_id: string;
  viewer_wallet: string;
  duration_seconds: number;
  amount_atomic: number;
  currency: "USDC";
  settlement_status: "settled";
  transaction_reference: string;
  settled_at: string;
};
