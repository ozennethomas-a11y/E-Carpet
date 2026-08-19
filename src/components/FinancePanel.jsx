import { useEffect, useState, useCallback } from "react";
import { StatTile, BarList } from "./charts";
import PeriodPicker from "./PeriodPicker";
import FinanceComparison from "./FinanceComparison";
import { formatPrice } from "../cart";

const CATEGORIES = ["Publicité", "Abonnements", "Conformité/REP", "Transport", "Autre"];

function query(periode) {
  return periode.mode === "dates" ? `from=${periode.from}&to=${periode.to}` : `days=${periode.days}`;
}

export default function FinancePanel({ periode, onPeriodeChange }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ok | error | unconfigured
  const [depenseForm, setDepenseForm] = useState({ category: CATEGORIES[0], amount: "", date: "", note: "" });
  const [coutForm, setCoutForm] = useState({ productId: "", amount: "", date: "" });
  const [envoi, setEnvoi] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/finance?${query(periode)}`);
      if (res.status === 503) return setState("unconfigured");
      if (!res.ok) return setState("error");
      const json = await res.json();
      setData(json);
      setState("ok");
      setCoutForm((f) => ({ ...f, productId: f.productId || json.produits?.[0]?.id || "" }));
    } catch {
      setState("error");
    }
  }, [periode]);

  useEffect(() => { load(); }, [load]);

  async function ajouterDepense(e) {
    e.preventDefault();
    if (!depenseForm.amount || !depenseForm.date) return;
    setEnvoi(true);
    try {
      await fetch("/api/finance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "ajouter-depense",
          category: depenseForm.category,
          amountCents: Math.round(Number(depenseForm.amount) * 100),
          expenseDate: depenseForm.date,
          note: depenseForm.note,
        }),
      });
      setDepenseForm({ category: CATEGORIES[0], amount: "", date: "", note: "" });
      await load();
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimerDepense(id) {
    await fetch("/api/finance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "supprimer-depense", id }),
    });
    load();
  }

  async function ajouterCout(e) {
    e.preventDefault();
    if (!coutForm.productId || !coutForm.amount || !coutForm.date) return;
    setEnvoi(true);
    try {
      await fetch("/api/finance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "ajouter-cout-produit",
          productId: coutForm.productId,
          unitCostCents: Math.round(Number(coutForm.amount) * 100),
          effectiveFrom: coutForm.date,
        }),
      });
      setCoutForm((f) => ({ ...f, amount: "", date: "" }));
      await load();
    } finally {
      setEnvoi(false);
    }
  }

  if (state === "unconfigured") {
    return (
      <p className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-zinc-300">
        La variable <code className="text-acid">DASHBOARD_PASSWORD</code> n'est pas encore définie dans Netlify.
      </p>
    );
  }
  if (state === "error") {
    return <p className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-red-400">Impossible de charger les données financières.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <FinanceComparison />

      <PeriodPicker
        periode={periode}
        onChange={onPeriodeChange}
        resume={data ? `${data.range.from} → ${data.range.to}` : "Chargement…"}
      />

      {state === "loading" && !data && <p className="text-sm text-zinc-500">Chargement…</p>}

      {data && (
        <>
          {(data.produitsSansCout.length > 0 || data.ordersWithoutStripeFee > 0) && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
              {data.produitsSansCout.length > 0 && (
                <p>
                  Coût produit non renseigné pour : <strong>{data.produitsSansCout.join(", ")}</strong> — la marge nette
                  ci-dessous ne tient pas compte de ces lignes. Ajoutez un tarif ci-dessous.
                </p>
              )}
              {data.ordersWithoutStripeFee > 0 && (
                <p className="mt-1">
                  {data.ordersWithoutStripeFee} commande(s) sans frais Stripe connu (antérieures au suivi automatique).
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Chiffre d'affaires total" value={formatPrice(data.ca.total)} hint={`Site ${formatPrice(data.ca.site)} · Amazon ${formatPrice(data.ca.amazon)}`} />
            <StatTile label="Marge nette" value={formatPrice(data.margeNette)} />
            <StatTile label="Dépenses hors vente" value={formatPrice(data.depenses.total)} />
          </div>

          <BarList
            title="Frais par poste"
            items={[
              { label: "Frais Stripe", value: Math.round(data.frais.stripe / 100) },
              { label: "Frais Amazon", value: Math.round(data.frais.amazon / 100) },
              { label: "Publicité", value: Math.round(data.frais.publicite / 100) },
              { label: "Commissions affiliés", value: Math.round(data.frais.commissionsAffilies / 100) },
              { label: "Coût produit", value: Math.round(data.coutProduit / 100) },
            ].filter((i) => i.value > 0)}
            empty="Aucun frais sur la période."
          />

          {data.amazon.indisponible && (
            <p className="text-xs text-zinc-500">Amazon : {data.amazon.raison}</p>
          )}
          {data.ads.indisponible && (
            <p className="text-xs text-zinc-500">Google Ads : {data.ads.raison}</p>
          )}

          {/* Coût du produit */}
          <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
            <h2 className="font-display text-base font-bold text-white">Coût du produit</h2>
            <form onSubmit={ajouterCout} className="mt-4 flex flex-wrap items-end gap-3">
              <select
                value={coutForm.productId}
                onChange={(e) => setCoutForm((f) => ({ ...f, productId: e.target.value }))}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
              >
                {data.produits.map((p) => (
                  <option key={p.id} value={p.id} className="bg-ink">
                    {p.name}
                  </option>
                ))}
              </select>
              <label className="text-xs text-zinc-500">
                Coût unitaire (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={coutForm.amount}
                  onChange={(e) => setCoutForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-1 block w-32 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
                />
              </label>
              <label className="text-xs text-zinc-500">
                À partir du
                <input
                  type="date"
                  value={coutForm.date}
                  onChange={(e) => setCoutForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 block rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none [color-scheme:dark] focus:border-acid"
                />
              </label>
              <button type="submit" disabled={envoi} className="rounded-full bg-acid px-5 py-2 font-display text-xs font-bold text-white disabled:opacity-60">
                Ajouter
              </button>
            </form>
            <div className="mt-4 flex flex-col gap-2">
              {data.coutsProduits.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucun coût renseigné.</p>
              ) : (
                data.coutsProduits.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-ink p-3 text-sm">
                    <span className="text-zinc-300">{c.productName}</span>
                    <span className="chiffre text-zinc-500">
                      {formatPrice(c.unitCostCents)} · à partir du {new Date(c.effectiveFrom).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dépenses */}
          <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
            <h2 className="font-display text-base font-bold text-white">Dépenses</h2>
            <form onSubmit={ajouterDepense} className="mt-4 flex flex-wrap items-end gap-3">
              <select
                value={depenseForm.category}
                onChange={(e) => setDepenseForm((f) => ({ ...f, category: e.target.value }))}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-ink">
                    {c}
                  </option>
                ))}
              </select>
              <label className="text-xs text-zinc-500">
                Montant (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depenseForm.amount}
                  onChange={(e) => setDepenseForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-1 block w-28 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
                />
              </label>
              <label className="text-xs text-zinc-500">
                Date
                <input
                  type="date"
                  value={depenseForm.date}
                  onChange={(e) => setDepenseForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 block rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none [color-scheme:dark] focus:border-acid"
                />
              </label>
              <label className="text-xs text-zinc-500">
                Note
                <input
                  value={depenseForm.note}
                  onChange={(e) => setDepenseForm((f) => ({ ...f, note: e.target.value }))}
                  className="mt-1 block rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
                />
              </label>
              <button type="submit" disabled={envoi} className="rounded-full bg-acid px-5 py-2 font-display text-xs font-bold text-white disabled:opacity-60">
                Ajouter
              </button>
            </form>
            <div className="mt-4 flex flex-col gap-2">
              {data.depenses.liste.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucune dépense sur la période.</p>
              ) : (
                data.depenses.liste.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-ink p-3 text-sm">
                    <div>
                      <span className="font-semibold text-white">{d.category}</span>
                      <span className="ml-2 text-zinc-500">{new Date(d.date).toLocaleDateString("fr-FR")}</span>
                      {d.note && <span className="ml-2 text-zinc-500">· {d.note}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="chiffre font-display font-bold text-white">{formatPrice(d.amountCents)}</span>
                      <button onClick={() => supprimerDepense(d.id)} className="text-xs text-zinc-500 hover:text-red-400">
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}
