import { synchroniserAmazon } from "./stock.mjs";
import { executerTache } from "./lib/_taches.mjs";

// Synchronise automatiquement le stock avec les ventes Amazon : auparavant
// cette synchronisation ne se déclenchait que sur un clic manuel dans
// l'onglet Stock, donc le stock affiché divergeait du stock réel dès que
// personne ne cliquait. Toutes les 4h : assez pour rester à jour, sans
// aggraver le quota déjà serré de l'API Amazon (cache partagé sur les
// lectures, voir netlify/functions/lib/_amazon.mjs).
export default async () =>
  executerTache("amazon-stock-sync", async () => {
    const resultat = await synchroniserAmazon();
    // L'erreur est renvoyée dans le résultat plutôt que levée : on la relaie
    // au journal pour qu'elle déclenche bien une alerte.
    if (resultat.erreur) throw new Error(resultat.erreur);
    const sku = resultat.skuNonReconnus?.length
      ? ` — SKU non reconnus : ${resultat.skuNonReconnus.join(", ")}`
      : "";
    return `${resultat.commandesTraitees} commande(s), ${resultat.quantiteTotale} unité(s) déduite(s)${sku}`;
  });

// Toutes les 6 h au lieu de 4 h. Le stock Amazon reste la synchronisation la
// plus sensible — une rupture non répercutée fait vendre ce qu'on n'a pas —
// mais 4 passages par jour suffisent au rythme de ventes constaté.
export const config = { schedule: "0 */6 * * *" };
