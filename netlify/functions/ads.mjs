// Google Ads pour l'onglet « Campagnes » du back-office.
//
// Deux usages, tous deux gratuits et sans dépense publicitaire :
//  - KeywordPlanIdeaService : volumes de recherche réels, concurrence, CPC, saisonnalité.
//  - generateKeywordForecastMetrics : coût, clics et impressions estimés pour un budget donné.
//
// Rien n'est créé ni dépensé ici : cette fonction est en lecture seule.
// La création de campagne se fera dans une fonction séparée, toujours en statut « en pause ».

const API = "https://googleads.googleapis.com";
const VERSION = process.env.GOOGLE_ADS_API_VERSION || "v21";

// France, français. Références Google : geoTargetConstants/2250 = France.
const GEO = "geoTargetConstants/2250";
const LANG = "languageConstants/1002";
const MICROS = 1_000_000; // Google exprime tous les montants en millionièmes d'euro.

function authorised(req) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return "not_configured";
  return (req.headers.get("x-dashboard-password") || "") === expected ? "ok" : "unauthorized";
}

function credentials() {
  const need = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
  ];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) return { missing };
  return {
    devToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    clientId: process.env.GOOGLE_ADS_CLIENT_ID,
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    // Les identifiants de compte se saisissent souvent avec des tirets : on nettoie.
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID.replace(/\D/g, ""),
    loginCustomerId: (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/\D/g, ""),
  };
}

/** Le refresh token ne périme pas : on rachète un jeton d'accès à chaque appel. */
async function getAccessToken(c) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: c.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      json.error === "invalid_grant"
        ? "refresh token invalide ou expiré : relancez scripts/google-ads-token.mjs"
        : json.error_description || json.error || "échec de l'authentification",
    );
  }
  return json.access_token;
}

async function adsPost(c, token, method, body) {
  const headers = {
    authorization: `Bearer ${token}`,
    "developer-token": c.devToken,
    "content-type": "application/json",
  };
  if (c.loginCustomerId) headers["login-customer-id"] = c.loginCustomerId;

  const res = await fetch(`${API}/${VERSION}/customers/${c.customerId}:${method}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readableError(json, res.status));
  return json;
}

/** Traduit les erreurs Google, souvent cryptiques, en une phrase actionnable. */
function readableError(json, status) {
  const detail = json?.error?.details?.[0]?.errors?.[0];
  const code = detail?.errorCode && Object.values(detail.errorCode)[0];
  const map = {
    DEVELOPER_TOKEN_NOT_APPROVED:
      "le jeton de développeur est encore en accès Test : demandez l'accès de base dans le Centre API",
    DEVELOPER_TOKEN_PROHIBITED: "ce jeton de développeur n'a pas le droit d'appeler cette API",
    CUSTOMER_NOT_FOUND: "GOOGLE_ADS_CUSTOMER_ID ne correspond à aucun compte accessible",
    NOT_ADS_USER: "ce compte Google n'a accès à aucun compte Google Ads",
    USER_PERMISSION_DENIED:
      "ce compte Google n'a pas les droits sur ce compte Ads, ou GOOGLE_ADS_LOGIN_CUSTOMER_ID manque",
  };
  if (code && map[code]) return map[code];
  return detail?.message || json?.error?.message || `erreur HTTP ${status}`;
}

const euros = (micros) => Math.round((Number(micros || 0) / MICROS) * 100) / 100;

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
  const auth = authorised(req);
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
