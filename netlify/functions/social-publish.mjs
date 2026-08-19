import { getAdminFromRequest } from "./_adminAuth.mjs";
import { publierSurReseaux } from "./_socialPublish.mjs";

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });
  if (req.method !== "POST") return Response.json({ error: "méthode non autorisée" }, { status: 405 });

  try {
    const body = await req.json().catch(() => ({}));
    const { caption = "", imageUrl, videoUrl, networks = [] } = body;
    if (!networks.length) return Response.json({ error: "aucun réseau sélectionné" }, { status: 400 });

    const resultats = await publierSurReseaux({ caption, imageUrl, videoUrl, networks });
    return Response.json({ resultats });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/social-publish" };
