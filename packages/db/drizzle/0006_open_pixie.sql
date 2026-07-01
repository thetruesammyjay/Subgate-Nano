CREATE TABLE IF NOT EXISTS "platform_fee_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"gross_amount_usdc" numeric(18, 6) NOT NULL,
	"platform_fee_usdc" numeric(18, 6) NOT NULL,
	"creator_net_usdc" numeric(18, 6) NOT NULL,
	"platform_fee_percent" numeric(7, 4) NOT NULL,
	"currency" varchar(16) DEFAULT 'USDC' NOT NULL,
	"status" varchar(32) DEFAULT 'posted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "platform_fee_usdc" numeric(18, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "creator_net_usdc" numeric(18, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "platform_fee_percent" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
UPDATE "payments" SET "creator_net_usdc" = "amount_usdc" WHERE "creator_net_usdc" = 0;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_fee_ledger_entries" ADD CONSTRAINT "platform_fee_ledger_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_fee_ledger_entries" ADD CONSTRAINT "platform_fee_ledger_entries_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_fee_ledger_entries" ADD CONSTRAINT "platform_fee_ledger_entries_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_fee_ledger_payment_idx" ON "platform_fee_ledger_entries" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_fee_ledger_creator_idx" ON "platform_fee_ledger_entries" USING btree ("creator_id");
--> statement-breakpoint
INSERT INTO "platform_fee_ledger_entries" (
	"payment_id",
	"creator_id",
	"content_id",
	"gross_amount_usdc",
	"platform_fee_usdc",
	"creator_net_usdc",
	"platform_fee_percent",
	"currency",
	"status"
)
SELECT
	"payments"."id",
	"content_items"."creator_id",
	"payments"."content_id",
	"payments"."amount_usdc",
	"payments"."platform_fee_usdc",
	"payments"."creator_net_usdc",
	"payments"."platform_fee_percent",
	'USDC',
	'posted'
FROM "payments"
INNER JOIN "content_items" ON "payments"."content_id" = "content_items"."id"
WHERE "payments"."status" = 'settled'
ON CONFLICT ("payment_id") DO NOTHING;
