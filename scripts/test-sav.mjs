// Tests du SAV assisté (netlify/functions/lib/_sav.mjs).
// Aucune base, aucun réseau, aucun envoi : les fonctions testées sont pures et
// reçoivent leurs commandes en argument. Lancé par `npm test`.
import assert from "node:assert/strict";
import {
  extraireNumerosCommande,
  rapprocherCommande,
  detecterIntention,
  construireBrouillon,
  analyserMail,
} from "../netlify/functions/lib/_sav.mjs";

let reussis = 0;
const echecs = [];

function test(nom, fn) {
  try {
    fn();
    reussis++;
  } catch (e) {
    echecs.push(`${nom} : ${e.message}`);
  }
}

// Jeu de commandes fictif, au format renvoyé par orders.mjs.
const COMMANDES = [
  {
    orderNumber: 482913,
    email: "marie.dupont@example.com",
    status: "expediee",
    trackingNumber: "6A12345678901",
    trackingCarrier: "Colissimo",
    shippedAt: "2026-09-04T09:12:00.000Z",
    shippingAddress: { firstName: "Marie", lastName: "Dupont", deliveryMode: "domicile" },
    createdAt: "2026-09-02T10:00:00.000Z",
  },
  {
    orderNumber: 731004,
    email: "marie.dupont@example.com",
    status: "payee",
    trackingNumber: null,
    trackingCarrier: null,
    shippedAt: null,
    shippingAddress: { firstName: "Marie", deliveryMode: "relais" },
    createdAt: "2026-09-07T14:30:00.000Z",
  },
  {
    orderNumber: 155208,
    email: "paul.martin@example.com",
    status: "en_attente_paiement",
    trackingNumber: null,
    trackingCarrier: null,
    shippedAt: null,
    shippingAddress: { firstName: "Paul", deliveryMode: "domicile" },
    createdAt: "2026-09-08T08:00:00.000Z",
  },
];

const mail = (o) => ({ id: "m1", sujet: "", apercu: "", email: "", ...o });

// --- Extraction des numéros ------------------------------------------------

test("numéro cité après « commande n° »", () => {
  assert.deepEqual(extraireNumerosCommande("Ma commande n°482913 n'est pas arrivée"), [482913]);
});

test("numéro cité après un dièse", () => {
  assert.deepEqual(extraireNumerosCommande("bonjour, #731004 svp"), [731004]);
});

test("six chiffres sans marqueur : rien (numéro de suivi, montant, référence...)", () => {
  assert.deepEqual(extraireNumerosCommande("j'ai payé 482913 centimes hier"), []);
  assert.deepEqual(extraireNumerosCommande("colis 6A12345678901"), []);
});

test("un code postal à 5 chiffres n'est jamais pris pour un numéro", () => {
  assert.deepEqual(extraireNumerosCommande("commande livrée au 75011 Paris"), []);
});

// --- Rapprochement ---------------------------------------------------------

test("rapprochement par numéro de commande cité", () => {
  const r = rapprocherCommande(mail({ sujet: "Re: commande n°482913", email: "marie.dupont@example.com" }), COMMANDES);
  assert.equal(r.motif, "numero");
  assert.equal(r.commande.orderNumber, 482913);
  assert.equal(r.avertissement, null);
});

test("numéro cité depuis une autre adresse : rapproché mais signalé", () => {
  const r = rapprocherCommande(mail({ sujet: "commande n°482913", email: "conjoint@example.com" }), COMMANDES);
  assert.equal(r.motif, "numero");
  assert.match(r.avertissement, /n'est pas l'adresse de la commande/);
});

test("rapprochement par adresse : la plus récente, et on le dit", () => {
  const r = rapprocherCommande(mail({ sujet: "Question", email: "Marie.Dupont@Example.com " }), COMMANDES);
  assert.equal(r.motif, "email");
  assert.equal(r.commande.orderNumber, 731004);
  assert.match(r.avertissement, /2 commandes pour cette adresse/);
});

test("expéditeur inconnu : aucun rapprochement, jamais de devinette", () => {
  assert.equal(rapprocherCommande(mail({ sujet: "Bonjour", email: "inconnu@example.com" }), COMMANDES), null);
});

test("numéro à 6 chiffres inexistant : aucun rapprochement", () => {
  assert.equal(rapprocherCommande(mail({ sujet: "commande n°999999", email: "inconnu@example.com" }), COMMANDES), null);
});

test("liste de commandes vide : aucun rapprochement, pas d'erreur", () => {
  assert.equal(rapprocherCommande(mail({ sujet: "commande n°482913", email: "a@b.fr" }), []), null);
});

// --- Intentions ------------------------------------------------------------

