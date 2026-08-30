import { synchroniserAmazon } from "./stock.mjs";

// Synchronise automatiquement le stock avec les ventes Amazon : auparavant
// cette synchronisation ne se déclenchait que sur un clic manuel dans
// l'onglet Stock, donc le stock affiché divergeait du stock réel dès que
// personne ne cliquait. Toutes les 4h : assez pour rester à jour, sans
// aggraver le quota déjà serré de l'API Amazon (cache partagé sur les
// lectures, voir netlify/functions/lib/_amazon.mjs).
export default async () => {
  const resultat = await synchroniserAmazon();
  if (resultat.erreur) {
    console.error("[cron-amazon-stock-sync] échec:", resultat.erreur);
    return new Response(resultat.erreur, { status: 200 });
  }
  console.log(
    `[cron-amazon-stock-sync] ${resultat.commandesTraitees} commande(s), ${resultat.quantiteTotale} unité(s) déduite(s)` +
      (resultat.skuNonReconnus?.length ? ` — SKU non reconnus : ${resultat.skuNonReconnus.join(", ")}` : ""),
  );
  return new Response(`${resultat.commandesTraitees} commande(s) traitée(s)`);
};

export const config = { schedule: "0 */4 * * *" };
