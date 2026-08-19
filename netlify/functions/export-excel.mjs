// Export Excel complet du back-office : un classeur multi-onglets (Synthèse,
// Finance, Ventes, Marketing) sur la période choisie, pour analyse ou
// présentation hors-ligne (banque, comptable, associé...).
//
// Réutilise les mêmes requêtes que finance.mjs et stats.mjs plutôt que
// d'appeler ces fonctions en HTTP interne — plus rapide, un seul aller-retour
// base de données.

import ExcelJS from "exceljs";
import { getStore } from "@netlify/blobs";
import { sql } from "./_db.mjs";
import { getAdminFromRequest } from "./_adminAuth.mjs";
import { credentials as amazonCredentials, getAccessToken as amazonToken, financesAmazon } from "./_amazon.mjs";
import { credentials as adsCredentials, getAccessToken as adsToken, depenseCampagnes } from "./_googleAds.mjs";
import { LOGO_WHITE_PNG_BASE64 } from "./_logoAsset.mjs";

const DAY_MS = 86400000;
const PAID_STATUSES = ["payee", "expediee"];
const EUR = "#,##0.00 €";
const EUR0 = "#,##0 €";

// Palette reprise telle quelle du classeur de suivi manuel de Thomas (thème
// Office par défaut d'Excel : dk2 = bandeau sombre, accent1 = teal des
// cartes KPI) — mêmes couleurs sur toutes les feuilles pour que ce classeur
// se lise comme la suite naturelle de l'autre.
const NAVY = "FF0E2841"; // thème dk2
const NAVY_LIGHT = "FF1F3A55";
const ACCENT = "FF156082"; // thème accent1 (teal)
const ACCENT_LIGHT = "FFDCEAF0";
const GREEN = "FF196B24"; // thème accent3
const RED = "FFC0392B";
const WHITE = "FFFFFFFF";
const BORDER_GREY = { style: "thin", color: { argb: "FFE5E7EB" } };
const TABLE_THEME = "TableStyleLight1"; // même style sobre que xl/tables/table1.xml de son classeur

function bandeau(sheet, texte, { cols = 6, sousTitre } = {}) {
  sheet.mergeCells(1, 1, 1, cols);
  const titre = sheet.getCell(1, 1);
  titre.value = texte;
  titre.font = { bold: true, size: 16, color: { argb: WHITE } };
  titre.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(1).height = 30;
  for (let c = 1; c <= cols; c++) sheet.getCell(1, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };

  if (sousTitre) {
    sheet.mergeCells(2, 1, 2, cols);
    const st = sheet.getCell(2, 1);
    st.value = sousTitre;
    st.font = { italic: true, size: 10, color: { argb: WHITE } };
    st.alignment = { vertical: "middle", indent: 1 };
    sheet.getRow(2).height = 18;
    for (let c = 1; c <= cols; c++) sheet.getCell(2, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_LIGHT } };
    return 3;
  }
  return 2;
}

// Carte KPI empilée dans le bandeau latéral — reproduit exactement le bloc
// "Total CA" / "Total Quantités" / "Total Marge" / "Stock Actuel" de son
// classeur : un pavé teal (accent1) sur toute la largeur de la colonne
// latérale, libellé en haut, grande valeur en dessous, pas de valeur = pavé
// vide (comme "Total Marge" et "Stock Actuel" dans son fichier).
function carteKpiSidebar(sheet, startRow, col1, col2, { label, valeur, format, hauteur = 4 }) {
  const rLabel = startRow;
  sheet.mergeCells(rLabel, col1, rLabel, col2);
  const labelCell = sheet.getCell(rLabel, col1);
  labelCell.value = label;
  labelCell.font = { bold: true, size: 13, color: { argb: WHITE } };
  labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  sheet.getCell(rLabel, col2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  sheet.getRow(rLabel).height = 22;

  const rValStart = startRow + 1;
  const rValEnd = startRow + hauteur - 1;
  sheet.mergeCells(rValStart, col1, rValEnd, col2);
  const valCell = sheet.getCell(rValStart, col1);
  if (valeur != null) {
    valCell.value = valeur;
    if (format) valCell.numFmt = format;
  }
  valCell.font = { bold: true, size: 18, color: { argb: WHITE } };
  valCell.alignment = { vertical: "middle", horizontal: "center" };
  for (let r = rValStart; r <= rValEnd; r++) {
    for (let c = col1; c <= col2; c++) {
      sheet.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
    }
  }
  return startRow + hauteur;
}

function barreDonnees(sheet, ref, couleur = ACCENT) {
  sheet.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "dataBar",
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: couleur },
        gradient: false,
        border: true,
        showValue: true,
      },
    ],
  });
}

function resolveRange(url) {
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (isDate(from) && isDate(to)) {
    const debut = new Date(`${from}T00:00:00Z`);
    const fin = new Date(`${to}T00:00:00Z`);
    let [a, b] = debut <= fin ? [debut, fin] : [fin, debut];
    // Le trafic marketing est agrégé jour par jour (un appel au store par
    // jour) : au-delà d'un an, ça multiplie les appels sans réel intérêt
    // d'analyse et risque un timeout — on plafonne comme pour "days".
    if (b.getTime() - a.getTime() > 365 * DAY_MS) a = new Date(b.getTime() - 365 * DAY_MS);
    return { from: a.toISOString().slice(0, 10), to: b.toISOString().slice(0, 10) };
  }
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10), 1), 365);
  const finJour = new Date();
  const debutJour = new Date(Date.now() - (days - 1) * DAY_MS);
  return { from: debutJour.toISOString().slice(0, 10), to: finJour.toISOString().slice(0, 10) };
}

