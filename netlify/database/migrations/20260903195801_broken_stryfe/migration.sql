ALTER TABLE "webauthn_credentials" ADD COLUMN IF NOT EXISTS "last_used_at" timestamp;
