// Cache mémoire partagé pour les appels GET du back-office : au lieu que
// chaque onglet refasse sa requête à chaque affichage, on télécharge tout en
// arrière-plan dès la connexion (voir DashboardPage), et les panneaux lisent
// ensuite depuis ce cache — plus aucune attente en changeant d'onglet.
const cache = new Map();
const inflight = new Map();

// Session expirée (401) détectée par N'IMPORTE quel appel : avant, seul
// l'onglet Analyse le remarquait (il lisait le status lui-même), tous les
// autres panneaux ignoraient le code HTTP et continuaient d'afficher des
// données en cache — donnant l'impression de rester connecté indéfiniment
// alors que la session avait bien expiré côté serveur. Centralisé ici pour
// que DashboardPage puisse renvoyer vers l'écran de connexion dès le tout
// premier appel qui échoue, quel que soit l'onglet ouvert.
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function cachedFetch(url) {
  const { data } = await cachedFetchWithStatus(url);
  return data;
}

// Variante qui garde le code HTTP (401, 503…) : nécessaire pour les quelques
// écrans (aperçu, statistiques) qui distinguent "non configuré" d'une erreur
// via le status plutôt que via le contenu JSON.
export async function cachedFetchWithStatus(url) {
  if (cache.has(url)) return cache.get(url);
  if (inflight.has(url)) return inflight.get(url);

  const requete = fetch(url)
    .then(async (r) => {
      const result = { status: r.status, data: await r.json().catch(() => null) };
      if (r.status === 401) onUnauthorized?.();
      cache.set(url, result);
      inflight.delete(url);
      return result;
    })
    .catch((e) => {
      inflight.delete(url);
      throw e;
    });

  inflight.set(url, requete);
  return requete;
}

// À appeler après toute mutation (création/modification/suppression) pour
// que le prochain cachedFetch(url) recharge des données à jour au lieu de
// resservir la version périmée.
export function invalidateCache(url) {
  cache.delete(url);
}

export function prefetch(urls) {
  urls.forEach((url) => {
    cachedFetch(url).catch(() => {});
  });
}

// Vide tout le cache (bouton "Rafraîchir" du back-office) : le prochain
// cachedFetch de chaque URL relance une vraie requête.
export function clearCache() {
  cache.clear();
  inflight.clear();
}
