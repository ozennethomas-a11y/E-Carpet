// SAV assisté : rapproche un mail entrant de la commande concernée et prépare
// un brouillon de réponse que le propriétaire relit et envoie lui-même.
//
// Tout ce qui décide (rapprochement, intention, rédaction du brouillon) est ici
// sous forme de fonctions PURES : elles reçoivent les commandes déjà chargées
// en argument et ne touchent ni à la base ni au réseau. C'est ce qui les rend
// testables hors ligne (voir scripts/test-sav.mjs) et c'est aussi la garantie
// qu'aucun brouillon ne peut partir tout seul : rien ici n'envoie d'email.

import { trackingUrl } from "./_email.mjs";

// Libellés repris de src/components/OrdersPanel.jsx. Le projet n'a pas encore
// de module de statuts partagé entre le front et les fonctions ; on duplique
// donc la table ici plutôt que d'importer du JSX dans une fonction Netlify.
const STATUT_LABEL = {
  en_attente_paiement: "En attente de paiement",
  payee: "Payée",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
  remboursee: "Remboursée",
};

const SIGNATURE = "Bien cordialement,\nThomas\nE-Carpet · service-client@e-carpet.shop";

// Délai de rétractation annoncé dans les CGV (src/data/legal.js, article 6).
const JOURS_RETRACTATION = 30;

/**
 * Numéros de commande cités dans un texte.
 *
 * Les numéros de commande sont des entiers à 6 chiffres tirés au hasard entre
 * 100000 et 999999 (voir checkout.mjs). Six chiffres isolés, ça ressemble aussi
 * à un numéro de suivi tronqué, à un montant ou à une référence fournisseur :
 * on n'accepte donc un nombre que s'il est précédé d'un marqueur explicite
 * (« commande », « n° », « #»…). Mieux vaut ne rien trouver que se tromper.
 */
export function extraireNumerosCommande(texte) {
  if (!texte) return [];
  const motif = /(?:commande|order|cmd|r[ée]f\.?|réference|n[°o]\.?|#)[^0-9]{0,12}(\d{6})(?!\d)/gi;
  const trouves = [];
  for (const m of texte.matchAll(motif)) {
    const n = Number(m[1]);
    if (n >= 100000 && n <= 999999 && !trouves.includes(n)) trouves.push(n);
  }
  return trouves;
}

export function normaliserEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Rapproche un mail d'une commande. FONCTION PURE : `commandes` est la liste
 * déjà chargée par l'appelant, au format renvoyé par orders.mjs.
 *
 * Deux motifs de rapprochement seulement, tous les deux certains :
 *  - « numero » : un numéro de commande cité correspond exactement ;
 *  - « email »  : l'adresse de l'expéditeur est exactement celle d'une commande.
 * Aucun rapprochement approximatif (nom, ville, montant proche...) : sur une
 * boutique de 2 commandes, une fausse correspondance coûte bien plus cher
 * qu'un honnête « aucune commande identifiée ».
 *
 * @returns {{commande: object, motif: "numero"|"email", avertissement: string|null}|null}
 */
export function rapprocherCommande(mail, commandes) {
  const liste = Array.isArray(commandes) ? commandes : [];
  const texte = `${mail?.sujet || ""}\n${mail?.apercu || ""}`;

  // Le numéro cité prime sur l'adresse : c'est le signal le plus explicite, et
  // il reste valable quand un proche écrit depuis sa propre boîte.
  for (const numero of extraireNumerosCommande(texte)) {
    const commande = liste.find((c) => Number(c.orderNumber) === numero);
    if (commande) {
      const expediteur = normaliserEmail(mail?.email);
      const different = expediteur && normaliserEmail(commande.email) !== expediteur;
      return {
        commande,
        motif: "numero",
        avertissement: different
          ? `Le numéro ${numero} est cité, mais l'expéditeur (${expediteur}) n'est pas l'adresse de la commande (${commande.email}). À vérifier avant de répondre.`
          : null,
      };
    }
  }

  const expediteur = normaliserEmail(mail?.email);
  if (!expediteur) return null;

  const siennes = liste.filter((c) => normaliserEmail(c.email) === expediteur);
  if (siennes.length === 0) return null;

  // Plusieurs commandes pour la même adresse : on retient la plus récente, mais
  // on le dit, parce que le client parle peut-être d'une autre.
  const commande = siennes.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a));
  return {
    commande,
    motif: "email",
    avertissement:
      siennes.length > 1
        ? `${siennes.length} commandes pour cette adresse : la plus récente (n°${commande.orderNumber}) est proposée, vérifiez de laquelle il s'agit.`
        : null,
  };
}

