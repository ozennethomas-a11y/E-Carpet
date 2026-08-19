import { getStore } from "@netlify/blobs";
import { sql } from "./lib/_db.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";

// Session-protected read API for the private dashboard (cookie posé par
// admin-auth.mjs après connexion mot de passe + TOTP).

const DAY_MS = 86400000;

function mergeCounts(target, source) {
  for (const [k, v] of Object.entries(source || {})) target[k] = (target[k] || 0) + v;
}

function topN(counts, n = 8) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, value]) => ({ label, value }));
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") {
    return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });
  }

  const url = new URL(req.url);

  // Deux façons de choisir la période : un nombre de jours glissants, ou deux
  // dates précises envoyées par le calendrier du dashboard.
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const wanted = [];
  if (isDate(from) && isDate(to)) {
    const debut = new Date(`${from}T00:00:00Z`);
    const fin = new Date(`${to}T00:00:00Z`);
    // On accepte les bornes à l'envers plutôt que de renvoyer une erreur.
    const [a, b] = debut <= fin ? [debut, fin] : [fin, debut];
    for (let t = a.getTime(); t <= b.getTime() && wanted.length < 400; t += DAY_MS) {
      wanted.push(new Date(t).toISOString().slice(0, 10));
    }
  } else {
    const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10), 1), 365);
    for (let i = days - 1; i >= 0; i--) {
      wanted.push(new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10));
    }
  }

  const store = getStore("analytics");

  const loaded = await Promise.all(
    wanted.map(async (date) => ({
      date,
      data: await store.get(`day/${date}`, { type: "json" }).catch(() => null),
    }))
  );

  const totals = { pages: {}, countries: {}, cities: {}, sources: {}, devices: {}, languages: {}, campaigns: {} };
  const series = [];
  const allVisitors = new Set();
  let views = 0;

  for (const { date, data } of loaded) {
    const d = data || {};
    const dayVisitors = d.visitors?.length || 0;
    views += d.views || 0;
    (d.visitors || []).forEach((v) => allVisitors.add(v));
    series.push({ date, views: d.views || 0, visitors: dayVisitors });
    mergeCounts(totals.pages, d.pages);
    mergeCounts(totals.countries, d.countries);
    mergeCounts(totals.cities, d.cities);
    mergeCounts(totals.sources, d.sources);
    mergeCounts(totals.devices, d.devices);
    mergeCounts(totals.languages, d.languages);
    mergeCounts(totals.campaigns, d.campaigns);
  }

  // Visitors are hashed per day, so the same person on two days counts twice.
  const visitors = allVisitors.size;

  // Commande : chiffre d'affaires, panier moyen, conversion, abandon de panier.
  // Isolé dans son propre essai pour ne jamais faire tomber les stats de trafic
  // si la base de données est indisponible.
  let commerce = null;
  try {
    const from = wanted[0];
    const toExclusive = new Date(new Date(`${wanted[wanted.length - 1]}T00:00:00Z`).getTime() + DAY_MS)
      .toISOString()
      .slice(0, 10);

    const orders = await sql()`
      select date_trunc('day', created_at)::date::text as day, status, total_cents, promo_code_id
      from orders
      where created_at >= ${from}::date and created_at < ${toExclusive}::date
    `;
    const products = await sql()`
      select oi.name, sum(oi.quantity)::int as qty
      from order_items oi
      join orders o on o.id = oi.order_id
      where o.created_at >= ${from}::date and o.created_at < ${toExclusive}::date and o.status != 'en_attente_paiement'
      group by oi.name
      order by qty desc
      limit 8
    `;
    const carts = await sql()`
      select converted_at
      from carts
      where created_at >= ${from}::date and created_at < ${toExclusive}::date
    `;

    const paid = orders.filter((o) => o.status === "payee" || o.status === "expediee");
    const revenueCents = paid.reduce((s, o) => s + o.total_cents, 0);
    const ordersCount = paid.length;
    const aovCents = ordersCount ? Math.round(revenueCents / ordersCount) : 0;
    const promoOrders = paid.filter((o) => o.promo_code_id).length;

    const totalCarts = carts.length;
    const abandonedCarts = carts.filter((c) => !c.converted_at).length;
    const abandonRate = totalCarts ? Math.round((abandonedCarts / totalCarts) * 1000) / 10 : 0;

    commerce = {
      revenueCents,
      ordersCount,
      aovCents,
      conversionRate: visitors ? Math.round((ordersCount / visitors) * 1000) / 10 : 0,
      abandonedCarts,
      abandonRate,
      promoOrders,
      promoRate: ordersCount ? Math.round((promoOrders / ordersCount) * 1000) / 10 : 0,
      products: products.map((p) => ({ label: p.name, value: p.qty })),
      series: wanted.map((date) => {
        const dayOrders = paid.filter((o) => o.day === date);
        return { date, revenueCents: dayOrders.reduce((s, o) => s + o.total_cents, 0), orders: dayOrders.length };
      }),
    };
  } catch (e) {
    console.error("[stats] échec calcul commerce:", e.message);
  }

  return Response.json(
    {
      range: { days: wanted.length, from: wanted[0], to: wanted[wanted.length - 1] },
      kpi: {
        visitors,
        views,
        perVisit: visitors ? Math.round((views / visitors) * 10) / 10 : 0,
      },
      series,
      pages: topN(totals.pages),
      countries: topN(totals.countries),
      cities: topN(totals.cities),
      sources: topN(totals.sources),
      campaigns: topN(totals.campaigns),
      devices: topN(totals.devices, 4),
      languages: topN(totals.languages, 5),
      commerce,
    },
    { headers: { "cache-control": "no-store" } }
  );
};

export const config = { path: "/api/stats" };
