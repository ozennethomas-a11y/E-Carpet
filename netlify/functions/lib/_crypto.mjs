// Comparaison à temps constant, pour ne pas laisser une différence de temps
// de réponse révéler combien de caractères d'un secret sont corrects (mot de
// passe admin, signature de webhook). On compare toujours un hash de longueur
// fixe plutôt que les chaînes brutes, pour que la boucle de comparaison ait un
// coût identique quelle que soit la longueur des valeurs d'origine.
export async function constantTimeEqual(a, b) {
  const enc = new TextEncoder();
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(a))),
    crypto.subtle.digest("SHA-256", enc.encode(String(b))),
  ]);
  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);

  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}

const PBKDF2_ITERATIONS = 210_000; // recommandation OWASP 2023 pour PBKDF2-SHA256

function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

// Stocke "iterations:sel:hash" (tout en hex) dans une seule colonne texte, pour
// pouvoir changer le nombre d'itérations plus tard sans casser les hachages existants.
export async function hashPassword(password, { salt } = {}) {
  const saltBytes = salt ? fromHex(salt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `${PBKDF2_ITERATIONS}:${toHex(saltBytes)}:${toHex(bits)}`;
}

export async function verifyPassword(password, stored) {
  const [iterations, salt, hash] = String(stored).split(":");
  if (!iterations || !salt || !hash) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(salt), iterations: Number(iterations), hash: "SHA-256" },
    key,
    256,
  );
  return constantTimeEqual(toHex(bits), hash);
}
