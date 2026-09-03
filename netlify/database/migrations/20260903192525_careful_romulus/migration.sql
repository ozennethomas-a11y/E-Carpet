CREATE TABLE IF NOT EXISTS "influencer_contacts" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"platform" text,
	"followers" text,
	"contact" text,
	"offer" text,
	"status" text DEFAULT 'a_contacter' NOT NULL,
	"publication" text,
	"on_site" boolean DEFAULT false NOT NULL,
	"next_action" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pilotage_settings" (
	"id" integer PRIMARY KEY,
	"tresorerie_cents" integer,
	"tresorerie_date" timestamp,
	"delai_reassort_jours" integer DEFAULT 60 NOT NULL,
	"couverture_cible_jours" integer DEFAULT 120 NOT NULL,
	"stock_securite_jours" integer DEFAULT 21 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
