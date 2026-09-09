import { sql } from "./_db.mjs";
import { STATUTS_PAYES } from "./_statuts.mjs";
import { detecterAnomalies } from "./_anomalies.mjs";

// Rapport hebdomadaire auto-rédigé (ERP 3.0, niveau 1).
//
// Le back-office sait déjà tout montrer, mais seulement à qui vient regarder.
// Personne n'ouvre huit onglets le lundi matin. Ce rapport inverse le sens de
// lecture : il vient à son lecteur, et se limite à trois questions —
// qu'est-ce qui a changé, qu'est-ce qui cloche, que faire cette semaine.
//
// Contrainte de conception dominante, et la seule qui compte vraiment ici :
// **l'activité est minuscule**. Deux commandes encaissées au total, aucune
// dépense saisie, aucun coût produit renseigné. Sur cette base, la tentation
// serait d'afficher « marge : 0,00 € » et « CA en baisse de 100 % » — deux
// affirmations fausses présentées avec l'assurance d'un chiffre. Un rapport
// qui ment une fois n'est plus jamais lu.
//
// D'où trois règles appliquées partout dans ce fichier :
//
//  1. Zéro n'est pas la même chose qu'inconnu. Une marge sans coût produit est
//     `null` + une raison lisible, jamais 0.
//  2. Aucune tendance en dessous d'un échantillon minimal. Passer de 1 à 2
//     commandes n'est pas « +100 % de croissance ».
//  3. Quand il ne s'est rien passé, le rapport le dit en une phrase et
//     recommande de préparer la donnée manquante, plutôt que de meubler.
//
// Le module est découpé en une couche de COLLECTE (accès base, en bas) et une
// couche de CONSTRUCTION pure (`construireRapport`, `recommanderActions`,
// `rendre*`), testable sans base ni réseau — voir scripts/test-rapport.mjs.

const JOUR = 86400000;

/** Seuils de prudence, groupés pour être ajustables sans relire la logique. */
export const SEUILS = {
  // En dessous, une variation de CA d'une semaine à l'autre ne veut rien dire.
  // Aligné sur SEUILS.baisseCaCommandesMin de _anomalies.mjs, volontairement :
  // les deux modules doivent se taire au même moment, sinon l'un contredit
  // l'autre sous les yeux du lecteur.
  commandesMinTendance: 5,
  // Variation en deçà de laquelle on parle de « stable » plutôt que d'annoncer
  // un mouvement : ±10 % sur de petits volumes, c'est du bruit.
  variationNegligeable: 10,
};

const euros = (cents) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
const pluriel = (n, mot, suffixe = "s") => `${mot}${n > 1 ? suffixe : ""}`;
const jourFr = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

// --- Comparaison -----------------------------------------------------------

/**
 * Compare deux périodes en refusant de conclure sur un échantillon trop
 * faible. Renvoie toujours `{ variation, suffisant, phrase }` : `variation`
 * vaut null tant que la comparaison n'est pas défendable.
 *
 * Le nombre de COMMANDES sert de test de significativité, pas le montant :
 * une seule grosse commande peut doubler le CA sans que l'activité ait changé.
 */
export function comparerPeriodes(actuel, precedent, seuils = SEUILS) {
  const base = { actuel, precedent };

  if (!actuel.nb && !precedent.nb) {
    return { ...base, variation: null, suffisant: false, phrase: "Aucune commande cette semaine, ni la semaine précédente." };
  }

  // Volume trop faible des deux côtés : on décrit les faits bruts, sans
  // pourcentage. « 1 commande contre 2 » se comprend seul et ne trompe pas.
  const echantillon = Math.max(actuel.nb, precedent.nb);
  if (echantillon < seuils.commandesMinTendance) {
    return {
      ...base,
      variation: null,
      suffisant: false,
      phrase:
        `${actuel.nb} ${pluriel(actuel.nb, "commande")} pour ${euros(actuel.caCents)} cette semaine, ` +
        `contre ${precedent.nb} pour ${euros(precedent.caCents)} la semaine précédente. ` +
        `Trop peu de volume pour parler de tendance.`,
    };
  }

  // Division par zéro écartée : sans CA précédent, il n'y a pas de variation
  // relative à calculer, seulement un démarrage à constater.
  if (!precedent.caCents) {
    return {
      ...base,
      variation: null,
      suffisant: false,
      phrase: `${euros(actuel.caCents)} cette semaine, contre aucune vente la semaine précédente.`,
    };
  }

  const variation = ((actuel.caCents - precedent.caCents) / precedent.caCents) * 100;
  const arrondi = Math.round(variation);
  const sens = Math.abs(arrondi) < seuils.variationNegligeable ? "stable" : arrondi > 0 ? "hausse" : "baisse";
  const phrase =
    sens === "stable"
      ? `Chiffre d'affaires stable à ${euros(actuel.caCents)} (${actuel.nb} ${pluriel(actuel.nb, "commande")}).`
      : `Chiffre d'affaires en ${sens} de ${Math.abs(arrondi)} % : ${euros(actuel.caCents)} contre ${euros(precedent.caCents)}.`;

  return { ...base, variation: arrondi, suffisant: true, sens, phrase };
}

