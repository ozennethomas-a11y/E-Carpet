import { getStore } from "@netlify/blobs";
import { getAdminFromRequest } from "./_adminAuth.mjs";

// Hébergement temporaire des images/vidéos à publier sur les réseaux sociaux.
// Instagram et TikTok exigent une URL HTTPS publique (pas un envoi direct de
// fichier), donc on stocke l'octet brut dans Netlify Blobs et on le ressert
// ici sans authentification — c'est nécessaire pour que Meta/TikTok puissent
// le récupérer, mais ça veut dire que l'ID doit rester imprévisible (token
// aléatoire, jamais un numéro séquentiel).
const MAX_BYTES = 60 * 1024 * 1024; // 60 Mo, large pour une vidéo courte
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/quicktime"];

function siteOrigin(req) {
  const fromEnv = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return new URL(req.url).origin;
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([\w./+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) return null;
  const [, contentType, b64] = match;
  if (!ALLOWED_TYPES.includes(contentType)) return null;
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (bytes.length > MAX_BYTES) return null;
  return { contentType, bytes };
}

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const store = getStore("social-media");

  try {
    // Servir un fichier : volontairement public, voir note ci-dessus.
    if (req.method === "GET" && id) {
      const result = await store.getWithMetadata(id, { type: "arrayBuffer" });
      if (!result) return new Response("introuvable", { status: 404 });
      return new Response(result.data, {
        headers: { "content-type": result.metadata?.contentType || "application/octet-stream", "cache-control": "public, max-age=3600" },
      });
    }

    // Tout le reste (upload) exige la session admin.
    const auth = await getAdminFromRequest(req);
    if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const decoded = decodeDataUrl(body.dataUrl);
      if (!decoded) return Response.json({ error: "fichier invalide (type ou taille non autorisés)" }, { status: 400 });

      const mediaId = crypto.randomUUID();
      await store.set(mediaId, decoded.bytes, { metadata: { contentType: decoded.contentType } });

      return Response.json({ id: mediaId, url: `${siteOrigin(req)}/api/social-media?id=${mediaId}` });
    }

    return Response.json({ error: "action inconnue" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/social-media" };
