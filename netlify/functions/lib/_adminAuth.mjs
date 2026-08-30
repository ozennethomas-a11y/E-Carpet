import { getStore } from "@netlify/blobs";
import { sql } from "./_db.mjs";
import { randomToken, parseCookies } from "./_auth.mjs";

export const ADMIN_SESSION_COOKIE = "ecarpet_admin_session";
// Filet de sécurité côté serveur seulement : la session ne doit normalement
// jamais durer aussi longtemps côté client, voir le cookie "de session" ci-dessous.
const SESSION_DAYS = 7;

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

// Le cookie admin doit être Secure partout sauf en dev local (`netlify dev`
// sert en HTTP simple ; un cookie Secure n'y serait jamais posé).
function secureFlag() {
  return process.env.CONTEXT === "dev" ? "" : " Secure;";
}

// Cookie "de session" (pas de Max-Age) : demandé explicitement — rester
// déconnecté à chaque fermeture de l'app plutôt que rester connecté en
// silence. Le navigateur/l'app efface ce cookie en fermant complètement,
// donc rouvrir l'app redemande toujours une connexion (rapide via Face ID).
// L'expiration de 7 jours ci-dessus reste en base comme filet de sécurité,
// au cas où l'app resterait ouverte en arrière-plan sans jamais se fermer.
export function adminSessionCookieHeader(token, { clear = false } = {}) {
  const value = clear ? "" : token;
  const expiration = clear ? " Max-Age=0;" : "";
  return `${ADMIN_SESSION_COOKIE}=${value}; Path=/; HttpOnly;${secureFlag()} SameSite=Lax;${expiration}`;
}

export async function findAdminByName(name) {
  const [row] = await sql()`
    select id, name, password_hash as "passwordHash", totp_secret as "totpSecret", is_owner as "isOwner"
    from admins where lower(name) = lower(${name})
  `;
  return row || null;
}

export async function listAdmins() {
  return sql()`select id, name, is_owner as "isOwner", created_at as "createdAt" from admins order by created_at`;
}

export async function countAdmins() {
  const [{ count }] = await sql()`select count(*)::int as count from admins`;
  return count;
}

export async function createAdmin({ name, passwordHash, totpSecret, isOwner = false }) {
  const [row] = await sql()`
    insert into admins (name, password_hash, totp_secret, is_owner)
    values (${name}, ${passwordHash}, ${totpSecret}, ${isOwner})
    returning id, name, is_owner as "isOwner"
  `;
  return row;
}

export async function createAdminSession(adminId) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql()`insert into admin_sessions (admin_id, token, expires_at) values (${adminId}, ${token}, ${expiresAt})`;
  return token;
}

export async function recordLoginHistory(adminId, req) {
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || null;
  const userAgent = req.headers.get("user-agent") || null;
  await sql()`insert into admin_login_history (admin_id, ip, user_agent) values (${adminId}, ${ip}, ${userAgent})`;
}

// Contrat conservé identique ("ok" | "unauthorized" | "not_configured") pour
// ne pas toucher aux ~25 fonctions qui appellent déjà getAdminFromRequest —
// seul l'écran de connexion (admin-auth.mjs) a besoin de savoir QUI est
// connecté, via getAdminSessionFromRequest ci-dessous.
export async function getAdminFromRequest(req) {
  const { [ADMIN_SESSION_COOKIE]: token } = parseCookies(req);
  if (!token) return "unauthorized";
  const [row] = await sql()`select id from admin_sessions where token = ${token} and expires_at > now()`;
  return row ? "ok" : "unauthorized";
}

// Version complète, utilisée uniquement par admin-auth.mjs (écran de connexion,
// historique) : renvoie l'admin connecté (nom, propriétaire ou non) ou null.
export async function getAdminSessionFromRequest(req) {
  const { [ADMIN_SESSION_COOKIE]: token } = parseCookies(req);
  if (!token) return null;
  const [row] = await sql()`
    select a.id, a.name, a.is_owner as "isOwner"
    from admin_sessions s join admins a on a.id = s.admin_id
    where s.token = ${token} and s.expires_at > now()
  `;
  return row || null;
}

export async function destroyAdminSession(req) {
  const { [ADMIN_SESSION_COOKIE]: token } = parseCookies(req);
  if (token) await sql()`delete from admin_sessions where token = ${token}`;
}

// Blocage par compte (clé = nom en minuscule), sur une fenêtre glissante,
// pour qu'un mot de passe erroné sur un compte ne bloque pas les autres.
// Stocké dans Netlify Blobs : donnée éphémère, pas besoin de migration.
function attemptsKey(name) {
  return `login-attempts:${String(name || "").toLowerCase()}`;
}

export async function checkLoginLock(name) {
  const store = getStore("admin-auth");
  const data = await store.get(attemptsKey(name), { type: "json" }).catch(() => null);
  if (!data) return { locked: false };

  const elapsed = Date.now() - data.windowStart;
  if (elapsed > WINDOW_MS) return { locked: false };
  if (data.count < MAX_ATTEMPTS) return { locked: false };

  return { locked: true, retryAfterSeconds: Math.ceil((WINDOW_MS - elapsed) / 1000) };
}

// Écriture protégée par comparaison d'etag (comme dans avis.mjs) : sans ça,
// des échecs de connexion concurrents pourraient se lire mutuellement le même
// compteur de départ et n'en incrémenter qu'un seul au lieu de N, affaiblissant
// la limite de 5 tentatives sous forte concurrence.
export async function recordLoginFailure(name) {
  const store = getStore("admin-auth");
  const key = attemptsKey(name);

  for (let essai = 0; essai < 5; essai++) {
    const existant = await store.getWithMetadata(key, { type: "json" }).catch(() => null);
    const now = Date.now();
    const data = existant?.data;

    const next =
      data && now - data.windowStart <= WINDOW_MS
        ? { count: data.count + 1, windowStart: data.windowStart }
        : { count: 1, windowStart: now };

    try {
      const res = await store.setJSON(key, next, existant?.etag ? { onlyIfMatch: existant.etag } : { onlyIfNew: true });
      if (res?.modified !== false) return;
    } catch {
      // un autre échec concurrent vient d'écrire : on relit et on recommence
    }
  }
}

export async function resetLoginAttempts(name) {
  const store = getStore("admin-auth");
  await store.delete(attemptsKey(name)).catch(() => {});
}
