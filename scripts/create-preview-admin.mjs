// Ponctuel : crée un admin de test sur la branche Neon locale (development)
// pour pouvoir se connecter en local sans connaître les vrais mots de passe
// copiés depuis la prod. N'affecte jamais la production.
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const envPath = path.join(import.meta.dirname, "..", ".env");
for (const ligne of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = ligne.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PBKDF2_ITERATIONS = 210_000;
function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `${PBKDF2_ITERATIONS}:${toHex(saltBytes)}:${toHex(bits)}`;
}

const sql = neon(process.env.NEON_DATABASE_URL);
const passwordHash = await hashPassword("apercu-local-123");
await sql`delete from admins where name = 'apercu-local'`;
await sql`
  insert into admins (name, password_hash, totp_secret, is_owner)
  values ('apercu-local', ${passwordHash}, ${process.env.ADMIN_TOTP_SECRET}, true)
`;
console.log("Admin de test créé : apercu-local / apercu-local-123");
