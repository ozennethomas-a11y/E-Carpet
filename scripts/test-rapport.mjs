// Tests du rapport hebdomadaire (lib/_rapport.mjs).
//
// Sans framework, exécutable par `npm test`. Ce que ces tests protègent n'est
// pas un calcul mais une PROMESSE : sur une boutique quasi vide, le rapport
// doit refuser de conclure. Les cas ci-dessous sont donc majoritairement des
// cas dégénérés — semaine vide, un seul acheteur, aucun coût saisi — parce
// que ce sont ceux que la production rencontre réellement aujourd'hui, et
// ceux où un rapport bavard ferait le plus de dégâts.

import {
  comparerPeriodes, evaluerMarge, recommanderActions, construireRapport,
  rendreTexte, resumePush, fenetres, SEUILS,
} from "../netlify/functions/lib/_rapport.mjs";

let ok = 0, ko = 0;
const eq = (nom, obtenu, attendu) => {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a === b) { ok++; console.log(`  ✓ ${nom}`); }
  else { ko++; console.log(`  ✗ ${nom}\n      obtenu  : ${a}\n      attendu : ${b}`); }
};

const ventes = (nb, caCents, extra = {}) => ({
  nb, caCents, fraisStripeCents: 0, coutProduitCents: 0, produitsSansCout: [], ...extra,
});

console.log("\nComparaison de périodes — refus de conclure");
eq("deux semaines vides", comparerPeriodes(ventes(0, 0), ventes(0, 0)).variation, null);
eq("deux semaines vides : phrase explicite",
   /Aucune commande cette semaine/.test(comparerPeriodes(ventes(0, 0), ventes(0, 0)).phrase), true);
eq("1 commande contre 2 : aucun pourcentage",
   comparerPeriodes(ventes(1, 3998), ventes(2, 7996)).variation, null);
eq("1 contre 2 : dit pourquoi il se tait",
   /Trop peu de volume/.test(comparerPeriodes(ventes(1, 3998), ventes(2, 7996)).phrase), true);
eq("échantillon insuffisant → suffisant = false",
   comparerPeriodes(ventes(1, 3998), ventes(2, 7996)).suffisant, false);
eq("démarrage depuis zéro : pas de division par zéro",
   comparerPeriodes(ventes(6, 24000), ventes(0, 0)).variation, null);

console.log("\nComparaison de périodes — quand le volume le permet");
eq("chute de moitié", comparerPeriodes(ventes(6, 10000), ventes(8, 20000)).variation, -50);
eq("chute qualifiée de baisse", comparerPeriodes(ventes(6, 10000), ventes(8, 20000)).sens, "baisse");
eq("hausse", comparerPeriodes(ventes(10, 30000), ventes(6, 20000)).variation, 50);
eq("variation faible = stable", comparerPeriodes(ventes(6, 20500), ventes(6, 20000)).sens, "stable");
eq("le seuil de significativité vient bien des seuils",
   comparerPeriodes(ventes(SEUILS.commandesMinTendance, 10000), ventes(SEUILS.commandesMinTendance, 20000)).suffisant, true);

console.log("\nMarge — zéro n'est pas inconnu");
const sansRien = { produitsSansCout: ["Tapis E-Carpet"], depensesTotales: 0 };
eq("aucun coût produit → incalculable", evaluerMarge(ventes(2, 8196), { totalCents: 0 }, sansRien).calculable, false);
eq("aucun coût produit → montant null", evaluerMarge(ventes(2, 8196), { totalCents: 0 }, sansRien).montantCents, null);
eq("la raison nomme le produit",
   /Tapis E-Carpet/.test(evaluerMarge(ventes(2, 8196), { totalCents: 0 }, sansRien).raison), true);
eq("la raison signale aussi les dépenses absentes",
   /aucune dépense/.test(evaluerMarge(ventes(2, 8196), { totalCents: 0 }, sansRien).raison), true);
eq("données complètes → marge calculée",
   evaluerMarge(ventes(2, 10000, { fraisStripeCents: 300, coutProduitCents: 4000 }), { totalCents: 1000 },
     { produitsSansCout: [], depensesTotales: 12 }).montantCents, 4700);

