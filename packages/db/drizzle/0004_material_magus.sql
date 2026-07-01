CREATE TABLE IF NOT EXISTS "external_access_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_source_id" uuid NOT NULL,
	"content_mapping_id" uuid,
	"platform" varchar(64) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_type" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"rule_type" varchar(64) NOT NULL,
	"pricing_type" varchar(32),
	"price_usdc" numeric(18, 6),
	"rate_per_second_usdc" numeric(18, 6),
	"duration_seconds" numeric(18, 0),
	"required_groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_content_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_source_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"platform" varchar(64) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_type" varchar(64) NOT NULL,
	"source_url" varchar(512),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"platform" varchar(64) NOT NULL,
	"external_source_id" varchar(255) NOT NULL,
	"name" varchar(160) NOT NULL,
	"base_url" varchar(512),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_access_rules" ADD CONSTRAINT "external_access_rules_integration_source_id_integration_sources_id_fk" FOREIGN KEY ("integration_source_id") REFERENCES "public"."integration_sources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_access_rules" ADD CONSTRAINT "external_access_rules_content_mapping_id_external_content_mappings_id_fk" FOREIGN KEY ("content_mapping_id") REFERENCES "public"."external_content_mappings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_content_mappings" ADD CONSTRAINT "external_content_mappings_integration_source_id_integration_sources_id_fk" FOREIGN KEY ("integration_source_id") REFERENCES "public"."integration_sources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_content_mappings" ADD CONSTRAINT "external_content_mappings_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_sources" ADD CONSTRAINT "integration_sources_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_access_rules_unique_idx" ON "external_access_rules" USING btree ("integration_source_id","external_type","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_content_mappings_unique_idx" ON "external_content_mappings" USING btree ("integration_source_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_sources_unique_idx" ON "integration_sources" USING btree ("creator_id","platform","external_source_id");