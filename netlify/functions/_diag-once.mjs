import { sql } from "./lib/_db.mjs";

// Fonction temporaire, ponctuelle : diagnostic + réinitialisation des clés
// Face ID en production suite à un signalement "unauthorized" à la
// connexion Face ID. À supprimer juste après usage.
const SECRET = "f3c718a04e2b95dd6a1c08fb35e7291d";

export default async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (url.searchParams.get("reset") === "1") {
    const admins = await sql()`select id, name from admins where is_owner = true`;
    const deleted = [];
    for (const a of admins) {
      const rows = await sql()`delete from webauthn_credentials where admin_id = ${a.id} returning id`;
      deleted.push({ admin: a.name, supprime: rows.length });
    }
    return Response.json({ ok: true, deleted });
  }

  const admins = await sql()`select id, name, is_owner as "isOwner" from admins`;
  const credentials = await sql()`
    select c.id, c.admin_id as "adminId", a.name, c.device_name as "deviceName", c.created_at as "createdAt"
    from webauthn_credentials c join admins a on a.id = c.admin_id order by c.created_at
  `;
  const loginAlertTable = await sql()`select to_regclass('login_alert_devices') as t`;
  return Response.json({ admins, credentials, loginAlertTableExists: !!loginAlertTable[0].t });
};

export const config = { path: "/api/_diag-once" };
