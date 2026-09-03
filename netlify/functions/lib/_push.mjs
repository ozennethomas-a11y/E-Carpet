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

// =====================================================================
// Notifications générales (nouvelle commande payée, etc.) — libres :
// plusieurs appareils par admin, ajout/retrait sans restriction.
// =====================================================================

export async function enregistrerAbonnement(adminId, subscription, deviceName) {
  await sql()`
    insert into push_subscriptions (admin_id, endpoint, p256dh, auth, device_name)
    values (${adminId}, ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth}, ${deviceName || null})
    on conflict (endpoint) do update set admin_id = excluded.admin_id, p256dh = excluded.p256dh, auth = excluded.auth
  `;
}

export async function supprimerAbonnementParId(adminId, id) {
  await sql()`delete from push_subscriptions where admin_id = ${adminId} and id = ${id}`;
}

export async function abonnementsPourAdmin(adminId) {
  return sql()`select id, device_name as "deviceName", created_at as "createdAt" from push_subscriptions where admin_id = ${adminId} order by created_at desc`;
}

async function envoyer(abonnements, payload, onExpired) {
  await Promise.all(
    abonnements.map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload);
      } catch (e) {
        // 404/410 : l'abonnement n'est plus valide (app désinstallée,
        // notifications désactivées...).
        if (e.statusCode === 404 || e.statusCode === 410) {
          if (onExpired) await onExpired(a).catch(() => {});
        } else {
          console.error("[push] échec envoi:", e.message);
        }
      }
    }),
  );
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
  await envoyer(abonnements, JSON.stringify({ title, body, url: url || "/admin" }), (a) =>
    sql()`delete from push_subscriptions where id = ${a.id}`,
  );
}

// =====================================================================
// Alerte de connexion — canal séparé, verrouillé sur UN SEUL appareil par
// admin, défini une fois pour toutes. Voir loginAlertDevices dans
// db/schema.ts pour le pourquoi : empêcher qu'une session admin compromise
// redirige cette alerte précise vers un autre appareil.
// =====================================================================

export async function appareilAlerteConnexion(adminId) {
  const [row] = await sql()`
    select admin_id as "adminId", device_name as "deviceName", created_at as "createdAt"
    from login_alert_devices where admin_id = ${adminId}
  `;
  return row || null;
}

export async function enregistrerAppareilAlerteConnexion(adminId, subscription, deviceName) {
  const existant = await appareilAlerteConnexion(adminId);
  if (existant) {
    throw new Error(
      "Un appareil est déjà enregistré et verrouillé pour l'alerte de connexion — aucun changement possible depuis l'admin.",
    );
  }
  await sql()`
    insert into login_alert_devices (admin_id, endpoint, p256dh, auth, device_name)
    values (${adminId}, ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth}, ${deviceName || null})
  `;
}

// Envoie l'alerte de connexion au(x) appareil(s) verrouillé(s) de tous les
// admins (pas seulement celui qui vient de se connecter) : c'est une alerte
// de sécurité, elle doit prévenir toute l'équipe qu'une connexion a eu lieu,
// y compris si ce n'est pas la sienne.
export async function notifierAlerteConnexion({ title, body, url }) {
  if (!vapidConfigure()) {
    console.log("[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY absentes, alerte de connexion non envoyée");
    return;
  }
  const abonnements = await sql()`select admin_id as id, endpoint, p256dh, auth from login_alert_devices`;
  if (!abonnements.length) return;
  await envoyer(abonnements, JSON.stringify({ title, body, url: url || "/admin" }));
}
