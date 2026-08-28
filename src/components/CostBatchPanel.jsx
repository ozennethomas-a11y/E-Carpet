import { useEffect, useState, useCallback } from "react";
import { formatPrice } from "../cart";
import { cachedFetch, invalidateCache } from "../lib/adminCache";

const LIGNES_DEFAUT = ["Fabrication", "Transport 1", "Transport 2", "Carton", "Audit"];

export default function CostBatchPanel({ produits }) {
  const [batches, setBatches] = useState(null);
  const [form, setForm] = useState({ productId: "", label: "", quantity: "", orderDate: "" });
  const [lignes, setLignes] = useState(LIGNES_DEFAUT.map((label) => ({ label, amount: "" })));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const load = useCallback(async () => {
    const data = await cachedFetch("/api/cost-batches");
    setBatches(data.batches);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (produits?.length && !form.productId) setForm((f) => ({ ...f, productId: produits[0].id }));
  }, [produits, form.productId]);

  function majLigne(i, champ, valeur) {
    setLignes((ls) => ls.map((l, idx) => (idx === i ? { ...l, [champ]: valeur } : l)));
  }

  function ajouterLigne() {
    setLignes((ls) => [...ls, { label: "", amount: "" }]);
  }

  function supprimerLigne(i) {
    setLignes((ls) => ls.filter((_, idx) => idx !== i));
  }

  const totalCents = lignes.reduce((s, l) => s + Math.round((Number(l.amount) || 0) * 100), 0);
  const unitCostCents = form.quantity && Number(form.quantity) > 0 ? Math.round(totalCents / Number(form.quantity)) : 0;

  async function creerLot(e) {
    e.preventDefault();
    setErreur("");
    const lignesValides = lignes.filter((l) => l.label && l.amount !== "");
    if (!form.productId || !form.label || !form.quantity || !form.orderDate || lignesValides.length === 0) {
      setErreur("Complétez le lot et au moins une ligne de coût.");
      return;
    }
    setEnvoi(true);
    try {
      const res = await fetch("/api/cost-batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "creer-lot",
          productId: form.productId,
          label: form.label,
          quantity: Number(form.quantity),
          orderDate: form.orderDate,
          lignes: lignesValides.map((l) => ({ label: l.label, amountCents: Math.round(Number(l.amount) * 100) })),
        }),
      });
      const json = await res.json();
      if (json.error) {
        setErreur(json.error);
        return;
      }
      setForm({ productId: form.productId, label: "", quantity: "", orderDate: "" });
      setLignes(LIGNES_DEFAUT.map((label) => ({ label, amount: "" })));
      invalidateCache("/api/cost-batches");
      await load();
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimerLot(id) {
    await fetch("/api/cost-batches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "supprimer-lot", id }),
    });
    invalidateCache("/api/cost-batches");
    load();
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <h2 className="font-display text-base font-bold text-white">Ajout de stock (commande fournisseur)</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Décomposition détaillée (fabrication, transport, carton, audit...) d'une commande fournisseur — les montants sont
        automatiquement reportés dans l'onglet Finance (coût produit, marge) et le coût unitaire alimente le reste du
        back-office.
      </p>

      <form onSubmit={creerLot} className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <select
            value={form.productId}
            onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
          >
            {produits?.map((p) => (
              <option key={p.id} value={p.id} className="bg-ink">
                {p.name}
              </option>
            ))}
          </select>
          <label className="text-xs text-zinc-500">
            Nom du lot
            <input
              placeholder="Commande n°2"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className="mt-1 block w-40 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Quantité
            <input
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className="mt-1 block w-24 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Date de commande
            <input
              type="date"
              value={form.orderDate}
              onChange={(e) => setForm((f) => ({ ...f, orderDate: e.target.value }))}
              className="mt-1 block rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none [color-scheme:dark] focus:border-acid"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          {lignes.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                placeholder="Libellé (ex: Fabrication)"
                value={l.label}
                onChange={(e) => majLigne(i, "label", e.target.value)}
                className="w-48 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Montant (€)"
                value={l.amount}
                onChange={(e) => majLigne(i, "amount", e.target.value)}
                className="w-32 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
              />
              <button type="button" onClick={() => supprimerLigne(i)} className="text-xs text-zinc-500 hover:text-red-400">
                Retirer
              </button>
            </div>
          ))}
          <button type="button" onClick={ajouterLigne} className="self-start text-xs text-zinc-400 hover:text-white">
            + Ajouter une ligne de coût
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-ink px-4 py-3 text-sm">
          <span className="text-zinc-400">Total lot : {formatPrice(totalCents)}</span>
          <span className="chiffre font-display font-bold text-white">Coût unitaire : {formatPrice(unitCostCents)}</span>
        </div>

        {erreur && <p className="text-xs text-red-400">{erreur}</p>}

        <button type="submit" disabled={envoi} className="self-start rounded-full bg-acid px-5 py-2 font-display text-xs font-bold text-white disabled:opacity-60">
          Enregistrer le lot
        </button>
      </form>

      <div className="mt-5 flex flex-col gap-2">
        {!batches?.length ? (
          <p className="text-sm text-zinc-500">Aucun lot enregistré.</p>
        ) : (
          batches.map((b) => (
            <div key={b.id} className="rounded-xl border border-white/10 bg-ink p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white">{b.label}</span>
                  <span className="ml-2 text-zinc-500">{b.productName}</span>
                  <span className="ml-2 text-zinc-500">· {b.quantity} unités</span>
                  <span className="ml-2 text-zinc-500">· {new Date(b.orderDate).toLocaleDateString("fr-FR")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="chiffre font-display font-bold text-white">{formatPrice(b.unitCostCents)} / unité</span>
                  <button onClick={() => supprimerLot(b.id)} className="text-xs text-zinc-500 hover:text-red-400">
                    Supprimer
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                {b.lignes.map((l) => (
                  <span key={l.id}>
                    {l.label} : <span className="chiffre">{formatPrice(l.amountCents)}</span>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
