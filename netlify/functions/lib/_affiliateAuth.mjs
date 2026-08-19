import { sql } from "./_db.mjs";
import { randomToken, parseCookies } from "./_auth.mjs";

export const AFFILIATE_SESSION_COOKIE = "ecarpet_affiliate_session";
const SESSION_DAYS = 30;

function secureFlag() {
  return process.env.CONTEXT === "dev" ? "" : " Secure;";
}

export function affiliateSessionCookieHeader(token, { clear = false } = {}) {
  const maxAge = clear ? 0 : SESSION_DAYS * 24 * 60 * 60;
  const value = clear ? "" : token;
  return `${AFFILIATE_SESSION_COOKIE}=${value}; Path=/; HttpOnly;${secureFlag()} SameSite=Lax; Max-Age=${maxAge}`;
}

export async function createAffiliateSession(affiliateId) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql()`insert into affiliate_sessions (affiliate_id, token, expires_at) values (${affiliateId}, ${token}, ${expiresAt})`;
  return token;
}

export async function getAffiliateFromRequest(req) {
  const { [AFFILIATE_SESSION_COOKIE]: token } = parseCookies(req);
  if (!token) return null;
  const [row] = await sql()`
    select a.id, a.email, a.name, a.status, a.commission_percent, a.promo_code_id, a.campaign_slug,
           a.stripe_account_id, a.stripe_payouts_enabled
    from affiliate_sessions s join affiliates a on a.id = s.affiliate_id
    where s.token = ${token} and s.expires_at > now()
  `;
  return row || null;
}
