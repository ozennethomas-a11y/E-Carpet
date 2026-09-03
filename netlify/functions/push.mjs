import { getAdminSessionFromRequest } from "./lib/_adminAuth.mjs";
import {
  vapidPublicKey,
  enregistrerAbonnement,
  supprimerAbonnementParId,
  abonnementsPourAdmin,
  appareilAlerteConnexion,
  enregistrerAppareilAlerteConnexion,
} from "./lib/_push.mjs";

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

  // --- Notifications générales (commandes, etc.) : libres, plusieurs appareils.
  if (req.method === "GET" && action === "list") {
    return Response.json({ abonnements: await abonnementsPourAdmin(admin.id) });
  }

  if (req.method === "POST" && action === "subscribe") {
    const { subscription, deviceName } = await req.json().catch(() => ({}));
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return Response.json({ error: "abonnement invalide" }, { status: 400 });
    }
    await enregistrerAbonnement(admin.id, subscription, deviceName);
    return Response.json({ ok: true });
  }

  if (req.method === "POST" && action === "supprimer") {
    const { id } = await req.json().catch(() => ({}));
    if (!id) return Response.json({ error: "id manquant" }, { status: 400 });
    await supprimerAbonnementParId(admin.id, id);
    return Response.json({ ok: true });
  }

  // --- Alerte de connexion : verrouillé, un seul appareil, jamais modifiable
  //     une fois défini (pas d'action de suppression exposée ici, volontaire).
  if (req.method === "GET" && action === "connexion-list") {
    return Response.json({ appareil: await appareilAlerteConnexion(admin.id) });
  }

  if (req.method === "POST" && action === "connexion-subscribe") {
    const { subscription, deviceName } = await req.json().catch(() => ({}));
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return Response.json({ error: "abonnement invalide" }, { status: 400 });
    }
    try {
      await enregistrerAppareilAlerteConnexion(admin.id, subscription, deviceName);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 409 });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "action inconnue" }, { status: 400 });
};

export const config = { path: "/api/push" };