const INTENTIONS = [
  { id: "annulation", motif: /annul|se r[ée]tracte|ne veux plus|renoncer/i },
  { id: "retour", motif: /retour|rembours|r[ée]tractation|renvoyer|ne (me )?convient pas|d[ée]fectueu|cass|ab[îi]m/i },
  { id: "suivi", motif: /suivi|livrais|coliss?|o[ùu] (en )?est|(pas|non|jamais) re[çc]u|pas arriv|exp[ée]di|d[ée]lai|quand/i },
  { id: "produit", motif: /compatib|dimension|taille|mati[èe]re|entretien|nettoy|couleur|utilis/i },
];

/** Intention dominante du message, d'après le sujet et l'aperçu. */
export function detecterIntention(mail) {
  const texte = `${mail?.sujet || ""} ${mail?.apercu || ""}`;
  return INTENTIONS.find((i) => i.motif.test(texte))?.id || "autre";
}

function dateFr(valeur) {
  if (!valeur) return null;
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("fr-FR");
}

function delaiLivraison(commande) {
  return commande?.shippingAddress?.deliveryMode === "relais" ? "1 à 3 jours ouvrés" : "1 à 2 jours ouvrés";
}

/** Bloc « où en est le colis », commun à plusieurs intentions. */
function paragrapheSuivi(commande, aCompleter) {
  const numero = commande.orderNumber;
  switch (commande.status) {
    case "expediee":
    case "livree": {
      const expedie = dateFr(commande.shippedAt);
      const lien = trackingUrl(commande.trackingCarrier, commande.trackingNumber);
      const lignes = [
        `Votre commande n°${numero} a bien été expédiée${expedie ? ` le ${expedie}` : ""}${commande.trackingCarrier ? ` par ${commande.trackingCarrier}` : ""}.`,
      ];
      if (commande.trackingNumber) lignes.push(`Numéro de suivi : ${commande.trackingNumber}${lien ? `\n${lien}` : ""}`);
      lignes.push(`Le délai de livraison annoncé est de ${delaiLivraison(commande)} après l'expédition.`);
      return lignes.join("\n");
    }
    case "payee":
      return `Votre commande n°${numero} est bien enregistrée et payée. Elle part sous 24 à 48 heures ouvrées, et vous recevrez le numéro de suivi par email dès l'expédition.`;
    case "en_attente_paiement":
      aCompleter.push("Vérifier côté Stripe si le paiement a finalement abouti avant d'envoyer.");
      return `Je retrouve bien votre commande n°${numero}, mais le paiement n'a pas été finalisé de notre côté : elle n'est donc pas encore validée.`;
    case "annulee":
      return `Votre commande n°${numero} est enregistrée comme annulée chez nous.`;
    case "remboursee":
      return `Votre commande n°${numero} a été remboursée. Le délai d'apparition sur le compte dépend de la banque, comptez généralement quelques jours ouvrés.`;
    default:
      aCompleter.push(`Statut inhabituel (${commande.status}) : à formuler à la main.`);
      return `Votre commande n°${numero} est actuellement au statut « ${STATUT_LABEL[commande.status] || commande.status} ».`;
  }
}

