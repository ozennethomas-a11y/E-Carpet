import { sql } from "./lib/_db.mjs";

// Fonction temporaire, ponctuelle : applique en production les migrations
// générées depuis le passage à Neon en direct (2026-08-31), qui n'ont jamais
// été appliquées automatiquement (l'ancien mécanisme d'auto-application
// était lié à l'extension "Netlify DB", abandonnée ce jour-là — voir
// netlify/functions/lib/_db.mjs). Toutes ces migrations utilisent
// IF NOT EXISTS, donc rejouables sans risque. À supprimer juste après usage.
const SECRET = "a2d790f3981b3182752d3fed638f42e7";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "influencer_contacts" (
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
)`,
  `CREATE TABLE IF NOT EXISTS "pilotage_settings" (
	"id" integer PRIMARY KEY,
	"tresorerie_cents" integer,
	"tresorerie_date" timestamp,
	"delai_reassort_jours" integer DEFAULT 60 NOT NULL,
	"couverture_cible_jours" integer DEFAULT 120 NOT NULL,
	"stock_securite_jours" integer DEFAULT 21 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
)`,
  `ALTER TABLE "webauthn_credentials" ADD COLUMN IF NOT EXISTS "last_used_at" timestamp`,
  `CREATE TABLE IF NOT EXISTS "login_alert_devices" (
	"admin_id" integer PRIMARY KEY,
	"endpoint" text NOT NULL UNIQUE,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
)`,
  `DO $$ BEGIN
  ALTER TABLE "login_alert_devices" ADD CONSTRAINT "login_alert_devices_admin_id_admins_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
];

export default async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const resultats = [];
  for (const statement of STATEMENTS) {
    try {
      await sql().query(statement);
      resultats.push({ ok: true, statement: statement.slice(0, 60) });
    } catch (e) {
      resultats.push({ ok: false, statement: statement.slice(0, 60), error: e.message });
    }
  }
  return Response.json({ resultats });
};

export const config = { path: "/api/_migrate-once" };
