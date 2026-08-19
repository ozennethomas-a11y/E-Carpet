CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"source" text DEFAULT 'manuel' NOT NULL,
	"unit_cost_cents" integer,
	"movement_date" timestamp DEFAULT now() NOT NULL,
	"note" text,
	"order_id" integer,
	"external_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");