// --- Marge -----------------------------------------------------------------

/**
 * Marge de la semaine, ou l'aveu qu'elle est incalculable.
 *
 * Point central du rapport : tant qu'aucun coût produit n'est saisi, une
 * « marge » n'est qu'un chiffre d'affaires déguisé. La renvoyer à 0 ou, pire,
 * égale au CA, ferait croire à une rentabilité qui n'a jamais été mesurée.
 */
export function evaluerMarge(ventes, depenses, couverture) {
  const manquants = [];
  if (couverture.produitsSansCout.length) {
    manquants.push(
      `aucun coût d'achat n'est renseigné pour ${couverture.produitsSansCout.map((n) => `« ${n} »`).join(", ")}`,
    );
  }
  if (!couverture.depensesTotales) {
    manquants.push("aucune dépense n'a jamais été saisie (frais fixes, publicité, transport)");
  }

  if (manquants.length) {
    return {
      calculable: false,
      montantCents: null,
      raison: `Marge incalculable : ${manquants.join(" ; ")}.`,
      manquants,
    };
  }

  const montantCents = ventes.caCents - ventes.fraisStripeCents - ventes.coutProduitCents - depenses.totalCents;
  return {
    calculable: true,
    montantCents,
    raison: null,
    manquants: [],
    phrase: `Marge de la semaine : ${euros(montantCents)} sur ${euros(ventes.caCents)} de ventes.`,
  };
}

// --- Actions recommandées --------------------------------------------------

// Impact sur 100. L'échelle n'a pas vocation à être exacte : elle sert à
// TRIER. Le classement compte, la valeur absolue non — c'est pourquoi elle
// n'est jamais affichée au lecteur.
//
// Hiérarchie assumée : l'argent déjà encaissé mais bloqué passe avant le
// client qui attend, qui passe avant la donnée manquante, qui passe avant
// l'optimisation. Une action n'entre dans la liste que si l'on sait dire quoi
// faire et où le faire.
const IMPACT = {
  argentBloque: 95,
  clientQuiAttend: 85,
  ruptureStock: 80,
  donneeManquanteMarge: 60,
  donneeManquanteDepenses: 55,
  anomalieAttention: 40,
  anomalieInfo: 20,
  activiteNulle: 30,
};

/**
 * Trois actions, classées par impact décroissant.
 *
 * Elles sont dérivées des anomalies déjà détectées (on ne redétecte rien) et
 * des trous de données constatés à la collecte. On n'en renvoie jamais plus de
 * trois : une liste de quinze actions ne se hiérarchise pas, donc ne se fait
 * pas.
 */
export function recommanderActions(snapshot) {
  const candidates = [];

  for (const a of snapshot.anomalies) {
    const impact =
      a.code === "paiement_bloque"
        ? IMPACT.argentBloque
        : a.code === "expedition_en_retard"
          ? IMPACT.clientQuiAttend
          : a.code === "rupture"
            ? IMPACT.ruptureStock
            : a.severite === "attention"
              ? IMPACT.anomalieAttention
              : IMPACT.anomalieInfo;
    candidates.push({ impact, titre: a.titre, pourquoi: a.detail, ou: a.action?.label || null });
  }

  // Les trous de données valent une action à part entière : tant qu'ils sont
  // là, aucune décision chiffrée n'est possible, et c'est donc le blocage le
  // plus rentable à lever — bien avant toute idée de croissance.
  if (snapshot.couverture.produitsSansCout.length) {
    candidates.push({
      impact: IMPACT.donneeManquanteMarge,
      titre: "Saisir le coût d'achat des produits",
      pourquoi:
        `Sans coût d'achat, la marge reste incalculable et aucun arbitrage (prix, publicité, réassort) ne repose ` +
        `sur autre chose qu'une intuition. Produits concernés : ${snapshot.couverture.produitsSansCout.join(", ")}.`,
      ou: "Finance",
    });
  }
  if (!snapshot.couverture.depensesTotales) {
    candidates.push({
      impact: IMPACT.donneeManquanteDepenses,
      titre: "Saisir les dépenses du mois",
      pourquoi:
        "Aucune dépense n'a jamais été enregistrée. Le résultat affiché est donc structurellement optimiste : " +
        "il ignore l'hébergement, la publicité et le transport.",
      ou: "Finance",
    });
  }

  // Semaine sans vente ET sans anomalie : plutôt que d'inventer un conseil
  // marketing que ce module n'a aucun moyen de fonder, on nomme le fait.
  if (!snapshot.ventes.nb && !snapshot.anomalies.length) {
    candidates.push({
      impact: IMPACT.activiteNulle,
      titre: "Aucune vente cette semaine",
      pourquoi:
        "Rien n'indique une panne : les tâches automatiques tournent et le stock est disponible. " +
        "C'est un problème d'acquisition, pas de fonctionnement du site.",
      ou: null,
    });
  }

  return candidates.sort((a, b) => b.impact - a.impact).slice(0, 3);
}

