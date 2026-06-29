CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"access_grant_id" uuid,
	"payer_address" varchar(255) NOT NULL,
	"payment_identifier" varchar(255) NOT NULL,
	"payment_payload" text NOT NULL,
	"settlement_response" text NOT NULL,
	"transaction_hash" varchar(255),
	"amount_usdc" numeric(18, 6) NOT NULL,
	"payment_type" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_access_grant_id_access_grants_id_fk" FOREIGN KEY ("access_grant_id") REFERENCES "public"."access_grants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_payment_identifier_idx" ON "payments" USING btree ("payment_identifier");