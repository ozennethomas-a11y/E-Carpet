import { sql } from "./_db.mjs";
import { decryptToken, encryptToken } from "./_socialCrypto.mjs";

const META_API = "https://graph.facebook.com/v19.0";

async function compteConnecte(network) {
  const [row] = await sql()`select account_id, access_token_enc, refresh_token_enc, expires_at, meta from social_accounts where network = ${network}`;
  if (!row) return null;
  return {
    accountId: row.account_id,
    accessToken: await decryptToken(row.access_token_enc),
    refreshToken: row.refresh_token_enc ? await decryptToken(row.refresh_token_enc) : null,
    expiresAt: row.expires_at,
    meta: row.meta,
  };
}

// Le jeton d'accès TikTok expire au bout de ~24h (contrairement aux jetons de
// Page Meta, qui n'expirent pratiquement jamais) : on le renouvelle ici avant
// chaque usage plutôt que d'obliger une reconnexion manuelle régulière.
async function compteTiktokFrais() {
  const compte = await compteConnecte("tiktok");
  if (!compte) return null;
  if (!compte.refreshToken) return compte;

  const bientotExpire = !compte.expiresAt || new Date(compte.expiresAt).getTime() - Date.now() < 5 * 60 * 1000;
  if (!bientotExpire) return compte;

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) return compte; // pas de credentials : on tente avec le jeton existant

  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "cache-control": "no-cache" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: compte.refreshToken,
    }),
  }).then((r) => r.json());

  if (tokenRes.error || !tokenRes.access_token) return compte; // échec : on retente avec l'ancien jeton, publierTiktok remontera l'erreur si besoin

  const accessTokenEnc = await encryptToken(tokenRes.access_token);
  const refreshTokenEnc = await encryptToken(tokenRes.refresh_token || compte.refreshToken);
  const expiresAt = tokenRes.expires_in ? new Date(Date.now() + tokenRes.expires_in * 1000) : null;
  await sql()`
    update social_accounts
    set access_token_enc = ${accessTokenEnc}, refresh_token_enc = ${refreshTokenEnc}, expires_at = ${expiresAt}
    where network = 'tiktok'
  `;

  return { ...compte, accessToken: tokenRes.access_token, refreshToken: tokenRes.refresh_token || compte.refreshToken, expiresAt };
}

async function publierFacebook({ caption, imageUrl }) {
  const compte = await compteConnecte("facebook");
  if (!compte) return { network: "facebook", ok: false, error: "compte non connecté" };

  const res = await fetch(`${META_API}/${compte.accountId}/photos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: imageUrl, caption, access_token: compte.accessToken }),
  }).then((r) => r.json());

  if (res.error) return { network: "facebook", ok: false, error: res.error.message };
  return { network: "facebook", ok: true, postId: res.post_id || res.id };
}

async function publierInstagram({ caption, imageUrl }) {
  const compte = await compteConnecte("instagram");
  if (!compte) return { network: "instagram", ok: false, error: "compte non connecté" };

  const creation = await fetch(`${META_API}/${compte.accountId}/media`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: compte.accessToken }),
  }).then((r) => r.json());
  if (creation.error) return { network: "instagram", ok: false, error: creation.error.message };

  const publish = await fetch(`${META_API}/${compte.accountId}/media_publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ creation_id: creation.id, access_token: compte.accessToken }),
  }).then((r) => r.json());
  if (publish.error) return { network: "instagram", ok: false, error: publish.error.message };

  return { network: "instagram", ok: true, postId: publish.id };
}

// TikTok ne publie que des vidéos, et uniquement en tant que brouillon tant
// que l'app n'est pas passée par la revue TikTok (App Review) — la vidéo
// arrive dans l'app TikTok du compte connecté, à valider manuellement avant
// publication réelle.
async function publierTiktok({ caption, videoUrl }) {
  const compte = await compteTiktokFrais();
  if (!compte) return { network: "tiktok", ok: false, error: "compte non connecté" };
  if (!videoUrl) return { network: "tiktok", ok: false, error: "une vidéo est requise pour TikTok" };

  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
    method: "POST",
    headers: { authorization: `Bearer ${compte.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ source_info: { source: "PULL_FROM_URL", video_url: videoUrl } }),
  }).then((r) => r.json());

  if (res.error && res.error.code !== "ok") return { network: "tiktok", ok: false, error: res.error.message || res.error.code };
  return { network: "tiktok", ok: true, publishId: res.data?.publish_id, note: "envoyée en brouillon dans l'app TikTok, à valider manuellement" };
}

// Point d'entrée partagé entre l'endpoint admin (social-publish.mjs, publication
// immédiate) et le cron (cron-social-publish.mjs, publication programmée).
export async function publierSurReseaux({ caption = "", imageUrl, videoUrl, networks = [] }) {
  const demandes = new Set(networks);
  const resultats = [];

  if (demandes.has("facebook")) {
    if (!imageUrl) resultats.push({ network: "facebook", ok: false, error: "une image est requise" });
    else resultats.push(await publierFacebook({ caption, imageUrl }));
  }
  if (demandes.has("instagram")) {
    if (!imageUrl) resultats.push({ network: "instagram", ok: false, error: "une image est requise" });
    else resultats.push(await publierInstagram({ caption, imageUrl }));
  }
  if (demandes.has("tiktok")) {
    resultats.push(await publierTiktok({ caption, videoUrl }));
  }

  return resultats;
}