// --- Construction du rapport ----------------------------------------------

/**
 * Assemble le rapport final. Fonction pure : tout ce dont elle a besoin est
 * dans `snapshot`, ce qui la rend testable en injectant des données inventées
 * — y compris les cas dégénérés (semaine vide, base neuve).
 */
export function construireRapport(snapshot) {
  const evolution = comparerPeriodes(snapshot.ventes, snapshot.ventesPrecedentes);
  const marge = evaluerMarge(snapshot.ventes, snapshot.depenses, snapshot.couverture);
  const actions = recommanderActions(snapshot);

  const faits = [evolution.phrase];
  if (marge.calculable) faits.push(marge.phrase);
  else faits.push(marge.raison);
  if (snapshot.depenses.nb) {
    faits.push(`${snapshot.depenses.nb} ${pluriel(snapshot.depenses.nb, "dépense")} saisie${snapshot.depenses.nb > 1 ? "s" : ""} pour ${euros(snapshot.depenses.totalCents)}.`);
  }
  if (snapshot.nouveauxClients) {
    faits.push(`${snapshot.nouveauxClients} ${pluriel(snapshot.nouveauxClients, "nouveau", "x")} ${pluriel(snapshot.nouveauxClients, "client")}.`);
  }

  return {
    periode: snapshot.periode,
    genereLe: snapshot.genereLe,
    evolution,
    marge,
    faits,
    anomalies: snapshot.anomalies,
    compteAnomalies: snapshot.compteAnomalies,
    erreursDetection: snapshot.erreursDetection,
    actions,
    couverture: snapshot.couverture,
    ventes: snapshot.ventes,
    ventesPrecedentes: snapshot.ventesPrecedentes,
  };
}

// --- Rendus ----------------------------------------------------------------

/** Résumé d'une ligne pour la notification push, qui n'a droit qu'à ça. */
export function resumePush(rapport) {
  const c = rapport.compteAnomalies;
  const morceaux = [];
  morceaux.push(
    rapport.ventes.nb
      ? `${rapport.ventes.nb} ${pluriel(rapport.ventes.nb, "commande")} · ${euros(rapport.ventes.caCents)}`
      : "aucune vente",
  );
  if (c.critique) morceaux.push(`${c.critique} ${pluriel(c.critique, "urgence")}`);
  else if (c.attention) morceaux.push(`${c.attention} point${c.attention > 1 ? "s" : ""} à vérifier`);
  if (rapport.actions[0]) morceaux.push(`à faire : ${rapport.actions[0].titre.toLowerCase()}`);
  return morceaux.join(" · ").slice(0, 200);
}

/** Version texte, utilisée par les tests et par la console lors d'un test manuel. */
export function rendreTexte(rapport) {
  const l = [];
  l.push(`RAPPORT HEBDOMADAIRE — semaine du ${jourFr(rapport.periode.debut)} au ${jourFr(rapport.periode.fin)}`);
  l.push("");
  l.push("CE QUI A CHANGÉ");
  for (const f of rapport.faits) l.push(`  · ${f}`);
  l.push("");
  l.push("ANOMALIES EN COURS");
  if (!rapport.anomalies.length) l.push("  · Aucune anomalie détectée.");
  for (const a of rapport.anomalies) l.push(`  · [${a.severite}] ${a.titre} — ${a.detail}`);
  if (rapport.erreursDetection.length) {
    for (const e of rapport.erreursDetection) l.push(`  · [détection indisponible] ${e.detecteur} : ${e.message}`);
  }
  l.push("");
  l.push("À FAIRE CETTE SEMAINE");
  if (!rapport.actions.length) l.push("  · Rien de prioritaire à signaler.");
  rapport.actions.forEach((a, i) => {
    l.push(`  ${i + 1}. ${a.titre}${a.ou ? ` (onglet ${a.ou})` : ""}`);
    l.push(`     ${a.pourquoi}`);
  });
  return l.join("\n");
}

