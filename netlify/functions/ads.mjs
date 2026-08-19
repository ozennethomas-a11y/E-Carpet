// Google Ads pour l'onglet « Campagnes » du back-office.
//
// Deux usages, tous deux gratuits et sans dépense publicitaire :
//  - KeywordPlanIdeaService : volumes de recherche réels, concurrence, CPC, saisonnalité.
//  - generateKeywordForecastMetrics : coût, clics et impressions estimés pour un budget donné.
//
// Rien n'est créé ni dépensé ici : cette fonction est en lecture seule.
// La création de campagne se fera dans une fonction séparée, toujours en statut « en pause ».

import { credentials, getAccessToken, readableError, adsPost, euros, resolveVersion } from "./lib/_googleAds.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";

// France, français. Références Google : geoTargetConstants/2250 = France.
const GEO = "geoTargetConstants/2250";
const LANG = "languageConstants/1002";
const MICROS = 1_000_000; // Google exprime tous les montants en millionièmes d'euro.
const API = "https://googleads.googleapis.com";

const COMPETITION = { LOW: "faible", MEDIUM: "moyenne", HIGH: "forte" };

/** Volumes de recherche et saisonnalité pour une liste de mots-clés de départ. */
async function keywordIdeas(c, token, seeds) {
  const json = await adsPost(c, token, "generateKeywordIdeas", {
    language: LANG,
    geoTargetConstants: [GEO],
    keywordPlanNetwork: "GOOGLE_SEARCH",
    keywordSeed: { keywords: seeds },
  });

  return (json.results || [])
    .map((r) => {
      const m = r.keywordIdeaMetrics || {};
      const monthly = (m.monthlySearchVolumes || []).map((v) => ({
        mois: v.month,
        annee: v.year,
        volume: Number(v.monthlySearches || 0),
      }));
      return {
        motCle: r.text,
        volume: Number(m.avgMonthlySearches || 0),
        concurrence: COMPETITION[m.competition] || "inconnue",
        cpcBas: euros(m.lowTopOfPageBidMicros),
        cpcHaut: euros(m.highTopOfPageBidMicros),
        // 12 derniers mois : c'est ce qui révèle la saisonnalité de la trottinette.
        saisonnalite: monthly.slice(-12),
      };
    })
    .filter((k) => k.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 60);
}

/**
 * Prévision officielle Google pour un budget donné : c'est le chiffre qui répond
 * à « combien ça va me coûter ». Aucune campagne n'est créée pour l'obtenir.
 */
async function forecast(c, token, keywords, dailyBudget, cpcBid) {
  const start = new Date();
  const end = new Date(Date.now() + 30 * 86400_000);
  const iso = (d) => d.toISOString().slice(0, 10);

  const json = await adsPost(c, token, "generateKeywordForecastMetrics", {
    currencyCode: "EUR",
    forecastPeriod: { startDate: iso(start), endDate: iso(end) },
    campaign: {
      keywordPlanAdGroups: [
        {
          cpcBidMicros: Math.round(cpcBid * MICROS),
          keywords: keywords.map((text) => ({
            text,
            matchType: "PHRASE",
          })),
        },
      ],
      geoModifiers: [{ geoTargetConstant: GEO }],
      languageConstants: [LANG],
      keywordPlanNetwork: "GOOGLE_SEARCH",
      dailyBudgetMicros: Math.round(dailyBudget * MICROS),
    },
  });

  const m = json.campaignForecastMetrics || {};
  const clicks = Math.round(Number(m.clicks || 0));
  const cost = euros(m.costMicros);
  return {
    periode: { du: iso(start), au: iso(end) },
    impressions: Math.round(Number(m.impressions || 0)),
    clics: clicks,
    coutEstime: cost,
    cpcMoyen: clicks ? Math.round((cost / clicks) * 100) / 100 : 0,
    budgetQuotidien: dailyBudget,
  };
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") {
    return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });
  }

  const c = credentials();
  if (c.missing) {
    return Response.json({ error: "missing_credentials", variables: c.missing }, { status: 200 });
  }

  const url = new URL(req.url);

  try {
    const token = await getAccessToken(c);

    // Diagnostic : quels comptes Ads ce refresh token voit-il vraiment ?
    // C'est la seule façon de distinguer un mauvais CUSTOMER_ID d'un compte Google
    // qui n'a tout simplement pas été invité sur le compte publicitaire.
    if (url.searchParams.get("check")) {
      const version = await resolveVersion(c, token);
      const res = await fetch(`${API}/${version}/customers:listAccessibleCustomers`, {
        headers: { authorization: `Bearer ${token}`, "developer-token": c.devToken },
      });
      const json = await res.json().catch(() => ({}));
      return Response.json({
        versionApi: version,
        comptesAccessibles: (json.resourceNames || []).map((n) => n.split("/")[1]),
        erreurGoogle: res.ok ? null : readableError(json, res.status),
        configure: { customerId: c.customerId, loginCustomerId: c.loginCustomerId || "(non défini)" },
      });
    }

    // Prévision de coût : POST avec les mots-clés retenus et le budget souhaité.
    if (req.method === "POST") {
      const body = await req.json();
      const keywords = (body.keywords || []).filter(Boolean).slice(0, 100);
      if (!keywords.length) {
        return Response.json({ error: "aucun mot-clé fourni" }, { status: 400 });
      }
      const data = await forecast(
        c,
        token,
        keywords,
        Number(body.dailyBudget) || 10,
        Number(body.cpcBid) || 0.5,
      );
      return Response.json(data, { headers: { "cache-control": "no-store" } });
    }

    // Inventaire en lecture seule : quelles campagnes existent, et ont-elles dépensé ?
    if (url.searchParams.get("campagnes")) {
      const json = await adsPost(c, token, "/googleAds:search", {
        query: `
          SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
                 campaign_budget.amount_micros, metrics.cost_micros, metrics.clicks, metrics.impressions
          FROM campaign
          WHERE segments.date DURING LAST_30_DAYS`,
      });
      const rows = (json.results || []).map((r) => ({
        id: r.campaign?.id,
        nom: r.campaign?.name,
        statut: r.campaign?.status,
        type: r.campaign?.advertisingChannelType,
        budgetQuotidien: euros(r.campaignBudget?.amountMicros),
        coutSur30Jours: euros(r.metrics?.costMicros),
        clics: Number(r.metrics?.clicks || 0),
        impressions: Number(r.metrics?.impressions || 0),
      }));
      return Response.json({
        nombre: rows.length,
        depenseTotale: Math.round(rows.reduce((s, r) => s + r.coutSur30Jours, 0) * 100) / 100,
        campagnes: rows,
      });
    }

    const seeds = (url.searchParams.get("seeds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const data = await keywordIdeas(c, token, seeds.length ? seeds : DEFAULT_SEEDS);
    return Response.json({ keywords: data }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

// Point de départ de l'analyse : le vocabulaire réel des acheteurs du produit.
const DEFAULT_SEEDS = [
  "tapis trottinette électrique",
  "protection sol trottinette",
  "tapis silicone",
  "tapis garage trottinette",
  "accessoire trottinette électrique",
];

export const config = { path: "/api/ads" };
