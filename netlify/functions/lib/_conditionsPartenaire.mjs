// Version des conditions du programme partenaire.
//
// Définie ici et nulle part ailleurs : le formulaire d'inscription l'affiche
// (src/data/legal.js la réexporte) et l'API l'enregistre avec l'acceptation.
// Si les deux la déclaraient séparément, on finirait par enregistrer un
// consentement à une version que le partenaire n'a jamais vue — exactement ce
// qu'une trace de consentement est censée empêcher.
//
// Ce module n'importe rien et ne touche pas à la base : il est donc
// importable aussi bien par une fonction Netlify que par le front.
//
// À incrémenter à CHAQUE modification du texte, faute de quoi la trace perd
// toute valeur probante.
export const VERSION_CONDITIONS = "2026-09-09";

/** Chemin public du document, pour ne pas le recopier dans chaque lien. */
export const URL_CONDITIONS = "/legal/programme-partenaire";
