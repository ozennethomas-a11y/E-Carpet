import { getStore } from "@netlify/blobs";
import { sql } from "./_db.mjs";
import { randomToken, parseCookies } from "./_auth.mjs";

export const ADMIN_SESSION_COOKIE = "ecarpet_admin_session";
const SESSION_DAYS = 7; // plus court qu'un compte client : accès sensible.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const ATTEMPTS_KEY = "login-attempts";

// Le cookie admin doit être Secure partout sauf en dev local (`netlify dev`
// sert en HTTP simple ; un cookie Secure n'y serait jamais posé).
function secureFlag() {
  return process.env.CONTEXT === "dev" ? "" : " Secure;";
}

export function adminSessionCookieHeader(token, { clear = false } = {}) {
  const maxAge = clear ? 0 : SESSION_DAYS * 24 * 60 * 60;
  const value = clear ? "" : token;
  return `${ADMIN_SESSION_COOKIE}=${value}; Path=/; HttpOnly;${secureFlag()} SameSite=Lax; Max-Age=${maxAge}`;
}

export async function createAdminSession() {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql()`insert into admin_sessions (token, expires_at) values (${token}, ${expiresAt})`;
  return token;
}

export async function getAdminFromRequest(req) {
  if (!process.env.DASHBOARD_PASSWORD || !process.env.ADMIN_TOTP_SECRET) return "not_configured";
  const { [ADMIN_SESSION_COOKIE]: token } = parseCookies(req);
  if (!token) return "unauthorized";
  const [row] = await sql()`select id from admin_sessions where token = ${token} and expires_at > now()`;
  return row ? "ok" : "unauthorized";
}

export async function destroyAdminSession(req) {
  const { [ADMIN_SESSION_COOKIE]: token } = parseCookies(req);
  if (token) await sql()`delete from admin_sessions where token = ${token}`;
}

// Blocage global (un seul compte admin) après plusieurs échecs, sur une
// fenêtre glissante. Stocké dans Netlify Blobs : donnée éphémère, pas besoin
// de migration ni de rétention longue.
export async function checkLoginLock() {
  const store = getStore("admin-auth");
  const data = await store.get(ATTEMPTS_KEY, { type: "json" }).catch(() => null);
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
export async function recordLoginFailure() {
  const store = getStore("admin-auth");

  for (let essai = 0; essai < 5; essai++) {
    const existant = await store.getWithMetadata(ATTEMPTS_KEY, { type: "json" }).catch(() => null);
    const now = Date.now();
    const data = existant?.data;

    const next =
      data && now - data.windowStart <= WINDOW_MS
        ? { count: data.count + 1, windowStart: data.windowStart }
        : { count: 1, windowStart: now };

    try {
      const res = await store.setJSON(ATTEMPTS_KEY, next, existant?.etag ? { onlyIfMatch: existant.etag } : { onlyIfNew: true });
      if (res?.modified !== false) return;
    } catch {
      // un autre échec concurrent vient d'écrire : on relit et on recommence
    }
  }
}

export async function resetLoginAttempts() {
  const store = getStore("admin-auth");
  await store.delete(ATTEMPTS_KEY).catch(() => {});
}