const COULEUR = { critique: "#dc2626", attention: "#d97706", info: "#71717a" };

/** Version HTML de l'email. Styles en ligne : les clients mail ignorent <style>. */
export function rendreHtml(rapport) {
  const bloc = (titre, contenu) => `
    <div style="margin:0 0 28px">
      <h2 style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#a1a1aa;margin:0 0 12px">${titre}</h2>
      ${contenu}
    </div>`;

  const faits = rapport.faits
    .map((f) => `<p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#3f3f46">${f}</p>`)
    .join("");

  const anomalies = rapport.anomalies.length
    ? rapport.anomalies
        .map(
          (a) => `
        <div style="border-left:3px solid ${COULEUR[a.severite]};padding:2px 0 2px 12px;margin:0 0 12px">
          <div style="font-size:14px;font-weight:700;color:#18181b">${a.titre}</div>
          <div style="font-size:13px;line-height:1.5;color:#52525b">${a.detail}</div>
        </div>`,
        )
        .join("")
    : `<p style="margin:0;font-size:14px;color:#3f3f46">Aucune anomalie détectée.</p>`;

  const actions = rapport.actions.length
    ? rapport.actions
        .map(
          (a, i) => `
        <div style="margin:0 0 14px">
          <div style="font-size:14px;font-weight:700;color:#18181b">${i + 1}. ${a.titre}${a.ou ? ` <span style="font-weight:500;color:#a1a1aa">· onglet ${a.ou}</span>` : ""}</div>
          <div style="font-size:13px;line-height:1.5;color:#52525b">${a.pourquoi}</div>
        </div>`,
        )
        .join("")
    : `<p style="margin:0;font-size:14px;color:#3f3f46">Rien de prioritaire à signaler.</p>`;

  return `
  <div style="background:#f4f4f5;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden">
      <div style="background:#18181b;padding:22px 28px">
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#e06a3b;font-weight:700">E-Carpet</div>
        <div style="font-size:19px;font-weight:800;color:#ffffff;margin-top:4px">Rapport de la semaine</div>
        <div style="font-size:13px;color:#a1a1aa;margin-top:2px">du ${jourFr(rapport.periode.debut)} au ${jourFr(rapport.periode.fin)}</div>
      </div>
      <div style="padding:26px 28px 8px">
        ${bloc("Ce qui a changé", faits)}
        ${bloc("Anomalies en cours", anomalies)}
        ${bloc("À faire cette semaine", actions)}
      </div>
      <div style="padding:0 28px 24px">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#a1a1aa">
          Rapport généré automatiquement chaque lundi. Les chiffres non calculables sont signalés comme tels
          plutôt qu'affichés à zéro.
        </p>
      </div>
    </div>
  </div>`;
}

// --- Collecte --------------------------------------------------------------

/** Bornes des deux semaines comparées, calculées une seule fois. */
export function fenetres(maintenant = new Date()) {
  const fin = new Date(maintenant);
  const debut = new Date(fin.getTime() - 7 * JOUR);
  const debutPrecedent = new Date(fin.getTime() - 14 * JOUR);
  return { debut, fin, debutPrecedent };
}

