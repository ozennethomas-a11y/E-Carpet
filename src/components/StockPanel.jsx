import { useEffect, useState, useCallback } from "react";
import { Sparkline } from "./charts";
import CostBatchPanel from "./CostBatchPanel";
import { formatPrice } from "../cart";
import { cachedFetchWithStatus, invalidateCache } from "../lib/adminCache";

const SOURCE_LABEL = {
  manuel: "Manuel",
  vente_site: "Vente site",
  vente_amazon: "Vente Amazon",
  initial: "Stock initial",
};

export default function StockPanel() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ok | error | unconfigured
  const [mvtForm, setMvtForm] = useState({ productId: "", type: "entree", quantity: "", date: "", note: "" });
  const [envoi, setEnvoi] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [voirTout, setVoirTout] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const { status, data: json } = await cachedFetchWithStatus("/api/stock");
      if (status === 503) return setState("unconfigured");
      if (status < 200 || status >= 300) return setState("error");
      setData(json);
      setState("ok");
      setMvtForm((f) => ({ ...f, productId: f.productId || json.produits?.[0]?.id || "" }));
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function ajouterMouvement(e) {
    e.preventDefault();
    if (!mvtForm.productId || !mvtForm.quantity) return;
    setEnvoi(true);
    try {
      await fetch("/api/stock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: mvtForm.type === "entree" ? "ajouter-entree" : "ajouter-sortie",
          productId: mvtForm.productId,
          quantity: Number(mvtForm.quantity),
          date: mvtForm.date || undefined,
          note: mvtForm.note || undefined,
        }),
      });
      setMvtForm((f) => ({ ...f, quantity: "", date: "", note: "" }));
      invalidateCache("/api/stock");
      await load();
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimerMouvement(id) {
    await fetch("/api/stock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "supprimer-mouvement", id }),
    });
    invalidateCache("/api/stock");
    load();
  }

  async function synchroniserAmazon() {
    setEnvoi(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sync-amazon" }),
      });
      const json = await res.json();
      if (json.erreur) {
        setSyncMsg(`Erreur : ${json.erreur}`);
      } else {
        setSyncMsg(
          `${json.commandesTraitees} commande(s) Amazon traitée(s), ${json.quantiteTotale} unité(s) déduite(s) du stock.` +
            (json.skuNonReconnus?.length ? ` SKU non reconnus : ${json.skuNonReconnus.join(", ")}.` : ""),
        );
      }
      invalidateCache("/api/stock");
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
    return <p className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-red-400">Impossible de charger les données de stock.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {state === "loading" && !data && <p className="text-sm text-zinc-500">Chargement…</p>}

      {data && (
        <>
          <div className="flex flex-col gap-4">
            {data.produits.map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-slate-deep p-5">
                <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Stock actuel</div>
                <div className="mt-2">
                  <span className="chiffre font-display text-3xl font-bold text-white sm:text-4xl">{p.stock} unité(s)</span>
                </div>
                <div className="chiffre mt-1 text-xs text-zinc-500">
                  {p.valeurStockCents != null ? `Valeur : ${formatPrice(p.valeurStockCents)}` : "Coût unitaire non renseigné"}
                </div>
                <div className="chiffre mt-0.5 text-xs text-zinc-500">
                  {p.coutMoyenPondereCents != null
                    ? `Coût moyen pondéré : ${formatPrice(p.coutMoyenPondereCents)} / unité`
                    : "Coût moyen non calculable"}
                </div>
                {p.tendance && <Sparkline values={p.tendance} />}
              </div>
            ))}
          </div>

          {/* Journal des mouvements */}
          <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-white">Journal des mouvements</h2>
              <button
                onClick={synchroniserAmazon}
                disabled={envoi}
                className="rounded-full border border-white/15 px-4 py-1.5 font-display text-xs font-bold text-zinc-300 transition-colors hover:text-white disabled:opacity-60"
              >
                Synchroniser Amazon
              </button>
            </div>
            {syncMsg && <p className="mt-2 text-xs text-zinc-400">{syncMsg}</p>}
            <div className="mt-4 flex flex-col gap-2">
              {data.mouvements.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucun mouvement enregistré.</p>
              ) : (
                (voirTout ? data.mouvements : data.mouvements.slice(0, 5)).map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-ink p-3 text-sm">
                    <div>
                      <span className="font-semibold text-white">{m.productName}</span>
                      <span className="ml-2 text-zinc-500">{new Date(m.date).toLocaleDateString("fr-FR")}</span>
                      <span className="ml-2 text-zinc-500">· {SOURCE_LABEL[m.source] || m.source}</span>
                      {m.note && <span className="ml-2 text-zinc-500">· {m.note}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`chiffre font-display font-bold ${m.type === "sortie" ? "text-red-400" : "text-green-400"}`}>
                        {m.type === "sortie" ? "-" : "+"}
                        {m.quantity}
                      </span>
                      {m.source === "manuel" || m.source === "initial" ? (
                        <button onClick={() => supprimerMouvement(m.id)} className="text-xs text-zinc-500 hover:text-red-400">
                          Supprimer
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              {!voirTout && data.mouvements.length > 5 && (
                <button
                  onClick={() => setVoirTout(true)}
                  className="mt-1 text-center text-xs text-zinc-500 underline hover:text-white"
                >
                  Voir plus ({data.mouvements.length - 5} de plus)
                </button>
              )}
            </div>
          </div>

          {/* Mouvement manuel */}
          <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
            <h2 className="font-display text-base font-bold text-white">Ajouter un mouvement</h2>
            <form onSubmit={ajouterMouvement} className="mt-4 flex flex-wrap items-end gap-3">
              <select
                value={mvtForm.productId}
                onChange={(e) => setMvtForm((f) => ({ ...f, productId: e.target.value }))}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
              >
                {data.produits.map((p) => (
                  <option key={p.id} value={p.id} className="bg-ink">
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={mvtForm.type}
                onChange={(e) => setMvtForm((f) => ({ ...f, type: e.target.value }))}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
              >
                <option value="entree" className="bg-ink">Entrée (réappro)</option>
                <option value="sortie" className="bg-ink">Sortie (perte/casse)</option>
              </select>
              <label className="text-xs text-zinc-500">
                Quantité
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={mvtForm.quantity}
                  onChange={(e) => setMvtForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="mt-1 block w-24 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
                />
              </label>
              <label className="text-xs text-zinc-500">
                Date
                <input
                  type="date"
                  value={mvtForm.date}
                  onChange={(e) => setMvtForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 block rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none [color-scheme:dark] focus:border-acid"
                />
              </label>
              <label className="text-xs text-zinc-500">
                Note
                <input
                  value={mvtForm.note}
                  onChange={(e) => setMvtForm((f) => ({ ...f, note: e.target.value }))}
                  className="mt-1 block rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
                />
              </label>
              <button type="submit" disabled={envoi} className="rounded-full bg-acid px-5 py-2 font-display text-xs font-bold text-white disabled:opacity-60">
                Ajouter
              </button>
            </form>
          </div>

          <CostBatchPanel produits={data.produits} />
        </>
      )}
    </div>
  );
}
