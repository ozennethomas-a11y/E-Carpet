// Amazon Ads (Sponsored Products) pour le sous-onglet « Marketing » d'Amazon.
//
// Testé contre de vraies données le 2026-08-30 : la liste des campagnes
// utilise l'API v3 (POST /sp/campaigns/list), l'ancien GET /v2/sp/campaigns
// n'existe plus.
//
// Lecture seule : consultation des campagnes et de leurs performances.
// Aucune création, modification ou pause de campagne n'est câblée ici tant
// qu'on n'a pas testé le circuit ensemble, comme convenu pour Google Ads.

import { getAdminFromRequest } from "./lib/_adminAuth.mjs";

const AUTH_URL = "https://api.amazon.com/auth/o2/token";
const API = "https://advertising-api-eu.amazon.com"; // région Europe (FR)

function credentials() {
  const need = ["AMAZON_ADS_CLIENT_ID", "AMAZON_ADS_CLIENT_SECRET", "AMAZON_ADS_REFRESH_TOKEN"];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) return { missing };
  return {
    clientId: process.env.AMAZON_ADS_CLIENT_ID,
    clientSecret: process.env.AMAZON_ADS_CLIENT_SECRET,
    refreshToken: process.env.AMAZON_ADS_REFRESH_TOKEN,
    // Optionnelle : si absente, on la découvre via /v2/profiles et on la
    // signale dans le diagnostic pour que vous la figiez dans Netlify.
    profileId: process.env.AMAZON_ADS_PROFILE_ID || null,
  };
}

async function getAccessToken(c) {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: c.refreshToken,
      client_id: c.clientId,
      client_secret: c.clientSecret,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      json.error === "invalid_grant"
        ? "refresh token Amazon Ads invalide ou révoqué : relancez scripts/amazon-ads-token.mjs"
        : json.error_description || json.error || "échec de l'authentification Amazon Ads",
    );
  }
  return json.access_token;
}

async function adsGet(c, token, path, profileId) {
  const headers = {
    authorization: `Bearer ${token}`,
    "Amazon-Advertising-API-ClientId": c.clientId,
  };
  if (profileId) headers["Amazon-Advertising-API-Scope"] = String(profileId);

  const res = await fetch(`${API}${path}`, { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readableError(json, res.status));
  return json;
}

// API v3 des campagnes Sponsored Products : contrairement à v2 (GET simple),
// v3 est un POST avec un corps de filtre (vide = tout) et des en-têtes
// vendor-specific dédiés (content-type/accept "vnd.spCampaign.v3+json").
async function campagnesSP(c, token, profileId) {
  const res = await fetch(`${API}/sp/campaigns/list`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "Amazon-Advertising-API-ClientId": c.clientId,
      "Amazon-Advertising-API-Scope": String(profileId),
      "content-type": "application/vnd.spCampaign.v3+json",
      accept: "application/vnd.spCampaign.v3+json",
    },
    body: JSON.stringify({}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readableError(json, res.status));
  return json.campaigns || [];
}

function readableError(json, status) {
  if (status === 401) return "jeton refusé : vérifiez que le scope advertising::campaign_management a bien été assigné à cette application";
  if (status === 403) return "accès refusé à ce profil publicitaire";
  if (status === 429) return "trop de requêtes envoyées à Amazon Ads, réessayez dans une minute";
  return json?.message || json?.details || `erreur HTTP ${status}`;
}

/** Les profils publicitaires disponibles : un par pays où vous faites de la pub. */
async function profils(c, token) {
  const json = await adsGet(c, token, "/v2/profiles");
  return (json || []).map((p) => ({
    id: p.profileId,
    pays: p.countryCode,
    devise: p.currencyCode,
    type: p.accountInfo?.type,
  }));
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

    // Diagnostic : confirme l'authentification et liste les profils réellement
    // accessibles, pour repérer l'AMAZON_ADS_PROFILE_ID à figer dans Netlify.
    if (url.searchParams.get("check")) {
      const p = await profils(c, token);
      return Response.json({ authentification: "réussie", profils: p, profileIdConfigure: c.profileId || "(non défini)" });
    }

    if (!c.profileId) {
      const p = await profils(c, token);
      const fr = p.find((x) => x.pays === "FR");
      return Response.json({
        error: "profil manquant",
        aide: "Ajoutez AMAZON_ADS_PROFILE_ID dans Netlify avec l'une de ces valeurs, puis redéployez.",
        profils: p,
        suggestion: fr?.id || null,
      });
    }

    // Vue d'ensemble des campagnes Sponsored Products (API v3).
    const campagnes = await campagnesSP(c, token, c.profileId);
    return Response.json(
      {
        profileId: c.profileId,
        campagnes: campagnes.map((cmp) => ({
          id: cmp.campaignId,
          nom: cmp.name,
          statut: cmp.state,
          budgetQuotidien: cmp.budget?.budget ?? null,
          cible: cmp.targetingType,
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/amazon-ads" };
