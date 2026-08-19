CREATE TABLE "affiliate_commissions" (
	"id" serial PRIMARY KEY,
	"affiliate_id" integer NOT NULL,
	"order_id" integer NOT NULL UNIQUE,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'due' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_login_tokens" (
	"id" serial PRIMARY KEY,
	"email" text NOT NULL,
	"token" text NOT NULL UNIQUE,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_payouts" (
	"id" serial PRIMARY KEY,
	"affiliate_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"stripe_transfer_id" text,
	"status" text DEFAULT 'en_cours' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_sessions" (
	"id" serial PRIMARY KEY,
	"affiliate_id" integer NOT NULL,
	"token" text NOT NULL UNIQUE,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" serial PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"social" text,
	"audience" text,
	"message" text,
	"status" text DEFAULT 'en_attente' NOT NULL,
	"commission_percent" integer DEFAULT 10 NOT NULL,
	"promo_code_id" integer UNIQUE,
	"campaign_slug" text UNIQUE,
	"stripe_account_id" text,
	"stripe_payouts_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "affiliate_id" integer;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_id_affiliates_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id");--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_affiliates_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id");--> statement-breakpoint
ALTER TABLE "affiliate_sessions" ADD CONSTRAINT "affiliate_sessions_affiliate_id_affiliates_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id");--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_promo_code_id_promo_codes_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_affiliate_id_affiliates_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id");