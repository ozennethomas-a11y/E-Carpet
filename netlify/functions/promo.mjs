import { sql } from "./_db.mjs";
import { getAdminFromRequest } from "./_adminAuth.mjs";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans caractères ambigus (0/O, 1/I)

function randomCode(len = 8) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function statusOf(c) {
  if (!c.active) return "desactive";
  if (c.expires_at && new Date(c.expires_at) <= new Date()) return "expire";
  if (c.max_uses != null && c.used_count >= c.max_uses) return "epuise";
  return "actif";
}

function toJson(c) {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: c.value,
    maxUses: c.max_uses,
    usedCount: c.used_count,
    expiresAt: c.expires_at,
    active: c.active,
    source: c.source,
    createdAt: c.created_at,
    status: statusOf(c),
  };
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    if (req.method === "GET") {
      const rows = await sql()`select * from promo_codes order by id desc`;
      return Response.json({ codes: rows.map(toJson) });
    }

    if (req.method === "POST") {
      const body = await req.json();

      if (body.action === "create") {
        const type = body.type === "fixed" ? "fixed" : "percent";
        const value = Math.round(Number(body.value));
        if (!Number.isFinite(value) || value <= 0) {
          return Response.json({ error: "valeur invalide" }, { status: 400 });
        }
        if (type === "percent" && value > 100) {
          return Response.json({ error: "un pourcentage ne peut pas dépasser 100" }, { status: 400 });
        }

        const maxUses = body.maxUses == null ? null : Math.max(1, parseInt(body.maxUses, 10));
        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
        if (expiresAt && Number.isNaN(expiresAt.getTime())) {
          return Response.json({ error: "date invalide" }, { status: 400 });
        }

        let code = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!code) code = randomCode();

        try {
          const [row] = await sql()`
            insert into promo_codes (code, type, value, max_uses, expires_at)
            values (${code}, ${type}, ${value}, ${maxUses}, ${expiresAt})
            returning *
          `;
          return Response.json({ ok: true, code: toJson(row) });
        } catch (e) {
          if (String(e.message || e).toLowerCase().includes("unique")) {
            return Response.json({ error: "ce code existe déjà" }, { status: 400 });
          }
          throw e;
        }
      }

      if (body.action === "toggle") {
        if (!body.id) return Response.json({ error: "id manquant" }, { status: 400 });
        await sql()`update promo_codes set active = ${!!body.active} where id = ${body.id}`;
        return Response.json({ ok: true });
      }

      return Response.json({ error: "action inconnue" }, { status: 400 });
    }

    return Response.json({ error: "méthode non supportée" }, { status: 405 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/promo" };
