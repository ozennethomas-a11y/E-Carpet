// Origine canonique du site, à utiliser pour toute URL générée côté serveur
// (liens d'email, redirections Stripe...). Jamais l'en-tête `Origin`/`Referer`
// de la requête : ces en-têtes sont fournis par le client et peuvent être
// falsifiés, ce qui permettrait de faire pointer un lien envoyé par email (ou
// une redirection post-paiement) vers un domaine contrôlé par un attaquant.
export function siteOrigin(req) {
  const fromEnv = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return new URL(req.url).origin;
}
