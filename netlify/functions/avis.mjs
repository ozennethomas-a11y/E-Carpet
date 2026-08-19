import { getStore } from "@netlify/blobs";
import { sql } from "./_db.mjs";
import { sendEmail, reviewPhotoRewardEmail, emailConfigured } from "./_email.mjs";
import { getAdminFromRequest } from "./_adminAuth.mjs";
import { checkAndRecord } from "./_rateLimit.mjs";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans caractères ambigus

function randomCode(len = 8) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

// Récompense pour un avis déposé avec photo : 10% à usage unique, sans
// expiration. Généré même si l'email de notification échoue ensuite (le
// code reste valide et visible dans l'admin), pour ne jamais faire perdre
// une récompense méritée à cause d'un souci d'envoi.
async function creerCodeRecompensePhoto() {
  for (let essai = 0; essai < 5; essai++) {
    const code = randomCode();
    try {
      await sql()`insert into promo_codes (code, type, value, max_uses, source) values (${code}, 'percent', 10, 1, 'avis_photo')`;
      return code;
    } catch (e) {
      if (!String(e.message || e).toLowerCase().includes("unique")) throw e;
    }
  }
  throw new Error("impossible de générer un code unique");
}

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
      // Attention : une écriture conditionnelle refusée ne lève pas d'erreur,
      // elle renvoie { modified: false }. Sans ce test, la modification est
      // perdue en silence et l'appelant croit avoir réussi.
      const res = await store.setJSON(
        KEY,
        suivant,
        existant?.etag ? { onlyIfMatch: existant.etag } : { onlyIfNew: true },
      );
      if (res?.modified !== false) return suivant;
    } catch {
      // Un autre envoi est passé entre-temps : on relit et on recommence.
    }
  }

  // Dernier recours : en environnement local, les etags peuvent être absents et
  // toutes les tentatives conditionnelles échouer. Mieux vaut une écriture sans
  // condition que perdre l'avis d'un visiteur.
  const etat = await read(store);
  const suivant = muter(etat);
  await store.setJSON(KEY, suivant);
  return suivant;
}

export default async (req, context) => {
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
  // On distingue un dépôt public d'une action de modération admin via la
  // présence d'une session admin valide (cookie), plus via un header de
  // mot de passe qui n'existe plus depuis le passage à l'authentification
  // par cookie + TOTP.
  const isAdmin = (await getAdminFromRequest(req)) === "ok";
  if (req.method === "POST" && !isAdmin) {
    const limite = await checkAndRecord("avis-submit", req, context, { max: 5, windowMs: 60 * 60 * 1000 });
    if (limite.limited) return Response.json({ error: "trop d'avis envoyés, réessayez plus tard" }, { status: 429 });

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

    const email = clean(body.email, 200);
    const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    // Data URL uniquement, taille bornée (le base64 gonfle ~33% : 4 Mo de photo
    // source -> ~5,5 Mo de texte), pour ne pas laisser n'importe quel binaire
    // atterrir dans le blob de modération.
    const photoValide =
      typeof body.photo === "string" &&
      /^data:image\/(png|jpe?g|webp|gif);base64,/.test(body.photo) &&
      body.photo.length < 6_000_000;
    const photo = photoValide ? body.photo : null;

    let codePromo = null;
    if (photo && emailValide) {
      try {
        codePromo = await creerCodeRecompensePhoto();
      } catch (e) {
        console.error("[avis] échec génération code récompense:", e.message);
      }
    }

    const avis = {
      id: `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      city: clean(body.city, 60),
      scooter: clean(body.scooter, 60),
      rating: Math.min(5, Math.max(1, parseInt(body.rating, 10) || 5)),
      text,
      email: emailValide ? email : "",
      photo,
      codePromo,
      date: new Date().toISOString().slice(0, 10),
      statut: "en_attente",
    };

    await write(store, (etat) => ({ ...etat, avis: [avis, ...etat.avis].slice(0, 500) }));

    if (codePromo && emailConfigured()) {
      const { subject, html } = reviewPhotoRewardEmail({ code: codePromo });
      await sendEmail({ to: email, subject, html }).catch((e) =>
        console.error("[avis] échec envoi email récompense:", e.message),
      );
    }

    return Response.json({ ok: true });
  }

  // --- Tout le reste demande une session admin valide.
  if (!isAdmin) {
    const auth = await getAdminFromRequest(req);
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
