// Ponctuel : crée un influenceur de test actif avec des commissions
// d'exemple sur la branche Neon locale (development), pour prévisualiser
// l'espace influenceur. N'affecte jamais la production.
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const envPath = path.join(import.meta.dirname, "..", ".env");
for (const ligne of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = ligne.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

function randomToken() {
  return crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
}

const sql = neon(process.env.NEON_DATABASE_URL);

await sql`delete from affiliates where email = 'apercu-influenceur@example.com'`;

const [promo] = await sql`
  insert into promo_codes (code, type, value, active, source)
  values ('APERCU10', 'percent', 10, true, 'affilie')
  on conflict (code) do update set active = true
  returning id
`;

const [affiliate] = await sql`
  insert into affiliates (email, name, social, status, commission_percent, promo_code_id, campaign_slug)
  values ('apercu-influenceur@example.com', 'Camille (aperçu)', '@camille.demo', 'actif', 10, ${promo.id}, 'apercu-influenceur')
  returning id
`;

const orders = await sql`select id, total_cents from orders order by id limit 3`;
for (const o of orders) {
  await sql`
    insert into affiliate_commissions (affiliate_id, order_id, amount_cents, status)
    values (${affiliate.id}, ${o.id}, ${Math.round(o.total_cents * 0.1)}, 'due')
    on conflict (order_id) do nothing
  `;
}

const token = randomToken();
const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
await sql`insert into affiliate_sessions (affiliate_id, token, expires_at) values (${affiliate.id}, ${token}, ${expiresAt})`;

console.log("Cookie de session (ecarpet_affiliate_session) :", token);
