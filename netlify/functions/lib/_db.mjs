import { neon } from "@neondatabase/serverless";

let cached;

// Base migrée de "Netlify DB" (Neon revendu par Netlify, facturé en crédits
// Netlify) vers un compte Neon en direct le 2026-08-31 : le calcul de la base
// consommait à lui seul la quasi-totalité du forfait de crédits mensuel (voir
// mémoire "e-carpet-verification-discipline-credits"). Le pilote officiel
// Neon (HTTP, sans connexion persistante) remplace `getDatabase().sql`.
export function sql() {
  if (!cached) cached = neon(process.env.NEON_DATABASE_URL);
  return cached;
}
