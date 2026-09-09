import { sql } from "./_db.mjs";
import { STATUTS_PAYES } from "./_statuts.mjs";
import { stripeSecretKey, stripeRequest } from "./_stripe.mjs";

// Détection d'anomalies : ce qui cloche et que personne ne regarde.
//
// Le back-office affiche beaucoup d'écrans, mais aucun ne dit « va voir là ».
// Une commande payée jamais expédiée, un paiement encaissé dont le webhook
// n'a pas abouti, un stock qui ne bouge plus, des commissions dues qu'on
// oublie de verser : rien de tout cela ne se signale, il faut y penser.
//
// Trois partis pris :
//
//  1. Détection déterministe, pas de modèle. Une anomalie doit être
//     reproductible et explicable : « cette commande est payée depuis 6 jours
//     et non expédiée » se vérifie, contrairement à un score.
//
//  2. Chaque anomalie porte son propre seuil et son propre texte. On ne
//     détecte que ce dont on sait dire quoi faire — une alerte sans action
//     possible n'est que du bruit, et le bruit finit par masquer le signal.
//
//  3. Silence quand la donnée manque. Sur un historique trop court, une
//     comparaison de tendance produit des faux positifs à répétition ; mieux
//     vaut ne rien dire que crier au loup.

const JOUR = 86400000;

/** Seuils, regroupés ici pour être ajustables sans relire la logique. */
export const SEUILS = {
  expeditionJours: 3, // commande payée non expédiée
  paiementBloqueHeures: 6, // avant de suspecter un webhook défaillant
  paiementBloqueMaxJours: 30, // au-delà, la session Stripe a expiré : rien à vérifier
  stockImmobileJours: 30, // aucune sortie de stock
  depenseAnormaleFacteur: 2.5, // × la moyenne de sa catégorie
  depenseHistoriqueMin: 4, // dépenses minimales avant de juger « inhabituel »
  commissionsSeuilCents: 2000, // seuil de virement affilié
  banqueATraiterJours: 14, // lignes bancaires laissées en attente
  baisseCaPourcent: 30, // chute de CA d'une période à l'autre
  baisseCaCommandesMin: 5, // en deçà, l'échantillon ne veut rien dire
};

// Destinations du back-office, pour que chaque anomalie mène à l'écran où on
// la corrige. Les identifiants doivent rester alignés sur SECTIONS dans
// DashboardPage.jsx.
export const OU = {
  commandes: { section: "site", tab: "commandes", label: "Commandes" },
  stock: { section: "stock", label: "Stock" },
  finance: { section: "finance", label: "Finance" },
  social: { section: "social", label: "Réseaux sociaux" },
};

const critique = (code, titre, detail, action) => ({ code, severite: "critique", titre, detail, action: action || null });
const attention = (code, titre, detail, action) => ({ code, severite: "attention", titre, detail, action: action || null });
const info = (code, titre, detail, action) => ({ code, severite: "info", titre, detail, action: action || null });

/** « il y a 3 jours », à partir d'un nombre de millisecondes. */
function depuis(ms) {
  const jours = Math.floor(ms / JOUR);
  if (jours >= 1) return `${jours} jour${jours > 1 ? "s" : ""}`;
  const heures = Math.floor(ms / 3600000);
  return `${heures} heure${heures > 1 ? "s" : ""}`;
}

const euros = (cents) => `${(cents / 100).toFixed(2)} €`;

/** Horodatage d'il y a N jours, passé en paramètre plutôt qu'interpolé. */
const ilYaJours = (n) => new Date(Date.now() - n * JOUR).toISOString();
const ilYaHeures = (n) => new Date(Date.now() - n * 3600000).toISOString();

// --- Détecteurs ------------------------------------------------------------

