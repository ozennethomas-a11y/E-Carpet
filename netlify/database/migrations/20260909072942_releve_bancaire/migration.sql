CREATE TABLE IF NOT EXISTS "bank_transactions" (
	"id" serial PRIMARY KEY,
	"value_date" timestamp NOT NULL,
	"label" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"fingerprint" text NOT NULL UNIQUE,
	"status" text DEFAULT 'a_traiter' NOT NULL,
	"expense_id" integer,
	"suggested_category" text,
	"note" text,
	"imported_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_expense_id_expenses_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_transactions_status_idx" ON "bank_transactions" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_transactions_date_idx" ON "bank_transactions" ("value_date");
