CREATE TABLE "webauthn_credentials" (
	"id" serial PRIMARY KEY,
	"admin_id" integer NOT NULL,
	"credential_id" text NOT NULL UNIQUE,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_admin_id_admins_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id");