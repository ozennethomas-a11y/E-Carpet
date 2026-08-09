import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { prettySource, campaignLabelOf } from "./shared/sources.mjs";

// Privacy-first page-view collector.
// No cookies, no persistent identifier: a visitor is a daily-rotating hash of
// (salt + date + IP + user-agent), which cannot be reversed or linked across days.
// That keeps it outside the scope of the cookie-consent requirement.

const BOT = /bot|crawl|spider|slurp|bing|baidu|yandex|duckduck|facebookexternal|embedly|quora|pinterest|slack|whatsapp|telegram|discord|preview|monitor|curl|wget|python-requests|headless|lighthouse|pingdom|uptime|ahrefs|semrush|mj12|dotbot|petal|gptbot|claudebot|ccbot/i;

const DAY_MS = 86400000;
const RETENTION_DAYS = 400;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function visitorHash(ip, ua, date) {
  const salt = process.env.ANALYTICS_SALT || "e-carpet-default-salt";
  return createHash("sha256").update(`${salt}|${date}|${ip}|${ua}`).digest("hex").slice(0, 12);
}

function sourceOf(referrer, host) {
  if (!referrer) return "Direct";
  try {
    const h = new URL(referrer).hostname.replace(/^www\./, "");
    if (!h || h === host.replace(/^www\./, "")) return "Direct";
    if (/google\./.test(h)) return "Google";
    if (/bing\./.test(h)) return "Bing";
    if (/tiktok\./.test(h)) return "TikTok";
    if (/instagram\./.test(h)) return "Instagram";
    if (/facebook\.|fb\./.test(h)) return "Facebook";
    if (/amazon\./.test(h)) return "Amazon";
    return h;
  } catch {
    return "Direct";
  }
}

function bump(obj, key, by = 1) {
  if (!key) return;
  obj[key] = (obj[key] || 0) + by;
}

const emptyDay = () => ({
  views: 0,
  visitors: [],
  pages: {},
  countries: {},
  cities: {},
  sources: {},
  devices: {},
  languages: {},
  campaigns: {},
});

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const ua = req.headers.get("user-agent") || "";
  // Silently accept bots so they get no error, but never count them.
  if (BOT.test(ua) || !ua) return new Response(null, { status: 204 });

  let body = {};
  try {
    body = await req.json();
  } catch {
    /* keep defaults */
  }

  const date = today();
  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "0.0.0.0";
  const hash = visitorHash(ip, ua, date);

  const geo = context.geo || {};
  const country = geo.country?.name || "Inconnu";
  const city = geo.city || "Inconnu";

  const url = new URL(req.url);
  const path = (body.path || "/").split("?")[0].slice(0, 120) || "/";

  // Tagged links: ?utm_source=tiktok&utm_campaign=bio (or the short ?ref=tiktok).
  // A tag beats the referrer, because social in-app browsers usually send none.
  const params = new URLSearchParams(body.query || "");
  const tag = (params.get("utm_source") || params.get("ref") || params.get("source") || "").slice(0, 40);
  const campaign = (params.get("utm_campaign") || params.get("c") || "").slice(0, 40);
  const campaignLabel = campaignLabelOf(tag, campaign);

  const source = tag ? prettySource(tag) : sourceOf(body.referrer, url.hostname);
  const device = /Mobi|Android|iPhone|iPod/i.test(ua)
    ? "Mobile"
    : /iPad|Tablet/i.test(ua)
      ? "Tablette"
      : "Ordinateur";
  const lang = (body.lang || "").slice(0, 5) || "?";

  const store = getStore("analytics");
  const key = `day/${date}`;

  // Read-modify-write with a conditional write so concurrent hits don't drop counts.
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await store.getWithMetadata(key, { type: "json" }).catch(() => null);
    const day = { ...emptyDay(), ...(res?.data ?? {}) };

    day.views += 1;
    if (!day.visitors.includes(hash)) day.visitors.push(hash);
    bump(day.campaigns, campaignLabel);
    bump(day.pages, path);
    bump(day.countries, country);
    bump(day.cities, city);
    bump(day.sources, source);
    bump(day.devices, device);
    bump(day.languages, lang);

    try {
      const opts = res?.etag ? { onlyIfMatch: res.etag } : { onlyIfNew: true };
      const write = await store.setJSON(key, day, opts);
      if (write?.modified !== false) break; // written
    } catch {
      // Conditional write unsupported → last-write-wins fallback.
      await store.setJSON(key, day);
      break;
    }
  }

  // Keep an index of days so the dashboard doesn't have to list the whole store.
  try {
    const idx = (await store.get("index", { type: "json" }).catch(() => null)) || { days: [] };
    if (!idx.days.includes(date)) {
      idx.days.push(date);
      idx.days.sort();
      const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS).toISOString().slice(0, 10);
      idx.days = idx.days.filter((d) => d >= cutoff);
      await store.setJSON("index", idx);
    }
  } catch {
    /* index is best-effort */
  }

  return new Response(null, { status: 204 });
};

export const config = { path: "/api/track" };
