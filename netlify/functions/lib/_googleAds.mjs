// Helpers Google Ads partagés entre ads.mjs (onglet Campagnes) et finance.mjs
// (tableau de bord Finance) — extraits d'ads.mjs pour éviter de dupliquer
// l'authentification et la résolution de version d'API.

const API = "https://googleads.googleapis.com";

const CANDIDATES = ["v27", "v26", "v25", "v24", "v23", "v22"];
let versionCache = process.env.GOOGLE_ADS_API_VERSION || null;

export async function resolveVersion(c, token) {
  if (versionCache) return versionCache;
  const headers = { authorization: `Bearer ${token}`, "developer-token": c.devToken };
  const refus = /deprecated|not supported|was not found|invalid.*version/i;

  for (const v of CANDIDATES) {
    const res = await fetch(`${API}/${v}/customers:listAccessibleCustomers`, { headers });
    if (res.status === 404) continue;
    const json = await res.json().catch(() => ({}));
    if (res.ok) return (versionCache = v);
    if (!refus.test(json?.error?.message || "")) return (versionCache = v);
  }
  throw new Error("aucune version de l'API Google Ads n'a été acceptée");
}

const MICROS = 1_000_000;
export const euros = (micros) => Math.round((Number(micros || 0) / MICROS) * 100) / 100;

export function credentials() {
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
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID.replace(/\D/g, ""),
    loginCustomerId: (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/\D/g, ""),
  };
}

export async function getAccessToken(c) {
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

export function readableError(json, status) {
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

export async function adsPost(c, token, method, body) {
  const version = await resolveVersion(c, token);
  const suffix = method.startsWith("/") ? method : `:${method}`;
  const url = `${API}/${version}/customers/${c.customerId}${suffix}`;

  const appel = (loginId) =>
    fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "developer-token": c.devToken,
        "content-type": "application/json",
        ...(loginId ? { "login-customer-id": loginId } : {}),
      },
      body: JSON.stringify(body),
    });

  let res = await appel(c.loginCustomerId);
  if (res.status === 403 && c.loginCustomerId) res = await appel(null);

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readableError(json, res.status));
  return json;
}

// Dépense réelle des campagnes depuis une date donnée (paramétrable, plutôt
// que la fenêtre fixe LAST_30_DAYS utilisée par l'inventaire de ads.mjs).
export async function depenseCampagnes(c, token, depuisISO) {
  const depuis = depuisISO.slice(0, 10);
  const json = await adsPost(c, token, "/googleAds:search", {
    query: `
      SELECT campaign.id, campaign.name, campaign.status,
             metrics.cost_micros, metrics.clicks, metrics.impressions
      FROM campaign
      WHERE segments.date >= '${depuis}'`,
  });
  const rows = (json.results || []).map((r) => ({
    id: r.campaign?.id,
    nom: r.campaign?.name,
    statut: r.campaign?.status,
    cout: euros(r.metrics?.costMicros),
    clics: Number(r.metrics?.clicks || 0),
    impressions: Number(r.metrics?.impressions || 0),
  }));
  return {
    depenseTotale: Math.round(rows.reduce((s, r) => s + r.cout, 0) * 100) / 100,
    campagnes: rows,
  };
}
