// Données structurées JSON-LD, adaptées à la page affichée.
//
// aggregateRating ajouté uniquement à partir de vrais avis de visiteurs
// (déposés via /avis, approuvés en admin) — jamais à partir des avis
// "maison" d'exemple du carrousel, qui sont fictifs. Les déclarer à Google
// en données structurées reviendrait à lui soumettre de faux avis, ce qu'il
// sanctionne explicitement. Tant qu'aucun vrai avis n'est approuvé, le champ
// est simplement absent (pas de note à 0 ni de note inventée).

import { INSTAGRAM_URL, TIKTOK_URL, CONTACT_EMAIL } from "./config.js";
import { ARTICLES } from "./data/articles.js";
import { COMPANY } from "./data/legal.js";

const SITE = "https://e-carpet.shop";

const organization = {
  "@type": "Organization",
  "@id": `${SITE}/#organization`,
  name: "E-Carpet",
  url: SITE,
  logo: `${SITE}/images/new/logo-grey.webp`,
  email: CONTACT_EMAIL,
  address: {
    "@type": "PostalAddress",
    streetAddress: "5 Cour Moderne",
    postalCode: "59000",
    addressLocality: "Lille",
    addressCountry: "FR",
  },
  sameAs: [INSTAGRAM_URL, TIKTOK_URL],
};

const website = {
  "@type": "WebSite",
  "@id": `${SITE}/#website`,
  url: SITE,
  name: "E-Carpet",
  inLanguage: "fr-FR",
  publisher: { "@id": `${SITE}/#organization` },
};

const product = {
  "@type": "Product",
  "@id": `${SITE}/#product`,
  name: "E-Carpet · Tapis de sol pour trottinette électrique",
  description:
    "Tapis de sol 100% silicone pour trottinettes électriques. Imperméable, antidérapant, résistant à la chaleur, avec bordure surélevée qui retient l'eau et la saleté. 130 × 40 cm, compatible tous modèles.",
  image: [`${SITE}/images/trottinette-detouree.webp`],
  brand: { "@type": "Brand", name: "E-Carpet" },
  material: "Silicone",
  color: "Noir",
  size: "130 x 40 cm",
  offers: {
    "@type": "Offer",
    url: `${SITE}/panier`,
    price: "34.99",
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@id": `${SITE}/#organization` },
  },
};

function faqPage(items) {
  return {
    "@type": "FAQPage",
    "@id": `${SITE}/#faq`,
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

function articleSchema(a) {
  return {
    "@type": "BlogPosting",
    "@id": `${SITE}/blog/${a.slug}#article`,
    headline: a.title,
    description: a.excerpt,
    image: [SITE + a.cover],
    datePublished: a.date,
    dateModified: a.date,
    inLanguage: "fr-FR",
    author: { "@id": `${SITE}/#organization` },
    publisher: { "@id": `${SITE}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/blog/${a.slug}` },
  };
}

/**
 * Construit le graphe adapté à la route courante.
 * @param {string} path chemin propre (ex. "/blog/mon-article")
 * @param {{items: {q:string,a:string}[]}} faq bloc FAQ traduit
 */
export function buildGraph(path, faq, avisReels) {
  const graph = [organization, website];

  if (path === "/" || path === "") {
    const p = { ...product };
    if (avisReels?.length) {
      const count = avisReels.length;
      const average = avisReels.reduce((s, a) => s + (a.rating || 0), 0) / count;
      p.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: average.toFixed(1),
        reviewCount: count,
      };
    }
    graph.push(p);
    if (faq?.items?.length) graph.push(faqPage(faq.items));
  } else if (path.startsWith("/blog/")) {
    const a = ARTICLES.find((x) => x.slug === path.slice("/blog/".length));
    if (a) graph.push(articleSchema(a));
  } else if (path === "/blog") {
    graph.push({
      "@type": "Blog",
      "@id": `${SITE}/blog#blog`,
      name: "Blog E-Carpet",
      url: `${SITE}/blog`,
      inLanguage: "fr-FR",
      publisher: { "@id": `${SITE}/#organization` },
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/** Injecte (ou remplace) le bloc JSON-LD de la page. */
export function applyStructuredData(path, faq) {
  let el = document.getElementById("ld-page");
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "ld-page";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(buildGraph(path, faq));

  // Sur l'accueil, complète ensuite avec la note moyenne réelle une fois les
  // avis chargés (fetch async, ne bloque jamais l'affichage initial).
  if (path === "/" || path === "") {
    fetch("/api/avis?public=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.avis?.length) el.textContent = JSON.stringify(buildGraph(path, faq, d.avis));
      })
      .catch(() => {});
  }
}

// Réexport pour le script de build qui écrit le JSON-LD statique de l'accueil.
export { COMPANY };
