// Chiffrement au repos des jetons d'accès réseaux sociaux (AES-GCM, Web
// Crypto natif — même approche « pas de dépendance ajoutée » que _totp.mjs).
// Une fuite de la base ne doit pas suffire à réutiliser un jeton Facebook/
// Instagram/TikTok valide : la clé ne vit que dans les variables d'environnement
// Netlify, jamais en base.
async function importKey() {
  const b64 = process.env.SOCIAL_TOKENS_KEY;
  if (!b64) throw new Error("SOCIAL_TOKENS_KEY manquante côté serveur");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("SOCIAL_TOKENS_KEY doit être une clé AES-256 encodée en base64 (32 octets)");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toB64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function encryptToken(plaintext) {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
  );
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, iv.length);
  return toB64(combined);
}

export async function decryptToken(stored) {
  const key = await importKey();
  const combined = fromB64(stored);
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}
