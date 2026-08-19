import { sql } from "./_db.mjs";

export async function findValidPromo(code) {
  if (!code || !code.trim()) return { error: "code manquant" };
  const normalized = code.trim().toUpperCase();
  const [row] = await sql()`select * from promo_codes where code = ${normalized}`;
  if (!row) return { error: "code introuvable" };
  if (!row.active) return { error: "code désactivé" };
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return { error: "code expiré" };
  if (row.max_uses != null && row.used_count >= row.max_uses) return { error: "code épuisé" };
  return { row };
}

export function computeDiscountCents(row, subtotalCents) {
  if (row.type === "percent") return Math.round((subtotalCents * row.value) / 100);
  return Math.min(row.value, subtotalCents);
}