async function ventesEntre(debut, fin) {
  const [r] = await sql()`
    select count(*)::int as nb,
           coalesce(sum(total_cents), 0)::int as ca,
           coalesce(sum(stripe_fee_cents), 0)::int as frais
    from orders
    where created_at >= ${debut.toISOString()} and created_at < ${fin.toISOString()}
      and status = any(${STATUTS_PAYES})
  `;

  // Coût produit à la date de la commande, jamais le coût actuel : c'est la
  // règle déjà appliquée par finance.mjs, et deux calculs de marge qui
  // divergent seraient pires qu'un seul absent.
  const items = await sql()`
    select oi.product_id, oi.name, oi.quantity, o.created_at
    from order_items oi
    join orders o on o.id = oi.order_id
    where o.created_at >= ${debut.toISOString()} and o.created_at < ${fin.toISOString()}
      and o.status = any(${STATUTS_PAYES})
  `;

  let coutProduitCents = 0;
  const sansCout = new Set();
  for (const it of items) {
    const [cout] = await sql()`
      select unit_cost_cents from product_costs
      where product_id = ${it.product_id} and effective_from <= ${it.created_at}
      order by effective_from desc limit 1
    `;
    if (cout) coutProduitCents += cout.unit_cost_cents * it.quantity;
    else sansCout.add(it.name);
  }

  return {
    nb: r.nb,
    caCents: r.ca,
    fraisStripeCents: r.frais,
    coutProduitCents,
    produitsSansCout: [...sansCout],
  };
}

/**
 * Lit tout ce dont le rapport a besoin. Seule fonction du module à toucher la
 * base : `construireRapport` reste ainsi vérifiable hors ligne.
 */
export async function collecterSnapshot(maintenant = new Date()) {
  const { debut, fin, debutPrecedent } = fenetres(maintenant);

  const [ventes, ventesPrecedentes, detection] = await Promise.all([
    ventesEntre(debut, fin),
    ventesEntre(debutPrecedent, debut),
    detecterAnomalies(),
  ]);

  const [depenses] = await sql()`
    select count(*)::int as nb, coalesce(sum(amount_cents), 0)::int as total
    from expenses
    where expense_date >= ${debut.toISOString()} and expense_date < ${fin.toISOString()}
  `;

  const [clients] = await sql()`
    select count(distinct email)::int as nb from orders
    where created_at >= ${debut.toISOString()} and created_at < ${fin.toISOString()}
      and status = any(${STATUTS_PAYES})
      and email not in (
        select email from orders
        where created_at < ${debut.toISOString()} and status = any(${STATUTS_PAYES})
      )
  `;

  // Couverture de la donnée, mesurée sur TOUT l'historique et pas seulement
  // sur la semaine : une semaine sans vente n'a évidemment aucun produit sans
  // coût, ce qui ferait disparaître l'avertissement au pire moment.
  const [couvertureCouts] = await sql()`
    select count(*)::int as nb from products p
    where p.active = true and not exists (select 1 from product_costs c where c.product_id = p.id)
  `;
  const produitsSansCoutGlobal = couvertureCouts.nb
    ? (await sql()`
        select p.name from products p
        where p.active = true and not exists (select 1 from product_costs c where c.product_id = p.id)
        order by p.name
      `).map((p) => p.name)
    : [];
  const [depensesTotales] = await sql()`select count(*)::int as nb from expenses`;

  return {
    periode: { debut: debut.toISOString(), fin: fin.toISOString() },
    genereLe: new Date(maintenant).toISOString(),
    ventes,
    ventesPrecedentes,
    depenses: { nb: depenses.nb, totalCents: depenses.total },
    nouveauxClients: clients.nb,
    anomalies: detection.anomalies,
    compteAnomalies: detection.compte,
    erreursDetection: detection.erreurs,
    couverture: {
      produitsSansCout: produitsSansCoutGlobal,
      depensesTotales: depensesTotales.nb,
    },
  };
}

// --- Persistance -----------------------------------------------------------

// Table créée à la volée plutôt que par migration : elle n'a aucune dépendance
// ni clé étrangère, et le même procédé est déjà utilisé par pilotage.mjs pour
// pilotage_settings. Le rapport complet est stocké en JSON — sa forme évoluera
// plus vite qu'un schéma de colonnes, et rien d'autre n'a besoin de le
// requêter champ par champ.
async function assurerTable() {
  await sql()`
    create table if not exists rapports_hebdo (
      id serial primary key,
      periode_debut timestamp not null,
      periode_fin timestamp not null,
      contenu jsonb not null,
      created_at timestamp not null default now()
    )
  `;
}

export async function enregistrerRapport(rapport) {
  await assurerTable();
  await sql()`
    insert into rapports_hebdo (periode_debut, periode_fin, contenu)
    values (${rapport.periode.debut}, ${rapport.periode.fin}, ${JSON.stringify(rapport)})
  `;
}

/** Dernier rapport produit, pour le back-office. Null si aucun n'a encore tourné. */
export async function dernierRapport() {
  await assurerTable();
  const [r] = await sql()`
    select contenu, created_at from rapports_hebdo order by created_at desc limit 1
  `;
  return r ? { ...r.contenu, enregistreLe: r.created_at } : null;
}
