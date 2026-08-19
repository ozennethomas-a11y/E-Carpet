CREATE TABLE "social_campaigns" (
	"id" serial PRIMARY KEY,
	"network" text NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"objective" text NOT NULL,
	"daily_budget_cents" integer NOT NULL,
	"post_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
