import { sql } from "./_db.mjs";

export default async () => {
  try {
    const rows = await sql()`
      select id, sku, name, price_cents, currency, stock
      from products
      where active = true
    `;
    return Response.json({
      products: rows.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        priceCents: p.price_cents,
        currency: p.currency,
        stock: p.stock,
      })),
    });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/products" };
