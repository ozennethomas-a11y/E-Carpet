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