async function commandesNonExpediees() {
  const rows = await sql()`
    select order_number, created_at
    from orders
    where status = 'payee' and created_at < ${ilYaJours(SEUILS.expeditionJours)}
    order by created_at
  `;
  if (!rows.length) return [];
  const plusAncienne = Math.max(...rows.map((r) => Date.now() - new Date(r.created_at).getTime()));
  return [
    critique(
      "expedition_en_retard",
      `${rows.length} commande${rows.length > 1 ? "s" : ""} payée${rows.length > 1 ? "s" : ""} non expédiée${rows.length > 1 ? "s" : ""}`,
      `La plus ancienne attend depuis ${depuis(plusAncienne)} : ${rows.map((r) => `n°${r.order_number}`).join(", ")}.`,
      OU.commandes,
    ),
  ];
}

// Paiement réellement encaissé, mais commande restée « en attente ».
//
// Deux pièges, tous deux rencontrés en construisant ce détecteur :
//
//  1. Une session Stripe est créée dès que le client ARRIVE sur la page de
//     paiement, pas quand il paie. S'appuyer sur sa seule présence revient à
//     alerter sur chaque panier abandonné — un bruit permanent qui masque le
//     signal. Cas réel : un client a laissé trois commandes en quatre minutes
//     le 21/08/2026, dont deux abandons parfaitement normaux.
//
//  2. stripe_payment_intent_id ne peut pas servir de filtre : il n'est écrit
//     que par marquerCommandePayee(), au moment même où le statut passe à
//     « payée ». Une commande en attente n'en a donc jamais, et s'en servir
//     rendrait ce détecteur incapable de se déclencher.
//
// Seul Stripe détient la réponse : on interroge le statut réel de la session.
// L'appel est borné (MAX_VERIFICATIONS) et précédé d'un filtre gratuit — on
// écarte d'abord les tentatives suivies d'un achat réussi par le même client,
// qui sont le schéma classique du client qui s'y reprend à plusieurs fois.
const MAX_VERIFICATIONS = 20;

async function paiementsBloques() {
  const candidates = await sql()`
    select o.order_number, o.email, o.created_at, o.total_cents, o.stripe_session_id
    from orders o
    where o.status = 'en_attente_paiement'
      and o.stripe_session_id is not null
      and o.created_at < ${ilYaHeures(SEUILS.paiementBloqueHeures)}
      and o.created_at > ${ilYaJours(SEUILS.paiementBloqueMaxJours)}
      and not exists (
        select 1 from orders p
        where p.email = o.email
          and p.status = any(${STATUTS_PAYES})
          and p.created_at between o.created_at and o.created_at + interval '2 hours'
      )
    order by o.created_at desc
    limit ${MAX_VERIFICATIONS}
  `;
  if (!candidates.length) return [];

  const key = stripeSecretKey();
  if (!key) return []; // sans clé, on ne devine pas : on se tait

  const encaissees = [];
  for (const o of candidates) {
    try {
      const session = await stripeRequest(`/checkout/sessions/${o.stripe_session_id}`, null, key, { method: "GET" });
      if (session.payment_status === "paid") encaissees.push(o);
    } catch {
      // Session expirée ou introuvable : ce n'est pas une anomalie, c'est un
      // abandon ancien. On n'alerte que sur ce qu'on a pu confirmer.
    }
  }
  if (!encaissees.length) return [];

  const total = encaissees.reduce((s, o) => s + o.total_cents, 0);
  return [
    critique(
      "paiement_bloque",
      `${encaissees.length} paiement${encaissees.length > 1 ? "s" : ""} encaissé${encaissees.length > 1 ? "s" : ""} sans commande validée`,
      `${euros(total)} confirmé${encaissees.length > 1 ? "s" : ""} par Stripe sur ${encaissees.map((o) => `n°${o.order_number}`).join(", ")}, ` +
        `alors que la commande est restée « en attente de paiement ». Le webhook n'a pas abouti : ` +
        `le client a payé et attend, marquez la commande payée depuis l'écran Commandes.`,
      OU.commandes,
    ),
  ];
}

