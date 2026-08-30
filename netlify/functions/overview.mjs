// Tableau de bord "Overview" en haut de l'onglet Accueil du back-office —
// inspiré du dashboard Shopify (mêmes cartes : ventes, sessions, taux de
// clients récurrents, taux de conversion, panier moyen, commandes).
//
// "Aujourd'hui" est comparé à "hier à la même heure" pour les commandes (les
// horodatages sont exacts), et à "hier en entier" pour les sessions (le
// tracking analytics n'est agrégé que par jour complet, pas par heure — la
// comparaison partielle n'est donc pas possible pour cette métrique).

import { getStore } from "@netlify/blobs";
import { sql } from "./lib/_db.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { credentials as amazonCredentials, getAccessToken as amazonToken, amz } from "./lib/_amazon.mjs";
import { packlinkCredentials, livraisonsEnCours } from "./lib/_packlink.mjs";

const DAY_MS = 86400000;
const PAID_STATUSES = ["payee", "expediee", "livree"];
const JOURS_TENDANCE = 14;

function pctChange(actuel, precedent) {
  if (!precedent) return actuel ? 100 : 0;
  return Math.round(((actuel - precedent) / precedent) * 1000) / 10;
}

// --- Commandes Amazon sur une période, tous marketplaces actifs (env) confondus.
// CreatedBefore est omis quand la borne haute est "maintenant" : l'API Amazon
// exige que ce paramètre soit antérieur au moment de la requête d'au moins
// quelques minutes, sans quoi elle renvoie une erreur 400. ---
async function commandesAmazon(token, marketplaceIds, depuisISO, jusquaISO) {
  const toutes = [];
  let nextToken = null;
  do {
    const params = new URLSearchParams({ MarketplaceIds: marketplaceIds, CreatedAfter: depuisISO });
    if (jusquaISO) params.set("CreatedBefore", jusquaISO);
    if (nextToken) params.set("NextToken", nextToken);
    const json = await amz(token, `/orders/v0/orders?${params}`);
    toutes.push(...(json.payload?.Orders || []));
    nextToken = json.payload?.NextToken || null;
  } while (nextToken && toutes.length < 2000);
  return toutes.filter((o) => o.OrderStatus !== "Canceled");
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    const maintenant = new Date();
    const debutAujourdhui = new Date(maintenant);
    debutAujourdhui.setUTCHours(0, 0, 0, 0);
    const hierMemeHeure = new Date(maintenant.getTime() - DAY_MS);
    const debutHier = new Date(debutAujourdhui.getTime() - DAY_MS);
    const finHier = new Date(debutAujourdhui.getTime());

    // --- Commandes : aujourd'hui (jusqu'à maintenant) vs hier (jusqu'à la même heure) ---
    const [commandesAujourdhui, commandesHier] = await Promise.all([
      sql()`
        select id, customer_id, email, total_cents, created_at from orders
        where created_at >= ${debutAujourdhui.toISOString()} and created_at <= ${maintenant.toISOString()}
          and status = any(${PAID_STATUSES})
      `,
      sql()`
        select id, customer_id, email, total_cents, created_at from orders
        where created_at >= ${debutHier.toISOString()} and created_at <= ${hierMemeHeure.toISOString()}
          and status = any(${PAID_STATUSES})
      `,
    ]);

    const revenueAujourdhui = commandesAujourdhui.reduce((s, o) => s + o.total_cents, 0);
    const revenueHier = commandesHier.reduce((s, o) => s + o.total_cents, 0);
    const panierMoyenHier = commandesHier.length ? Math.round(revenueHier / commandesHier.length) : 0;

    // --- Clients récurrents : un client est "récurrent" si sa toute première
    // commande (tous statuts payés confondus, sur toute l'historique) est
    // antérieure à celle du jour. identifiant = customer_id, ou email si
    // commande invité (customer_id nul).
    const premieresCommandes = await sql()`
      select customer_id, email, min(created_at) as premiere
      from orders
      where status = any(${PAID_STATUSES})
      group by customer_id, email
    `;
    const premiereParClient = new Map();
    for (const p of premieresCommandes) {
      const cle = p.customer_id != null ? `id:${p.customer_id}` : `email:${p.email}`;
      premiereParClient.set(cle, new Date(p.premiere).getTime());
    }
    function estRecurrente(o) {
      const cle = o.customer_id != null ? `id:${o.customer_id}` : `email:${o.email}`;
      const premiere = premiereParClient.get(cle);
      return premiere != null && new Date(o.created_at).getTime() > premiere;
    }
    const recurrentesAujourdhui = commandesAujourdhui.filter(estRecurrente).length;
    const tauxRecurrenceAujourdhui = commandesAujourdhui.length ? (recurrentesAujourdhui / commandesAujourdhui.length) * 100 : 0;
    const recurrentesHier = commandesHier.filter(estRecurrente).length;
    const tauxRecurrenceHier = commandesHier.length ? (recurrentesHier / commandesHier.length) * 100 : 0;

    // --- Sessions (visites du site) : jour complet aujourd'hui vs jour complet hier. ---
    const store = getStore("analytics");
    const jourISO = (d) => d.toISOString().slice(0, 10);
    const [dataAujourdhui, dataHier] = await Promise.all([
      store.get(`day/${jourISO(debutAujourdhui)}`, { type: "json" }).catch(() => null),
      store.get(`day/${jourISO(debutHier)}`, { type: "json" }).catch(() => null),
    ]);
    const sessionsAujourdhui = dataAujourdhui?.visitors?.length || 0;
    const sessionsHier = dataHier?.visitors?.length || 0;

    const tauxConversionAujourdhui = sessionsAujourdhui ? (commandesAujourdhui.length / sessionsAujourdhui) * 100 : 0;
    const tauxConversionHier = sessionsHier ? (commandesHier.length / sessionsHier) * 100 : 0;

    const panierMoyenAujourdhui = commandesAujourdhui.length ? Math.round(revenueAujourdhui / commandesAujourdhui.length) : 0;

    // --- Commandes en attente d'expédition (file en cours, pas limitée à aujourd'hui). ---
    const [{ count: enAttenteSite }] = await sql()`select count(*)::int as count from orders where status = 'payee'`;

    // --- Amazon : une seule requête sur 30 jours, dont on dérive tout le reste
    // (aujourd'hui, hier, tendance 14j, en attente d'expédition) pour limiter
    // le nombre d'appels à l'API Amazon (rate limit strict sur /orders). ---
    const marketplaceIds = [process.env.AMAZON_MARKETPLACE_ID_FR, process.env.AMAZON_MARKETPLACE_ID_DE].filter(Boolean).join(",");
    const amazonCreds = amazonCredentials();
    let amazon30j = [];
    let amazonToken_ = null;
    let amazonIndisponible = !marketplaceIds || amazonCreds.missing;
    let amazonRaison = amazonCreds.missing ? "identifiants Amazon manquants" : null;
    if (!amazonIndisponible) {
      try {
        amazonToken_ = await amazonToken(amazonCreds);
        const depuis30j = new Date(maintenant.getTime() - 30 * DAY_MS).toISOString();
        amazon30j = await commandesAmazon(amazonToken_, marketplaceIds, depuis30j);
      } catch (e) {
        amazonIndisponible = true;
        amazonRaison = String(e.message || e);
        console.error("[overview] Amazon indisponible:", amazonRaison);
      }
    }
    const amazonAujourdhui = amazon30j.filter((o) => new Date(o.PurchaseDate).getTime() >= debutAujourdhui.getTime());
    const amazonHier = amazon30j.filter((o) => {
      const t = new Date(o.PurchaseDate).getTime();
      return t >= debutHier.getTime() && t <= hierMemeHeure.getTime();
    });
    const enAttenteAmazon = amazon30j.filter((o) => o.OrderStatus === "Unshipped" || o.OrderStatus === "PartiallyShipped").length;
    const totalAujourdhui = commandesAujourdhui.length + amazonAujourdhui.length;
    const totalHier = commandesHier.length + amazonHier.length;
    const partAmazonAujourdhui = totalAujourdhui ? (amazonAujourdhui.length / totalAujourdhui) * 100 : 0;
    const partAmazonHier = totalHier ? (amazonHier.length / totalHier) * 100 : 0;

    // --- Tendance sur 14 jours (mini-graphiques), un jour = un point. ---
    const jours = [];
    for (let i = JOURS_TENDANCE - 1; i >= 0; i--) jours.push(new Date(debutAujourdhui.getTime() - i * DAY_MS));

    const commandesPeriode = await sql()`
      select customer_id, email, total_cents, created_at from orders
      where created_at >= ${jours[0].toISOString()} and status = any(${PAID_STATUSES})
    `;
    const parJour = new Map(jours.map((j) => [jourISO(j), { ventes: 0, commandes: 0, recurrentes: 0, amazon: 0 }]));
    for (const o of commandesPeriode) {
      const cle = jourISO(new Date(o.created_at));
      const bucket = parJour.get(cle);
      if (!bucket) continue;
      bucket.ventes += o.total_cents;
      bucket.commandes += 1;
      if (estRecurrente(o)) bucket.recurrentes += 1;
    }
    for (const o of amazon30j) {
      const cle = (o.PurchaseDate || "").slice(0, 10);
      const bucket = parJour.get(cle);
      if (bucket) bucket.amazon += 1;
    }
    const sessionsParJour = await Promise.all(jours.map((j) => store.get(`day/${jourISO(j)}`, { type: "json" }).catch(() => null)));

    const tendanceVentes = jours.map((j) => parJour.get(jourISO(j)).ventes);
    const tendanceCommandes = jours.map((j) => parJour.get(jourISO(j)).commandes);
    const tendanceSessions = jours.map((j, i) => sessionsParJour[i]?.visitors?.length || 0);
    const tendanceCanal = jours.map((j) => {
      const b = parJour.get(jourISO(j));
      const total = b.commandes + b.amazon;
      return total ? Math.round((b.amazon / total) * 1000) / 10 : 0;
    });
    const tendanceConversion = jours.map((j, i) => {
      const b = parJour.get(jourISO(j));
      const s = sessionsParJour[i]?.visitors?.length || 0;
      return s ? Math.round((b.commandes / s) * 1000) / 10 : 0;
    });
    const tendanceAov = jours.map((j) => {
      const b = parJour.get(jourISO(j));
      return b.commandes ? Math.round(b.ventes / b.commandes) : 0;
    });

    // Suivi des livraisons en cours : Packlink est la seule source qui
    // connaît le vrai statut de transit (notre base ne sait dire que
    // "expédié" ou non), tous canaux confondus (site, Amazon, créé à la main).
    const packlinkKey = packlinkCredentials();
    let livraisons = [];
    let livraisonsIndisponible = !packlinkKey;
    let livraisonsRaison = packlinkKey ? null : "PROPACKING_API_KEY manquante";
    if (packlinkKey) {
      try {
        livraisons = await livraisonsEnCours(packlinkKey);
      } catch (e) {
        livraisonsIndisponible = true;
        livraisonsRaison = String(e.message || e);
      }
    }

    return Response.json(
      {
        comparaison: `hier ${debutHier.toLocaleDateString("fr-FR")}`,
        enAttente: { site: enAttenteSite, amazon: amazonIndisponible ? null : enAttenteAmazon, amazonRaison },
        ventes: { valeurCents: revenueAujourdhui, variationPct: pctChange(revenueAujourdhui, revenueHier), tendance: tendanceVentes },
        sessions: { valeur: sessionsAujourdhui, variationPct: pctChange(sessionsAujourdhui, sessionsHier), tendance: tendanceSessions },
        canal: {
          indisponible: amazonIndisponible,
          raison: amazonRaison,
          amazonPct: Math.round(partAmazonAujourdhui * 10) / 10,
          sitePct: Math.round((100 - partAmazonAujourdhui) * 10) / 10,
          variationPct: pctChange(partAmazonAujourdhui, partAmazonHier),
          tendance: tendanceCanal,
        },
        conversion: { valeurPct: Math.round(tauxConversionAujourdhui * 100) / 100, variationPct: pctChange(tauxConversionAujourdhui, tauxConversionHier), tendance: tendanceConversion },
        panierMoyen: { valeurCents: panierMoyenAujourdhui, variationPct: pctChange(panierMoyenAujourdhui, panierMoyenHier), tendance: tendanceAov },
        commandes: { valeur: commandesAujourdhui.length, variationPct: pctChange(commandesAujourdhui.length, commandesHier.length), tendance: tendanceCommandes },
        livraisons: { indisponible: livraisonsIndisponible, raison: livraisonsRaison, liste: livraisons },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/overview" };
