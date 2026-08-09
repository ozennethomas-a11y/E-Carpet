// Métadonnées par page, appliquées côté client à chaque changement de route.
//
// Limite assumée : Google exécute le JavaScript et voit donc ces balises, mais
// les robots qui ne rendent pas le JS (Bing, scrapers de réseaux sociaux) ne
// voient que le HTML statique de index.html. La solution complète reste le
// pré-rendu au build. Ceci en couvre l'essentiel à coût quasi nul.

const SITE = "https://e-carpet.shop";

function setMeta(selector, attr, value) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    const [, name, key] = selector.match(/\[(name|property)="(.+)"\]/) || [];
    if (name && key) el.setAttribute(name, key);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function setCanonical(url) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

function setRobots(value) {
  let el = document.head.querySelector('meta[name="robots"]');
  if (!value) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", "robots");
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

/**
 * @param {string} path  chemin propre, sans paramètres (ex. "/blog/mon-article")
 * @param {{title:string, description:string, noindex?:boolean}} meta
 */
export function applyPageMeta(path, meta) {
  const canonical = SITE + (path === "/" ? "/" : path);

  document.title = meta.title;
  setMeta('meta[name="description"]', "content", meta.description);
  setMeta('meta[property="og:title"]', "content", meta.title);
  setMeta('meta[property="og:description"]', "content", meta.description);
  setMeta('meta[property="og:url"]', "content", canonical);

  // La canonique ignore volontairement la query string : c'est elle qui règle
  // les doublons créés par les liens tagués (?utm_source=…).
  setCanonical(canonical);

  setRobots(meta.noindex ? "noindex, nofollow" : "");
}
