// Suivi de stock pour l'onglet « Stock » du back-office.
//
// products.stock reste la source de vérité déjà utilisée par checkout.mjs
// pour bloquer une vente si le stock est insuffisant (décrémenté
// automatiquement par stripe-webhook.mjs à chaque paiement site). Cette
// fonction ajoute par-dessus :
//  - un journal (stock_movements) qui explique CHAQUE variation ;
//  - la possibilité de saisir un stock de départ et des réappros manuels ;
//  - une synchronisation des ventes Amazon (qui ne touchaient pas encore le
//    stock, puisque Amazon gère sa propre logistique côté vente mais que le
//    stock physique est partagé avec le site).
//
// Toutes les actions sont protégées par la session admin (cookie), comme le
// reste du back-office.

import { sql } from "./lib/_db.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { credentials as amazonCredentials, getAccessToken as amazonToken, amz } from "./lib/_amazon.mjs";

const MAX_COMMANDES_PAR_SYNC = 50;

const DAY_MS = 86400000;
const JOURS_TENDANCE = 30;

async function dernierCoutUnitaire(productId) {
  const [row] = await sql()`
    select unit_cost_cents from product_costs
    where product_id = ${productId} and effective_from <= now()
    order by effective_from desc
    limit 1
  `;
  return row?.unit_cost_cents ?? null;
}

// Coût unitaire moyen pondéré (CUMP) du stock actuel : chaque entrée peut
// avoir un coût différent (un nouveau lot fournisseur négocié plus cher ou
// moins cher qu'avant), donc la valeur du stock n'est pas juste "dernier
// coût connu × quantité" mais la moyenne des coûts d'entrée pondérée par les
// quantités qui restent réellement en stock. Les sorties ne changent pas le
// coût moyen, seulement la quantité restante.
async function coutMoyenPondere(productId) {
  const mouvements = await sql()`
    select type, quantity, unit_cost_cents, movement_date from stock_movements
    where product_id = ${productId}
    order by movement_date asc, id asc
  `;
  if (!mouvements.length) return null;

  let qte = 0;
  let valeurCents = 0;
  for (const m of mouvements) {
    if (m.type === "sortie") {
      const coutMoyen = qte > 0 ? valeurCents / qte : 0;
      qte = Math.max(qte - m.quantity, 0);
      valeurCents = Math.max(valeurCents - coutMoyen * m.quantity, 0);
      continue;
    }
    // "entree" ou "initial" : il faut un coût unitaire. Si le mouvement n'en
    // a pas d'enregistré directement, on retombe sur le coût produit en
    // vigueur à cette date (cas des anciens comptages manuels).
    let cout = m.unit_cost_cents;
    if (cout == null) {
      const [pc] = await sql()`
        select unit_cost_cents from product_costs
        where product_id = ${productId} and effective_from <= ${m.movement_date}
        order by effective_from desc
        limit 1
      `;
      cout = pc?.unit_cost_cents ?? 0;
    }
    if (m.type === "initial") {
      qte = m.quantity;
      valeurCents = m.quantity * cout;
    } else {
      qte += m.quantity;
      valeurCents += m.quantity * cout;
    }
  }

  return qte > 0 ? Math.round(valeurCents / qte) : null;
}

// Niveau de stock reconstitué jour par jour sur les 30 derniers jours, pour
// la mini-courbe de tendance affichée à côté du stock actuel.
async function tendanceStock(productId) {
  const jours = [];
  for (let i = JOURS_TENDANCE - 1; i >= 0; i--) jours.push(new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10));
  const debutFenetre = `${jours[0]}T00:00:00.000Z`;

  // Solde au tout début de la fenêtre : on rejoue tous les mouvements
  // antérieurs ("initial" fixe une valeur absolue, entrée/sortie l'ajustent).
  const avantFenetre = await sql()`
    select type, quantity from stock_movements
    where product_id = ${productId} and movement_date < ${debutFenetre}
    order by movement_date asc, id asc
  `;
  let soldeAvantFenetre = 0;
  for (const m of avantFenetre) {
    if (m.type === "initial") soldeAvantFenetre = m.quantity;
    else soldeAvantFenetre += m.type === "entree" ? m.quantity : -m.quantity;
  }

  const dansFenetre = await sql()`
    select type, quantity, movement_date from stock_movements
    where product_id = ${productId} and movement_date >= ${debutFenetre}
    order by movement_date asc, id asc
  `;
  let solde = soldeAvantFenetre;
  const soldeFinDuJour = new Map();
  for (const m of dansFenetre) {
    if (m.type === "initial") solde = m.quantity;
    else solde += m.type === "entree" ? m.quantity : -m.quantity;
    soldeFinDuJour.set(new Date(m.movement_date).toISOString().slice(0, 10), solde);
  }

  // Marche chronologique simple : chaque jour garde son solde de fin s'il a
  // eu un mouvement, sinon reprend celui de la veille.
  let courant = soldeAvantFenetre;
  return jours.map((j) => {
    if (soldeFinDuJour.has(j)) courant = soldeFinDuJour.get(j);
    return courant;
  });
}

