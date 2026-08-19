import { getAdminFromRequest } from "./_adminAuth.mjs";
import { credentials, getAccessToken, mailsImportants } from "./_outlookMail.mjs";

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  const c = credentials();
  if (c.missing) return Response.json({ error: "missing_credentials", variables: c.missing }, { status: 200 });

  try {
    const token = await getAccessToken(c);
    const mails = await mailsImportants(token);
    return Response.json(
      { mails, urgents: mails.filter((m) => m.urgent).length },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/mail-alerts" };
