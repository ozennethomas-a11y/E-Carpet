import webpush from "web-push";
import { sql } from "./_db.mjs";

function vapidConfigure() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails("mailto:service-client@e-carpet.shop", publicKey, privateKey);
  return { publicKey, privateKey };
}

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

// Verrouillé sur UN SEUL appareil, définitivement, demandé explicitement le
// 03/09/2026 : une fois l'appareil de Thomas enregistré, ni un ajout ni une
// suppression ne doivent être possibles depuis l'admin lui-même — sinon
// n'importe qui disposant d'une session admin valide (session volée...)
// pourrait rediriger silencieusement les alertes de connexion vers son
// propre téléphone, ce qui viderait cette alerte de son intérêt. Un vrai
// changement d'appareil (perte du téléphone...) doit passer par une
// intervention directe en base, jamais par l'interface.
export async function enregistrerAbonnement(adminId, subscription, deviceName) {
  const [{ count }] = await sql()`select count(*)::int as count from push_subscriptions where admin_id = ${adminId}`;
  if (count > 0) {
    throw new Error(
      "Un appareil est déjà enregistré et verrouillé pour ce compte — aucun changement possible depuis l'admin.",
    );
  }
  await sql()`
    insert into push_subscriptions (admin_id, endpoint, p256dh, auth, device_name)
    values (${adminId}, ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth}, ${deviceName || null})
  `;
}

export async function abonnementsPourAdmin(adminId) {
  return sql()`select id, device_name as "deviceName", created_at as "createdAt" from push_subscriptions where admin_id = ${adminId} order by created_at desc`;
}

// Envoie à tous les admins abonnés (pas juste celui qui a déclenché
// l'événement) : une nouvelle commande intéresse toute l'équipe, pas
// seulement la personne connectée au moment du paiement.
export async function notifierTousLesAdmins({ title, body, url }) {
  if (!vapidConfigure()) {
    console.log("[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY absentes, notification non envoyée");
    return;
  }

  const abonnements = await sql()`select id, endpoint, p256dh, auth from push_subscriptions`;
  if (!abonnements.length) return;

  const payload = JSON.stringify({ title, body, url: url || "/admin" });

  await Promise.all(
    abonnements.map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload);
      } catch (e) {
        // 404/410 : l'abonnement n'est plus valide (app désinstallée,
        // notifications désactivées...) — on le retire plutôt que de
        // réessayer indéfiniment à chaque commande.
        if (e.statusCode === 404 || e.statusCode === 410) {
          await sql()`delete from push_subscriptions where id = ${a.id}`;
        } else {
          console.error("[push] échec envoi:", e.message);
        }
      }
    }),
  );
}
