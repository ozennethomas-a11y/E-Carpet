import { getStore } from "@netlify/blobs";

// Modération des avis.
//
// Deux populations distinctes, volontairement :
//  - Les avis « maison » écrits dans src/i18n/translations.js. Ils restent la
//    source de vérité du site et sont traduits dans les quatre langues. On ne
//    peut pas les supprimer d'ici, seulement les mettre en veille.
//  - Les avis envoyés par les visiteurs. Ils arrivent en attente et ne
//    s'affichent qu'après validation explicite depuis le back-office.
//
// Rien n'est publié automatiquement : c'est tout l'intérêt de la pré-autorisation.

const KEY = "moderation";
const STATUTS = ["en_attente", "en_ligne", "en_veille", "refuse"];

function authorised(req) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return "not_configured";
  return (req.headers.get("x-dashboard-password") || "") === expected ? "ok" : "unauthorized";
}

async function read(store) {
  const data = await store.get(KEY, { type: "json" }).catch(() => null);
  return {
    // Identifiants des avis maison mis en veille (« base-0 » à « base-4 »).
    masques: Array.isArray(data?.masques) ? data.masques : [],
    avis: Array.isArray(data?.avis) ? data.avis : [],
  };
}

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

/** Écriture protégée contre les envois simultanés, comme pour les statistiques. */
async function write(store, muter) {
  for (let essai = 0; essai < 5; essai++) {
    const existant = await store.getWithMetadata(KEY, { type: "json" }).catch(() => null);
    const etat = {
      masques: Array.isArray(existant?.data?.masques) ? existant.data.masques : [],
      avis: Array.isArray(existant?.data?.avis) ? existant.data.avis : [],
    };
    const suivant = muter(etat);
    try {
      await store.setJSON(KEY, suivant, existant?.etag ? { onlyIfMatch: existant.etag } : { onlyIfNew: true });
      return suivant;
    } catch {
      // Un autre envoi est passé entre-temps : on relit et on recommence.
    }
  }
  throw new Error("écriture impossible, réessayez");
}

export default async (req) => {
  const store = getStore("analytics");
  const url = new URL(req.url);

  // --- Public : les avis visibles sur le site. Aucune donnée privée exposée.
  if (req.method === "GET" && url.searchParams.get("public")) {
    const etat = await read(store);
    return Response.json(
      {
        masques: etat.masques,
        avis: etat.avis
          .filter((a) => a.statut === "en_ligne")
          .map(({ name, city, scooter, rating, text, date }) => ({ name, city, scooter, rating, text, date })),
      },
      { headers: { "cache-control": "public, max-age=300" } },
    );
  }

  // --- Public : dépôt d'un avis. Il arrive en attente, jamais en ligne.
  if (req.method === "POST" && !req.headers.get("x-dashboard-password")) {
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "requête illisible" }, { status: 400 });
    }
    if (body.botField) return Response.json({ ok: true }); // piège à robots

    const text = clean(body.text ?? body.message, 1200);
    const name = clean(body.name, 60);
    if (!name || text.length < 10) {
      return Response.json({ error: "nom ou message manquant" }, { status: 400 });
    }

    const avis = {
      id: `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      city: clean(body.city, 60),
      scooter: clean(body.scooter, 60),
      rating: Math.min(5, Math.max(1, parseInt(body.rating, 10) || 5)),
      text,
      date: new Date().toISOString().slice(0, 10),
      statut: "en_attente",
    };

    await write(store, (etat) => ({ ...etat, avis: [avis, ...etat.avis].slice(0, 500) }));
    return Response.json({ ok: true });
  }

  // --- Tout le reste demande le mot de passe.
  const auth = authorised(req);
  if (auth !== "ok") {
    return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });
  }

  if (req.method === "GET") {
    const etat = await read(store);
    return Response.json(
      {
        masques: etat.masques,
        avis: etat.avis,
        enAttente: etat.avis.filter((a) => a.statut === "en_attente").length,
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  if (req.method === "POST") {
    const { id, statut } = await req.json().catch(() => ({}));
    if (!id || !STATUTS.includes(statut)) {
      return Response.json({ error: "identifiant ou statut invalide" }, { status: 400 });
    }

    // Les avis maison ne sont pas stockés ici : on ne mémorise que leur mise en veille.
    if (id.startsWith("base-")) {
      const etat = await write(store, (e) => ({
        ...e,
        masques:
          statut === "en_veille"
            ? [...new Set([...e.masques, id])]
            : e.masques.filter((m) => m !== id),
      }));
      return Response.json({ ok: true, masques: etat.masques });
    }

    const etat = await write(store, (e) => ({
      ...e,
      avis: e.avis.map((a) => (a.id === id ? { ...a, statut } : a)),
    }));
    return Response.json({ ok: true, avis: etat.avis });
  }

  return Response.json({ error: "méthode non gérée" }, { status: 405 });
};

export const config = { path: "/api/avis" };
