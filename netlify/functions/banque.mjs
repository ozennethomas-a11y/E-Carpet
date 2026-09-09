import { sql } from "./lib/_db.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { parserReleve, chercherRapprochement, CATEGORIES } from "./lib/_banque.mjs";

// Rapprochement bancaire : import d'un relevé CSV, rattachement automatique
// aux dépenses déjà saisies, et traitement à la main de ce qui reste.
//
// Le rapprochement était jusqu'ici intégralement manuel — les mouvements
// recopiés un par un dans un classeur, puis rattachés aux factures à la main.
//
// Principe retenu : la machine propose, l'admin dispose. L'import ne crée
// jamais de dépense tout seul. Il rattache uniquement quand la correspondance
// est certaine (même montant au centime, date proche, une seule candidate) et
// laisse tout le reste explicitement « à traiter ». Une écriture comptable
// fausse coûte plus cher à retrouver qu'une ligne laissée en attente.

/** Une ligne bancaire, telle que consommée par le front. */
function versFront(r) {
  return {
    id: r.id,
    date: r.value_date,
    label: r.label,
    amountCents: r.amount_cents,
    status: r.status,
    expenseId: r.expense_id,
    suggestedCategory: r.suggested_category,
    note: r.note,
    depense: r.depense_category
      ? { category: r.depense_category, amountCents: r.depense_amount_cents, date: r.depense_date }
      : null,
  };
}

async function listerLignes() {
  const rows = await sql()`
    select t.id, t.value_date, t.label, t.amount_cents, t.status, t.expense_id,
           t.suggested_category, t.note,
           e.category as depense_category, e.amount_cents as depense_amount_cents,
           e.expense_date as depense_date
    from bank_transactions t
    left join expenses e on e.id = t.expense_id
    order by t.value_date desc, t.id desc
    limit 500
  `;
  const [compte] = await sql()`
    select
      count(*) filter (where status = 'a_traiter')::int as a_traiter,
      count(*) filter (where status = 'rapproche')::int as rapproche,
      count(*) filter (where status = 'ignore')::int as ignore,
      coalesce(sum(amount_cents) filter (where status = 'a_traiter' and amount_cents < 0), 0)::int as a_traiter_debit_cents
    from bank_transactions
  `;
  return { lignes: rows.map(versFront), compte, categories: CATEGORIES };
}

