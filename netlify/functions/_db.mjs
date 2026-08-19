import { getDatabase } from "@netlify/database";

let cached;

// On utilise directement `sql` (tagged template, fourni par @netlify/database)
// plutôt que drizzle-orm : le driver `pg` bundlé par esbuild pour les
// fonctions Netlify ignore silencieusement le connectionString fourni et
// retombe sur le port Postgres par défaut (5432), donc les requêtes
// échouent en local. `sql` passe par le même client déjà correctement
// configuré par @netlify/database, en local comme en prod.
export function sql() {
  if (!cached) cached = getDatabase().sql;
  return cached;
}
