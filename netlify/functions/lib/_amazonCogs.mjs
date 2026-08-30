import { sql } from "./_db.mjs";

// Coût de revient des ventes Amazon (SKU + quantité par commande, fournis par
// financesAmazon), au tarif product_costs en vigueur à la date de la
// commande — même logique que le coût produit du site. Partagé entre
// finance.mjs (marge nette) et export-excel.mjs, pour rester cohérents.
export async function coutRevientAmazon(parCommande) {
  if (!parCommande?.length) return { coutCents: 0, skuSansCout: [] };

  const produits = await sql()`select id, sku from products`;
  const parSku = new Map(produits.map((p) => [p.sku, p.id]));
  const skuSansCout = new Set();
  let coutCents = 0;

  for (const commande of parCommande) {
    for (const it of commande.items || []) {
      const productId = parSku.get(it.sku);
      if (!productId) {
        skuSansCout.add(it.sku);
        continue;
      }
      const [cost] = await sql()`
        select unit_cost_cents from product_costs
        where product_id = ${productId} and effective_from <= ${commande.date}
        order by effective_from desc
        limit 1
      `;
      if (cost) coutCents += cost.unit_cost_cents * it.quantity;
      else skuSansCout.add(it.sku);
    }
  }
  return { coutCents, skuSansCout: [...skuSansCout] };
}
