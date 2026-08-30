CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY,
	"admin_id" integer NOT NULL,
	"endpoint" text NOT NULL UNIQUE,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_admin_id_admins_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id");