test("intentions reconnues", () => {
  assert.equal(detecterIntention(mail({ sujet: "Où est ma commande ?" })), "suivi");
  assert.equal(detecterIntention(mail({ sujet: "Je souhaite un remboursement" })), "retour");
  assert.equal(detecterIntention(mail({ sujet: "Annuler ma commande" })), "annulation");
  assert.equal(detecterIntention(mail({ sujet: "Compatible avec une Ninebot ?" })), "produit");
  assert.equal(detecterIntention(mail({ sujet: "Bonjour" })), "autre");
});

// --- Brouillons ------------------------------------------------------------

test("brouillon suivi d'une commande expédiée : suivi, transporteur, délai, lien", () => {
  const b = construireBrouillon({ mail: mail({ sujet: "Où est mon colis ?" }), commande: COMMANDES[0] });
  assert.match(b.corps, /Bonjour Marie,/);
  assert.match(b.corps, /n°482913/);
  assert.match(b.corps, /Colissimo/);
  assert.match(b.corps, /6A12345678901/);
  assert.match(b.corps, /laposte\.fr/);
  assert.match(b.corps, /1 à 2 jours ouvrés/);
  assert.equal(b.objet, "Re: Où est mon colis ?");
});

test("commande payée non expédiée : pas de numéro de suivi inventé", () => {
  const b = construireBrouillon({ mail: mail({ sujet: "Quand part ma commande ?" }), commande: COMMANDES[1] });
  assert.match(b.corps, /24 à 48 heures ouvrées/);
  assert.ok(!/suivi : /i.test(b.corps), "aucun numéro de suivi ne doit apparaître");
});

test("sans commande rapprochée : le brouillon le dit et demande le numéro", () => {
  const b = construireBrouillon({ mail: mail({ sujet: "Toujours pas reçu" }), commande: null });
  assert.match(b.corps, /Je ne retrouve aucune commande associée à cette adresse email/);
  assert.match(b.corps, /numéro de commande à 6 chiffres/);
  assert.ok(b.aCompleter.some((c) => /Aucune commande rapprochée/.test(c)));
});

test("demande de retour : délai des CGV et adresse de retour à compléter", () => {
  const b = construireBrouillon({ mail: mail({ sujet: "Je veux retourner le tapis" }), commande: COMMANDES[0] });
  assert.match(b.corps, /30 jours/);
  assert.match(b.corps, /emballage d'origine/);
  assert.ok(b.aCompleter.some((c) => /adresse de retour/.test(c)));
});

test("annulation d'une commande déjà expédiée : renvoie vers le retour", () => {
  const b = construireBrouillon({ mail: mail({ sujet: "Annuler svp" }), commande: COMMANDES[0] });
  assert.match(b.corps, /déjà partie/);
});

test("commande impayée : le brouillon ne prétend pas qu'elle est validée", () => {
  const b = construireBrouillon({ mail: mail({ sujet: "Où en est ma commande ?" }), commande: COMMANDES[2] });
  assert.match(b.corps, /paiement n'a pas été finalisé/);
  assert.ok(b.aCompleter.some((c) => /Stripe/.test(c)));
});

test("aucun brouillon ne contient de tiret cadratin ni de crochet non signalé", () => {
  for (const commande of [...COMMANDES, null]) {
    for (const sujet of ["Où est ma commande", "Retour", "Annuler", "Compatible ?", "Bonjour"]) {
      const b = construireBrouillon({ mail: mail({ sujet }), commande });
      assert.ok(!b.corps.includes("—"), `tiret cadratin dans « ${sujet} »`);
      if (b.corps.includes("[")) assert.ok(b.aCompleter.length > 0, `crochet non signalé dans « ${sujet} »`);
      assert.match(b.corps, /E-Carpet · service-client@e-carpet\.shop$/);
    }
  }
});

test("analyserMail assemble rapprochement et brouillon", () => {
  const a = analyserMail(mail({ sujet: "Re: commande n°482913 non reçue", email: "marie.dupont@example.com" }), COMMANDES);
  assert.equal(a.rapprochement.orderNumber, 482913);
  assert.equal(a.rapprochement.statusLabel, "Expédiée");
  assert.equal(a.brouillon.intention, "suivi");

  const b = analyserMail(mail({ sujet: "Newsletter", email: "promo@ailleurs.com" }), COMMANDES);
  assert.equal(b.rapprochement, null);
});

console.log(`SAV : ${reussis} tests réussis${echecs.length ? `, ${echecs.length} échec(s)` : ""}`);
for (const e of echecs) console.error(`  ✗ ${e}`);
if (echecs.length) process.exit(1);
