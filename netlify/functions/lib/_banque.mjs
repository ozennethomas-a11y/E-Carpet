import { createHash } from "node:crypto";

// Lecture d'un relevé bancaire exporté en CSV, et rapprochement avec les
// dépenses déjà saisies.
//
// Tout ce fichier est constitué de fonctions pures : aucune requête, aucun
// effet. C'est délibéré — le rapprochement décide de ce qui entre en
// comptabilité, il doit pouvoir être testé sans base et relu sans exécuter.
//
// Le format des exports bancaires n'est normalisé nulle part : séparateur
// point-virgule ou virgule, montant sur une colonne signée ou deux colonnes
// débit/crédit, date en JJ/MM/AAAA ou AAAA-MM-JJ, décimale à la française.
// L'analyseur reconnaît ces variantes plutôt que d'imposer un gabarit, parce
// qu'un import qui échoue silencieusement sur un relevé renvoie l'utilisateur
// à la saisie manuelle qu'on cherche justement à supprimer.

/** Catégories proposées — celles déjà utilisées dans l'onglet Finance. */
export const CATEGORIES = ["Publicité", "Abonnements", "Conformité/REP", "Transport", "Autre"];

// Règles de catégorisation, volontairement déterministes plutôt que confiées
// à un modèle : une écriture comptable doit être reproductible et explicable.
// L'ordre compte, la première correspondance gagne.
const REGLES = [
  { motifs: ["google ads", "googleads", "meta platf", "facebook", "tiktok ads", "adwords"], categorie: "Publicité" },
  { motifs: ["netlify", "neon", "openai", "anthropic", "adobe", "canva", "notion", "github", "brevo", "abonnement"], categorie: "Abonnements" },
  { motifs: ["ecosystem", "eco-organisme", "citeo", "refashion", "rep ", "ecotax"], categorie: "Conformité/REP" },
  { motifs: ["packlink", "mondial relay", "colissimo", "chronopost", "dhl", "ups", "fedex", "transport", "fret", "douane"], categorie: "Transport" },
];

// Libellés d'encaissement : ce ne sont pas des dépenses, et le chiffre
// d'affaires les compte déjà par ailleurs. Les rapprocher comme des charges
// fausserait doublement le résultat.
const ENCAISSEMENTS = ["stripe", "paypal", "amazon", "virement recu", "virement reçu"];

