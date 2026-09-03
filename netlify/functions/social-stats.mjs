// Statistiques de base par réseau (abonnés + dernières publications), pour
// l'onglet "Général" de Réseaux sociaux. Lecture seule, jamais de
// publication depuis ce fichier.
import { sql } from "./lib/_db.mjs";
import { decryptToken } from "./lib/_socialCrypto.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";

const META_API = "https://graph.facebook.com/v19.0";

async function compteConnecte(network) {
  const [row] = await sql()`select account_id, access_token_enc, meta from social_accounts where network = ${network}`;
  if (!row) return null;
  return { accountId: row.account_id, accessToken: await decryptToken(row.access_token_enc), meta: row.meta };
}

async function statsFacebook() {
  const compte = await compteConnecte("facebook");
  if (!compte) return { connecte: false };

  // Champs Page Facebook disponibles via Graph API (les plus utiles pour un
  // suivi rapide) : abonnés, catégorie, description, lien, avatar. D'autres
  // existent (ratings, hours...) mais ne s'appliquent pas à une marque en
  // ligne.
  const profil = await fetch(
    `${META_API}/${compte.accountId}?fields=fan_count,followers_count,name,category,about,link,picture{url}&access_token=${compte.accessToken}`,
  ).then((r) => r.json());
  if (profil.error) return { connecte: true, erreur: profil.error.message };

  const postsRes = await fetch(
    `${META_API}/${compte.accountId}/posts?fields=message,created_time,permalink_url,likes.summary(true),comments.summary(true),shares&limit=5&access_token=${compte.accessToken}`,
  ).then((r) => r.json());
  const posts = postsRes.error
    ? []
    : (postsRes.data || []).map((p) => ({
        message: p.message ? p.message.slice(0, 140) : "(sans texte)",
        date: p.created_time,
        url: p.permalink_url,
        likes: p.likes?.summary?.total_count ?? 0,
        commentaires: p.comments?.summary?.total_count ?? 0,
        partages: p.shares?.count ?? 0,
      }));

  return {
    connecte: true,
    abonnes: profil.followers_count ?? profil.fan_count ?? null,
    mentionsJaime: profil.fan_count ?? null,
    categorie: profil.category || null,
    description: profil.about || null,
    lien: profil.link || null,
    avatar: profil.picture?.data?.url || null,
    postsErreur: postsRes.error?.message || null,
    derniersPosts: posts,
  };
}

async function statsInstagram() {
  const compte = await compteConnecte("instagram");
  if (!compte) return { connecte: false };

  const profil = await fetch(
    `${META_API}/${compte.accountId}?fields=followers_count,media_count,username&access_token=${compte.accessToken}`,
  ).then((r) => r.json());
  if (profil.error) return { connecte: true, erreur: profil.error.message };

  const mediaRes = await fetch(
    `${META_API}/${compte.accountId}/media?fields=caption,timestamp,permalink,like_count,comments_count,media_type&limit=5&access_token=${compte.accessToken}`,
  ).then((r) => r.json());
  const posts = mediaRes.error
    ? []
    : (mediaRes.data || []).map((m) => ({
        message: m.caption ? m.caption.slice(0, 140) : "(sans légende)",
        date: m.timestamp,
        url: m.permalink,
        likes: m.like_count ?? 0,
        commentaires: m.comments_count ?? 0,
        type: m.media_type,
      }));

  return {
    connecte: true,
    abonnes: profil.followers_count ?? null,
    postsErreur: mediaRes.error?.message || null,
    derniersPosts: posts,
  };
}

async function statsTiktok() {
  const compte = await compteConnecte("tiktok");
  if (!compte) return { connecte: false };
  // Les statistiques (abonnés, vues, likes) exigent les scopes TikTok
  // "user.info.stats" et "video.list", non demandés aujourd'hui (seuls
  // user.info.basic + video.upload le sont) — reconnexion nécessaire pour
  // les activer. Pas de valeur inventée en attendant.
  return { connecte: true, statsIndisponibles: true, raison: "Scopes TikTok supplémentaires requis (user.info.stats, video.list) — à reconnecter." };
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    const [facebook, instagram, tiktok] = await Promise.all([statsFacebook(), statsInstagram(), statsTiktok()]);
    return Response.json({ facebook, instagram, tiktok });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/social-stats" };
