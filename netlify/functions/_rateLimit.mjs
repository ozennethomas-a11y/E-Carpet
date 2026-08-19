import { getStore } from "@netlify/blobs";

// Limitation de débit générique par IP, sur le modèle de checkLoginLock/
// recordLoginFailure dans _adminAuth.mjs (même store Blobs, même écriture
// protégée par etag pour rester correcte sous requêtes concurrentes).
const STORE_NAME = "rate-limit";

export function clientIp(req, context) {
  return context?.ip || req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}

// bucket : identifiant de l'action limitée (ex: "auth-request-link").
// Retourne { limited, retryAfterSeconds } sans consommer de tentative — à
// appeler avant de traiter la requête.
export async function rateLimited(bucket, ip, { max, windowMs }) {
  const store = getStore(STORE_NAME);
  const key = `${bucket}:${ip}`;
  const data = await store.get(key, { type: "json" }).catch(() => null);
  if (!data) return { limited: false };

  const elapsed = Date.now() - data.windowStart;
  if (elapsed > windowMs) return { limited: false };
  if (data.count < max) return { limited: false };

  return { limited: true, retryAfterSeconds: Math.ceil((windowMs - elapsed) / 1000) };
}

// Enregistre une tentative pour ce bucket/IP. À appeler pour chaque requête
// reçue sur l'endpoint limité (avant ou après traitement selon le cas).
//
// Pas d'écriture conditionnelle par etag ici (contrairement à
// recordLoginFailure dans _adminAuth.mjs) : sous forte concurrence, deux hits
// simultanés pourraient se relire mutuellement le même compteur de départ et
// n'en incrémenter qu'un seul — un rate limit qui laisse passer une requête
// de trop de temps en temps n'est pas un problème, contrairement au verrou de
// connexion admin qui doit rester strict.
export async function recordHit(bucket, ip, { max, windowMs }) {
  const store = getStore(STORE_NAME);
  const key = `${bucket}:${ip}`;

  const data = await store.get(key, { type: "json" }).catch(() => null);
  const now = Date.now();
  const next = data && now - data.windowStart <= windowMs ? { count: data.count + 1, windowStart: data.windowStart } : { count: 1, windowStart: now };

  await store.setJSON(key, next);
}

// Combine les deux : vérifie la limite puis enregistre la tentative dans la
// foulée si elle n'est pas bloquée. Pratique pour le cas courant "un hit = une
// tentative", à ne pas utiliser quand on veut ne compter que les échecs.
export async function checkAndRecord(bucket, req, context, opts) {
  const ip = clientIp(req, context);
  const etat = await rateLimited(bucket, ip, opts);
  if (etat.limited) return etat;
  await recordHit(bucket, ip, opts);
  return { limited: false };
}