async function stockCritique() {
  const rows = await sql()`
    select name, stock, reorder_threshold from products where active = true
  `;
  const sorties = [];
  for (const p of rows) {
    if (p.stock <= 0) {
      sorties.push(critique("rupture", `Rupture de stock : ${p.name}`, "Le stock est à zéro : les ventes du site sont bloquées.", OU.stock));
    } else if (p.reorder_threshold != null && p.stock <= p.reorder_threshold) {
      sorties.push(
        attention(
          "seuil_reassort",
          `Seuil de réassort atteint : ${p.name}`,
          `Il reste ${p.stock} unité${p.stock > 1 ? "s" : ""}, pour un seuil fixé à ${p.reorder_threshold}.`,
          OU.stock,
        ),
      );
    }
  }
  return sorties;
}

async function stockImmobile() {
  const [mouvement] = await sql()`
    select max(movement_date) as dernier from stock_movements where type = 'sortie'
  `;
  if (!mouvement?.dernier) return []; // aucun historique : rien à déduire
  const ecart = Date.now() - new Date(mouvement.dernier).getTime();
  if (ecart < SEUILS.stockImmobileJours * JOUR) return [];
  return [
    attention(
      "stock_immobile",
      "Aucune sortie de stock récente",
      `La dernière sortie remonte à ${depuis(ecart)}. Soit les ventes se sont arrêtées, soit la synchronisation ne remonte plus les sorties.`,
      OU.stock,
    ),
  ];
}

// Une dépense très supérieure à l'habitude de sa catégorie : erreur de saisie,
// prélèvement inattendu, ou changement de tarif à constater.
async function depensesInhabituelles() {
  const rows = await sql()`
    select id, category, amount_cents, expense_date, note
    from expenses
    where expense_date >= now() - interval '30 days'
    order by amount_cents desc
  `;
  if (!rows.length) return [];

  const references = await sql()`
    select category, avg(amount_cents)::float as moyenne, count(*)::int as nb
    from expenses
    where expense_date < now() - interval '30 days'
    group by category
  `;
  const parCategorie = new Map(references.map((r) => [r.category, r]));

  const sorties = [];
  for (const d of rows) {
    const ref = parCategorie.get(d.category);
    // Sans historique suffisant, on ne juge pas : la première dépense d'une
    // catégorie serait sinon toujours « anormale ».
    if (!ref || ref.nb < SEUILS.depenseHistoriqueMin) continue;
    if (d.amount_cents > ref.moyenne * SEUILS.depenseAnormaleFacteur) {
      sorties.push(
        attention(
          "depense_inhabituelle",
          `Dépense inhabituelle : ${d.category}`,
          `${euros(d.amount_cents)} le ${new Date(d.expense_date).toLocaleDateString("fr-FR")}${d.note ? ` (${d.note})` : ""}, ` +
            `contre ${euros(Math.round(ref.moyenne))} en moyenne sur cette catégorie.`,
          OU.finance,
        ),
      );
    }
  }
  return sorties;
}

async function commissionsAVerser() {
  const rows = await sql()`
    select a.name, coalesce(sum(c.amount_cents), 0)::int as du
    from affiliates a
    join affiliate_commissions c on c.affiliate_id = a.id and c.status = 'due'
    group by a.id, a.name
    having coalesce(sum(c.amount_cents), 0) >= ${SEUILS.commissionsSeuilCents}
    order by du desc
  `;
  if (!rows.length) return [];
  const total = rows.reduce((s, r) => s + r.du, 0);
  return [
    info(
      "commissions_dues",
      `${rows.length} partenaire${rows.length > 1 ? "s" : ""} au-dessus du seuil de virement`,
      `${euros(total)} de commissions dues : ${rows.map((r) => `${r.name} (${euros(r.du)})`).join(", ")}.`,
      OU.social,
    ),
  ];
}

