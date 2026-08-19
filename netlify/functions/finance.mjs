import { sql } from "./lib/_db.mjs";
import { credentials as amazonCredentials, getAccessToken as amazonToken, financesAmazon } from "./lib/_amazon.mjs";
import { credentials as adsCredentials, getAccessToken as adsToken, depenseCampagnes } from "./lib/_googleAds.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";

const DAY_MS = 86400000;
const PAID_STATUSES = ["payee", "expediee"];

// Même logique de plage que stats.mjs, pour que les deux tableaux de bord
// affichent la même période avec les mêmes réglages.
function resolveRange(url) {
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (isDate(from) && isDate(to)) {
    const debut = new Date(`${from}T00:00:00Z`);
    const fin = new Date(`${to}T00:00:00Z`);
    const [a, b] = debut <= fin ? [debut, fin] : [fin, debut];
    return { from: a.toISOString().slice(0, 10), to: b.toISOString().slice(0, 10) };
  }

  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10), 1), 365);
  const finJour = new Date();
  const debutJour = new Date(Date.now() - (days - 1) * DAY_MS);
  return { from: debutJour.toISOString().slice(0, 10), to: finJour.toISOString().slice(0, 10) };
}

function toExclusive(dateStr) {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
}

async function siteData(from, toExcl) {
  const orders = await sql()`
    select id, order_number, status, total_cents, stripe_fee_cents, created_at
    from orders
    where created_at >= ${from}::date and created_at < ${toExcl}::date and status = any(${PAID_STATUSES})
  `;
  const orderIds = orders.map((o) => o.id);

  const items = orderIds.length
    ? await sql()`
        select oi.order_id, oi.product_id, oi.name, oi.unit_price_cents, oi.quantity, o.created_at as order_created_at
        from order_items oi
        join orders o on o.id = oi.order_id
        where oi.order_id = any(${orderIds})
      `
    : [];

  // Coût applicable = le tarif le plus récent dont effective_from ne dépasse
  // pas la date de la commande, jamais le coût actuel.
  let coutProduitCents = 0;
  const produitsSansCout = new Set();
  for (const it of items) {
    const [cost] = await sql()`
      select unit_cost_cents from product_costs
      where product_id = ${it.product_id} and effective_from <= ${it.order_created_at}
      order by effective_from desc
      limit 1
    `;
    if (cost) coutProduitCents += cost.unit_cost_cents * it.quantity;
    else produitsSansCout.add(it.name);
  }

  const revenueCents = orders.reduce((s, o) => s + o.total_cents, 0);
  const stripeFeeCents = orders.reduce((s, o) => s + (o.stripe_fee_cents || 0), 0);
  const ordersWithoutStripeFee = orders.filter((o) => o.stripe_fee_cents == null).length;

  return { revenueCents, stripeFeeCents, ordersWithoutStripeFee, coutProduitCents, produitsSansCout: [...produitsSansCout], ordersCount: orders.length };
}

async function depensesData(from, toExcl) {
  const rows = await sql()`
    select id, category, amount_cents, expense_date, note
    from expenses
    where expense_date >= ${from}::date and expense_date < ${toExcl}::date
    order by expense_date desc
  `;
  const parCategorie = {};
  for (const r of rows) parCategorie[r.category] = (parCategorie[r.category] || 0) + r.amount_cents;
  return {
    total: rows.reduce((s, r) => s + r.amount_cents, 0),
    parCategorie: Object.entries(parCategorie).map(([category, amountCents]) => ({ category, amountCents })),
    liste: rows.map((r) => ({ id: r.id, category: r.category, amountCents: r.amount_cents, date: r.expense_date, note: r.note })),
  };
}

async function commissionsAffiliesData(from, toExcl) {
  const rows = await sql()`
    select amount_cents, status from affiliate_commissions
    where created_at >= ${from}::date and created_at < ${toExcl}::date and status != 'annulee'
  `;
  return rows.reduce((s, r) => s + r.amount_cents, 0);
}

async function amazonData(depuisISO) {
  const c = amazonCredentials();
  if (c.missing) return { indisponible: true, raison: "identifiants Amazon manquants" };
  try {
    const token = await amazonToken(c);
    return await financesAmazon(token, depuisISO);
  } catch (e) {
    return { indisponible: true, raison: String(e.message || e) };
  }
}

async function googleAdsData(depuisISO) {
  const c = adsCredentials();
  if (c.missing) return { indisponible: true, raison: "identifiants Google Ads manquants" };
  try {
    const token = await adsToken(c);
    return await depenseCampagnes(c, token, depuisISO);
  } catch (e) {
    return { indisponible: true, raison: String(e.message || e) };
  }
}

