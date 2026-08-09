import { getStore } from "@netlify/blobs";

// Password-protected read API for the private dashboard.
// Set DASHBOARD_PASSWORD in Netlify → Site configuration → Environment variables.

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
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const given = req.headers.get("x-dashboard-password") || url.searchParams.get("pw") || "";
  if (given !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10), 1), 365);

  const store = getStore("analytics");
  const wanted = [];
  for (let i = days - 1; i >= 0; i--) {
    wanted.push(new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10));
  }

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

  return Response.json(
    {
      range: { days, from: wanted[0], to: wanted[wanted.length - 1] },
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
    },
    { headers: { "cache-control": "no-store" } }
  );
};

export const config = { path: "/api/stats" };