function paragrapheRetour(commande, aCompleter) {
  const recu = commande ? dateFr(commande.shippedAt) : null;
  aCompleter.push("Ajouter l'adresse de retour avant l'envoi.");
  return [
    `Vous disposez de ${JOURS_RETRACTATION} jours à compter de la réception pour nous retourner le produit, non utilisé et dans son emballage d'origine.`,
    recu ? `Votre colis a été expédié le ${recu}, vous êtes donc dans les délais.` : null,
    "Confirmez-moi simplement votre accord et je vous transmets l'adresse de retour ainsi que la marche à suivre. Le remboursement est effectué dès réception du colis.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function paragrapheAnnulation(commande, aCompleter) {
  if (!commande) return "Pour annuler, j'ai besoin de votre numéro de commande à 6 chiffres, il figure dans l'email de confirmation.";
  if (commande.status === "en_attente_paiement") {
    return `Votre commande n°${commande.orderNumber} n'a pas été payée, il n'y a donc rien à annuler ni aucun montant prélevé.`;
  }
  if (commande.status === "payee") {
    aCompleter.push("Annuler réellement la commande en admin et déclencher le remboursement Stripe après réponse du client.");
    return `Votre commande n°${commande.orderNumber} n'est pas encore partie : je peux l'annuler et vous rembourser intégralement. Confirmez-moi que c'est bien ce que vous souhaitez.`;
  }
  return `Votre commande n°${commande.orderNumber} est déjà partie, elle ne peut plus être annulée. En revanche, vous pouvez la refuser à la livraison ou nous la retourner sous ${JOURS_RETRACTATION} jours pour un remboursement complet.`;
}

/**
 * Brouillon de réponse, entièrement déterministe. FONCTION PURE.
 * `commande` peut être nulle : le brouillon le dit franchement et demande le
 * numéro de commande, plutôt que d'inventer un statut.
 *
 * @returns {{objet: string, corps: string, intention: string, aCompleter: string[]}}
 */
export function construireBrouillon({ mail, commande = null }) {
  const intention = detecterIntention(mail);
  const aCompleter = [];
  const prenom = commande?.shippingAddress?.firstName || "";
  const parts = [prenom ? `Bonjour ${prenom},` : "Bonjour,"];

  if (!commande) {
    aCompleter.push("Aucune commande rapprochée : vérifier l'identité du client avant de répondre.");
  }

  if (intention === "retour") {
    parts.push("Merci de votre message, et désolé que le produit ne vous convienne pas.");
    parts.push(paragrapheRetour(commande, aCompleter));
  } else if (intention === "annulation") {
    parts.push("Merci de votre message.");
    parts.push(paragrapheAnnulation(commande, aCompleter));
  } else if (intention === "suivi") {
    parts.push("Merci de votre message, je regarde ça tout de suite.");
    parts.push(
      commande
        ? paragrapheSuivi(commande, aCompleter)
        : "Je ne retrouve aucune commande associée à cette adresse email. Pouvez-vous me communiquer votre numéro de commande à 6 chiffres, ou l'adresse utilisée lors de l'achat ? Je vérifie immédiatement.",
    );
  } else if (intention === "produit") {
    parts.push("Merci de votre message et de votre intérêt pour E-Carpet.");
    aCompleter.push("Répondre à la question produit : le gabarit ne peut pas la deviner.");
    parts.push("[Réponse à la question produit à écrire ici.]");
  } else {
    parts.push("Merci de votre message.");
    aCompleter.push("Intention non identifiée : écrire la réponse à la main.");
    parts.push("[Réponse à écrire ici.]");
    if (commande) parts.push(paragrapheSuivi(commande, aCompleter));
  }

  parts.push("Je reste à votre disposition.");
  parts.push(SIGNATURE);

  const sujet = mail?.sujet || "votre message";
  return {
    objet: /^re\s*:/i.test(sujet) ? sujet : `Re: ${sujet}`,
    corps: parts.join("\n\n"),
    intention,
    aCompleter,
  };
}

/**
 * Assemble le SAV d'un mail : rapprochement + brouillon. FONCTION PURE.
 * Utilisée telle quelle par mail-alerts.mjs une fois les commandes chargées.
 */
export function analyserMail(mail, commandes) {
  const trouve = rapprocherCommande(mail, commandes);
  const commande = trouve?.commande || null;
  return {
    rapprochement: commande
      ? {
          orderNumber: commande.orderNumber,
          status: commande.status,
          statusLabel: STATUT_LABEL[commande.status] || commande.status,
          email: commande.email,
          trackingNumber: commande.trackingNumber,
          trackingCarrier: commande.trackingCarrier,
          createdAt: commande.createdAt,
          motif: trouve.motif,
          avertissement: trouve.avertissement,
        }
      : null,
    brouillon: construireBrouillon({ mail, commande }),
  };
}

// --- Reformulation facultative par le modèle -------------------------------
// La clé peut très bien être absente : dans ce cas on renvoie le brouillon
// déterministe tel quel. Le modèle n'a le droit que de REFORMULER le gabarit,
// jamais d'inventer un statut ou un numéro de suivi, et le résultat reste un
// brouillon relu par le propriétaire. Aucun envoi ici non plus.

export function iaConfiguree() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function reformulerBrouillon(brouillon, { faits = "" } = {}) {
  if (!iaConfiguree()) return { ...brouillon, source: "gabarit" };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      system:
        "Tu reformules un brouillon de réponse SAV pour la boutique E-Carpet (tapis en silicone pour trottinettes électriques). " +
        "Ton premium, phrases courtes, pas de superlatifs creux, vouvoiement, français. " +
        "Interdits : inventer un fait (statut, date, numéro de suivi, délai) absent du brouillon, supprimer un passage entre crochets [ ] qui reste à compléter, utiliser le tiret cadratin. " +
        "Renvoie uniquement le corps du message reformulé, sans commentaire.",
      messages: [{ role: "user", content: `${faits ? `Faits vérifiés :\n${faits}\n\n` : ""}Brouillon à reformuler :\n${brouillon.corps}` }],
    }),
  });

  if (!res.ok) return { ...brouillon, source: "gabarit" };
  const json = await res.json().catch(() => null);
  const texte = json?.content?.map((b) => b.text || "").join("").trim();
  return texte ? { ...brouillon, corps: texte, source: "ia" } : { ...brouillon, source: "gabarit" };
}