async function marketplacesActifs(token) {
  const json = await amz(token, "/sellers/v1/marketplaceParticipations");
  return (json.payload || []).filter((p) => p.participation?.isParticipating).map((p) => p.marketplace.id);
}

async function commandesDepuis(token, marketplaceId, depuisISO) {
  const toutes = [];
  let nextToken = null;
  do {
    const params = new URLSearchParams({ MarketplaceIds: marketplaceId, CreatedAfter: depuisISO });
    if (nextToken) params.set("NextToken", nextToken);
    const json = await amz(token, `/orders/v0/orders?${params}`);
    toutes.push(...(json.payload?.Orders || []));
    nextToken = json.payload?.NextToken || null;
  } while (nextToken && toutes.length < 200);
  return toutes;
}

export async function synchroniserAmazon() {
  const c = amazonCredentials();
  if (c.missing) return { erreur: "identifiants Amazon manquants" };

  const produits = await sql()`select id, sku from products`;
  const parSku = new Map(produits.map((p) => [p.sku, p.id]));
  if (!parSku.size) return { erreur: "aucun produit avec SKU en base" };

  const [dernierMouvement] = await sql()`
    select max(movement_date) as date from stock_movements where source = 'vente_amazon'
  `;
  const depuisISO = dernierMouvement?.date
    ? new Date(dernierMouvement.date).toISOString()
    : new Date(Date.now() - 90 * 86400000).toISOString();

  const token = await amazonToken(c);
  const marketplaces = await marketplacesActifs(token);

  let commandesTraitees = 0;
  let quantiteTotale = 0;
  const nonReconnues = new Set();

  for (const marketplaceId of marketplaces) {
    const commandes = await commandesDepuis(token, marketplaceId, depuisISO);
    for (const o of commandes) {
      if (commandesTraitees >= MAX_COMMANDES_PAR_SYNC) break;
      if (o.OrderStatus === "Canceled" || o.OrderStatus === "Pending") continue;

      const [dejaTraitee] = await sql()`
        select id from stock_movements where source = 'vente_amazon' and external_ref = ${o.AmazonOrderId}
      `;
      if (dejaTraitee) continue;

      const itemsJson = await amz(token, `/orders/v0/orders/${o.AmazonOrderId}/orderItems`);
      const items = itemsJson.payload?.OrderItems || [];
      for (const it of items) {
        const productId = parSku.get(it.SellerSKU);
        const quantite = Number(it.QuantityOrdered || 0);
        if (!quantite) continue;
        if (!productId) {
          nonReconnues.add(it.SellerSKU);
          continue;
        }
        await sql()`
          insert into stock_movements (product_id, type, quantity, source, movement_date, external_ref, note)
          values (${productId}, 'sortie', ${quantite}, 'vente_amazon', ${o.PurchaseDate}, ${o.AmazonOrderId}, ${"Commande Amazon " + o.AmazonOrderId})
        `;
        await sql()`update products set stock = greatest(stock - ${quantite}, 0) where id = ${productId}`;
        quantiteTotale += quantite;
      }
      commandesTraitees += 1;
    }
  }

  return {
    commandesTraitees,
    quantiteTotale,
    skuNonReconnus: [...nonReconnues],
  };
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    if (req.method === "GET") {
      const produits = await sql()`select id, sku, name, stock from products order by name`;
      const produitsAvecValeur = await Promise.all(
        produits.map(async (p) => {
          const [coutUnitaireCents, coutMoyenPondereCents, tendance] = await Promise.all([
            dernierCoutUnitaire(p.id),
            coutMoyenPondere(p.id),
            tendanceStock(p.id),
          ]);
          return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            stock: p.stock,
            coutUnitaireCents,
            coutMoyenPondereCents,
            // Valorisée au coût moyen pondéré (CUMP) plutôt qu'au dernier coût
            // connu : plus fidèle quand les lots successifs ont des coûts différents.
            valeurStockCents: coutMoyenPondereCents != null ? coutMoyenPondereCents * p.stock : null,
            tendance,
          };
        }),
      );

      const mouvements = await sql()`
        select m.id, m.product_id, p.name as product_name, m.type, m.quantity, m.source, m.movement_date, m.note
        from stock_movements m
        join products p on p.id = m.product_id
        order by m.movement_date desc, m.id desc
        limit 200
      `;

      return Response.json(
        {
          produits: produitsAvecValeur,
          mouvements: mouvements.map((m) => ({
            id: m.id,
            productId: m.product_id,
            productName: m.product_name,
            type: m.type,
            quantity: m.quantity,
            source: m.source,
            date: m.movement_date,
            note: m.note,
          })),
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    if (req.method === "POST") {
      const body = await req.json();

      if (body.action === "definir-stock") {
        const quantity = Math.round(Number(body.quantity));
        if (!body.productId || !Number.isFinite(quantity) || quantity < 0) {
          return Response.json({ error: "champs manquants ou invalides" }, { status: 400 });
        }
        const [produit] = await sql()`select stock from products where id = ${body.productId}`;
        if (!produit) return Response.json({ error: "produit introuvable" }, { status: 404 });

        await sql()`update products set stock = ${quantity} where id = ${body.productId}`;
        await sql()`
          insert into stock_movements (product_id, type, quantity, source, movement_date, note)
          values (${body.productId}, 'initial', ${quantity}, 'initial', ${body.date || new Date().toISOString()}, ${body.note || `Stock défini manuellement (ancien : ${produit.stock})`})
        `;
        return Response.json({ ok: true });
      }

      if (body.action === "ajouter-entree" || body.action === "ajouter-sortie") {
        const quantity = Math.round(Number(body.quantity));
        if (!body.productId || !Number.isFinite(quantity) || quantity <= 0) {
          return Response.json({ error: "champs manquants ou invalides" }, { status: 400 });
        }
        const type = body.action === "ajouter-entree" ? "entree" : "sortie";
        const signe = type === "entree" ? 1 : -1;

        await sql()`update products set stock = greatest(stock + ${signe * quantity}, 0) where id = ${body.productId}`;
        await sql()`
          insert into stock_movements (product_id, type, quantity, source, unit_cost_cents, movement_date, note)
          values (${body.productId}, ${type}, ${quantity}, 'manuel', ${body.unitCostCents || null}, ${body.date || new Date().toISOString()}, ${body.note || null})
        `;
        return Response.json({ ok: true });
      }

      if (body.action === "supprimer-mouvement") {
        if (!body.id) return Response.json({ error: "id manquant" }, { status: 400 });
        const [mvt] = await sql()`select product_id, type, quantity, source from stock_movements where id = ${body.id}`;
        if (!mvt) return Response.json({ error: "mouvement introuvable" }, { status: 404 });
        if (mvt.source === "vente_site" || mvt.source === "vente_amazon") {
          return Response.json({ error: "impossible de supprimer une sortie liée à une vente" }, { status: 400 });
        }
        // Annule l'effet du mouvement sur le stock courant avant de le retirer du journal.
        const inverse = mvt.type === "entree" ? -mvt.quantity : mvt.type === "sortie" ? mvt.quantity : 0;
        if (inverse) await sql()`update products set stock = greatest(stock + ${inverse}, 0) where id = ${mvt.product_id}`;
        await sql()`delete from stock_movements where id = ${body.id}`;
        return Response.json({ ok: true });
      }

      if (body.action === "sync-amazon") {
        const resultat = await synchroniserAmazon();
        return Response.json(resultat);
      }

      return Response.json({ error: "action inconnue" }, { status: 400 });
    }

    return Response.json({ error: "méthode non supportée" }, { status: 405 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/stock" };
