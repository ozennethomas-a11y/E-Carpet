import { getStore } from "@netlify/blobs";
import { sql } from "./lib/_db.mjs";
import { randomToken } from "./lib/_auth.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { encryptToken } from "./lib/_socialCrypto.mjs";

const META_API = "https://graph.facebook.com/v19.0";
// video.publish n'est pas disponible sans passer par la revue TikTok ; video.upload
// (publication en brouillon, à valider manuellement dans l'app TikTok) suffit pour l'instant.
const TIKTOK_SCOPES = ["user.info.basic", "video.upload"].join(",");
const STATE_TTL_MS = 10 * 60 * 1000;

function siteOrigin(req) {
  const fromEnv = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return new URL(req.url).origin;
}

// État CSRF à usage unique par flux OAuth : évite qu'un attaquant ne fasse
// approuver sa propre autorisation via un callback forgé. `extra` permet d'y
// glisser d'autres données à retrouver au callback (ex. le code_verifier PKCE).
async function creerState(network, extra) {
  const store = getStore("social-auth");
  const state = randomToken();
  await store.setJSON(`state:${network}`, { state, expiresAt: Date.now() + STATE_TTL_MS, ...extra });
  return state;
}

async function verifierEtConsommerState(network, state) {
  const store = getStore("social-auth");
  const key = `state:${network}`;
  const saved = await store.get(key, { type: "json" }).catch(() => null);
  await store.delete(key).catch(() => {});
  if (!saved || !state || saved.state !== state || Date.now() > saved.expiresAt) return null;
  return saved;
}

// PKCE (obligatoire pour l'autorisation TikTok v2) : le code_verifier ne
// transite jamais dans l'URL, seul son empreinte (code_challenge) y figure.
function base64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function genererPkce() {
  const codeVerifier = randomToken();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier)));
  return { codeVerifier, codeChallenge: base64url(digest) };
}

async function upsertAccount({ network, accountId, accountName, accessToken, refreshToken, expiresAt, meta }) {
  const accessTokenEnc = await encryptToken(accessToken);
  const refreshTokenEnc = refreshToken ? await encryptToken(refreshToken) : null;
  await sql()`
    insert into social_accounts (network, account_id, account_name, access_token_enc, refresh_token_enc, expires_at, meta, connected_at)
    values (${network}, ${accountId}, ${accountName}, ${accessTokenEnc}, ${refreshTokenEnc}, ${expiresAt || null}, ${meta ? JSON.stringify(meta) : null}::jsonb, now())
    on conflict (network) do update set
      account_id = excluded.account_id,
      account_name = excluded.account_name,
      access_token_enc = excluded.access_token_enc,
      refresh_token_enc = excluded.refresh_token_enc,
      expires_at = excluded.expires_at,
      meta = excluded.meta,
      connected_at = now()
  `;
}

async function metaStart(req, origin) {
  const appId = process.env.META_APP_ID;
  const configId = process.env.META_CONFIG_ID;
  if (!appId || !configId) return Response.json({ error: "META_APP_ID / META_CONFIG_ID manquant côté serveur" }, { status: 200 });
  const state = await creerState("meta");
  // "Facebook Login for Business" (nécessaire pour les permissions Pages/Instagram)
  // s'autorise via un config_id représentant un jeu de permissions préconfiguré,
  // pas via un paramètre scope classique.
  const p = new URLSearchParams({
    client_id: appId,
    redirect_uri: `${origin}/api/social-auth?action=meta-callback`,
    config_id: configId,
    response_type: "code",
    state,
  });
  return Response.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${p.toString()}`, 302);
}

async function metaCallback(req, origin) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return Response.json({ error: "META_APP_ID / META_APP_SECRET manquant côté serveur" }, { status: 200 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const erreurMeta = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (erreurMeta) return Response.redirect(`${origin}/admin?social_erreur=${encodeURIComponent(erreurMeta)}`, 302);
  if (!code || !(await verifierEtConsommerState("meta", state))) {
    return Response.redirect(`${origin}/admin?social_erreur=${encodeURIComponent("lien de connexion invalide ou expiré")}`, 302);
  }

  const redirectUri = `${origin}/api/social-auth?action=meta-callback`;

  const shortLived = await fetch(
    `${META_API}/oauth/access_token?${new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, client_secret: appSecret, code })}`,
  ).then((r) => r.json());
  if (shortLived.error) return Response.redirect(`${origin}/admin?social_erreur=${encodeURIComponent(shortLived.error.message)}`, 302);

  const longLived = await fetch(
    `${META_API}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLived.access_token,
    })}`,
  ).then((r) => r.json());
  if (longLived.error) return Response.redirect(`${origin}/admin?social_erreur=${encodeURIComponent(longLived.error.message)}`, 302);

  const pagesRes = await fetch(`${META_API}/me/accounts?fields=id,name,access_token&access_token=${longLived.access_token}`).then((r) =>
    r.json(),
  );
  if (pagesRes.error) return Response.redirect(`${origin}/admin?social_erreur=${encodeURIComponent(pagesRes.error.message)}`, 302);

  const pages = pagesRes.data || [];
  if (!pages.length) {
    return Response.redirect(
      `${origin}/admin?social_erreur=${encodeURIComponent("aucune Page Facebook trouvée sur ce compte")}`,
      302,
    );
  }

  // Une seule Page gérée pour l'instant (le compte E-Carpet) : on prend la
  // première, avec la liste complète en réserve dans `meta` pour permettre un
  // sélecteur plus tard si plusieurs Pages existent.
  const page = pages[0];

  await upsertAccount({
    network: "facebook",
    accountId: page.id,
    accountName: page.name,
    accessToken: page.access_token,
    expiresAt: null, // les jetons de Page issus d'un jeton utilisateur longue durée n'expirent pas
    meta: { pagesDisponibles: pages.map((p) => ({ id: p.id, name: p.name })) },
  });

  const igRes = await fetch(
    `${META_API}/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`,
  ).then((r) => r.json());
  const ig = igRes.instagram_business_account;

  if (ig) {
    await upsertAccount({
      network: "instagram",
      accountId: ig.id,
      accountName: ig.username,
      accessToken: page.access_token, // la publication IG passe par le jeton de la Page liée
      expiresAt: null,
      meta: { pageId: page.id },
    });
  }

  return Response.redirect(`${origin}/admin?social_connecte=${ig ? "facebook,instagram" : "facebook"}`, 302);
}

// TikTok refuse tout paramètre de requête dans l'URI de redirection enregistrée
// (contrairement à Meta) — on utilise donc un chemin dédié sans "?action=...".
// TikTok y ajoute lui-même ?code=...&state=... au retour.
const TIKTOK_REDIRECT_PATH = "/api/social-auth-tiktok-callback";

async function tiktokStart(req, origin) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) return Response.json({ error: "TIKTOK_CLIENT_KEY manquant côté serveur" }, { status: 200 });
  const { codeVerifier, codeChallenge } = await genererPkce();
  const state = await creerState("tiktok", { codeVerifier });
  const p = new URLSearchParams({
    client_key: clientKey,
    redirect_uri: `${origin}${TIKTOK_REDIRECT_PATH}`,
    scope: TIKTOK_SCOPES,
    response_type: "code",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return Response.redirect(`https://www.tiktok.com/v2/auth/authorize/?${p.toString()}`, 302);
}

