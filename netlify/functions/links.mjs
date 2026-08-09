import { getStore } from "@netlify/blobs";
import { campaignLabelOf, slug } from "./shared/sources.mjs";

// Saved tagged links, managed from the dashboard (Liens tab).
// Stored in Netlify Blobs so the list follows you across devices and browsers.

const KEY = "links";

function authorised(req) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return "not_configured";
  const given = req.headers.get("x-dashboard-password") || "";
  return given === expected ? "ok" : "unauthorized";
}

function siteOrigin(req) {
  // Netlify exposes the site's primary URL; fall back to the request origin.
  const fromEnv = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return new URL(req.url).origin;
}

function buildUrl(origin, source, campaign) {
  const p = new URLSearchParams({ utm_source: source });
  if (campaign) p.set("utm_campaign", campaign);
  return `${origin}/?${p.toString()}`;
}

async function readLinks(store) {
  const data = await store.get(KEY, { type: "json" }).catch(() => null);
  return Array.isArray(data?.links) ? data.links : [];
}

export default async (req) => {
  const auth = authorised(req);
  if (auth === "not_configured") return Response.json({ error: "not_configured" }, { status: 503 });
  if (auth === "unauthorized") return Response.json({ error: "unauthorized" }, { status: 401 });

  const store = getStore("analytics");
  const origin = siteOrigin(req);

  if (req.method === "GET") {
    return Response.json({ links: await readLinks(store) }, { headers: { "cache-control": "no-store" } });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const source = slug(body.source);
    const campaign = slug(body.campaign);
    if (!source) return Response.json({ error: "source_required" }, { status: 400 });

    const links = await readLinks(store);
    const label = campaignLabelOf(source, campaign);
    if (links.some((l) => l.label === label)) {
      return Response.json({ error: "already_exists" }, { status: 409 });
    }

    const link = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      source,
      campaign,
      label,
      note: String(body.note || "").slice(0, 80),
      url: buildUrl(origin, source, campaign),
      created: new Date().toISOString(),
    };
    links.unshift(link);
    await store.setJSON(KEY, { links });
    return Response.json({ link }, { status: 201 });
  }

  if (req.method === "DELETE") {
    const id = new URL(req.url).searchParams.get("id");
    const links = await readLinks(store);
    const kept = links.filter((l) => l.id !== id);
    if (kept.length === links.length) return Response.json({ error: "not_found" }, { status: 404 });
    await store.setJSON(KEY, { links: kept });
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/links" };
