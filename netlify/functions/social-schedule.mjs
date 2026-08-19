import { sql } from "./_db.mjs";
import { getAdminFromRequest } from "./_adminAuth.mjs";

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    if (req.method === "GET") {
      const posts = await sql()`select * from scheduled_posts order by scheduled_for asc`;
      return Response.json({ posts });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { caption = "", imageUrl, videoUrl, networks = [], scheduledFor } = body;

      if (!Array.isArray(networks) || !networks.length) {
        return Response.json({ error: "aucun réseau sélectionné" }, { status: 400 });
      }
      const date = new Date(scheduledFor);
      if (!scheduledFor || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        return Response.json({ error: "date de programmation invalide (doit être future)" }, { status: 400 });
      }
      if ((networks.includes("facebook") || networks.includes("instagram")) && !imageUrl) {
        return Response.json({ error: "une image est requise pour Facebook/Instagram" }, { status: 400 });
      }
      if (networks.includes("tiktok") && !videoUrl) {
        return Response.json({ error: "une vidéo est requise pour TikTok" }, { status: 400 });
      }

      const [post] = await sql()`
        insert into scheduled_posts (networks, caption, image_url, video_url, scheduled_for)
        values (${JSON.stringify(networks)}, ${caption}, ${imageUrl || null}, ${videoUrl || null}, ${date})
        returning *
      `;
      return Response.json({ post });
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "id manquant" }, { status: 400 });
      await sql()`delete from scheduled_posts where id = ${id} and status = 'pending'`;
      return Response.json({ ok: true });
    }

    return Response.json({ error: "méthode non autorisée" }, { status: 405 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/social-schedule" };
