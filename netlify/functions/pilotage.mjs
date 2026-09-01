// Onglet « Pilotage » du back-office : aide à la décision d'investissement.
//
// Différence avec finance.mjs, qui constate ce qui s'est passé sur une période :
// ici on projette. Quatre blocs, tous alimentés par les mêmes tables que le
// reste du back-office, sans donnée dupliquée :
//   1. trésorerie et runway (combien de mois de fonctionnement restants) ;
//   2. marge réelle par canal (site vs Amazon) et par produit ;
//   3. prévision de réassort (quand recommander, et combien) ;
//   4. score de priorité d'investissement.
//
// Règle appliquée partout : aucun chiffre n'est inventé. Quand une donnée
// manque (coût produit non renseigné, trésorerie non saisie, historique de
// ventes trop court), le champ vaut null et une raison lisible est renvoyée,
// pour que l'interface affiche « donnée insuffisante » au lieu d'une
// projection qui aurait l'air précise.

import { sql } from "./lib/_db.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { credentials as amazonCredentials, getAccessToken as amazonToken, financesAmazon } from "./lib/_amazon.mjs";
import { coutRevientAmazon } from "./lib/_amazonCogs.mjs";
import { TARIF_DOMICILE_CENTS, TARIF_RELAIS_CENTS } from "./lib/_shipping.mjs";

const DAY_MS = 86400000;
const PAID_STATUSES = ["payee", "expediee"];

// Fenêtre d'observation par défaut : 180 jours. Plus longue que celle de
// l'onglet Finance (30 jours) parce qu'on cherche ici une vitesse de vente et
// un rythme de dépenses moyens, pas un instantané.
const FENETRE_DEFAUT_JOURS = 180;

// En dessous de ce nombre d'unités vendues sur la fenêtre, une « vitesse de
// vente » n'a aucun sens : on refuse de projeter une date de rupture plutôt
// que d'extrapoler sur deux ou trois commandes.
const UNITES_MIN_POUR_VELOCITE = 5;

// Idem pour les dépenses : moins de deux mois de saisie ne permet pas de
// parler d'un « rythme mensuel » fiable, on le signale.
const MOIS_MIN_POUR_BURN = 2;

// Le délai fournisseur et la couverture cible ne sont pas mesurables depuis la
// base : ce sont des hypothèses de départ, modifiables dans l'interface, et
// signalées comme telles tant que le propriétaire ne les a pas confirmées.
const DEFAUTS = {
  delaiReassortJours: 60,
  couvertureCibleJours: 120,
  stockSecuriteJours: 21,
};

// Créée à la volée : cette table ne contient que des paramètres saisis par
// l'admin (solde bancaire, délai fournisseur), sans aucune dépendance, elle
// peut donc apparaître sans migration préalable. Voir aussi db/schema.ts.
async function assurerTableParametres() {
  await sql()`
    create table if not exists pilotage_settings (
      id integer primary key,
      tresorerie_cents integer,
      tresorerie_date timestamp,
      delai_reassort_jours integer not null default 60,
      couverture_cible_jours integer not null default 120,
      stock_securite_jours integer not null default 21,
      updated_at timestamp not null default now()
    )
  `;
}

async function lireParametres() {
  await assurerTableParametres();
  const [row] = await sql()`select * from pilotage_settings where id = 1`;
  if (!row) return { tresorerieCents: null, tresorerieDate: null, ...DEFAUTS, parametresSaisis: false };
  return {
    tresorerieCents: row.tresorerie_cents,
    tresorerieDate: row.tresorerie_date,
    delaiReassortJours: row.delai_reassort_jours,
    couvertureCibleJours: row.couverture_cible_jours,
    stockSecuriteJours: row.stock_securite_jours,
    majLe: row.updated_at,
    parametresSaisis: true,
  };
}

function resolveFenetre(url) {
  const demande = parseInt(url.searchParams.get("days") || String(FENETRE_DEFAUT_JOURS), 10);
  const jours = Math.min(Math.max(Number.isFinite(demande) ? demande : FENETRE_DEFAUT_JOURS, 30), 730);
  const fin = new Date();
  const debut = new Date(Date.now() - (jours - 1) * DAY_MS);
  return {
    jours,
    from: debut.toISOString().slice(0, 10),
    to: fin.toISOString().slice(0, 10),
    toExcl: new Date(fin.getTime() + DAY_MS).toISOString().slice(0, 10),
  };
}

