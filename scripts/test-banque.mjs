// Tests du lecteur de relevé bancaire (lib/_banque.mjs).
//
// Sans framework, exécutable par `npm test` : ces fonctions décident de ce qui
// entre en comptabilité, elles ne doivent pas pouvoir changer de comportement
// sans que quelque chose le signale. Elles sont pures, donc testables sans
// base de données ni réseau.

import {
  parserReleve, montantEnCentimes, lireDate, categorieSuggeree, chercherRapprochement, normaliser,
} from "../netlify/functions/lib/_banque.mjs";

let ok = 0, ko = 0;
const eq = (nom, obtenu, attendu) => {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a === b) { ok++; console.log(`  ✓ ${nom}`); }
  else { ko++; console.log(`  ✗ ${nom}\n      obtenu  : ${a}\n      attendu : ${b}`); }
};

console.log("\nMontants");
eq("virgule française", montantEnCentimes("37,99"), 3799);
eq("milliers + virgule", montantEnCentimes("1.234,56"), 123456);
eq("espace insécable + €", montantEnCentimes("1 234,56 €"), 123456);
eq("négatif", montantEnCentimes("-12,34"), -1234);
eq("parenthèses = débit", montantEnCentimes("(12,34)"), -1234);
eq("point décimal", montantEnCentimes("12.34"), 1234);
eq("vide", montantEnCentimes(""), null);
eq("texte", montantEnCentimes("n/a"), null);

console.log("\nDates");
eq("JJ/MM/AAAA", lireDate("03/09/2026")?.toISOString().slice(0, 10), "2026-09-03");
eq("AAAA-MM-JJ", lireDate("2026-09-03")?.toISOString().slice(0, 10), "2026-09-03");
eq("JJ-MM-AA", lireDate("03-09-26")?.toISOString().slice(0, 10), "2026-09-03");
eq("mois invalide", lireDate("03/13/2026"), null);
eq("vide", lireDate(""), null);

console.log("\nCatégories");
eq("Google Ads", categorieSuggeree("PRLV GOOGLE ADS 8829"), "Publicité");
eq("Netlify", categorieSuggeree("CB NETLIFY.COM"), "Abonnements");
eq("Mondial Relay", categorieSuggeree("VIR MONDIAL RELAY"), "Transport");
eq("accents ignorés", categorieSuggeree("PRÉLÈVEMENT ÉCOTAX"), "Conformité/REP");
eq("inconnu → null", categorieSuggeree("VIR M. DUPONT"), null);
eq("normalisation", normaliser("  PRÉLÈVEMENT   Écotax "), "prelevement ecotax");

console.log("\nRelevé point-virgule, montant signé");
const csv1 = [
  "Date;Libellé;Montant",
  "03/09/2026;PRLV GOOGLE ADS;-45,20",
  "04/09/2026;VIR STRIPE PAYOUT;1 250,00",
  "05/09/2026;CB NETLIFY.COM;-19,00",
].join("\n");
const r1 = parserReleve(csv1);
eq("3 lignes lues", r1.lignes.length, 3);
eq("aucune erreur", r1.erreurs.length, 0);
eq("débit signé", r1.lignes[0].amountCents, -4520);
eq("catégorie proposée", r1.lignes[0].suggestedCategory, "Publicité");
eq("crédit détecté comme encaissement", r1.lignes[1].encaissement, true);
eq("pas de catégorie sur un crédit", r1.lignes[1].suggestedCategory, null);

console.log("\nRelevé virgule, colonnes débit/crédit");
const csv2 = [
  "Date operation,Description,Debit,Credit",
  '15/08/2026,"PACKLINK, expédition",34.50,',
  "16/08/2026,VIREMENT RECU,,200.00",
].join("\n");
const r2 = parserReleve(csv2);
eq("2 lignes lues", r2.lignes.length, 2);
eq("débit rendu négatif", r2.lignes[0].amountCents, -3450);
eq("virgule protégée par les guillemets", r2.lignes[0].label, "PACKLINK, expédition");
eq("crédit positif", r2.lignes[1].amountCents, 20000);

console.log("\nEmpreintes");
eq("import identique → mêmes empreintes",
   parserReleve(csv1).lignes.map((l) => l.fingerprint),
   r1.lignes.map((l) => l.fingerprint));
const csvDouble = ["Date;Libellé;Montant", "03/09/2026;PRLV IDENTIQUE;-10,00", "03/09/2026;PRLV IDENTIQUE;-10,00"].join("\n");
const rd = parserReleve(csvDouble);
eq("deux lignes identiques le même jour → 2 empreintes distinctes",
   new Set(rd.lignes.map((l) => l.fingerprint)).size, 2);

console.log("\nLignes illisibles");
const csv3 = ["Date;Libellé;Montant", "pas une date;X;-10,00", "03/09/2026;Y;n/a", "03/09/2026;Z;-5,00"].join("\n");
const r3 = parserReleve(csv3);
eq("seule la ligne valable est retenue", r3.lignes.length, 1);
eq("les deux autres sont signalées", r3.erreurs.length, 2);
eq("le numéro de ligne est exact", r3.erreurs[0].ligne, 2);

console.log("\nEn-têtes non reconnus");
const r4 = parserReleve("Colonne A;Colonne B\n1;2");
eq("refus explicite", r4.lignes.length, 0);
eq("raison lisible", /colonnes non reconnues/.test(r4.erreurs[0].raison), true);

console.log("\nRapprochement");
const d = (iso, cents, id, deja = false) => ({ id, amountCents: cents, expenseDate: iso, dejaRattachee: deja });
const ligne = { amountCents: -4520, date: new Date("2026-09-03T12:00:00Z") };
eq("même montant, date proche", chercherRapprochement(ligne, [d("2026-09-05", 4520, 7)])?.id, 7);
eq("montant différent → rien", chercherRapprochement(ligne, [d("2026-09-03", 4521, 7)]), null);
eq("date trop éloignée → rien", chercherRapprochement(ligne, [d("2026-09-20", 4520, 7)]), null);
eq("déjà rattachée → rien", chercherRapprochement(ligne, [d("2026-09-03", 4520, 7, true)]), null);
eq("la plus proche gagne",
   chercherRapprochement(ligne, [d("2026-09-06", 4520, 1), d("2026-09-04", 4520, 2)])?.id, 2);
eq("ambiguïté stricte → on ne choisit pas",
   chercherRapprochement(ligne, [d("2026-09-02", 4520, 1), d("2026-09-04", 4520, 2)]), null);
eq("un crédit n'est jamais une dépense",
   chercherRapprochement({ amountCents: 4520, date: new Date("2026-09-03T12:00:00Z") }, [d("2026-09-03", 4520, 7)]), null);

console.log(`\n${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