async function tiktokCallback(req, origin) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret)
    return Response.json({ error: "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET manquant côté serveur" }, { status: 200 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const erreurTiktok = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (erreurTiktok) return Response.redirect(`${origin}/admin?social_erreur=${encodeURIComponent(erreurTiktok)}`, 302);
  const savedState = code ? await verifierEtConsommerState("tiktok", state) : null;
  if (!savedState) {
    return Response.redirect(`${origin}/admin?social_erreur=${encodeURIComponent("lien de connexion invalide ou expiré")}`, 302);
  }

  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "cache-control": "no-cache" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${origin}${TIKTOK_REDIRECT_PATH}`,
      code_verifier: savedState.codeVerifier,
    }),
  }).then((r) => r.json());

  if (tokenRes.error) return Response.redirect(`${origin}/admin?social_erreur=${encodeURIComponent(tokenRes.error_description || tokenRes.error)}`, 302);

  const infoRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name", {
    headers: { authorization: `Bearer ${tokenRes.access_token}` },
  }).then((r) => r.json());
  const displayName = infoRes.data?.user?.display_name || tokenRes.open_id;

  await upsertAccount({
    network: "tiktok",
    accountId: tokenRes.open_id,
    accountName: displayName,
    accessToken: tokenRes.access_token,
    refreshToken: tokenRes.refresh_token,
    expiresAt: tokenRes.expires_in ? new Date(Date.now() + tokenRes.expires_in * 1000) : null,
  });

  return Response.redirect(`${origin}/admin?social_connecte=tiktok`, 302);
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const origin = siteOrigin(req);

  try {
    if (req.method === "GET" && url.pathname === TIKTOK_REDIRECT_PATH) return tiktokCallback(req, origin);

    if (req.method === "GET" && action === "status") {
      const rows = await sql()`select network, account_id, account_name, expires_at, connected_at from social_accounts order by network`;
      return Response.json({
        accounts: rows.map((r) => ({
          network: r.network,
          accountId: r.account_id,
          accountName: r.account_name,
          expiresAt: r.expires_at,
          connectedAt: r.connected_at,
        })),
      });
    }

    if (req.method === "GET" && action === "meta-start") return metaStart(req, origin);
    if (req.method === "GET" && action === "meta-callback") return metaCallback(req, origin);
    if (req.method === "GET" && action === "tiktok-start") return tiktokStart(req, origin);
    if (req.method === "GET" && action === "tiktok-callback") return tiktokCallback(req, origin);

    if (req.method === "POST" && action === "disconnect") {
      const body = await req.json().catch(() => ({}));
      const network = body.network;
      if (!["instagram", "facebook", "tiktok"].includes(network)) {
        return Response.json({ error: "réseau inconnu" }, { status: 400 });
      }
      await sql()`delete from social_accounts where network = ${network}`;
      return Response.json({ ok: true });
    }

    return Response.json({ error: "action inconnue" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: ["/api/social-auth", "/api/social-auth-tiktok-callback"] };
