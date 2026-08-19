// Décomposition du coût de revient par lot de fabrication (« Commande n°1 »,
// « Commande n°2 »...) pour l'onglet Finance du back-office — reprend la
// logique du tableau de suivi manuel de Thomas (fabrication, transport,
// carton, audit...) plutôt que le seul coût unitaire final déjà stocké dans
// product_costs.
//
// À l'enregistrement d'un lot, une ligne product_costs est créée
// automatiquement (unitCostCents = somme des lignes / quantité, effective au
// jour de la commande) : le reste du site (finance.mjs, export Excel) n'a
// rien à changer, il continue de lire product_costs comme avant.

import { sql } from "./_db.mjs";
import { getAdminFromRequest } from "./_adminAuth.mjs";

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    if (req.method === "GET") {
      const batches = await sql()`
        select b.id, b.product_id, p.name as product_name, b.label, b.quantity, b.order_date, b.product_cost_id, pc.unit_cost_cents
        from cost_batches b
        join products p on p.id = b.product_id
        left join product_costs pc on pc.id = b.product_cost_id
        order by b.order_date desc
      `;
      const lignes = await sql()`
        select cbl.id, cbl.batch_id, cbl.label, cbl.amount_cents from cost_batch_lines cbl order by cbl.id
      `;
      const lignesParLot = {};
      for (const l of lignes) (lignesParLot[l.batch_id] ||= []).push({ id: l.id, label: l.label, amountCents: l.amount_cents });

      return Response.json({
        batches: batches.map((b) => ({
          id: b.id,
          productId: b.product_id,
          productName: b.product_name,
          label: b.label,
          quantity: b.quantity,
          orderDate: b.order_date,
          unitCostCents: b.unit_cost_cents,
          totalCents: (lignesParLot[b.id] || []).reduce((s, l) => s + l.amountCents, 0),
          lignes: lignesParLot[b.id] || [],
        })),
      });
    }

    if (req.method === "POST") {
      const body = await req.json();

      if (body.action === "creer-lot") {
        const { productId, label, quantity, orderDate, lignes } = body;
        const qte = Math.round(Number(quantity));
        if (!productId || !label || !Number.isFinite(qte) || qte <= 0 || !orderDate || !Array.isArray(lignes) || lignes.length === 0) {
          return Response.json({ error: "champs manquants ou invalides" }, { status: 400 });
        }
        for (const l of lignes) {
          if (!l.label || !Number.isFinite(Number(l.amountCents)) || Number(l.amountCents) < 0) {
            return Response.json({ error: "ligne de coût invalide" }, { status: 400 });
          }
        }

        const totalCents = lignes.reduce((s, l) => s + Math.round(Number(l.amountCents)), 0);
        const unitCostCents = Math.round(totalCents / qte);

        const [cost] = await sql()`
          insert into product_costs (product_id, unit_cost_cents, effective_from)
          values (${productId}, ${unitCostCents}, ${orderDate}::date)
          returning id
        `;

        // Un lot de fabrication est une vraie réception de stock : on la
        // journalise (avec son coût unitaire propre, pour le calcul du coût
        // moyen pondéré) et on incrémente le stock courant du produit.
        const [mouvement] = await sql()`
          insert into stock_movements (product_id, type, quantity, source, unit_cost_cents, movement_date, note)
          values (${productId}, 'entree', ${qte}, 'manuel', ${unitCostCents}, ${orderDate}::date, ${"Réception " + label})
          returning id
        `;
        await sql()`update products set stock = stock + ${qte} where id = ${productId}`;

        const [batch] = await sql()`
          insert into cost_batches (product_id, label, quantity, order_date, product_cost_id, stock_movement_id)
          values (${productId}, ${label}, ${qte}, ${orderDate}::date, ${cost.id}, ${mouvement.id})
          returning id
        `;
        for (const l of lignes) {
          await sql()`insert into cost_batch_lines (batch_id, label, amount_cents) values (${batch.id}, ${l.label}, ${Math.round(Number(l.amountCents))})`;
        }
        return Response.json({ ok: true, unitCostCents });
      }

      if (body.action === "supprimer-lot") {
        if (!body.id) return Response.json({ error: "id manquant" }, { status: 400 });
        const [batch] = await sql()`select product_id, quantity, product_cost_id, stock_movement_id from cost_batches where id = ${body.id}`;
        if (!batch) return Response.json({ error: "lot introuvable" }, { status: 404 });
        await sql()`delete from cost_batch_lines where batch_id = ${body.id}`;
        await sql()`delete from cost_batches where id = ${body.id}`;
        if (batch.product_cost_id) await sql()`delete from product_costs where id = ${batch.product_cost_id}`;
        // Retire du stock ce que ce lot avait ajouté, puis efface son mouvement.
        if (batch.stock_movement_id) {
          await sql()`update products set stock = greatest(stock - ${batch.quantity}, 0) where id = ${batch.product_id}`;
          await sql()`delete from stock_movements where id = ${batch.stock_movement_id}`;
        }
        return Response.json({ ok: true });
      }

      return Response.json({ error: "action inconnue" }, { status: 400 });
    }

    return Response.json({ error: "méthode non supportée" }, { status: 405 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/cost-batches" };
