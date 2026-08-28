// Cache mémoire partagé pour les appels GET du back-office : au lieu que
// chaque onglet refasse sa requête à chaque affichage, on télécharge tout en
// arrière-plan dès la connexion (voir DashboardPage), et les panneaux lisent
// ensuite depuis ce cache — plus aucune attente en changeant d'onglet.
const cache = new Map();
const inflight = new Map();

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
