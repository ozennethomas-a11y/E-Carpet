// Comparaison "mois en cours à date" vs "mois dernier à la même date" pour
// l'onglet Finance — même présentation que le bloc Overview de l'Accueil
// (carte + variation % + mini-tendance).
//
// Ne reprend que les données site (base Postgres, rapide) : pas d'appel
// Amazon/Google Ads ici, pour rester léger au chargement de l'onglet, comme
// pour le bloc Overview de l'accueil.

import { sql } from "./lib/_db.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";

const DAY_MS = 86400000;
const PAID_STATUSES = ["payee", "expediee", "livree"];

function pctChange(actuel, precedent) {
  if (!precedent) return actuel ? 100 : 0;
  return Math.round(((actuel - precedent) / precedent) * 1000) / 10;
}

function dernierJourDuMois(annee, moisIndex) {
  return new Date(Date.UTC(annee, moisIndex + 1, 0)).getUTCDate();
}

async function coutProduitTotal(items) {
  let total = 0;
  const parJour = new Map();
  for (const it of items) {
    const [cost] = await sql()`
      select unit_cost_cents from product_costs
      where product_id = ${it.product_id} and effective_from <= ${it.order_created_at}
      order by effective_from desc
      limit 1
    `;
    const coutLigne = cost ? cost.unit_cost_cents * it.quantity : 0;
    total += coutLigne;
    const jour = new Date(it.order_created_at).toISOString().slice(0, 10);
    parJour.set(jour, (parJour.get(jour) || 0) + coutLigne);
  }
  return { total, parJour };
}

async function donneesPeriode(debut, fin) {
  const finExclusive = new Date(fin.getTime() + 1); // borne "fin" incluse
  const orders = await sql()`
    select id, total_cents, stripe_fee_cents, created_at from orders
    where created_at >= ${debut.toISOString()} and created_at < ${finExclusive.toISOString()}
      and status = any(${PAID_STATUSES})
  `;
  const orderIds = orders.map((o) => o.id);
  const items = orderIds.length
    ? await sql()`
        select oi.product_id, oi.unit_price_cents, oi.quantity, o.created_at as order_created_at
        from order_items oi join orders o on o.id = oi.order_id
        where oi.order_id = any(${orderIds})
      `
    : [];
  const { total: coutProduitCents, parJour: coutParJour } = await coutProduitTotal(items);

  const depenses = await sql()`
    select amount_cents, expense_date from expenses
    where expense_date >= ${debut.toISOString()} and expense_date < ${finExclusive.toISOString()}
  `;
  const depensesTotalCents = depenses.reduce((s, d) => s + d.amount_cents, 0);

  const revenueCents = orders.reduce((s, o) => s + o.total_cents, 0);
  const stripeFeeCents = orders.reduce((s, o) => s + (o.stripe_fee_cents || 0), 0);
  const margeNetteCents = revenueCents - coutProduitCents - stripeFeeCents - depensesTotalCents;

  return { orders, revenueCents, margeNetteCents, coutParJour, depensesParJour: groupByDay(depenses, "expense_date", "amount_cents") };
}

function groupByDay(rows, dateKey, valueKey) {
  const map = new Map();
  for (const r of rows) {
    const jour = new Date(r[dateKey]).toISOString().slice(0, 10);
    map.set(jour, (map.get(jour) || 0) + r[valueKey]);
  }
  return map;
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    const maintenant = new Date();
    const anneeActuelle = maintenant.getUTCFullYear();
    const moisActuel = maintenant.getUTCMonth();
    const jourDuMois = maintenant.getUTCDate();

    const debutMoisActuel = new Date(Date.UTC(anneeActuelle, moisActuel, 1));

    let anneeMoisDernier = anneeActuelle;
    let moisDernier = moisActuel - 1;
    if (moisDernier < 0) {
      moisDernier = 11;
      anneeMoisDernier -= 1;
    }
    const debutMoisDernier = new Date(Date.UTC(anneeMoisDernier, moisDernier, 1));
    const jourFinMoisDernier = Math.min(jourDuMois, dernierJourDuMois(anneeMoisDernier, moisDernier));
    const finMoisDernier = new Date(Date.UTC(anneeMoisDernier, moisDernier, jourFinMoisDernier));

    const [actuel, precedent] = await Promise.all([
      donneesPeriode(debutMoisActuel, maintenant),
      donneesPeriode(debutMoisDernier, finMoisDernier),
    ]);

    const panierMoyenActuel = actuel.orders.length ? Math.round(actuel.revenueCents / actuel.orders.length) : 0;
    const panierMoyenPrecedent = precedent.orders.length ? Math.round(precedent.revenueCents / precedent.orders.length) : 0;

    // Tendance : une valeur par jour écoulé du mois en cours (jour 1 à aujourd'hui).
    const joursDuMois = [];
    for (let j = 1; j <= jourDuMois; j++) joursDuMois.push(new Date(Date.UTC(anneeActuelle, moisActuel, j)).toISOString().slice(0, 10));

    const ventesParJourActuel = groupByDay(actuel.orders, "created_at", "total_cents");
    const commandesParJourActuel = new Map();
    for (const o of actuel.orders) {
      const jour = new Date(o.created_at).toISOString().slice(0, 10);
      commandesParJourActuel.set(jour, (commandesParJourActuel.get(jour) || 0) + 1);
    }

    const tendanceVentes = joursDuMois.map((j) => ventesParJourActuel.get(j) || 0);
    const tendanceCommandes = joursDuMois.map((j) => commandesParJourActuel.get(j) || 0);
    const tendanceMarge = joursDuMois.map((j) => {
      const ventes = ventesParJourActuel.get(j) || 0;
      const cout = actuel.coutParJour.get(j) || 0;
      const depenses = actuel.depensesParJour.get(j) || 0;
      return ventes - cout - depenses;
    });
    const tendancePanierMoyen = joursDuMois.map((j, i) => {
      const c = tendanceCommandes[i];
      return c ? Math.round(tendanceVentes[i] / c) : 0;
    });

    return Response.json(
      {
        comparaison: `${debutMoisDernier.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${finMoisDernier.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`,
        periodeActuelle: `${debutMoisActuel.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${maintenant.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`,
        ventes: { valeurCents: actuel.revenueCents, variationPct: pctChange(actuel.revenueCents, precedent.revenueCents), tendance: tendanceVentes },
        marge: { valeurCents: actuel.margeNetteCents, variationPct: pctChange(actuel.margeNetteCents, precedent.margeNetteCents), tendance: tendanceMarge },
        commandes: { valeur: actuel.orders.length, variationPct: pctChange(actuel.orders.length, precedent.orders.length), tendance: tendanceCommandes },
        panierMoyen: { valeurCents: panierMoyenActuel, variationPct: pctChange(panierMoyenActuel, panierMoyenPrecedent), tendance: tendancePanierMoyen },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/finance-comparison" };
