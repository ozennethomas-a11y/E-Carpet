ALTER TABLE "orders" ADD COLUMN "order_number" integer;--> statement-breakpoint
UPDATE "orders" SET "order_number" = (100000 + floor(random() * 900000))::int WHERE "order_number" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_key" UNIQUE("order_number");