/** Dépenses candidates au rapprochement, avec l'indication de celles déjà prises. */
async function depensesCandidates() {
  const rows = await sql()`
    select e.id, e.category, e.amount_cents, e.expense_date,
           exists(select 1 from bank_transactions t where t.expense_id = e.id) as deja
    from expenses e
    order by e.expense_date desc
    limit 1000
  `;
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    amountCents: r.amount_cents,
    expenseDate: r.expense_date,
    dejaRattachee: r.deja,
  }));
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    if (req.method === "GET") {
      return Response.json(await listerLignes());
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      // Import d'un relevé. Idempotent : les lignes déjà connues sont
      // ignorées grâce à leur empreinte, donc réimporter le même fichier ou
      // deux relevés qui se chevauchent ne crée pas de doublon.
      if (body.action === "importer") {
        const { lignes, erreurs, colonnes } = parserReleve(body.csv || "");
        if (lignes.length === 0) {
          return Response.json({ error: erreurs[0]?.raison || "aucune ligne exploitable" }, { status: 400 });
        }

        const candidates = await depensesCandidates();
        // Suivi local des dépenses consommées pendant cet import : sans lui,
        // deux lignes bancaires de même montant se rattacheraient à la même
        // dépense.
        const prises = new Set();

        let ajoutees = 0;
        let doublons = 0;
        let rapprochees = 0;

        for (const l of lignes) {
          const disponibles = candidates.map((d) => ({ ...d, dejaRattachee: d.dejaRattachee || prises.has(d.id) }));
          const trouvee = chercherRapprochement(l, disponibles);
          const statut = trouvee ? "rapproche" : "a_traiter";

          const [insere] = await sql()`
            insert into bank_transactions
              (value_date, label, amount_cents, fingerprint, status, expense_id, suggested_category)
            values (${l.date}, ${l.label}, ${l.amountCents}, ${l.fingerprint},
                    ${statut}, ${trouvee?.id ?? null}, ${l.suggestedCategory})
            on conflict (fingerprint) do nothing
            returning id
          `;
          if (!insere) {
            doublons++;
            continue;
          }
          ajoutees++;
          if (trouvee) {
            prises.add(trouvee.id);
            rapprochees++;
          }
        }

        return Response.json({
          ok: true,
          ajoutees,
          doublons,
          rapprochees,
          aTraiter: ajoutees - rapprochees,
          lignesIgnorees: erreurs,
          colonnes,
        });
      }

      // Rattache une ligne à une dépense existante.
      if (body.action === "rapprocher") {
        const { id, expenseId } = body;
        if (!id || !expenseId) return Response.json({ error: "ligne ou dépense manquante" }, { status: 400 });

        const [prise] = await sql()`
          select id from bank_transactions where expense_id = ${expenseId} and id != ${id}
        `;
        if (prise) return Response.json({ error: "cette dépense est déjà rattachée à une autre ligne" }, { status: 409 });

        await sql()`
          update bank_transactions set expense_id = ${expenseId}, status = 'rapproche' where id = ${id}
        `;
        return Response.json({ ok: true });
      }

      // Crée la dépense correspondant à une ligne, et l'y rattache. Le montant
      // et la date viennent de la banque, jamais d'une saisie : c'est tout
      // l'intérêt de partir du relevé.
      if (body.action === "creer-depense") {
        const { id, category, note } = body;
        if (!id) return Response.json({ error: "ligne manquante" }, { status: 400 });
        if (!CATEGORIES.includes(category)) return Response.json({ error: "catégorie invalide" }, { status: 400 });

        const [ligne] = await sql()`
          select id, value_date, label, amount_cents, status, expense_id
          from bank_transactions where id = ${id}
        `;
        if (!ligne) return Response.json({ error: "ligne introuvable" }, { status: 404 });
        if (ligne.expense_id) return Response.json({ error: "ligne déjà rattachée" }, { status: 409 });
        if (ligne.amount_cents >= 0) {
          return Response.json({ error: "un encaissement ne peut pas devenir une dépense" }, { status: 400 });
        }

        const [depense] = await sql()`
          insert into expenses (category, amount_cents, expense_date, note)
          values (${category}, ${Math.abs(ligne.amount_cents)}, ${ligne.value_date},
                  ${note || ligne.label})
          returning id
        `;
        await sql()`
          update bank_transactions set expense_id = ${depense.id}, status = 'rapproche' where id = ${id}
        `;
        return Response.json({ ok: true, expenseId: depense.id });
      }

      // Écarte une ligne qui n'est pas une charge d'exploitation : encaissement
      // Stripe déjà compté dans le CA, virement interne, remboursement.
      if (body.action === "ignorer") {
        const { id, note } = body;
        if (!id) return Response.json({ error: "ligne manquante" }, { status: 400 });
        await sql()`
          update bank_transactions
          set status = 'ignore', expense_id = null, note = ${note || null}
          where id = ${id}
        `;
        return Response.json({ ok: true });
      }

      // Remet une ligne à traiter. La dépense éventuellement créée depuis
      // cette ligne n'est PAS supprimée : elle a pu servir ailleurs, et
      // supprimer une écriture comptable sans le dire serait pire que de
      // laisser un doublon visible.
      if (body.action === "reouvrir") {
        const { id } = body;
        if (!id) return Response.json({ error: "ligne manquante" }, { status: 400 });
        await sql()`
          update bank_transactions set status = 'a_traiter', expense_id = null where id = ${id}
        `;
        return Response.json({ ok: true });
      }

      return Response.json({ error: "action inconnue" }, { status: 400 });
    }

    return Response.json({ error: "méthode non supportée" }, { status: 405 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/banque" };
