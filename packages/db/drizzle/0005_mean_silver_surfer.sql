CREATE TABLE IF NOT EXISTS "streaming_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"access_grant_id" uuid,
	"payer_address" varchar(255) NOT NULL,
	"rate_per_second_usdc" numeric(18, 6) NOT NULL,
	"max_amount_usdc" numeric(18, 6),
	"total_accrued_usdc" numeric(18, 6) DEFAULT '0' NOT NULL,
	"total_settled_usdc" numeric(18, 6) DEFAULT '0' NOT NULL,
	"pending_settlement_usdc" numeric(18, 6) DEFAULT '0' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_ticked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stopped_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "streaming_sessions" ADD CONSTRAINT "streaming_sessions_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "streaming_sessions" ADD CONSTRAINT "streaming_sessions_access_grant_id_access_grants_id_fk" FOREIGN KEY ("access_grant_id") REFERENCES "public"."access_grants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "streaming_sessions_status_idx" ON "streaming_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "streaming_sessions_content_payer_idx" ON "streaming_sessions" USING btree ("content_id","payer_address");