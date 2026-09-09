ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "terms_version" text;
