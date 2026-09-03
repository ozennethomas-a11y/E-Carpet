import { getAdminSessionFromRequest } from "./lib/_adminAuth.mjs";
import { vapidPublicKey, enregistrerAbonnement, abonnementsPourAdmin } from "./lib/_push.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // Clé publique : pas de donnée sensible, ne nécessite pas de session (le
  // navigateur en a besoin avant même de savoir si l'admin est connecté).
  if (req.method === "GET" && action === "vapid-public-key") {
    const key = vapidPublicKey();
    if (!key) return Response.json({ error: "VAPID_PUBLIC_KEY manquante" }, { status: 200 });
    return Response.json({ publicKey: key });
  }

  const admin = await getAdminSessionFromRequest(req);
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

  if (req.method === "GET" && action === "list") {
    return Response.json({ abonnements: await abonnementsPourAdmin(admin.id) });
  }

  if (req.method === "POST" && action === "subscribe") {
    const { subscription, deviceName } = await req.json().catch(() => ({}));
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return Response.json({ error: "abonnement invalide" }, { status: 400 });
    }
    try {
      await enregistrerAbonnement(admin.id, subscription, deviceName);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 409 });
    }
    return Response.json({ ok: true });
  }

  // Volontairement aucune action de suppression/désabonnement ici : verrouillé
  // sur un seul appareil, voir le commentaire dans lib/_push.mjs.

  return Response.json({ error: "action inconnue" }, { status: 400 });
};

export const config = { path: "/api/push" };
