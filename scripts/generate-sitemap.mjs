// Génère public/sitemap.xml à partir des données du site.
// Lancé automatiquement avant chaque build (voir "build" dans package.json).
//
// Les articles dont la date de publication est future sont exclus : ils sont
// invisibles sur le site tant que la date n'est pas atteinte, il ne faut donc
// pas les déclarer à Google. Relancer un build après leur sortie les ajoutera.

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://e-carpet.shop";

const { ARTICLES } = await import(resolve(root, "src/data/articles.js"));
const { LEGAL_SLUGS } = await import(resolve(root, "src/data/legal.js"));

const today = new Date().toISOString().slice(0, 10);
const published = ARTICLES.filter((a) => new Date(a.date) <= new Date());

const urls = [
  { loc: "/", changefreq: "weekly", priority: "1.0", lastmod: today },
  { loc: "/blog", changefreq: "weekly", priority: "0.8", lastmod: published[0]?.date || today },
  ...published.map((a) => ({
    loc: `/blog/${a.slug}`,
    changefreq: "monthly",
    priority: "0.7",
    lastmod: a.date,
  })),
  { loc: "/avis", changefreq: "yearly", priority: "0.3", lastmod: today },
  ...LEGAL_SLUGS.map((slug) => ({
    loc: `/legal/${slug}`,
    changefreq: "yearly",
    priority: "0.2",
    lastmod: today,
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE}${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

writeFileSync(resolve(root, "public/sitemap.xml"), xml);
console.log(
  `sitemap.xml : ${urls.length} URL (${published.length} article(s) publié(s), ${ARTICLES.length - published.length} programmé(s) et exclu(s))`
);

// ---------------------------------------------------------------------------
// JSON-LD statique de la page d'accueil, écrit directement dans index.html.
// Servi dans le HTML brut, il est donc lu par tous les robots, y compris ceux
// qui n'exécutent pas le JavaScript. Les sous-pages le remplacent ensuite via
// src/structuredData.js une fois l'application montée.
// ---------------------------------------------------------------------------
const { buildGraph } = await import(resolve(root, "src/structuredData.js"));
const { translations } = await import(resolve(root, "src/i18n/translations.js"));

const graph = buildGraph("/", translations.fr.faq);
const block = `    <script type="application/ld+json" id="ld-page">${JSON.stringify(graph)}</script>`;

const indexPath = resolve(root, "index.html");
const html = readFileSync(indexPath, "utf8");
const updated = html.replace(
  /(<!-- ld-page:start[^>]*-->)[\s\S]*?(<!-- ld-page:end -->)/,
  `$1\n${block}\n    $2`
);
if (updated === html && !html.includes("ld-page:start")) {
  console.warn("⚠️  Marqueurs ld-page absents de index.html : JSON-LD non injecté.");
} else {
  writeFileSync(indexPath, updated);
  const types = graph["@graph"].map((n) => n["@type"]).join(", ");
  console.log(`JSON-LD accueil : ${types}`);
}
