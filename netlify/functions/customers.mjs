import { sql } from "./_db.mjs";
import { getAdminFromRequest } from "./_adminAuth.mjs";

// Pas encore de comptes clients (création de compte / connexion) : cette vue
// agrège simplement les commandes par email, ce qui suffit pour voir qui
// achète et repérer les clients récurrents.

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    const orders = await sql()`
      select email, status, total_cents, currency, shipping_address, created_at
      from orders
      order by created_at desc
    `;

    const parClient = new Map();
    for (const o of orders) {
      const key = o.email;
      if (!parClient.has(key)) {
        parClient.set(key, {
          email: o.email,
          nom: [o.shipping_address?.firstName, o.shipping_address?.lastName].filter(Boolean).join(" "),
          telephone: o.shipping_address?.phone || null,
          ville: o.shipping_address?.city || o.shipping_address?.pickupPoint?.ville || null,
          nbCommandes: 0,
          totalDepenseCents: 0,
          currency: o.currency,
          derniereCommande: o.created_at,
        });
      }
      const c = parClient.get(key);
      c.nbCommandes += 1;
      if (o.status === "payee" || o.status === "expediee" || o.status === "livree") {
        c.totalDepenseCents += o.total_cents;
      }
      if (new Date(o.created_at) > new Date(c.derniereCommande)) c.derniereCommande = o.created_at;
    }

    const clients = [...parClient.values()].sort((a, b) => b.totalDepenseCents - a.totalDepenseCents);

    return Response.json({ clients });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/customers" };