function toExclusive(dateStr) {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
}

function euros(cents) {
  return Math.round(cents || 0) / 100;
}

async function chargerDonnees(from, to) {
  const toExcl = toExclusive(to);

  const orders = await sql()`
    select id, order_number, status, total_cents, stripe_fee_cents, created_at
    from orders
    where created_at >= ${from}::date and created_at < ${toExcl}::date and status = any(${PAID_STATUSES})
    order by created_at
  `;
  const orderIds = orders.map((o) => o.id);

  const items = orderIds.length
    ? await sql()`
        select oi.order_id, oi.product_id, oi.name, oi.unit_price_cents, oi.quantity, o.created_at as order_created_at
        from order_items oi
        join orders o on o.id = oi.order_id
        where oi.order_id = any(${orderIds})
      `
    : [];

  let coutProduitCents = 0;
  const parProduit = {};
  // Répartition mensuelle (CA / marge / quantité) — le tableau « évolutif »
  // de la Synthèse, façon pivot par mois de son classeur de référence. Suit
  // automatiquement la période choisie : un export sur 3 mois donne 3 lignes,
  // un export sur 1 an en donne 12.
  const parMois = {};
  for (const it of items) {
    const [cost] = await sql()`
      select unit_cost_cents from product_costs
      where product_id = ${it.product_id} and effective_from <= ${it.order_created_at}
      order by effective_from desc
      limit 1
    `;
    const coutLigne = cost ? cost.unit_cost_cents * it.quantity : 0;
    coutProduitCents += coutLigne;
    const p = (parProduit[it.name] ||= { quantite: 0, caCents: 0, coutCents: 0 });
    p.quantite += it.quantity;
    p.caCents += it.unit_price_cents * it.quantity;
    p.coutCents += coutLigne;

    const mois = String(it.order_created_at).slice(0, 7);
    const m = (parMois[mois] ||= { caCents: 0, margeCents: 0, quantite: 0 });
    const caLigne = it.unit_price_cents * it.quantity;
    m.caCents += caLigne;
    m.margeCents += caLigne - coutLigne;
    m.quantite += it.quantity;
  }

  const depenses = await sql()`
    select category, amount_cents, expense_date, note
    from expenses
    where expense_date >= ${from}::date and expense_date < ${toExcl}::date
    order by expense_date desc
  `;

  // Vue « coûts fixes » façon tableur manuel : dépenses regroupées par
  // catégorie × mois, pour repérer d'un coup d'œil les charges récurrentes
  // (abonnements, transporteur...) plutôt que la liste brute déjà présente
  // dans l'onglet Finance.
  const moisSet = new Set();
  const parCategorieEtMois = {};
  for (const dep of depenses) {
    const mois = String(dep.expense_date).slice(0, 7);
    moisSet.add(mois);
    const bucket = (parCategorieEtMois[dep.category] ||= {});
    bucket[mois] = (bucket[mois] || 0) + dep.amount_cents;
  }
  const moisTries = [...moisSet].sort();

  const commissions = await sql()`
    select amount_cents from affiliate_commissions
    where created_at >= ${from}::date and created_at < ${toExcl}::date and status != 'annulee'
  `;
  const commissionsCents = commissions.reduce((s, r) => s + r.amount_cents, 0);

  const promoCodes = await sql()`select code, type, value, used_count, active from promo_codes order by code`;

  // Coût de revient détaillé par lot (fabrication, transport, carton,
  // audit...), saisi dans l'onglet Finance — chaque lot correspond à une
  // commande fournisseur réelle (ex : « Commande n°1 »).
  const lots = await sql()`
    select b.id, b.label, b.quantity, b.order_date, p.name as product_name, pc.unit_cost_cents
    from cost_batches b
    join products p on p.id = b.product_id
    left join product_costs pc on pc.id = b.product_cost_id
    order by b.order_date asc
  `;
  const lignesLots = lots.length
    ? await sql()`select batch_id, label, amount_cents from cost_batch_lines where batch_id = any(${lots.map((l) => l.id)}) order by id`
    : [];
  const lignesParLot = {};
  for (const l of lignesLots) (lignesParLot[l.batch_id] ||= []).push(l);
  const coutsRevient = lots.map((l) => ({
    label: l.label,
    productName: l.product_name,
    quantity: l.quantity,
    orderDate: String(l.order_date).slice(0, 10),
    unitCostCents: l.unit_cost_cents,
    totalCents: (lignesParLot[l.id] || []).reduce((s, x) => s + x.amount_cents, 0),
    lignes: (lignesParLot[l.id] || []).map((x) => ({ label: x.label, amountCents: x.amount_cents })),
  }));

  // Journal de stock (onglet Stock du back-office) : solde d'ouverture avant
  // la période + mouvements dans la période, pour reconstituer une ligne par
  // mouvement avec stock initial/final courant, comme un grand livre.
  const produitsStock = await sql()`select id, name, stock from products order by name`;
  const stockLedger = [];
  for (const p of produitsStock) {
    // Un mouvement "initial" fixe une valeur absolue : le solde d'ouverture
    // repart de cette valeur à chaque "initial" rencontré avant la période
    // plutôt que de cumuler les mouvements qui l'ont précédé.
    const avantPeriode = await sql()`
      select type, quantity, movement_date from stock_movements
      where product_id = ${p.id} and movement_date < ${from}::date
      order by movement_date asc, id asc
    `;
    let soldeOuverture = 0;
    for (const m of avantPeriode) {
      if (m.type === "initial") soldeOuverture = m.quantity;
      else if (m.type === "entree") soldeOuverture += m.quantity;
      else soldeOuverture -= m.quantity;
    }

    const mouvementsPeriode = await sql()`
      select type, quantity, source, movement_date, note, unit_cost_cents from stock_movements
      where product_id = ${p.id} and movement_date >= ${from}::date and movement_date < ${toExcl}::date
      order by movement_date asc, id asc
    `;

    let solde = soldeOuverture;
    const dernierCout = await sql()`
      select unit_cost_cents from product_costs where product_id = ${p.id} and effective_from <= now() order by effective_from desc limit 1
    `;
    const puCents = dernierCout[0]?.unit_cost_cents ?? null;

    for (const m of mouvementsPeriode) {
      const stockInitialLigne = solde;
      if (m.type === "initial") solde = m.quantity;
      else if (m.type === "entree") solde += m.quantity;
      else solde -= m.quantity;
      const delta = solde - stockInitialLigne;
      stockLedger.push({
        productName: p.name,
        date: String(m.movement_date).slice(0, 10),
        stockInitial: stockInitialLigne,
        entree: delta > 0 ? delta : 0,
        sortie: delta < 0 ? -delta : 0,
        stockFinal: solde,
        source: m.source,
        note: m.note,
        puCents,
        valeurCents: puCents != null ? puCents * solde : null,
      });
    }

    stockLedger.push({
      productName: p.name,
      date: null,
      stockActuel: p.stock,
      puCents,
      valeurCents: puCents != null ? puCents * p.stock : null,
      soldeCalcule: solde,
    });
  }

  let amazon = { indisponible: true };
  try {
    const c = amazonCredentials();
    if (!c.missing) {
      const token = await amazonToken(c);
      amazon = await financesAmazon(token, from);
    }
  } catch (e) {
    amazon = { indisponible: true, raison: String(e.message || e) };
  }

  let ads = { indisponible: true };
  try {
    const c = adsCredentials();
    if (!c.missing) {
      const token = await adsToken(c);
      ads = await depenseCampagnes(c, token, from);
    }
  } catch (e) {
    ads = { indisponible: true, raison: String(e.message || e) };
  }

  // Trafic / marketing : mêmes agrégats journaliers que stats.mjs.
  const store = getStore("analytics");
  const jours = [];
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= new Date(`${to}T00:00:00Z`).getTime(); t += DAY_MS) {
    jours.push(new Date(t).toISOString().slice(0, 10));
  }
  // Par lots plutôt que tout en parallèle : sur une période longue (~365
  // jours), des centaines d'appels simultanés au store saturaient
  // l'émulateur local (et risqueraient un comportement similaire en prod).
  const chargés = [];
  const TAILLE_LOT = 30;
  for (let i = 0; i < jours.length; i += TAILLE_LOT) {
    const lot = jours.slice(i, i + TAILLE_LOT);
    chargés.push(
      ...(await Promise.all(lot.map(async (date) => ({ date, data: await store.get(`day/${date}`, { type: "json" }).catch(() => null) })))),
    );
  }
  const sources = {};
  const pages = {};
  const campagnes = {};
  const serieVisites = [];
  let vuesTotal = 0;
  for (const { date, data } of chargés) {
    const d = data || {};
    vuesTotal += d.views || 0;
    serieVisites.push({ date, vues: d.views || 0, visiteurs: d.visitors?.length || 0 });
    for (const [k, v] of Object.entries(d.sources || {})) sources[k] = (sources[k] || 0) + v;
    for (const [k, v] of Object.entries(d.pages || {})) pages[k] = (pages[k] || 0) + v;
    for (const [k, v] of Object.entries(d.campaigns || {})) campagnes[k] = (campagnes[k] || 0) + v;
  }

  const caSite = orders.reduce((s, o) => s + o.total_cents, 0);
  const stripeFeeCents = orders.reduce((s, o) => s + (o.stripe_fee_cents || 0), 0);
  const caAmazon = amazon.indisponible ? 0 : Math.round((amazon.net || 0) * 100);
  const fraisAmazonCents = amazon.indisponible ? 0 : Math.round((amazon.fraisAmazon || 0) * 100);
  const publiciteCents = ads.indisponible ? 0 : Math.round((ads.depenseTotale || 0) * 100);
  const depensesTotalCents = depenses.reduce((s, d) => s + d.amount_cents, 0);
  const margeNetteCents =
    caSite + caAmazon - stripeFeeCents - coutProduitCents - depensesTotalCents - commissionsCents - publiciteCents;

  return {
    orders,
    parProduit,
    parMois,
    depenses,
    parCategorieEtMois,
    moisTries,
    promoCodes,
    stockLedger,
    produitsStock,
    coutsRevient,
    amazon,
    ads,
    sources,
    pages,
    campagnes,
    serieVisites,
    vuesTotal,
    kpis: {
      caSite,
      caAmazon,
      caTotal: caSite + caAmazon,
      stripeFeeCents,
      coutProduitCents,
      depensesTotalCents,
      commissionsCents,
      publiciteCents,
      fraisAmazonCents,
      margeNetteCents,
      nbCommandes: orders.length,
      panierMoyenCents: orders.length ? Math.round(caSite / orders.length) : 0,
    },
  };
}

