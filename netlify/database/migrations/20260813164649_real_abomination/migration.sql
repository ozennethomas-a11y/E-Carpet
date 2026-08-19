CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY,
	"category" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"expense_date" timestamp NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_costs" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"unit_cost_cents" integer NOT NULL,
	"effective_from" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stripe_fee_cents" integer;--> statement-breakpoint
ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");