// Jeton de désinscription : HMAC(email) pour éviter qu'un lien devine
// l'adresse de quelqu'un d'autre, sans avoir besoin d'une colonne dédiée en
// base. Réutilise SOCIAL_TOKENS_KEY comme secret de signature (déjà un
// secret privé côté serveur, jamais exposé) — usage différent de sa fonction
// d'origine (chiffrement des jetons sociaux) mais un HMAC n'a besoin que
// d'une clé secrète stable, peu importe sa provenance.
async function hmacKey() {
  const raw = process.env.SOCIAL_TOKENS_KEY;
  if (!raw) throw new Error("SOCIAL_TOKENS_KEY manquante");
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function unsubscribeToken(email) {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(email.toLowerCase()));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function verifyUnsubscribeToken(email, token) {
  const expected = await unsubscribeToken(email);
  if (expected.length !== String(token || "").length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
