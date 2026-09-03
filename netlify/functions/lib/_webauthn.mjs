import { getStore } from "@netlify/blobs";
import { sql } from "./_db.mjs";

// Domaine (sans schéma) sur lequel Face ID/Touch ID est enregistré : doit
// correspondre exactement à l'origine servie, sinon le navigateur refuse la
// clé. process.env.URL est celle fournie par Netlify en production.
export function rpID() {
  const url = process.env.URL || "https://e-carpet.shop";
  return new URL(url).hostname;
}

export function expectedOrigin() {
  return process.env.URL || "https://e-carpet.shop";
}

// Challenges à usage unique (enregistrement ou connexion) : courte durée de
// vie dans Netlify Blobs, jamais en base — ils n'ont aucune valeur après
// utilisation ou expiration.
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function sauverChallenge(cle, challenge, extra = {}) {
  const store = getStore("webauthn-challenges");
  await store.setJSON(cle, { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS, ...extra });
}

export async function lireEtConsommerChallenge(cle) {
  const store = getStore("webauthn-challenges");
  const data = await store.get(cle, { type: "json" }).catch(() => null);
  await store.delete(cle).catch(() => {});
  if (!data || Date.now() > data.expiresAt) return null;
  return data;
}

function toBase64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(str) {
  return new Uint8Array(Buffer.from(str, "base64url"));
}

// Le tout premier appareil Face ID enregistré par cet admin — sert d'ancre
// pour les actions les plus sensibles (déconnexion globale) : seule cette
// clé précise, cryptographiquement liée à un seul appareil physique, peut
// les déclencher.
export async function premierCredentialPourAdmin(adminId) {
  const [row] = await sql()`
    select id, credential_id as "credentialId", public_key as "publicKey", counter, device_name as "deviceName"
    from webauthn_credentials where admin_id = ${adminId} order by created_at asc limit 1
  `;
  if (!row) return null;
  return { ...row, publicKey: fromBase64Url(row.publicKey) };
}

export async function credentialsPourAdmin(adminId) {
  const rows = await sql()`
    select id, credential_id as "credentialId", device_name as "deviceName", created_at as "createdAt",
           last_used_at as "lastUsedAt"
    from webauthn_credentials where admin_id = ${adminId} order by created_at desc
  `;
  return rows;
}

// Limite volontairement basse : Face ID doit rester réservé à quelques
// appareils choisis, pas s'accumuler sans contrôle (voir mémoire/discussion
// du 03/09/2026 — une clé peut aussi se synchroniser automatiquement entre
// appareils Apple d'un même compte iCloud, ce qui n'est pas visible ici,
// d'où l'intérêt de garder ce nombre volontairement restreint).
export const MAX_CREDENTIALS_PAR_ADMIN = 3;

export async function enregistrerCredential(adminId, { credentialID, credentialPublicKey, counter }, deviceName) {
  const [{ count }] = await sql()`select count(*)::int as count from webauthn_credentials where admin_id = ${adminId}`;
  if (count >= MAX_CREDENTIALS_PAR_ADMIN) {
    throw new Error(
      `Limite de ${MAX_CREDENTIALS_PAR_ADMIN} appareils Face ID atteinte. Retirez un appareil existant avant d'en ajouter un nouveau.`,
    );
  }
  await sql()`
    insert into webauthn_credentials (admin_id, credential_id, public_key, counter, device_name)
    values (${adminId}, ${credentialID}, ${toBase64Url(credentialPublicKey)}, ${counter}, ${deviceName || null})
  `;
}

// Retrouve à qui appartient une clé Face ID à partir de son identifiant —
// c'est ce qui permet de se connecter sans taper de nom au préalable.
export async function credentialParId(credentialId) {
  const [row] = await sql()`
    select c.id, c.admin_id as "adminId", c.credential_id as "credentialId", c.public_key as "publicKey", c.counter,
           c.device_name as "deviceName", a.name, a.is_owner as "isOwner"
    from webauthn_credentials c join admins a on a.id = c.admin_id
    where c.credential_id = ${credentialId}
  `;
  if (!row) return null;
  return { ...row, publicKey: fromBase64Url(row.publicKey) };
}

export async function majCompteur(credentialDbId, counter) {
  await sql()`update webauthn_credentials set counter = ${counter}, last_used_at = now() where id = ${credentialDbId}`;
}

export async function supprimerCredential(adminId, credentialDbId) {
  await sql()`delete from webauthn_credentials where id = ${credentialDbId} and admin_id = ${adminId}`;
}
