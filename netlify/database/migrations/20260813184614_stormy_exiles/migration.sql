CREATE TABLE "social_accounts" (
	"id" serial PRIMARY KEY,
	"network" text NOT NULL UNIQUE,
	"account_id" text,
	"account_name" text,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text,
	"expires_at" timestamp,
	"meta" jsonb,
	"connected_at" timestamp DEFAULT now() NOT NULL
);
