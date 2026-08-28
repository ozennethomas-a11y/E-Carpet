CREATE TABLE "admin_login_history" (
	"id" serial PRIMARY KEY,
	"admin_id" integer NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"totp_secret" text NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DELETE FROM "admin_sessions";--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD COLUMN "admin_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_login_history" ADD CONSTRAINT "admin_login_history_admin_id_admins_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id");--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admins_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id");