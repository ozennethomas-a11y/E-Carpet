// Définition unique des statuts de commande, et de ceux qui comptent comme
// une vente encaissée.
//
// Pourquoi ce fichier : la liste était recopiée dans cinq fonctions et elles
// avaient divergé. finance.mjs et export-excel.mjs s'arrêtaient à
// ['payee', 'expediee'] tandis que overview.mjs, finance-comparison.mjs et
// l'assistant comptaient aussi 'livree'.
//
// L'écart est nul pour l'instant, mais pour une raison qui n'est pas
// rassurante : aucun code n'écrit jamais le statut 'livree'. Une commande
// s'arrête donc définitivement à 'expediee', et le suivi de livraison est un
// trou fonctionnel à part entière. Le jour où ce statut sera renseigné — à la
// main ou par le transporteur — le CA de Finance et du classeur Excel serait
// devenu silencieusement inférieur à celui de l'accueil.
//
// Une commande livrée est évidemment payée : l'oubli venait de l'ajout du
// statut 'livree' après coup, sans repasser sur les fonctions financières.
// Toute nouvelle fonction doit importer STATUTS_PAYES plutôt que réécrire la
// liste.

/**
 * Cycle de vie complet d'une commande, dans l'ordre.
 *
 * 'remboursee' est écrit par stripe-webhook.mjs à la réception d'un
 * remboursement. Il manquait à cette liste, qui prétendait pourtant décrire le
 * cycle complet — corrigé après l'avoir constaté dans le webhook.
 */
export const STATUTS = [
  "en_attente_paiement",
  "payee",
  "expediee",
  "livree",
  "annulee",
  "remboursee",
];

/**
 * Libellés affichés, définis ici et nulle part ailleurs.
 *
 * Ils étaient recopiés dans trois fichiers (OrdersPanel, AccountPage et la
 * bibliothèque SAV) : la même erreur que pour STATUTS_PAYES, à une échelle
 * plus visible puisqu'un libellé divergent se voit directement par le client.
 * Ce module n'importe rien et ne touche pas à la base : il est donc
 * importable aussi bien par une fonction Netlify que par le front.
 */
export const STATUT_LABEL = {
  en_attente_paiement: "En attente de paiement",
  payee: "Payée",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
  remboursee: "Remboursée",
};

/** Libellé d'un statut, ou le statut brut s'il est inconnu. */
export function libelleStatut(statut) {
  return STATUT_LABEL[statut] || statut;
}

/** Statuts pour lesquels l'argent est encaissé : la base de tout calcul de CA. */
export const STATUTS_PAYES = ["payee", "expediee", "livree"];

/** Statuts qui ne doivent jamais entrer dans un chiffre d'affaires. */
export const STATUTS_NON_PAYES = ["en_attente_paiement", "annulee", "remboursee"];