const moisDansFenetre = (jours) => Math.max(jours / 30.44, 1);
const arrondi = (cents) => Math.round(cents);

// ---------------------------------------------------------------------------
// 1. Dépenses : rythme mensuel, structure et publicité séparées.
// ---------------------------------------------------------------------------

async function depensesEtBurn(from, toExcl, jours) {
  const rows = await sql()`
    select category, amount_cents, expense_date
    from expenses
    where expense_date >= ${from}::date and expense_date < ${toExcl}::date
    order by expense_date asc
  `;

  const parCategorie = {};
  const moisAvecDepense = new Set();
  let totalCents = 0;
  let publiciteCents = 0;
  for (const r of rows) {
    parCategorie[r.category] = (parCategorie[r.category] || 0) + r.amount_cents;
    moisAvecDepense.add(new Date(r.expense_date).toISOString().slice(0, 7));
    totalCents += r.amount_cents;
    if (r.category === "Publicité") publiciteCents += r.amount_cents;
  }

  // Achats de stock : sorties de trésorerie réelles, mais ponctuelles et
  // pilotables, pas des charges courantes. Les mélanger au burn ferait croire
  // à une hémorragie mensuelle alors qu'il s'agit d'un investissement.
  const lots = await sql()`
    select cb.id, cb.label, cb.quantity, cb.order_date, coalesce(sum(cbl.amount_cents), 0) as montant_cents
    from cost_batches cb
    left join cost_batch_lines cbl on cbl.batch_id = cb.id
    where cb.order_date >= ${from}::date and cb.order_date < ${toExcl}::date
    group by cb.id
    order by cb.order_date desc
  `;
  const achatsStockCents = lots.reduce((s, l) => s + Number(l.montant_cents), 0);

  const mois = moisDansFenetre(jours);
  return {
    totalCents,
    // Moyenne sur la durée de la fenêtre, pas sur les seuls mois où une dépense
    // a été saisie : un mois sans dépense saisie est un vrai mois à 0, pas un
    // mois à ignorer.
    burnMensuelCents: rows.length ? arrondi(totalCents / mois) : null,
    burnStructureMensuelCents: rows.length ? arrondi((totalCents - publiciteCents) / mois) : null,
    burnPubMensuelCents: rows.length ? arrondi(publiciteCents / mois) : null,
    publiciteCents,
    moisAvecDepense: moisAvecDepense.size,
    historiqueSuffisant: moisAvecDepense.size >= MOIS_MIN_POUR_BURN,
    parCategorie: Object.entries(parCategorie)
      .map(([category, amountCents]) => ({ category, amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents),
    nbDepenses: rows.length,
    achatsStock: {
      totalCents: achatsStockCents,
      lots: lots.map((l) => ({
        id: l.id,
        label: l.label,
        quantity: l.quantity,
        date: l.order_date,
        montantCents: Number(l.montant_cents),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Marge réelle par canal.
// ---------------------------------------------------------------------------

// Coût produit applicable à une date donnée : toujours le tarif fournisseur en
// vigueur ce jour-là, jamais le tarif actuel, sinon une marge historique serait
// recalculée à tort avec les prix d'aujourd'hui.
async function coutUnitaireADate(productId, date) {
  const [row] = await sql()`
    select unit_cost_cents from product_costs
    where product_id = ${productId} and effective_from <= ${date}
    order by effective_from desc
    limit 1
  `;
  return row?.unit_cost_cents ?? null;
}

async function canalSite(from, toExcl) {
  const commandes = await sql()`
    select id, total_cents, discount_cents, stripe_fee_cents, created_at,
           shipping_address->>'deliveryMode' as mode
    from orders
    where created_at >= ${from}::date and created_at < ${toExcl}::date
      and status = any(${PAID_STATUSES})
    order by created_at asc
  `;

  const ids = commandes.map((c) => c.id);
  const lignes = ids.length
    ? await sql()`
        select oi.order_id, oi.product_id, oi.name, oi.unit_price_cents, oi.quantity
        from order_items oi where oi.order_id = any(${ids})
      `
    : [];
  const commissions = ids.length
    ? await sql()`
        select order_id, amount_cents from affiliate_commissions
        where order_id = any(${ids}) and status != 'annulee'
      `
    : [];
  const commissionParCommande = new Map(commissions.map((c) => [c.order_id, c.amount_cents]));

  const lignesParCommande = new Map();
  for (const l of lignes) {
    if (!lignesParCommande.has(l.order_id)) lignesParCommande.set(l.order_id, []);
    lignesParCommande.get(l.order_id).push(l);
  }

  const produits = new Map();
  const produitsSansCout = new Set();
  let caCents = 0;
  let coutProduitCents = 0;
  let stripeCents = 0;
  let expeditionCents = 0;
  let commissionsCents = 0;
  let remisesCents = 0;
  let unites = 0;
  let commandesSansStripe = 0;

  for (const c of commandes) {
    const mesLignes = lignesParCommande.get(c.id) || [];
    const caLignes = mesLignes.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0);

    // Expédition : le coût réel des étiquettes Packlink n'est pas exposé par
    // leur API, on applique donc le même tarif estimé que l'onglet Expédition
    // et que finance.mjs, selon le mode de livraison choisi par le client.
    const expedition = c.mode === "relais" ? TARIF_RELAIS_CENTS : TARIF_DOMICILE_CENTS;
    const stripe = c.stripe_fee_cents;
    if (stripe == null) commandesSansStripe += 1;
    const commission = commissionParCommande.get(c.id) || 0;

    caCents += c.total_cents;
    stripeCents += stripe || 0;
    expeditionCents += expedition;
    commissionsCents += commission;
    remisesCents += c.discount_cents || 0;

    for (const l of mesLignes) {
      unites += l.quantity;
      const cout = await coutUnitaireADate(l.product_id, c.created_at);
      if (cout == null) produitsSansCout.add(l.name);
      const coutLigne = cout == null ? 0 : cout * l.quantity;
      coutProduitCents += coutLigne;

      // Les frais de commande (Stripe, expédition, commission) sont répartis au
      // prorata du poids de la ligne dans la commande. Avec un seul produit au
      // catalogue le prorata vaut 1, mais le calcul reste juste le jour où un
      // deuxième produit apparaît.
      const part = caLignes > 0 ? (l.unit_price_cents * l.quantity) / caLignes : 1;
      const agg = produits.get(l.product_id) || {
        productId: l.product_id,
        name: l.name,
        unites: 0,
        caCents: 0,
        coutProduitCents: 0,
        fraisCents: 0,
        coutConnu: true,
      };
      agg.unites += l.quantity;
      // Le CA du produit inclut sa quote-part des frais de port facturés au
      // client, sinon sa marge apparaîtrait artificiellement basse.
      agg.caCents += Math.round(c.total_cents * part);
      agg.coutProduitCents += coutLigne;
      agg.fraisCents += Math.round(((stripe || 0) + expedition + commission) * part);
      if (cout == null) agg.coutConnu = false;
      produits.set(l.product_id, agg);
    }
  }

  const margeCents = caCents - coutProduitCents - stripeCents - expeditionCents - commissionsCents;

  return {
    canal: "Site",
    disponible: true,
    commandes: commandes.length,
    unites,
    caCents,
    coutProduitCents,
    fraisPlateformeCents: stripeCents,
    fraisPlateformeLabel: "Frais Stripe",
    expeditionCents,
    commissionsCents,
    remisesCents,
    margeCents,
    margePct: caCents ? Math.round((margeCents / caCents) * 1000) / 10 : null,
    margeUnitaireCents: unites ? arrondi(margeCents / unites) : null,
    // Une marge calculée avec un coût produit manquant est fausse, et toujours
    // trop haute : on le dit au lieu de l'afficher telle quelle.
    fiable: produitsSansCout.size === 0 && commandesSansStripe === 0 && commandes.length > 0,
    produitsSansCout: [...produitsSansCout],
    commandesSansStripe,
    produits: [...produits.values()].map((p) => ({
      productId: p.productId,
      name: p.name,
      unites: p.unites,
      caCents: p.caCents,
      coutProduitCents: p.coutConnu ? p.coutProduitCents : null,
      margeCents: p.coutConnu ? p.caCents - p.coutProduitCents - p.fraisCents : null,
      margeUnitaireCents:
        p.coutConnu && p.unites ? arrondi((p.caCents - p.coutProduitCents - p.fraisCents) / p.unites) : null,
    })),
  };
}

async function canalAmazon(from, toExcl) {
  const c = amazonCredentials();
  if (c.missing) return { canal: "Amazon", disponible: false, raison: "identifiants Amazon manquants" };

  let finances;
  try {
    const token = await amazonToken(c);
    finances = await financesAmazon(token, from, toExcl);
  } catch (e) {
    return { canal: "Amazon", disponible: false, raison: String(e.message || e) };
  }
  if (finances?.erreur) return { canal: "Amazon", disponible: false, raison: finances.erreur };

  const parCommande = finances.parCommande || [];
  const cogs = await coutRevientAmazon(parCommande);

  const caCents = Math.round((finances.ventesBrutes || 0) * 100);
  // ATTENTION : l'API Amazon renvoie ses frais en valeurs NÉGATIVES (une
  // commission de 5,25 € arrive à -5,25). On les ramène ici en positif pour
  // qu'ils se soustraient comme n'importe quel autre coût.
  const fraisCents = Math.abs(Math.round((finances.fraisAmazon || 0) * 100));
  const remboursementsCents = Math.abs(Math.round((finances.remboursements || 0) * 100));
  // Amazon ne facture pas de frais de port tant que l'étiquette n'est pas
  // achetée chez lui : le colis part avec le même transporteur que pour le
  // site, donc même tarif domicile estimé.
  const expeditionCents = parCommande.length * TARIF_DOMICILE_CENTS;

  const unites = parCommande.reduce((s, o) => s + (o.items || []).reduce((t, i) => t + i.quantity, 0), 0);
  const margeCents = caCents - fraisCents - remboursementsCents - cogs.coutCents - expeditionCents;

  const parSku = new Map();
  for (const o of parCommande) {
    for (const it of o.items || []) {
      const agg = parSku.get(it.sku) || { sku: it.sku, unites: 0 };
      agg.unites += it.quantity;
      parSku.set(it.sku, agg);
    }
  }

  return {
    canal: "Amazon",
    disponible: true,
    commandes: parCommande.length,
    unites,
    caCents,
    coutProduitCents: cogs.coutCents,
    fraisPlateformeCents: fraisCents,
    fraisPlateformeLabel: "Frais Amazon",
    expeditionCents,
    commissionsCents: 0,
    remisesCents: 0,
    remboursementsCents,
    margeCents,
    margePct: caCents ? Math.round((margeCents / caCents) * 1000) / 10 : null,
    margeUnitaireCents: unites ? arrondi(margeCents / unites) : null,
    fiable: cogs.skuSansCout.length === 0 && parCommande.length > 0,
    skuSansCout: cogs.skuSansCout,
    produits: [...parSku.values()],
  };
}

// ---------------------------------------------------------------------------
// 3. Prévision de réassort.
// ---------------------------------------------------------------------------

async function reassort(from, toExcl, jours, parametres) {
  const produits = await sql()`select id, sku, name, stock from products order by name`;

  // Les sorties de stock sont la seule source qui couvre les DEUX canaux : les
  // ventes Amazon n'existent pas dans orders, mais la synchronisation Amazon
  // les enregistre ici. C'est donc la bonne base pour une vitesse réelle.
  const ventes = await sql()`
    select product_id, sum(quantity)::int as unites
    from stock_movements
    where type = 'sortie' and source in ('vente_site', 'vente_amazon')
      and movement_date >= ${from}::date and movement_date < ${toExcl}::date
    group by product_id
  `;
  const ventesParProduit = new Map(ventes.map((v) => [v.product_id, v.unites]));

  const maintenant = new Date().toISOString();
  const lignes = [];
  for (const p of produits) {
    const unites = ventesParProduit.get(p.id) || 0;
    const coutUnitaireCents = await coutUnitaireADate(p.id, maintenant);
    const base = { productId: p.id, sku: p.sku, name: p.name, stock: p.stock, unitesVendues: unites, coutUnitaireCents };

    if (unites < UNITES_MIN_POUR_VELOCITE) {
      lignes.push({
        ...base,
        velociteMensuelle: null,
        joursDeStock: null,
        joursAvantCommande: null,
        dateRupture: null,
        dateCommande: null,
        quantiteConseillee: null,
        coutReassortCents: null,
        statut: "donnees_insuffisantes",
        raison: `${unites} unité(s) vendue(s) sur ${jours} jours. Il en faut au moins ${UNITES_MIN_POUR_VELOCITE} pour estimer une vitesse de vente.`,
      });
      continue;
    }

    const velociteJour = unites / jours;
    const joursDeStock = Math.floor(p.stock / velociteJour);
    const dateRupture = new Date(Date.now() + joursDeStock * DAY_MS);
    // Il faut commander assez tôt pour que le lot arrive avant d'entamer le
    // stock de sécurité : rupture moins délai fournisseur moins réserve.
    const joursAvantCommande = joursDeStock - parametres.delaiReassortJours - parametres.stockSecuriteJours;
    const dateCommande = new Date(Date.now() + joursAvantCommande * DAY_MS);
    const quantiteConseillee = Math.ceil(velociteJour * (parametres.couvertureCibleJours + parametres.delaiReassortJours));

    lignes.push({
      ...base,
      velociteMensuelle: Math.round(velociteJour * 30.44 * 10) / 10,
      joursDeStock,
      joursAvantCommande,
      dateRupture: dateRupture.toISOString().slice(0, 10),
      dateCommande: dateCommande.toISOString().slice(0, 10),
      quantiteConseillee,
      coutReassortCents: coutUnitaireCents == null ? null : quantiteConseillee * coutUnitaireCents,
      coutReassortRaison: coutUnitaireCents == null ? "coût unitaire fournisseur non renseigné" : null,
      statut: joursAvantCommande <= 0 ? "urgent" : joursAvantCommande <= 30 ? "a_commander" : "ok",
      raison: null,
    });
  }

  return { produits: lignes, unitesMinPourVelocite: UNITES_MIN_POUR_VELOCITE };
}

// ---------------------------------------------------------------------------
// 4. Trésorerie et runway.
// ---------------------------------------------------------------------------

function tresorerieEtRunway(parametres, burn, contributionMensuelleCents) {
  const solde = parametres.tresorerieCents;
  const reserves = [];
  if (solde == null) reserves.push("solde de trésorerie non saisi");
  if (burn.burnMensuelCents == null) reserves.push("aucune dépense enregistrée sur la fenêtre");
  else if (!burn.historiqueSuffisant) reserves.push(`dépenses saisies sur ${burn.moisAvecDepense} mois seulement`);
  if (contributionMensuelleCents == null)
    reserves.push("contribution mensuelle non calculable (aucune vente sur la fenêtre, ou marge incomplète)");

  const calcul = (chargeMensuelle) => {
    if (solde == null || chargeMensuelle == null) return null;
    if (chargeMensuelle <= 0) return { infini: true, mois: null };
    return { infini: false, mois: Math.round((solde / chargeMensuelle) * 10) / 10 };
  };

  const chargeNette =
    burn.burnMensuelCents == null || contributionMensuelleCents == null
      ? null
      : burn.burnMensuelCents - contributionMensuelleCents;

  return {
    soldeCents: solde,
    soldeDate: parametres.tresorerieDate,
    contributionMensuelleCents,
    sansVente: calcul(burn.burnMensuelCents),
    sansVenteSansPub: calcul(burn.burnStructureMensuelCents),
    rythmeActuel: calcul(chargeNette),
    chargeNetteMensuelleCents: chargeNette,
    autofinance: chargeNette != null && chargeNette <= 0,
    // Un runway calculé sur deux mois de saisie n'est pas une prévision, c'est
    // une extrapolation : l'interface relaie ces réserves telles quelles.
    reserves,
    fiable: reserves.length === 0,
  };
}

// ---------------------------------------------------------------------------
// 5. Score de priorité d'investissement.
//
// Le score va de 0 à 100 et vaut null quand il n'est pas calculable. Chaque
// ligne porte ses composantes et ses données manquantes, pour qu'un score
// puisse toujours être contesté à partir des chiffres qui l'ont produit.
// ---------------------------------------------------------------------------

function priorites({ tresorerie, burn, canaux, reassortData, parametres }) {
  const liste = [];
  const canauxDispo = canaux.filter((c) => c.disponible);
  const unitesTotales = canauxDispo.reduce((s, c) => s + (c.unites || 0), 0);
  const margeTotaleCents = canauxDispo.reduce((s, c) => s + (c.margeCents || 0), 0);
  const margeUnitaireCents = unitesTotales ? Math.round(margeTotaleCents / unitesTotales) : null;
  const margeFiable = canauxDispo.length > 0 && canauxDispo.every((c) => c.fiable);
  const commandesTotales = canauxDispo.reduce((s, c) => s + (c.commandes || 0), 0);

  // --- A. Réassort du stock -------------------------------------------------
  for (const p of reassortData.produits) {
    if (p.statut === "donnees_insuffisantes") {
      liste.push({
        id: `reassort-${p.productId}`,
        titre: `Réassort ${p.name}`,
        montantCents: null,
        score: null,
        justification: [p.raison],
        donneesManquantes: ["vitesse de vente non mesurable"],
        composantes: [{ label: "Stock actuel", valeur: `${p.stock} unités` }],
      });
      continue;
    }

    // Un stock qui doit être commandé maintenant est la seule dépense dont
    // l'absence coûte la totalité des ventes de la période de rupture : elle
    // est structurellement prioritaire sur toute dépense de croissance.
    const urgence = p.joursAvantCommande <= 0 ? 100 : Math.max(0, Math.round(100 - (p.joursAvantCommande / 180) * 100));
    const margeProtegeeCents = margeUnitaireCents != null && margeFiable ? margeUnitaireCents * p.quantiteConseillee : null;
    liste.push({
      id: `reassort-${p.productId}`,
      titre: `Réassort ${p.name}`,
      montantCents: p.coutReassortCents,
      score: p.coutReassortCents == null ? null : urgence,
      gainAttenduCents: margeProtegeeCents,
      gainLabel: "marge protégée sur le lot",
      justification: [
        `${p.joursDeStock} jours de stock au rythme actuel (${p.velociteMensuelle} unités/mois), rupture estimée le ${p.dateRupture}.`,
        p.joursAvantCommande <= 0
          ? `Avec un délai fournisseur de ${parametres.delaiReassortJours} jours et ${parametres.stockSecuriteJours} jours de sécurité, la commande est déjà en retard.`
          : `Dernier moment pour commander : ${p.dateCommande} (délai fournisseur ${parametres.delaiReassortJours} jours plus ${parametres.stockSecuriteJours} jours de sécurité).`,
        `Quantité conseillée : ${p.quantiteConseillee} unités, soit ${parametres.couvertureCibleJours} jours de couverture plus le délai fournisseur.`,
      ],
      donneesManquantes: [
        p.coutReassortCents == null ? "coût unitaire fournisseur non renseigné, montant non chiffrable" : null,
        !margeFiable ? "marge unitaire non fiable, marge protégée non chiffrée" : null,
      ].filter(Boolean),
      composantes: [
        { label: "Stock actuel", valeur: `${p.stock} unités` },
        { label: "Jours de stock", valeur: `${p.joursDeStock} j` },
      ],
    });
  }

  // --- B. Publicité ---------------------------------------------------------
  // Le seul chiffre solide disponible est le plafond : au-delà de la marge
  // contributive unitaire, une commande achetée en publicité fait perdre de
  // l'argent. Le « coût publicitaire par commande » ci-dessous n'est PAS une
  // attribution (aucun suivi de conversion payante n'existe), c'est un ratio
  // brut dépenses pub sur commandes toutes sources : il est étiqueté comme tel.
  const ratioPubParCommandeCents =
    burn.publiciteCents > 0 && commandesTotales > 0 ? Math.round(burn.publiciteCents / commandesTotales) : null;
  const pubManques = [];
  if (margeUnitaireCents == null) pubManques.push("aucune vente sur la fenêtre, marge unitaire inconnue");
  else if (!margeFiable) pubManques.push("marge unitaire non fiable (coût produit ou frais Stripe manquants)");
  if (ratioPubParCommandeCents == null) pubManques.push("aucune dépense publicitaire enregistrée, rendement réel inconnu");

  let scorePub = null;
  if (margeUnitaireCents != null && margeFiable && ratioPubParCommandeCents != null && margeUnitaireCents > 0) {
    const ecart = margeUnitaireCents - ratioPubParCommandeCents;
    scorePub = Math.max(0, Math.min(100, Math.round((ecart / margeUnitaireCents) * 100)));
  }
  liste.push({
    id: "publicite",
    titre: "Publicité (acquisition payante)",
    montantCents: null,
    score: scorePub,
    justification: [
      margeUnitaireCents != null && margeFiable
        ? `Marge contributive moyenne : ${(margeUnitaireCents / 100).toFixed(2)} € par unité vendue. C'est le coût d'acquisition maximal au-delà duquel une commande achetée en publicité fait perdre de l'argent.`
        : "Marge contributive unitaire inconnue ou incomplète : impossible de fixer un coût d'acquisition maximal fiable.",
      ratioPubParCommandeCents != null
        ? `Ratio brut observé : ${(ratioPubParCommandeCents / 100).toFixed(2)} € de publicité par commande (dépenses pub divisées par les commandes toutes sources, ce n'est pas une attribution).`
        : "Aucune dépense publicitaire saisie sur la fenêtre : le rendement réel de la publicité ne peut pas être mesuré.",
    ],
    donneesManquantes: pubManques,
    composantes: [
      {
        label: "Plafond d'acquisition",
        valeur: margeUnitaireCents != null && margeFiable ? `${(margeUnitaireCents / 100).toFixed(2)} €` : "donnée insuffisante",
      },
      { label: "Commandes sur la fenêtre", valeur: String(commandesTotales) },
    ],
  });

  // --- C. Garder la trésorerie ---------------------------------------------
  if (tresorerie.sansVente && !tresorerie.sansVente.infini) {
    const mois = tresorerie.sansVente.mois;
    // Sous 12 mois de runway, garder du cash gagne progressivement en priorité :
    // une rupture de trésorerie arrête tout, quel que soit le retour attendu des
    // autres lignes.
    const score = mois >= 12 ? 0 : Math.round(((12 - mois) / 12) * 100);
    liste.push({
      id: "tresorerie",
      titre: "Ne rien engager, garder la trésorerie",
      montantCents: null,
      score,
      justification: [
        `Runway sans nouvelle vente : ${mois} mois au rythme de dépenses actuel.`,
        mois < 6
          ? "En dessous de 6 mois, toute dépense non indispensable rapproche l'arrêt de l'activité avant que le retour n'arrive."
          : "Runway confortable : il existe de la marge pour engager une dépense de croissance.",
      ],
      donneesManquantes: tresorerie.reserves,
      composantes: [{ label: "Runway", valeur: `${mois} mois` }],
    });
  } else {
    liste.push({
      id: "tresorerie",
      titre: "Ne rien engager, garder la trésorerie",
      montantCents: null,
      score: null,
      justification: [
        tresorerie.sansVente?.infini
          ? "Aucune charge mensuelle enregistrée : le runway serait infini sur le papier, ce qui signale surtout que les dépenses ne sont pas saisies."
          : "Runway non calculable.",
      ],
      donneesManquantes: tresorerie.reserves.length ? tresorerie.reserves : ["données de trésorerie insuffisantes"],
      composantes: [],
    });
  }

  // --- D. Deuxième produit --------------------------------------------------
  // Volontairement non noté : aucune donnée du système ne permet d'estimer les
  // ventes d'un produit qui n'existe pas encore. On fournit seulement le
  // contexte chiffré réel qui permet de trancher, jamais un score inventé.
  const stockValorisable = reassortData.produits.every((p) => p.coutUnitaireCents != null);
  const stockImmobiliseCents = reassortData.produits.reduce(
    (s, p) => s + (p.coutUnitaireCents != null ? p.coutUnitaireCents * p.stock : 0),
    0,
  );
  liste.push({
    id: "nouveau-produit",
    titre: "Lancer un deuxième produit",
    montantCents: null,
    score: null,
    justification: [
      stockValorisable
        ? `Trésorerie déjà immobilisée dans le stock existant : ${(stockImmobiliseCents / 100).toFixed(2)} €.`
        : "Trésorerie immobilisée dans le stock : non chiffrable, coût unitaire fournisseur manquant.",
      "Aucune donnée interne ne permet d'estimer les ventes d'un produit qui n'existe pas encore : cette ligne reste volontairement non notée.",
    ],
    donneesManquantes: ["aucun historique de vente pour un second produit"],
    composantes: [],
  });

  return liste.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

// ---------------------------------------------------------------------------

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  const url = new URL(req.url);

  try {
    if (req.method === "POST") {
      const body = await req.json();
      if (body.action !== "enregistrer-parametres") return Response.json({ error: "action inconnue" }, { status: 400 });
      await assurerTableParametres();

      const entier = (v, min, max) => {
        const n = Math.round(Number(v));
        return Number.isFinite(n) && n >= min && n <= max ? n : null;
      };
      const tresorerieVide = body.tresorerieCents === "" || body.tresorerieCents == null;
      const tresorerieCents = tresorerieVide ? null : entier(body.tresorerieCents, 0, 100000000000);
      const delai = entier(body.delaiReassortJours, 1, 365) ?? DEFAUTS.delaiReassortJours;
      const couverture = entier(body.couvertureCibleJours, 7, 730) ?? DEFAUTS.couvertureCibleJours;
      const securite = entier(body.stockSecuriteJours, 0, 365) ?? DEFAUTS.stockSecuriteJours;

      await sql()`
        insert into pilotage_settings (id, tresorerie_cents, tresorerie_date, delai_reassort_jours, couverture_cible_jours, stock_securite_jours, updated_at)
        values (1, ${tresorerieCents}, ${tresorerieCents == null ? null : new Date().toISOString()}, ${delai}, ${couverture}, ${securite}, now())
        on conflict (id) do update set
          tresorerie_cents = excluded.tresorerie_cents,
          tresorerie_date = coalesce(excluded.tresorerie_date, pilotage_settings.tresorerie_date),
          delai_reassort_jours = excluded.delai_reassort_jours,
          couverture_cible_jours = excluded.couverture_cible_jours,
          stock_securite_jours = excluded.stock_securite_jours,
          updated_at = now()
      `;
      return Response.json({ ok: true });
    }

    if (req.method !== "GET") return Response.json({ error: "méthode non supportée" }, { status: 405 });

    const fenetre = resolveFenetre(url);
    const parametres = await lireParametres();

    const [burn, site, amazon, reassortData] = await Promise.all([
      depensesEtBurn(fenetre.from, fenetre.toExcl, fenetre.jours),
      canalSite(fenetre.from, fenetre.toExcl),
      canalAmazon(fenetre.from, fenetre.toExcl),
      reassort(fenetre.from, fenetre.toExcl, fenetre.jours, parametres),
    ]);

    const canaux = [site, amazon];
    const canauxDispo = canaux.filter((c) => c.disponible);
    const margeTotaleCents = canauxDispo.reduce((s, c) => s + (c.margeCents || 0), 0);
    // Contribution mensuelle = ce que l'activité dégage avant les charges de
    // structure. Null si aucune vente : mieux vaut « donnée insuffisante »
    // qu'un zéro qui ressemblerait à une mesure.
    const aDesVentes = canauxDispo.some((c) => c.commandes > 0);
    // Une contribution calculée sur une marge incomplète (coût produit ou frais
    // Stripe manquants) serait systématiquement trop optimiste, et le runway
    // qui en découle aussi : on préfère ne rien afficher.
    const margesFiables = canauxDispo.length > 0 && canauxDispo.every((c) => c.fiable);
    const contributionMensuelleCents =
      aDesVentes && margesFiables ? arrondi(margeTotaleCents / moisDansFenetre(fenetre.jours)) : null;

    const tresorerie = tresorerieEtRunway(parametres, burn, contributionMensuelleCents);
    const listePriorites = priorites({ tresorerie, burn, canaux, reassortData, parametres });

    // Récapitulatif de tout ce qui empêche une lecture fiable, remonté en haut
    // de l'écran pour que le propriétaire sache quoi saisir en priorité.
    const manques = [];
    if (parametres.tresorerieCents == null) manques.push("Solde de trésorerie non saisi : aucun runway calculable.");
    if (!burn.nbDepenses) manques.push("Aucune dépense enregistrée sur la fenêtre : le rythme de dépenses est inconnu.");
    else if (!burn.historiqueSuffisant)
      manques.push(`Dépenses saisies sur ${burn.moisAvecDepense} mois seulement : le rythme mensuel est une extrapolation.`);
    if (site.produitsSansCout.length)
      manques.push(`Coût produit manquant pour : ${site.produitsSansCout.join(", ")}. La marge du canal site est surévaluée.`);
    if (site.commandesSansStripe)
      manques.push(`${site.commandesSansStripe} commande(s) site sans frais Stripe connus (antérieures au suivi automatique).`);
    if (!amazon.disponible)
      manques.push(`Canal Amazon indisponible : ${amazon.raison}. Les marges affichées n'incluent pas Amazon.`);
    else if (amazon.skuSansCout?.length)
      manques.push(`Coût produit manquant pour le(s) SKU Amazon : ${amazon.skuSansCout.join(", ")}.`);
    if (!parametres.parametresSaisis)
      manques.push(`Délai fournisseur non confirmé : hypothèse de ${parametres.delaiReassortJours} jours utilisée pour les dates de réassort.`);
    for (const p of reassortData.produits) {
      if (p.statut === "donnees_insuffisantes") manques.push(`${p.name} : ${p.raison}`);
    }

    return Response.json(
      {
        range: { from: fenetre.from, to: fenetre.to, jours: fenetre.jours },
        parametres,
        burn,
        tresorerie,
        canaux,
        margeTotaleCents: canauxDispo.length ? margeTotaleCents : null,
        reassort: reassortData,
        priorites: listePriorites,
        manques,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/pilotage" };
