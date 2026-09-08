import { sql } from "./_db.mjs";

// Outils de LECTURE SEULE mis à disposition de l'assistant.
//
// Règle de sécurité centrale : l'assistant ne rédige jamais de SQL. Il choisit
// un outil dans cette liste et fournit des paramètres, que l'on valide et que
// l'on injecte en requête préparée. Un outil ne peut donc jamais écrire, ni
// lire une table qui n'est pas prévue ici (aucun accès aux mots de passe,
// jetons de session, clés Face ID, jetons des réseaux sociaux...).
//
// Ajouter un outil = ajouter une entrée ici. Il n'y a pas d'autre chemin.

const MOIS_MAX = 36;

// Angles morts connus des données, attachés au résultat des outils concernés
// plutôt qu'aux seules consignes générales : un modèle — surtout un petit
// modèle local — signale beaucoup plus fiablement une limite qu'il a sous les
// yeux au moment de rédiger que celle lue dans un préambule lointain.
const LIMITE_CANAUX =
  "Ces chiffres ne couvrent QUE les ventes du site. Les ventes Amazon, PayPal et B2B (MF-World) ne sont pas dans le système : le total réel est supérieur. À signaler dans la réponse.";
const LIMITE_STATUTS =
  "Les commandes annulées et en attente de paiement sont exclues de ces totaux. À signaler s'il en existe sur la période.";
const LIMITE_STOCK =
  "Le stock est décrémenté par les ventes du site et la synchronisation Amazon, mais pas par les ventes B2B directes : une prévision de rupture calculée ici est donc optimiste. À signaler dans la réponse.";
const LIMITE_ACHATS =
  "Tous les achats fournisseur ne sont pas saisis dans le système : une marge ou un coût calculé à partir de ces données peut être optimiste. À signaler dans la réponse.";

/** Bornes de dates sûres : format ISO strict, période plafonnée. */
function bornes(params) {
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  const to = isDate(params?.to) ? params.to : new Date().toISOString().slice(0, 10);
  const defautFrom = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  let from = isDate(params?.from) ? params.from : defautFrom;
  // Garde-fou : une plage démesurée ferait tourner la fonction trop longtemps.
  const limite = new Date(new Date(to).getTime() - MOIS_MAX * 30 * 86400000).toISOString().slice(0, 10);
  if (from < limite) from = limite;
  return { from, to };
}

function limite(params, defaut = 20, max = 100) {
  const n = parseInt(params?.limit, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), max) : defaut;
}

