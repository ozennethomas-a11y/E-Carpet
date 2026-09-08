ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'site' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_channel_idx" ON "orders" ("channel");