async function banqueEnAttente() {
  // La table peut ne pas exister sur une base antérieure à la migration.
  let rows;
  try {
    rows = await sql()`
      select count(*)::int as nb, min(value_date) as plus_ancienne,
             coalesce(sum(amount_cents) filter (where amount_cents < 0), 0)::int as debits
      from bank_transactions where status = 'a_traiter'
    `;
  } catch {
    return [];
  }
  const r = rows?.[0];
  if (!r?.nb || !r.plus_ancienne) return [];
  const ecart = Date.now() - new Date(r.plus_ancienne).getTime();
  if (ecart < SEUILS.banqueATraiterJours * JOUR) return [];
  return [
    attention(
      "banque_en_attente",
      `${r.nb} ligne${r.nb > 1 ? "s" : ""} bancaire${r.nb > 1 ? "s" : ""} non rapprochée${r.nb > 1 ? "s" : ""}`,
      `La plus ancienne date d'il y a ${depuis(ecart)}, pour ${euros(Math.abs(r.debits))} de débits non rattachés à une dépense.`,
      OU.finance,
    ),
  ];
}

async function chuteDesVentes() {
  const [actuelle] = await sql()`
    select count(*)::int as nb, coalesce(sum(total_cents), 0)::int as ca
    from orders
    where created_at >= now() - interval '30 days' and status = any(${STATUTS_PAYES})
  `;
  const [precedente] = await sql()`
    select count(*)::int as nb, coalesce(sum(total_cents), 0)::int as ca
    from orders
    where created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'
      and status = any(${STATUTS_PAYES})
  `;
  // Échantillon trop petit : une variation ne signifierait rien.
  if (!precedente || precedente.nb < SEUILS.baisseCaCommandesMin || !precedente.ca) return [];
  const baisse = ((precedente.ca - actuelle.ca) / precedente.ca) * 100;
  if (baisse < SEUILS.baisseCaPourcent) return [];
  return [
    attention(
      "chute_ventes",
      `Chiffre d'affaires en baisse de ${Math.round(baisse)} %`,
      `${euros(actuelle.ca)} sur 30 jours contre ${euros(precedente.ca)} sur les 30 précédents ` +
        `(${actuelle.nb} commande${actuelle.nb > 1 ? "s" : ""} contre ${precedente.nb}).`,
      null,
    ),
  ];
}

// --- Assemblage ------------------------------------------------------------

const DETECTEURS = [
  commandesNonExpediees,
  paiementsBloques,
  stockCritique,
  stockImmobile,
  depensesInhabituelles,
  commissionsAVerser,
  banqueEnAttente,
  chuteDesVentes,
];

const ORDRE = { critique: 0, attention: 1, info: 2 };

/**
 * Exécute tous les détecteurs et renvoie les anomalies, les plus graves
 * d'abord.
 *
 * Un détecteur qui échoue n'interrompt pas les autres : une anomalie non
 * détectée est moins grave qu'un écran vide qui laisserait croire que tout va
 * bien. L'échec est renvoyé dans `erreurs` pour rester visible.
 */
export async function detecterAnomalies() {
  const anomalies = [];
  const erreurs = [];

  const resultats = await Promise.allSettled(DETECTEURS.map((d) => d()));
  resultats.forEach((r, i) => {
    if (r.status === "fulfilled") anomalies.push(...r.value);
    else erreurs.push({ detecteur: DETECTEURS[i].name, message: r.reason?.message || String(r.reason) });
  });

  anomalies.sort((a, b) => ORDRE[a.severite] - ORDRE[b.severite]);
  return {
    anomalies,
    erreurs,
    compte: {
      critique: anomalies.filter((a) => a.severite === "critique").length,
      attention: anomalies.filter((a) => a.severite === "attention").length,
      info: anomalies.filter((a) => a.severite === "info").length,
    },
  };
}
