CREATE TABLE IF NOT EXISTS "login_alert_devices" (
	"admin_id" integer PRIMARY KEY,
	"endpoint" text NOT NULL UNIQUE,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "login_alert_devices" ADD CONSTRAINT "login_alert_devices_admin_id_admins_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
