CREATE TABLE "admin_sessions" (
	"id" serial PRIMARY KEY,
	"token" text NOT NULL UNIQUE,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
