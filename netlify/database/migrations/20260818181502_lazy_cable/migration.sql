CREATE TABLE "cost_batch_lines" (
	"id" serial PRIMARY KEY,
	"batch_id" integer NOT NULL,
	"label" text NOT NULL,
	"amount_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_batches" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"label" text NOT NULL,
	"quantity" integer NOT NULL,
	"order_date" timestamp NOT NULL,
	"product_cost_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_batch_lines" ADD CONSTRAINT "cost_batch_lines_batch_id_cost_batches_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "cost_batches"("id");--> statement-breakpoint
ALTER TABLE "cost_batches" ADD CONSTRAINT "cost_batches_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "cost_batches" ADD CONSTRAINT "cost_batches_product_cost_id_product_costs_id_fkey" FOREIGN KEY ("product_cost_id") REFERENCES "product_costs"("id");