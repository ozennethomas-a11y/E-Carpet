import { sql } from "./_db.mjs";
import { checkAndRecord } from "./_rateLimit.mjs";

export default async (req, context) => {
  const limite = await checkAndRecord("cart-sync", req, context, { max: 30, windowMs: 60 * 1000 });
  if (limite.limited) return Response.json({ error: "trop de requêtes" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "requête invalide" }, { status: 400 });
  }

  const { token, email, items } = body || {};
  const emailValide = typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
  const itemsValides =
    Array.isArray(items) &&
    items.length > 0 &&
    items.length <= 50 &&
    items.every(
      (it) =>
        it &&
        typeof it.productId !== "undefined" &&
        Number.isFinite(Number(it.quantity)) &&
        Number(it.quantity) > 0 &&
        Number(it.quantity) <= 99,
    );

  if (typeof token !== "string" || !token || token.length > 100 || !emailValide || !itemsValides) {
    return Response.json({ error: "paramètres manquants ou invalides" }, { status: 400 });
  }

  await sql()`
    insert into carts (token, email, items, updated_at)
    values (${token}, ${email}, ${JSON.stringify(items)}::jsonb, now())
    on conflict (token) do update set email = excluded.email, items = excluded.items, updated_at = now()
  `;

  return Response.json({ ok: true });
};

export const config = { path: "/api/cart-sync" };