/** Retire accents, ponctuation et casse, pour comparer des libellés bancaires. */
export function normaliser(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Catégorie proposée pour un libellé, ou null si aucune règle ne s'applique.
 * Renvoyer null est un résultat valable : mieux vaut « à catégoriser » qu'une
 * catégorie inventée.
 */
export function categorieSuggeree(label) {
  const n = normaliser(label);
  if (!n) return null;
  for (const { motifs, categorie } of REGLES) {
    if (motifs.some((m) => n.includes(m))) return categorie;
  }
  return null;
}

/** Vrai si le libellé désigne un encaissement plutôt qu'une charge. */
export function estEncaissement(label) {
  const n = normaliser(label);
  return ENCAISSEMENTS.some((m) => n.includes(m));
}

/** Montant « 1 234,56 » ou « -12.34 » en centimes entiers. Null si illisible. */
export function montantEnCentimes(brut) {
  if (brut == null) return null;
  let t = String(brut).trim();
  if (!t) return null;

  // Certains exports notent le débit entre parenthèses.
  let negatif = /^\(.*\)$/.test(t);
  if (negatif) t = t.slice(1, -1);
  if (t.startsWith("-")) {
    negatif = true;
    t = t.slice(1);
  }

  t = t.replace(/[€\s ]/g, "");
  // Décimale française : la virgule sépare les centimes, le point les milliers.
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;

  const centimes = Math.round(parseFloat(t) * 100);
  return negatif ? -centimes : centimes;
}

/** Date « JJ/MM/AAAA », « JJ-MM-AAAA » ou « AAAA-MM-JJ » en Date UTC. Null si illisible. */
export function lireDate(brut) {
  const t = String(brut || "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return dateUtc(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (m) return dateUtc(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{2})[/-](\d{2})[/-](\d{2})$/);
  if (m) return dateUtc(2000 + +m[3], +m[2], +m[1]);
  return null;
}

function dateUtc(annee, mois, jour) {
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;
  const d = new Date(Date.UTC(annee, mois - 1, jour, 12));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Découpe une ligne CSV en respectant les guillemets. */
function decouper(ligne, sep) {
  const cellules = [];
  let courant = "";
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (entreGuillemets && ligne[i + 1] === '"') {
        courant += '"';
        i++;
      } else entreGuillemets = !entreGuillemets;
    } else if (c === sep && !entreGuillemets) {
      cellules.push(courant);
      courant = "";
    } else courant += c;
  }
  cellules.push(courant);
  return cellules.map((c) => c.trim());
}

/** Séparateur majoritaire hors guillemets. */
function detecterSeparateur(ligne) {
  const candidats = [";", "\t", ","];
  let meilleur = ";";
  let max = -1;
  for (const sep of candidats) {
    const n = decouper(ligne, sep).length;
    if (n > max) {
      max = n;
      meilleur = sep;
    }
  }
  return meilleur;
}

const ENTETES = {
  date: ["date", "date operation", "date de valeur", "date valeur", "date comptable"],
  label: ["libelle", "libelle operation", "label", "description", "nature", "intitule", "motif"],
  montant: ["montant", "amount", "valeur"],
  debit: ["debit"],
  credit: ["credit"],
};

function trouverColonne(entetes, cles) {
  // Correspondance exacte d'abord : « date » ne doit pas capter « date de
  // valeur » si les deux colonnes existent.
  for (const cle of cles) {
    const i = entetes.indexOf(cle);
    if (i !== -1) return i;
  }
  for (const cle of cles) {
    const i = entetes.findIndex((e) => e.includes(cle));
    if (i !== -1) return i;
  }
  return -1;
}

/**
 * Analyse un relevé CSV.
 * Renvoie { lignes, erreurs, colonnes } — `erreurs` liste les lignes ignorées
 * avec leur raison, pour qu'un import partiel se voie au lieu de passer pour
 * un import complet.
 */
export function parserReleve(texte) {
  const brutes = String(texte || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (brutes.length < 2) return { lignes: [], erreurs: [{ ligne: 0, raison: "fichier vide ou sans données" }], colonnes: null };

  const sep = detecterSeparateur(brutes[0]);
  const entetes = decouper(brutes[0], sep).map(normaliser);

  const iDate = trouverColonne(entetes, ENTETES.date);
  const iLabel = trouverColonne(entetes, ENTETES.label);
  const iMontant = trouverColonne(entetes, ENTETES.montant);
  const iDebit = trouverColonne(entetes, ENTETES.debit);
  const iCredit = trouverColonne(entetes, ENTETES.credit);

  if (iDate === -1 || iLabel === -1 || (iMontant === -1 && iDebit === -1 && iCredit === -1)) {
    return {
      lignes: [],
      erreurs: [{
        ligne: 1,
        raison:
          "colonnes non reconnues : il faut une colonne de date, une de libellé, " +
          "et une de montant (ou deux colonnes débit/crédit). Colonnes lues : " +
          entetes.join(", "),
      }],
      colonnes: null,
    };
  }

  const lignes = [];
  const erreurs = [];
  // Compteur d'occurrences : deux prélèvements identiques le même jour sont
  // possibles, et doivent donner deux empreintes différentes.
  const occurrences = new Map();

  for (let i = 1; i < brutes.length; i++) {
    const cellules = decouper(brutes[i], sep);
    const date = lireDate(cellules[iDate]);
    if (!date) {
      erreurs.push({ ligne: i + 1, raison: `date illisible : « ${cellules[iDate] ?? ""} »` });
      continue;
    }

    let centimes = null;
    if (iMontant !== -1) centimes = montantEnCentimes(cellules[iMontant]);
    if (centimes == null && iDebit !== -1) {
      const d = montantEnCentimes(cellules[iDebit]);
      if (d != null && d !== 0) centimes = -Math.abs(d);
    }
    if (centimes == null && iCredit !== -1) {
      const c = montantEnCentimes(cellules[iCredit]);
      if (c != null && c !== 0) centimes = Math.abs(c);
    }
    if (centimes == null || centimes === 0) {
      erreurs.push({ ligne: i + 1, raison: "montant illisible ou nul" });
      continue;
    }

    const label = (cellules[iLabel] || "").replace(/\s+/g, " ").trim() || "(sans libellé)";
    const cle = `${date.toISOString().slice(0, 10)}|${centimes}|${normaliser(label)}`;
    const rang = occurrences.get(cle) || 0;
    occurrences.set(cle, rang + 1);

    lignes.push({
      date,
      label,
      amountCents: centimes,
      fingerprint: createHash("sha256").update(`${cle}|${rang}`).digest("hex").slice(0, 32),
      suggestedCategory: centimes < 0 ? categorieSuggeree(label) : null,
      encaissement: centimes > 0 || estEncaissement(label),
    });
  }

  return { lignes, erreurs, colonnes: { sep, entetes } };
}

/**
 * Écart en jours CALENDAIRES entre deux dates.
 *
 * Comparer les horodatages bruts serait faux ici : une date bancaire est
 * ancrée à midi UTC par lireDate(), tandis qu'une date de dépense stockée en
 * base l'est à minuit. Deux dépenses à un jour de part et d'autre de la ligne
 * bancaire paraîtraient alors à des distances différentes (0,5 et 1,5 jour),
 * et le rapprochement pencherait systématiquement vers la plus tardive au
 * lieu de constater l'ambiguïté.
 */
function ecartEnJours(a, b) {
  const jour = (v) => {
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime())
      ? null
      : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const ja = jour(a);
  const jb = jour(b);
  if (ja == null || jb == null) return null;
  return Math.abs(ja - jb) / 86400000;
}

/** Écart maximal accepté entre la date bancaire et la date de la dépense. */
const TOLERANCE_JOURS = 5;

/**
 * Cherche la dépense correspondant à une ligne bancaire : même montant au
 * centime près, date proche, dépense pas déjà rattachée.
 *
 * Le montant doit être exact. Une tolérance sur le montant transformerait le
 * rapprochement en devinette, et une erreur de rapprochement est plus coûteuse
 * à retrouver qu'une ligne laissée à traiter à la main.
 *
 * En cas d'égalité, la dépense dont la date est la plus proche l'emporte ; si
 * plusieurs candidates subsistent à égalité stricte, on ne choisit pas —
 * proposer au hasard serait pire que de laisser l'admin trancher.
 */
export function chercherRapprochement(ligne, depenses) {
  if (ligne.amountCents >= 0) return null; // un encaissement n'est pas une dépense
  const cible = Math.abs(ligne.amountCents);

  const candidates = depenses
    .filter((d) => !d.dejaRattachee && d.amountCents === cible)
    .map((d) => ({ d, ecart: ecartEnJours(ligne.date, d.expenseDate) }))
    .filter((c) => c.ecart != null && c.ecart <= TOLERANCE_JOURS)
    .sort((a, b) => a.ecart - b.ecart);

  if (candidates.length === 0) return null;
  if (candidates.length > 1 && candidates[0].ecart === candidates[1].ecart) return null;
  return candidates[0].d;
}
