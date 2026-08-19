#!/usr/bin/env node
/**
 * Génère la clé de chiffrement AES-256 des jetons réseaux sociaux, en local.
 *
 *   node scripts/generate-social-key.mjs
 *
 * Rien n'est écrit sur disque ni envoyé où que ce soit. Copiez la clé dans
 * Netlify → Site configuration → Environment variables sous le nom
 * SOCIAL_TOKENS_KEY. Si cette clé change ou est perdue, les comptes réseaux
 * sociaux déjà connectés devront être reconnectés (leurs jetons stockés ne
 * seront plus déchiffrables).
 */

const key = crypto.getRandomValues(new Uint8Array(32));
let s = "";
for (const b of key) s += String.fromCharCode(b);
const b64 = btoa(s);

console.log("\nVariable Netlify à créer :\n");
console.log(`  SOCIAL_TOKENS_KEY=${b64}\n`);
console.log("Cette clé ne sera plus jamais affichée — notez-la avant de fermer ce terminal.\n");
