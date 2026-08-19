import {
  adminSessionCookieHeader,
  createAdminSession,
  getAdminFromRequest,
  destroyAdminSession,
  checkLoginLock,
  recordLoginFailure,
  resetLoginAttempts,
} from "./lib/_adminAuth.mjs";
import { verifyTotp } from "./lib/_totp.mjs";
import { constantTimeEqual } from "./lib/_crypto.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const expectedPassword = process.env.DASHBOARD_PASSWORD;
  const totpSecret = process.env.ADMIN_TOTP_SECRET;
  if (!expectedPassword || !totpSecret) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  if (req.method === "POST" && action === "login") {
    const lock = await checkLoginLock();
    if (lock.locked) {
      return Response.json(
        { error: `trop de tentatives, réessayez dans ${Math.ceil(lock.retryAfterSeconds / 60)} min` },
        { status: 429 },
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "requête invalide" }, { status: 400 });
    }

    if (!(await constantTimeEqual(body.password || "", expectedPassword))) {
      await recordLoginFailure();
      return Response.json({ error: "mot de passe incorrect" }, { status: 401 });
    }

    const validTotp = await verifyTotp(totpSecret, body.totp);
    if (!validTotp) {
      await recordLoginFailure();
      return Response.json({ error: "code de vérification incorrect" }, { status: 401 });
    }

    await resetLoginAttempts();
    const token = await createAdminSession();
    return Response.json({ ok: true }, { headers: { "Set-Cookie": adminSessionCookieHeader(token) } });
  }

  if (req.method === "POST" && action === "logout") {
    await destroyAdminSession(req);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": adminSessionCookieHeader(null, { clear: true }) } });
  }

  if (req.method === "GET" && action === "me") {
    const auth = await getAdminFromRequest(req);
    return Response.json({ connecte: auth === "ok" });
  }

  return Response.json({ error: "action inconnue" }, { status: 400 });
};

export const config = { path: "/api/admin-auth" };
