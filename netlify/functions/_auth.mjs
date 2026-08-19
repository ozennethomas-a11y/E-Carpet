import { sql } from "./_db.mjs";

export const SESSION_COOKIE = "ecarpet_session";
const SESSION_DAYS = 30;

export function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseCookies(req) {
  const header = req.headers.get("cookie") || "";
  return Object.fromEntries(
    header.split(";").map((p) => p.trim()).filter(Boolean).map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
    }),
  );
}

// Secure sauf en dev local (`netlify dev` sert en HTTP simple ; un cookie
// Secure n'y serait jamais posé).
function secureFlag() {
  return process.env.CONTEXT === "dev" ? "" : " Secure;";
}

export function sessionCookieHeader(token, { clear = false } = {}) {
  const maxAge = clear ? 0 : SESSION_DAYS * 24 * 60 * 60;
  const value = clear ? "" : token;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly;${secureFlag()} SameSite=Lax; Max-Age=${maxAge}`;
}

export async function createSession(customerId) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql()`insert into sessions (customer_id, token, expires_at) values (${customerId}, ${token}, ${expiresAt})`;
  return token;
}

export async function getCustomerFromRequest(req) {
  const { [SESSION_COOKIE]: token } = parseCookies(req);
  if (!token) return null;
  const [row] = await sql()`
    select c.id, c.email, c.first_name, c.last_name, c.phone
    from sessions s join customers c on c.id = s.customer_id
    where s.token = ${token} and s.expires_at > now()
  `;
  return row || null;
}
