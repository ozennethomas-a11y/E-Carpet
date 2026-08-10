import { createSign } from "node:crypto";

// Données SEO pour l'onglet « SEO » du dashboard.
//
// Deux sources, toutes deux gratuites :
//  - Google Search Console (requêtes, pages, positions) via un compte de service.
//    Nécessite la variable GSC_SERVICE_ACCOUNT (contenu du fichier JSON de clé).
//  - PageSpeed Insights (Core Web Vitals). Aucune authentification requise.
//
// La clé de service n'est jamais exposée au navigateur : tout se passe ici.

const SITE_URL = "https://e-carpet.shop/";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function authorised(req) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return "not_configured";
  const given = req.headers.get("x-dashboard-password") || "";
  return given === expected ? "ok" : "unauthorized";
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Échange un JWT signé contre un jeton d'accès Google (flux compte de service). */
async function getAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = b64url(signer.sign(creds.private_key));
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || "auth_failed");
  return json.access_token;
}

async function searchAnalytics(token, body) {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || "gsc_query_failed");
  return json.rows || [];
}

const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

function mapRows(rows) {
  return rows.map((r) => ({
    label: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: round(r.ctr * 100, 1),
    position: round(r.position, 1),
  }));
}

/** Requêtes très vues mais peu cliquées : le meilleur gisement de gains rapides. */
function opportunities(queries) {
  return queries
    .filter((q) => q.impressions >= 20 && q.ctr < 3 && q.position <= 30)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8);
}

async function pageSpeed() {
  const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    SITE_URL
  )}&strategy=mobile&category=performance&category=seo`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json();
  const lh = j.lighthouseResult;
  if (!lh) return null;
  const audit = (k) => lh.audits?.[k]?.displayValue || null;
  return {
    performance: Math.round((lh.categories?.performance?.score ?? 0) * 100),
    seo: Math.round((lh.categories?.seo?.score ?? 0) * 100),
    lcp: audit("largest-contentful-paint"),
    cls: audit("cumulative-layout-shift"),
    tbt: audit("total-blocking-time"),
  };
}

export default async (req) => {
  const auth = authorised(req);
  if (auth !== "ok") {
    return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });
  }

  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "28", 10), 7), 480);
  const range = { startDate: isoDaysAgo(days + 2), endDate: isoDaysAgo(2) }; // GSC a ~2 jours de retard

  const out = { range, gsc: null, gscError: null, pagespeed: null };

  // PageSpeed est indépendant de Search Console : on le récupère dans tous les cas.
  const psPromise = pageSpeed().catch(() => null);

  const raw = process.env.GSC_SERVICE_ACCOUNT;
  if (!raw) {
    out.gscError = "missing_credentials";
  } else {
    try {
      const creds = JSON.parse(raw);
      const token = await getAccessToken(creds);

      const [queries, pages, totals, byDate] = await Promise.all([
        searchAnalytics(token, { ...range, dimensions: ["query"], rowLimit: 100 }),
        searchAnalytics(token, { ...range, dimensions: ["page"], rowLimit: 25 }),
        searchAnalytics(token, { ...range, rowLimit: 1 }),
        searchAnalytics(token, { ...range, dimensions: ["date"], rowLimit: 500 }),
      ]);

      const q = mapRows(queries);
      const t = totals[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

      out.gsc = {
        totals: {
          clicks: t.clicks,
          impressions: t.impressions,
          ctr: round(t.ctr * 100, 1),
          position: round(t.position, 1),
        },
        series: byDate.map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
        queries: q.slice(0, 15),
        pages: mapRows(pages).slice(0, 10),
        opportunities: opportunities(q),
      };
    } catch (e) {
      out.gscError = String(e.message || e);
    }
  }

  out.pagespeed = await psPromise;
  return Response.json(out, { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/seo" };
