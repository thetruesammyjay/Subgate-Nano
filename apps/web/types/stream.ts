export type PricingModel = "pay_per_view" | "metered";
export type StreamType = "video" | "livestream";

export type Pricing = {
  model: PricingModel;
  price_atomic: number | null;
  rate_atomic_per_minute: number | null;
};

export type ChainConfig = {
  chain_id: number;
  network: string;
  payment_token_address: string;
  registry_contract_address: string;
  receipts_contract_address: string;
  explorer_base_url: string;
};

export type Stream = {
  id: string;
  creator_wallet: string;
  creator_display_name: string;
  slug: string;
  title: string;
  description: string;
  stream_type: StreamType;
  pricing: Pricing;
  free_preview_seconds: number;
  playback_url: string;
  is_published: boolean;
  chain?: ChainConfig | null;
  chain_stream_id?: string | null;
  registry_transaction_hash?: string | null;
  created_at: string;
};

export type CreateStreamPayload = {
  creator_wallet: string;
  creator_display_name: string;
  slug: string;
  title: string;
  description: string;
  stream_type: StreamType;
  pricing: Pricing;
  free_preview_seconds: number;
  playback_url: string;
  is_published: boolean;
};

export type UpdateStreamPayload = Partial<
  Pick<
    Stream,
    "title" | "description" | "free_preview_seconds" | "playback_url" | "is_published"
  >
> & { pricing?: Pricing };
