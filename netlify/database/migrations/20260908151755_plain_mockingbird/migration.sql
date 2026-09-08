ALTER TABLE "cost_batches" ADD COLUMN IF NOT EXISTS "supplier" text;--> statement-breakpoint
ALTER TABLE "cost_batches" ADD COLUMN IF NOT EXISTS "invoice_file" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_cost_cents" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reorder_threshold" integer;