// Reproduit la mise en page exacte de l'onglet TDB de son classeur : un
// bandeau latéral navy pleine hauteur (logo + cartes KPI empilées, colonnes
// A:B) et, à droite (à partir de la colonne C), le bandeau de titre puis un
// tableau façon pivot (en-tête sombre, ligne de total noire). Le tableau
// mensuel est "évolutif" au sens où il suit la période choisie à la
// génération : un export sur 3 mois donne 3 lignes, sur 1 an en donne 12 —
// une vraie tranche de dates interactive façon slicer Excel n'est pas
// possible dans un fichier généré côté serveur sans connexion live aux
// données, donc c'est la période choisie dans le dashboard qui pilote tout.
function feuilleSynthese(wb, from, to, d) {
  const s = wb.addWorksheet("Synthèse", { properties: { tabColor: { argb: NAVY } } });

  const COL_SIDEBAR = [1, 2];
  const COL_CONTENU_DEBUT = 3;
  const COL_CONTENU_FIN = 9;
  const HAUTEUR_TOTALE = 42;

  s.getColumn(1).width = 16;
  s.getColumn(2).width = 16;
  for (let c = COL_CONTENU_DEBUT; c <= COL_CONTENU_FIN; c++) s.getColumn(c).width = 14;

  // Bandeau latéral navy sur toute la hauteur de la feuille.
  for (let r = 1; r <= HAUTEUR_TOTALE; r++) {
    for (const c of COL_SIDEBAR) s.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  }

  // Logo (icône + texte, recoloré en blanc) en haut du bandeau.
  const imageId = wb.addImage({ base64: `data:image/png;base64,${LOGO_WHITE_PNG_BASE64}`, extension: "png" });
  s.addImage(imageId, { tl: { col: 0.3, row: 0.3 }, ext: { width: 150, height: 160 } });

  // Cartes KPI empilées, comme "Total CA / Total Quantités / Total Marge /
  // Stock Actuel" — un pavé vide (pas de fabrication de chiffre) si la donnée
  // n'est pas disponible, exactement comme son fichier laisse "Total Marge"
  // et "Stock Actuel" vides tant qu'ils ne sont pas branchés.
  let rSidebar = 11;
  rSidebar = carteKpiSidebar(s, rSidebar, 1, 2, { label: "Chiffre d'affaires", valeur: euros(d.kpis.caTotal), format: EUR0 });
  rSidebar += 2;
  rSidebar = carteKpiSidebar(s, rSidebar, 1, 2, { label: "Commandes", valeur: d.kpis.nbCommandes });
  rSidebar += 2;
  rSidebar = carteKpiSidebar(s, rSidebar, 1, 2, { label: "Marge nette", valeur: euros(d.kpis.margeNetteCents), format: EUR0 });
  rSidebar += 2;
  const stockTotal = d.produitsStock?.reduce((s2, p) => s2 + p.stock, 0);
  carteKpiSidebar(s, rSidebar, 1, 2, { label: "Stock actuel", valeur: d.produitsStock?.length ? stockTotal : null });

  // Bandeau de titre, seulement au-dessus de la zone de contenu (pas sur le
  // bandeau latéral, qui a déjà sa propre identité visuelle).
  const largeurBandeau = COL_CONTENU_FIN - COL_CONTENU_DEBUT + 1;
  s.mergeCells(1, COL_CONTENU_DEBUT, 5, COL_CONTENU_FIN);
  const titre = s.getCell(1, COL_CONTENU_DEBUT);
  titre.value = "E-Carpet — Rapport financier & marketing";
  titre.font = { bold: true, size: 20, color: { argb: WHITE } };
  titre.alignment = { vertical: "top", horizontal: "left", indent: 1, wrapText: true };
  s.mergeCells(6, COL_CONTENU_DEBUT, 7, COL_CONTENU_FIN);
  const sousTitre = s.getCell(6, COL_CONTENU_DEBUT);
  sousTitre.value = `Période du ${from} au ${to} · généré le ${new Date().toLocaleDateString("fr-FR")}`;
  sousTitre.font = { size: 11, color: { argb: WHITE } };
  sousTitre.alignment = { vertical: "top", horizontal: "left", indent: 1 };
  for (let r = 1; r <= 7; r++) {
    for (let c = COL_CONTENU_DEBUT; c <= COL_CONTENU_FIN; c++) s.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  }

  // Tableau mensuel façon pivot (en-tête sombre + ligne de total noire, comme
  // son tableau "Étiquettes de lignes / Somme de CA / Somme de Marge Brute
  // / Somme de Qantité" sous le bandeau).
  let r = 9;
  const moisTries = Object.keys(d.parMois).sort();
  const headerRow = s.getRow(r);
  const entetes = ["Mois", "CA (€)", "Marge (€)", "Quantité vendue"];
  entetes.forEach((texte, i) => {
    const cell = headerRow.getCell(COL_CONTENU_DEBUT + i);
    cell.value = texte;
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF000000" } } };
  });
  r += 1;

  let totalCa = 0;
  let totalMarge = 0;
  let totalQte = 0;
  for (const mois of moisTries) {
    const m = d.parMois[mois];
    const libelle = new Date(`${mois}-01T00:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const row = s.getRow(r);
    row.getCell(COL_CONTENU_DEBUT).value = libelle;
    row.getCell(COL_CONTENU_DEBUT + 1).value = euros(m.caCents);
    row.getCell(COL_CONTENU_DEBUT + 1).numFmt = EUR;
    row.getCell(COL_CONTENU_DEBUT + 2).value = euros(m.margeCents);
    row.getCell(COL_CONTENU_DEBUT + 2).numFmt = EUR;
    row.getCell(COL_CONTENU_DEBUT + 3).value = m.quantite;
    totalCa += m.caCents;
    totalMarge += m.margeCents;
    totalQte += m.quantite;
    r += 1;
  }

  if (!moisTries.length) {
    s.getCell(r, COL_CONTENU_DEBUT).value = "Aucune vente sur la période.";
    s.getCell(r, COL_CONTENU_DEBUT).font = { italic: true, color: { argb: "FF6B7280" } };
    r += 1;
  }

  const totalRow = s.getRow(r);
  totalRow.getCell(COL_CONTENU_DEBUT).value = "Total général";
  totalRow.getCell(COL_CONTENU_DEBUT + 1).value = euros(totalCa);
  totalRow.getCell(COL_CONTENU_DEBUT + 1).numFmt = EUR;
  totalRow.getCell(COL_CONTENU_DEBUT + 2).value = euros(totalMarge);
  totalRow.getCell(COL_CONTENU_DEBUT + 2).numFmt = EUR;
  totalRow.getCell(COL_CONTENU_DEBUT + 3).value = totalQte;
  for (let i = 0; i < entetes.length; i++) {
    const cell = totalRow.getCell(COL_CONTENU_DEBUT + i);
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
  }
  r += 3;

  // Décomposition détaillée du résultat, sous le tableau mensuel.
  s.getCell(r, COL_CONTENU_DEBUT).value = "Décomposition du résultat";
  s.getCell(r, COL_CONTENU_DEBUT).font = { bold: true, size: 12 };
  r += 1;

  const lignes = [
    ["Chiffre d'affaires site", euros(d.kpis.caSite)],
    ["Chiffre d'affaires Amazon", euros(d.kpis.caAmazon)],
    ["Frais Stripe", -euros(d.kpis.stripeFeeCents)],
    ["Frais Amazon", -euros(d.kpis.fraisAmazonCents)],
    ["Coût produit (matière/achat)", -euros(d.kpis.coutProduitCents)],
    ["Dépenses diverses", -euros(d.kpis.depensesTotalCents)],
    ["Commissions affiliés", -euros(d.kpis.commissionsCents)],
    ["Publicité (Google Ads)", -euros(d.kpis.publiciteCents)],
  ];

  const debutTable = r;
  const refDebut = s.getCell(debutTable, COL_CONTENU_DEBUT).address;
  s.addTable({
    name: "SyntheseResultat",
    ref: refDebut,
    headerRow: true,
    totalsRow: false,
    style: { theme: TABLE_THEME, showRowStripes: true },
    columns: [{ name: "Poste" }, { name: "Montant (€)" }],
    rows: lignes,
  });
  for (let i = 0; i < lignes.length; i++) s.getCell(debutTable + 1 + i, COL_CONTENU_DEBUT + 1).numFmt = EUR;
  barreDonnees(
    s,
    `${s.getCell(debutTable + 1, COL_CONTENU_DEBUT + 1).address}:${s.getCell(debutTable + lignes.length, COL_CONTENU_DEBUT + 1).address}`,
  );

  r = debutTable + lignes.length + 2;
  const margeRow = s.getRow(r);
  margeRow.getCell(COL_CONTENU_DEBUT).value = "MARGE NETTE";
  margeRow.getCell(COL_CONTENU_DEBUT).font = { bold: true, size: 12 };
  margeRow.getCell(COL_CONTENU_DEBUT + 1).value = euros(d.kpis.margeNetteCents);
  margeRow.getCell(COL_CONTENU_DEBUT + 1).numFmt = EUR;
  margeRow.getCell(COL_CONTENU_DEBUT + 1).font = { bold: true, size: 12, color: { argb: d.kpis.margeNetteCents < 0 ? RED : GREEN } };
}

function feuilleFinance(wb, d) {
  const s = wb.addWorksheet("Finance", { properties: { tabColor: { argb: ACCENT } } });
  const debut = bandeau(s, "Détail financier", { cols: 4 });

  const lignes = [
    ["Recettes", "Chiffre d'affaires site", euros(d.kpis.caSite), `${d.kpis.nbCommandes} commande(s)`],
  ];
  if (!d.amazon.indisponible) lignes.push(["Recettes", "Chiffre d'affaires Amazon (net)", euros(d.kpis.caAmazon), ""]);
  lignes.push(["Charges", "Frais Stripe", -euros(d.kpis.stripeFeeCents), ""]);
  if (!d.amazon.indisponible) lignes.push(["Charges", "Frais Amazon", -euros(d.kpis.fraisAmazonCents), ""]);
  lignes.push(["Charges", "Coût produit", -euros(d.kpis.coutProduitCents), ""]);
  lignes.push(["Charges", "Commissions affiliés", -euros(d.kpis.commissionsCents), ""]);
  if (!d.ads.indisponible) lignes.push(["Charges", "Publicité Google Ads", -euros(d.kpis.publiciteCents), ""]);
  for (const dep of d.depenses) {
    lignes.push(["Dépense", dep.category, -euros(dep.amount_cents), `${String(dep.expense_date).slice(0, 10)} — ${dep.note || ""}`]);
  }

  s.addTable({
    name: "FinanceDetail",
    ref: `A${debut}`,
    headerRow: true,
    totalsRow: true,
    style: { theme: TABLE_THEME, showRowStripes: true },
    columns: [
      { name: "Catégorie", filterButton: true },
      { name: "Sous-catégorie", filterButton: true },
      { name: "Montant (€)", totalsRowFunction: "sum", filterButton: false },
      { name: "Note", filterButton: false },
    ],
    rows: lignes,
  });
  for (let i = 0; i < lignes.length; i++) s.getCell(debut + 1 + i, 3).numFmt = EUR;
  s.getCell(debut + 1 + lignes.length, 3).numFmt = EUR;
  s.getColumn(1).width = 14;
  s.getColumn(2).width = 30;
  s.getColumn(3).width = 15;
  s.getColumn(4).width = 42;
  s.views = [{ state: "frozen", ySplit: debut }];

  const promo = wb.addWorksheet("Codes promo", { properties: { tabColor: { argb: ACCENT } } });
  const debutPromo = bandeau(promo, "Codes promo", { cols: 5 });
  promo.addTable({
    name: "CodesPromo",
    ref: `A${debutPromo}`,
    headerRow: true,
    style: { theme: TABLE_THEME, showRowStripes: true },
    columns: [{ name: "Code" }, { name: "Type" }, { name: "Valeur" }, { name: "Utilisations" }, { name: "Actif" }],
    rows: d.promoCodes.map((p) => [p.code, p.type, p.value, p.used_count, p.active ? "oui" : "non"]),
  });
  promo.columns = [{ width: 16 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 8 }];
}

// Vue « coûts fixes » : dépenses regroupées par catégorie en lignes et par
// mois en colonnes (matrice), comme le tableau de suivi manuel — plus lisible
// que la liste chronologique de l'onglet Finance pour repérer les charges
// récurrentes (abonnements, transporteur...).
function feuilleCoutsFixes(wb, d) {
  const s = wb.addWorksheet("Coûts fixes", { properties: { tabColor: { argb: ACCENT } } });
  const debut = bandeau(s, "Coûts fixes & charges récurrentes", {
    cols: d.moisTries.length + 2,
    sousTitre: "Dépenses regroupées par catégorie et par mois",
  });

  const categories = Object.keys(d.parCategorieEtMois).sort();
  if (!categories.length || !d.moisTries.length) {
    s.getCell(debut, 1).value = "Aucune dépense enregistrée sur la période.";
    s.getCell(debut, 1).font = { italic: true, color: { argb: "FF6B7280" } };
    s.getColumn(1).width = 40;
    return;
  }

  const moisLabel = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const rows = categories.map((cat) => {
    const bucket = d.parCategorieEtMois[cat];
    const valeurs = d.moisTries.map((m) => euros(bucket[m] || 0));
    const total = valeurs.reduce((a, b) => a + b, 0);
    return [cat, ...valeurs, total];
  });

  s.addTable({
    name: "CoutsFixes",
    ref: `A${debut}`,
    headerRow: true,
    totalsRow: true,
    style: { theme: TABLE_THEME, showRowStripes: true },
    columns: [
      { name: "Catégorie", filterButton: true },
      ...d.moisTries.map((m) => ({ name: moisLabel(m), totalsRowFunction: "sum" })),
      { name: "Total", totalsRowFunction: "sum" },
    ],
    rows,
  });
  const nCols = d.moisTries.length + 2;
  for (let i = 0; i <= rows.length; i++) {
    for (let c = 2; c <= nCols; c++) s.getCell(debut + 1 + i, c).numFmt = EUR;
  }
  s.getColumn(1).width = 26;
  for (let c = 2; c <= nCols; c++) s.getColumn(c).width = 16;
  s.views = [{ state: "frozen", ySplit: debut, xSplit: 1 }];
}

// Grand livre de stock — même esprit que le tableau de suivi manuel de
// référence (Date | Stock initial | Entrée | Sortie | Stock final | P.U |
// Valeur), construit à partir du journal réel (stock_movements), lui-même
// alimenté automatiquement par les ventes site (webhook Stripe) et Amazon
// (synchronisation), plus les mouvements manuels (réappro, casse, comptage).
// Reprend la structure de l'onglet « Coûts Revient » du classeur manuel : un
// bloc par lot de fabrication avec chaque ligne de coût (fabrication,
// transport, carton, audit...), le total et le coût de revient à l'unité.
function feuilleCoutRevient(wb, d) {
  const s = wb.addWorksheet("Coût de revient", { properties: { tabColor: { argb: ACCENT } } });
  let r = bandeau(s, "Coût de revient par lot", { cols: 4 });

  if (!d.coutsRevient.length) {
    s.getCell(r, 1).value = "Aucun lot de fabrication enregistré pour l'instant.";
    s.getCell(r, 1).font = { italic: true, color: { argb: "FF6B7280" } };
    s.getColumn(1).width = 40;
    return;
  }

  for (const lot of d.coutsRevient) {
    s.mergeCells(r, 1, r, 4);
    const titre = s.getCell(r, 1);
    titre.value = `${lot.label} — ${lot.productName} — ${lot.quantity} unités — ${lot.orderDate}`;
    titre.font = { bold: true, size: 12, color: { argb: WHITE } };
    titre.alignment = { vertical: "middle", indent: 1 };
    for (let c = 1; c <= 4; c++) s.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
    s.getRow(r).height = 20;
    r += 1;

    const debutTable = r;
    s.addTable({
      name: `Lot${lot.label.replace(/[^a-zA-Z0-9]/g, "")}${r}`,
      ref: `A${debutTable}`,
      headerRow: true,
      totalsRow: true,
      style: { theme: TABLE_THEME, showRowStripes: true },
      columns: [{ name: "Poste" }, { name: "Montant (€)", totalsRowFunction: "sum" }],
      rows: lot.lignes.map((l) => [l.label, euros(l.amountCents)]),
    });
    for (let i = 0; i <= lot.lignes.length; i++) s.getCell(debutTable + 1 + i, 2).numFmt = EUR;
    r = debutTable + lot.lignes.length + 2;

    s.getCell(r, 1).value = "Coût de revient à l'unité :";
    s.getCell(r, 1).font = { bold: true };
    s.getCell(r, 2).value = lot.unitCostCents != null ? euros(lot.unitCostCents) : null;
    s.getCell(r, 2).numFmt = EUR;
    s.getCell(r, 2).font = { bold: true, size: 12, color: { argb: ACCENT } };
    r += 3;
  }

  s.getColumn(1).width = 26;
  s.getColumn(2).width = 16;
  s.getColumn(3).width = 10;
  s.getColumn(4).width = 10;
}

function feuilleStock(wb, d) {
  const s = wb.addWorksheet("Stock", { properties: { tabColor: { argb: ACCENT } } });
  const debut = bandeau(s, "Mouvements de stock", { cols: 7 });

  const lignesMouvements = d.stockLedger.filter((l) => l.date);
  s.addTable({
    name: "MouvementsStock",
    ref: `A${debut}`,
    headerRow: true,
    style: { theme: TABLE_THEME, showRowStripes: true },
    columns: [
      { name: "Produit", filterButton: true },
      { name: "Date", filterButton: true },
      { name: "Stock initial" },
      { name: "Entrée" },
      { name: "Sortie" },
      { name: "Stock final" },
      { name: "Origine", filterButton: true },
    ],
    rows: lignesMouvements.length
      ? lignesMouvements.map((l) => [l.productName, l.date, l.stockInitial, l.entree, l.sortie, l.stockFinal, l.source])
      : [["—", "", 0, 0, 0, 0, ""]],
  });
  const nLignes = Math.max(lignesMouvements.length, 1);
  if (lignesMouvements.length) {
    barreDonnees(s, `D${debut + 1}:D${debut + nLignes}`, GREEN);
    barreDonnees(s, `E${debut + 1}:E${debut + nLignes}`, RED);
  }
  s.columns = [{ width: 24 }, { width: 12 }, { width: 13 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 14 }];
  s.views = [{ state: "frozen", ySplit: debut }];

  let r = debut + nLignes + 2;
  s.getCell(r, 1).value = "Stock actuel & valorisation";
  s.getCell(r, 1).font = { bold: true, size: 12 };
  r += 1;
  const debutValo = r;
  const lignesValo = d.stockLedger.filter((l) => !l.date);
  s.addTable({
    name: "ValorisationStock",
    ref: `A${debutValo}`,
    headerRow: true,
    style: { theme: TABLE_THEME, showRowStripes: true },
    columns: [{ name: "Produit" }, { name: "Stock actuel" }, { name: "P.U (€)" }, { name: "Valeur stock (€)" }],
    rows: lignesValo.length
      ? lignesValo.map((l) => [l.productName, l.stockActuel, l.puCents != null ? euros(l.puCents) : null, l.valeurCents != null ? euros(l.valeurCents) : null])
      : [["—", 0, null, null]],
  });
  for (let i = 0; i < Math.max(lignesValo.length, 1); i++) {
    s.getCell(debutValo + 1 + i, 3).numFmt = EUR;
    s.getCell(debutValo + 1 + i, 4).numFmt = EUR;
  }
}

function feuilleVentes(wb, d) {
  const s = wb.addWorksheet("Ventes", { properties: { tabColor: { argb: NAVY } } });
  const debut = bandeau(s, "Commandes", { cols: 5 });
  const rows = d.orders.map((o) => [
    o.order_number,
    new Date(o.created_at).toISOString().slice(0, 10),
    o.status,
    euros(o.total_cents),
    euros(o.stripe_fee_cents),
  ]);
  s.addTable({
    name: "Commandes",
    ref: `A${debut}`,
    headerRow: true,
    totalsRow: rows.length > 0,
    style: { theme: TABLE_THEME, showRowStripes: true },
    columns: [
      { name: "N° commande", filterButton: true },
      { name: "Date", filterButton: true },
      { name: "Statut", filterButton: true },
      { name: "Total (€)", totalsRowFunction: "sum", filterButton: false },
      { name: "Frais Stripe (€)", totalsRowFunction: "sum", filterButton: false },
    ],
    rows: rows.length ? rows : [["—", "", "", 0, 0]],
  });
  for (let i = 0; i <= rows.length; i++) {
    s.getCell(debut + 1 + i, 4).numFmt = EUR;
    s.getCell(debut + 1 + i, 5).numFmt = EUR;
  }
  s.columns = [{ width: 16 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 }];
  s.views = [{ state: "frozen", ySplit: debut }];

  const produits = wb.addWorksheet("Produits", { properties: { tabColor: { argb: NAVY } } });
  const debutP = bandeau(produits, "Performance par produit", { cols: 6 });
  const lignesP = Object.entries(d.parProduit)
    .sort((a, b) => b[1].caCents - a[1].caCents)
    .map(([nom, p]) => {
      const marge = p.caCents - p.coutCents;
      return [nom, p.quantite, euros(p.caCents), euros(p.coutCents), euros(marge), p.caCents ? marge / p.caCents : 0];
    });
  produits.addTable({
    name: "PerformanceProduits",
    ref: `A${debutP}`,
    headerRow: true,
    style: { theme: TABLE_THEME, showRowStripes: true },
    columns: [
      { name: "Produit", filterButton: true },
      { name: "Quantité vendue" },
      { name: "CA (€)" },
      { name: "Coût (€)" },
      { name: "Marge (€)" },
      { name: "Marge (%)" },
    ],
    rows: lignesP.length ? lignesP : [["—", 0, 0, 0, 0, 0]],
  });
  const nP = Math.max(lignesP.length, 1);
  for (let i = 0; i < nP; i++) {
    produits.getCell(debutP + 1 + i, 3).numFmt = EUR;
    produits.getCell(debutP + 1 + i, 4).numFmt = EUR;
    produits.getCell(debutP + 1 + i, 5).numFmt = EUR;
    produits.getCell(debutP + 1 + i, 6).numFmt = "0.0%";
  }
  if (lignesP.length) barreDonnees(produits, `E${debutP + 1}:E${debutP + nP}`, GREEN);
  produits.columns = [{ width: 30 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 10 }];
}

function feuilleMarketing(wb, d) {
  const s = wb.addWorksheet("Marketing", { properties: { tabColor: { argb: GREEN } } });
  let r = bandeau(s, "Marketing & trafic", { cols: 3 });

  s.getCell(r, 1).value = "Trafic par jour";
  s.getCell(r, 1).font = { bold: true, size: 12 };
  r += 1;
  const debutTrafic = r;
  s.addTable({
    name: "TraficParJour",
    ref: `A${debutTrafic}`,
    headerRow: true,
    style: { theme: TABLE_THEME, showRowStripes: true },
    columns: [{ name: "Date" }, { name: "Pages vues" }, { name: "Visiteurs uniques" }],
    rows: d.serieVisites.length ? d.serieVisites.map((j) => [j.date, j.vues, j.visiteurs]) : [["—", 0, 0]],
  });
  const nTrafic = Math.max(d.serieVisites.length, 1);
  if (d.serieVisites.length) barreDonnees(s, `B${debutTrafic + 1}:B${debutTrafic + nTrafic}`, GREEN);
  r = debutTrafic + nTrafic + 2;

  const sourcesTri = Object.entries(d.sources).sort((a, b) => b[1] - a[1]);
  s.getCell(r, 1).value = "Sources de trafic";
  s.getCell(r, 1).font = { bold: true, size: 12 };
  r += 1;
  const debutSources = r;
  s.addTable({
    name: "SourcesTrafic",
    ref: `A${debutSources}`,
    headerRow: true,
    style: { theme: TABLE_THEME, showRowStripes: true },
    columns: [{ name: "Source" }, { name: "Vues" }],
    rows: sourcesTri.length ? sourcesTri : [["—", 0]],
  });
  const nSources = Math.max(sourcesTri.length, 1);
  if (sourcesTri.length) barreDonnees(s, `B${debutSources + 1}:B${debutSources + nSources}`, ACCENT);
  r = debutSources + nSources + 2;

  const pagesTri = Object.entries(d.pages).sort((a, b) => b[1] - a[1]).slice(0, 30);
  s.getCell(r, 1).value = "Pages les plus vues";
  s.getCell(r, 1).font = { bold: true, size: 12 };
  r += 1;
  const debutPages = r;
  s.addTable({
    name: "PagesVues",
    ref: `A${debutPages}`,
    headerRow: true,
    style: { theme: TABLE_THEME, showRowStripes: true },
    columns: [{ name: "Page" }, { name: "Vues" }],
    rows: pagesTri.length ? pagesTri : [["—", 0]],
  });
  r = debutPages + Math.max(pagesTri.length, 1) + 2;

  const campagnesTri = Object.entries(d.campagnes).sort((a, b) => b[1] - a[1]);
  if (campagnesTri.length) {
    s.getCell(r, 1).value = "Campagnes (UTM)";
    s.getCell(r, 1).font = { bold: true, size: 12 };
    r += 1;
    s.addTable({
      name: "CampagnesUtm",
      ref: `A${r}`,
      headerRow: true,
      style: { theme: TABLE_THEME, showRowStripes: true },
      columns: [{ name: "Campagne" }, { name: "Vues" }],
      rows: campagnesTri,
    });
    r += campagnesTri.length + 2;
  }

  if (!d.ads.indisponible) {
    s.getCell(r, 1).value = "Google Ads — dépense sur la période";
    s.getCell(r, 1).font = { bold: true, size: 12 };
    r += 1;
    s.getCell(r, 1).value = "Dépense (€)";
    s.getCell(r, 2).value = euros(Math.round((d.ads.depenseTotale || 0) * 100));
    s.getCell(r, 2).numFmt = EUR;
  }

  s.columns = [{ width: 28 }, { width: 14 }, { width: 16 }];
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  const url = new URL(req.url);
  const { from, to } = resolveRange(url);

  try {
    const d = await chargerDonnees(from, to);

    const wb = new ExcelJS.Workbook();
    wb.creator = "E-Carpet";
    wb.created = new Date();

    feuilleSynthese(wb, from, to, d);
    feuilleFinance(wb, d);
    feuilleCoutsFixes(wb, d);
    feuilleCoutRevient(wb, d);
    feuilleStock(wb, d);
    feuilleVentes(wb, d);
    feuilleMarketing(wb, d);

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="e-carpet-rapport-${from}-au-${to}.xlsx"`,
      },
    });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
};

export const config = { path: "/api/export-excel" };