function toCsv(rows) {
  const header = "date,source,categorie,montant_eur,note";
  const lignes = rows.map((r) =>
    [r.date, r.source, r.categorie, (r.montantCents / 100).toFixed(2), (r.note || "").replace(/[\n,]/g, " ")].join(","),
  );
  return [header, ...lignes].join("\n");
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  const url = new URL(req.url);

  try {
    if (req.method === "GET") {
      const { from, to } = resolveRange(url);
      const toExcl = toExclusive(to);

      const [site, amazon, ads, depenses, commissionsAffiliesCents, produits, coutsProduits] = await Promise.all([
        siteData(from, toExcl),
        amazonData(from),
        googleAdsData(from),
        depensesData(from, toExcl),
        commissionsAffiliesData(from, toExcl),
        sql()`select id, name from products order by id`,
        sql()`
          select pc.id, pc.product_id, p.name as product_name, pc.unit_cost_cents, pc.effective_from
          from product_costs pc
          join products p on p.id = pc.product_id
          order by pc.effective_from desc
        `,
      ]);

      const caSite = site.revenueCents;
      const caAmazon = amazon.indisponible ? 0 : Math.round((amazon.net || 0) * 100);
      const fraisAmazonCents = amazon.indisponible ? 0 : Math.round((amazon.fraisAmazon || 0) * 100);
      const publiciteCents = ads.indisponible ? 0 : Math.round((ads.depenseTotale || 0) * 100);

      const margeNetteCents =
        caSite + caAmazon - site.stripeFeeCents - site.coutProduitCents - depenses.total - commissionsAffiliesCents - publiciteCents;

      if (url.searchParams.get("export") === "csv") {
        const lignes = [];
        lignes.push({ date: from, source: "Site", categorie: "Chiffre d'affaires", montantCents: caSite, note: `${site.ordersCount} commande(s)` });
        if (!amazon.indisponible) {
          lignes.push({ date: from, source: "Amazon", categorie: "Chiffre d'affaires net", montantCents: caAmazon, note: "" });
          lignes.push({ date: from, source: "Amazon", categorie: "Frais Amazon", montantCents: -fraisAmazonCents, note: "" });
        }
        if (site.stripeFeeCents) lignes.push({ date: from, source: "Site", categorie: "Frais Stripe", montantCents: -site.stripeFeeCents, note: "" });
        if (site.coutProduitCents) lignes.push({ date: from, source: "Site", categorie: "Coût produit", montantCents: -site.coutProduitCents, note: "" });
        if (commissionsAffiliesCents) lignes.push({ date: from, source: "Affiliation", categorie: "Commissions", montantCents: -commissionsAffiliesCents, note: "" });
        if (!ads.indisponible && publiciteCents) lignes.push({ date: from, source: "Google Ads", categorie: "Publicité", montantCents: -publiciteCents, note: "" });
        for (const d of depenses.liste) {
          lignes.push({ date: String(d.date).slice(0, 10), source: "Dépense", categorie: d.category, montantCents: -d.amountCents, note: d.note });
        }
        return new Response(toCsv(lignes), {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="finance-${from}-${to}.csv"`,
          },
        });
      }

      return Response.json(
        {
          range: { from, to },
          ca: { site: caSite, amazon: caAmazon, total: caSite + caAmazon },
          frais: {
            stripe: site.stripeFeeCents,
            amazon: fraisAmazonCents,
            publicite: publiciteCents,
            commissionsAffilies: commissionsAffiliesCents,
          },
          coutProduit: site.coutProduitCents,
          margeNette: margeNetteCents,
          produitsSansCout: site.produitsSansCout,
          ordersWithoutStripeFee: site.ordersWithoutStripeFee,
          depenses,
          amazon,
          ads,
          produits: produits.map((p) => ({ id: p.id, name: p.name })),
          coutsProduits: coutsProduits.map((c) => ({
            id: c.id,
            productId: c.product_id,
            productName: c.product_name,
            unitCostCents: c.unit_cost_cents,
            effectiveFrom: c.effective_from,
          })),
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    if (req.method === "POST") {
      const body = await req.json();

      if (body.action === "ajouter-depense") {
        const amountCents = Math.round(Number(body.amountCents));
        if (!body.category || !Number.isFinite(amountCents) || amountCents <= 0 || !body.expenseDate) {
          return Response.json({ error: "champs manquants ou invalides" }, { status: 400 });
        }
        await sql()`
          insert into expenses (category, amount_cents, expense_date, note)
          values (${body.category}, ${amountCents}, ${body.expenseDate}::date, ${body.note || null})
        `;
        return Response.json({ ok: true });
      }

      if (body.action === "supprimer-depense") {
        if (!body.id) return Response.json({ error: "id manquant" }, { status: 400 });
        await sql()`delete from expenses where id = ${body.id}`;
        return Response.json({ ok: true });
      }

      if (body.action === "ajouter-cout-produit") {
        const unitCostCents = Math.round(Number(body.unitCostCents));
        if (!body.productId || !Number.isFinite(unitCostCents) || unitCostCents < 0 || !body.effectiveFrom) {
          return Response.json({ error: "champs manquants ou invalides" }, { status: 400 });
        }
        await sql()`
          insert into product_costs (product_id, unit_cost_cents, effective_from)
          values (${body.productId}, ${unitCostCents}, ${body.effectiveFrom}::date)
        `;
        return Response.json({ ok: true });
      }

      return Response.json({ error: "action inconnue" }, { status: 400 });
    }

    return Response.json({ error: "méthode non supportée" }, { status: 405 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/finance" };