export const OUTILS = {
  ventes_periode: {
    description:
      "Chiffre d'affaires, nombre de commandes et panier moyen du site sur une période. Exclut les commandes annulées et non payées. Ne couvre pas les ventes Amazon (outil ventes_amazon) ni les ventes PayPal/B2B historiques, absentes du système.",
    schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Date de début, format AAAA-MM-JJ. Omettre pour les 30 derniers jours." },
        to: { type: "string", description: "Date de fin incluse, format AAAA-MM-JJ. Omettre pour aujourd'hui." },
      },
    },
    async run(params) {
      const { from, to } = bornes(params);
      const [r] = await sql()`
        select count(*)::int as nb_commandes,
               coalesce(sum(total_cents), 0)::int as ca_cents,
               coalesce(sum(discount_cents), 0)::int as remises_cents,
               coalesce(sum(stripe_fee_cents), 0)::int as frais_stripe_cents,
               coalesce(sum(shipping_cost_cents), 0)::int as expedition_reelle_cents,
               count(shipping_cost_cents)::int as nb_avec_cout_expedition_reel
        from orders
        where created_at >= ${from}::date and created_at < (${to}::date + interval '1 day')
          and status not in ('annulee', 'en_attente_paiement')
      `;
      // Comptées à part pour pouvoir dire combien de commandes sont exclues,
      // plutôt que de laisser croire que le total couvre tout.
      const [exclues] = await sql()`
        select count(*)::int as nb
        from orders
        where created_at >= ${from}::date and created_at < (${to}::date + interval '1 day')
          and status in ('annulee', 'en_attente_paiement')
      `;
      return {
        periode: { from, to },
        ...r,
        panier_moyen_cents: r.nb_commandes ? Math.round(r.ca_cents / r.nb_commandes) : 0,
        commandes_exclues: exclues.nb,
        limites: [LIMITE_CANAUX, LIMITE_STATUTS],
      };
    },
  },

  ventes_par_mois: {
    description:
      "Évolution mensuelle du chiffre d'affaires et du nombre de commandes du site, pour repérer une tendance ou une saisonnalité.",
    schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Date de début, format AAAA-MM-JJ. Omettre pour les 30 derniers jours." },
        to: { type: "string", description: "Date de fin incluse, format AAAA-MM-JJ. Omettre pour aujourd'hui." },
      },
    },
    async run(params) {
      const { from, to } = bornes(params);
      const rows = await sql()`
        select to_char(date_trunc('month', created_at), 'YYYY-MM') as mois,
               count(*)::int as nb_commandes,
               coalesce(sum(total_cents), 0)::int as ca_cents
        from orders
        where created_at >= ${from}::date and created_at < (${to}::date + interval '1 day')
          and status not in ('annulee', 'en_attente_paiement')
        group by 1 order by 1
      `;
      return { periode: { from, to }, mois: rows, limites: [LIMITE_CANAUX, LIMITE_STATUTS] };
    },
  },

  commandes_recentes: {
    description:
      "Liste des dernières commandes avec leur statut, montant, suivi d'expédition et coût d'expédition réel s'il est renseigné. Utile pour répondre sur une commande précise ou voir ce qui est en attente.",
    schema: {
      type: "object",
      properties: {
        statut: {
          type: "string",
          description:
            "Filtre optionnel sur le statut exact : payee, expediee, livree, annulee, en_attente_paiement",
        },
        limit: { type: "integer", description: "Nombre de commandes à retourner (défaut 20, max 100)" },
      },
    },
    async run(params) {
      const n = limite(params);
      const statut = typeof params?.statut === "string" ? params.statut : null;
      const rows = await sql()`
        select o.order_number, o.created_at, o.status, o.total_cents, o.shipping_cost_cents,
               o.tracking_carrier, o.tracking_number, o.email,
               c.first_name, c.last_name
        from orders o
        left join customers c on c.id = o.customer_id
        where (${statut}::text is null or o.status = ${statut})
        order by o.created_at desc
        limit ${n}
      `;
      return { commandes: rows };
    },
  },

  stock_actuel: {
    description:
      "Stock actuel par produit, seuil de réassort configuré, et derniers mouvements de stock (entrées/sorties). Utile pour anticiper une rupture.",
    schema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Nombre de mouvements récents à inclure (défaut 20, max 100)" },
      },
    },
    async run(params) {
      const n = limite(params);
      const produits = await sql()`
        select id, sku, name, stock, reorder_threshold, price_cents, active
        from products order by name
      `;
      const mouvements = await sql()`
        select m.movement_date, m.type, m.quantity, m.source, m.note, p.name as produit
        from stock_movements m join products p on p.id = m.product_id
        order by m.movement_date desc limit ${n}
      `;
      return { produits, mouvements_recents: mouvements, limites: [LIMITE_STOCK] };
    },
  },

  depenses_periode: {
    description:
      "Dépenses saisies manuellement (publicité, abonnements, frais divers) regroupées par catégorie sur une période. Ne contient pas les achats de stock fournisseur, qui sont dans lots_couts.",
    schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Date de début, format AAAA-MM-JJ. Omettre pour les 30 derniers jours." },
        to: { type: "string", description: "Date de fin incluse, format AAAA-MM-JJ. Omettre pour aujourd'hui." },
      },
    },
    async run(params) {
      const { from, to } = bornes(params);
      const rows = await sql()`
        select category, count(*)::int as nb, coalesce(sum(amount_cents), 0)::int as total_cents
        from expenses
        where expense_date >= ${from}::date and expense_date < (${to}::date + interval '1 day')
        group by category order by total_cents desc
      `;
      const [total] = await sql()`
        select coalesce(sum(amount_cents), 0)::int as total_cents
        from expenses
        where expense_date >= ${from}::date and expense_date < (${to}::date + interval '1 day')
      `;
      return {
        periode: { from, to },
        par_categorie: rows,
        total_cents: total.total_cents,
        limites: ["Ces dépenses n'incluent PAS les achats de stock fournisseur (voir l'outil lots_couts)."],
      };
    },
  },

  lots_couts: {
    description:
      "Lots de production fournisseur (coût de revient) : quantité, coût unitaire, fournisseur, facture rattachée et détail des lignes de coût. Utile pour analyser l'évolution du coût d'achat.",
    schema: { type: "object", properties: {} },
    async run() {
      const lots = await sql()`
        select b.id, b.label, b.quantity, b.order_date, b.supplier, b.invoice_file,
               p.name as produit, pc.unit_cost_cents,
               coalesce((select sum(l.amount_cents) from cost_batch_lines l where l.batch_id = b.id), 0)::int as total_cents
        from cost_batches b
        join products p on p.id = b.product_id
        left join product_costs pc on pc.id = b.product_cost_id
        order by b.order_date desc
      `;
      return { lots, limites: [LIMITE_ACHATS] };
    },
  },

  clients_top: {
    description:
      "Meilleurs clients par total dépensé, avec leur nombre de commandes. Commandes annulées exclues du total.",
    schema: {
      type: "object",
      properties: { limit: { type: "integer", description: "Nombre de clients (défaut 20, max 100)" } },
    },
    async run(params) {
      const n = limite(params);
      const rows = await sql()`
        select c.email, c.first_name, c.last_name, c.created_at,
               count(o.id) filter (where o.status not in ('annulee', 'en_attente_paiement'))::int as nb_commandes,
               coalesce(sum(o.total_cents) filter (where o.status not in ('annulee', 'en_attente_paiement')), 0)::int as total_depense_cents
        from customers c
        left join orders o on o.customer_id = c.id
        group by c.id, c.email, c.first_name, c.last_name, c.created_at
        order by total_depense_cents desc
        limit ${n}
      `;
      return { clients: rows, limites: [LIMITE_CANAUX] };
    },
  },

  affilies_performance: {
    description:
      "Partenaires affiliés : statut, code promo, taux de commission, commissions dues et déjà versées, et chiffre d'affaires généré.",
    schema: { type: "object", properties: {} },
    async run() {
      const rows = await sql()`
        select a.name, a.email, a.status, a.commission_percent, a.campaign_slug, p.code as code_promo,
               count(c.id) filter (where c.status != 'annulee')::int as nb_commissions,
               coalesce(sum(c.amount_cents) filter (where c.status = 'due'), 0)::int as commissions_dues_cents,
               coalesce(sum(c.amount_cents) filter (where c.status = 'payee'), 0)::int as commissions_versees_cents
        from affiliates a
        left join promo_codes p on p.id = a.promo_code_id
        left join affiliate_commissions c on c.affiliate_id = a.id
        group by a.id, a.name, a.email, a.status, a.commission_percent, a.campaign_slug, p.code
        order by commissions_dues_cents desc
      `;
      return { affilies: rows };
    },
  },

  influenceurs_suivi: {
    description:
      "Tableau de suivi du démarchage influenceurs : plateforme, abonnés, statut, publication et prochaine action prévue.",
    schema: { type: "object", properties: {} },
    async run() {
      const rows = await sql()`
        select name, platform, followers, contact, offer, status, publication, on_site, next_action, note
        from influencer_contacts order by updated_at desc
      `;
      return { influenceurs: rows };
    },
  },

  codes_promo: {
    description:
      "Codes promo existants : type de remise, valeur, nombre d'utilisations, expiration, origine (créé à la main, récompense avis, partenaire affilié).",
    schema: { type: "object", properties: {} },
    async run() {
      const rows = await sql()`
        select code, type, value, used_count, max_uses, expires_at, active, source, created_at
        from promo_codes order by used_count desc
      `;
      return { codes: rows };
    },
  },
};

/** Définitions au format attendu par l'API Claude. */
export function definitionsOutils() {
  return Object.entries(OUTILS).map(([name, o]) => ({
    name,
    description: o.description,
    input_schema: o.schema,
  }));
}

/** Exécute un outil par son nom. Un nom inconnu est refusé, jamais interprété. */
export async function executerOutil(name, params) {
  const outil = OUTILS[name];
  if (!outil) return { erreur: `outil inconnu : ${name}` };
  try {
    return await outil.run(params || {});
  } catch (e) {
    return { erreur: String(e.message || e) };
  }
}