console.log("\nActions — au plus trois, triées par impact");
const snapshotBase = {
  periode: { debut: "2026-09-01T00:00:00.000Z", fin: "2026-09-08T00:00:00.000Z" },
  genereLe: "2026-09-08T08:00:00.000Z",
  ventes: ventes(0, 0), ventesPrecedentes: ventes(0, 0),
  depenses: { nb: 0, totalCents: 0 }, nouveauxClients: 0,
  anomalies: [], compteAnomalies: { critique: 0, attention: 0, info: 0 }, erreursDetection: [],
  couverture: { produitsSansCout: ["Tapis E-Carpet"], depensesTotales: 0 },
};
const anomalie = (code, severite, titre) => ({ code, severite, titre, detail: "détail", action: { label: "Commandes" } });

const avecUrgences = {
  ...snapshotBase,
  anomalies: [
    anomalie("expedition_en_retard", "critique", "1 commande payée non expédiée"),
    anomalie("paiement_bloque", "critique", "1 paiement encaissé sans commande validée"),
    anomalie("commissions_dues", "info", "1 partenaire au-dessus du seuil"),
  ],
  // Doit rester cohérent avec la liste ci-dessus : c'est detecterAnomalies()
  // qui produit les deux ensemble en conditions réelles.
  compteAnomalies: { critique: 2, attention: 0, info: 1 },
};
eq("jamais plus de trois", recommanderActions(avecUrgences).length, 3);
eq("l'argent bloqué passe en premier",
   recommanderActions(avecUrgences)[0].titre, "1 paiement encaissé sans commande validée");
eq("le client qui attend passe en second",
   recommanderActions(avecUrgences)[1].titre, "1 commande payée non expédiée");
eq("l'action porte l'onglet où agir", recommanderActions(avecUrgences)[0].ou, "Commandes");

console.log("\nActions — boutique vide, sans anomalie");
const actionsVides = recommanderActions(snapshotBase);
eq("les trous de données deviennent les actions", actionsVides[0].titre, "Saisir le coût d'achat des produits");
eq("puis les dépenses", actionsVides[1].titre, "Saisir les dépenses du mois");
eq("l'absence de vente est nommée, pas déguisée en conseil",
   actionsVides[2].titre, "Aucune vente cette semaine");
eq("aucune action inventée au-delà", actionsVides.length, 3);
eq("une boutique sans trou de données et sans anomalie ne fabrique rien",
   recommanderActions({ ...snapshotBase, ventes: ventes(3, 12000), couverture: { produitsSansCout: [], depensesTotales: 5 } }).length, 0);

console.log("\nRapport complet — cas réel de production (2 commandes, 0 coût, 0 dépense)");
const rapport = construireRapport(snapshotBase);
eq("aucun pourcentage inventé", rapport.evolution.variation, null);
eq("marge annoncée incalculable", rapport.marge.calculable, false);
eq("les faits mentionnent l'incalculabilité",
   rapport.faits.some((f) => /incalculable/.test(f)), true);
eq("aucun « 0,00 € » de marge dans le texte",
   /Marge de la semaine/.test(rendreTexte(rapport)), false);
eq("trois actions proposées", rapport.actions.length, 3);
eq("le texte contient les trois sections",
   ["CE QUI A CHANGÉ", "ANOMALIES EN COURS", "À FAIRE CETTE SEMAINE"].every((s) => rendreTexte(rapport).includes(s)), true);

console.log("\nRésumé push");
eq("semaine vide", /aucune vente/.test(resumePush(rapport)), true);
eq("longueur bornée", resumePush(rapport).length <= 200, true);
const rapportUrgent = construireRapport(avecUrgences);
eq("les urgences priment dans le résumé", /2 urgences/.test(resumePush(rapportUrgent)), true);

console.log("\nFenêtres");
const f = fenetres(new Date("2026-09-14T08:00:00.000Z"));
eq("semaine écoulée", f.debut.toISOString().slice(0, 10), "2026-09-07");
eq("semaine précédente", f.debutPrecedent.toISOString().slice(0, 10), "2026-08-31");
eq("les deux fenêtres sont contiguës et de même durée",
   f.fin - f.debut, f.debut - f.debutPrecedent);

console.log(`\n${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
