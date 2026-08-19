import { useEffect, useState } from "react";
import { CarteComparaison } from "./charts";
import { formatPrice } from "../cart";

export default function FinanceComparison() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ok | error | unconfigured

  useEffect(() => {
    setState("loading");
    fetch("/api/finance-comparison")
      .then((res) => {
        if (res.status === 503) return setState("unconfigured");
        if (!res.ok) return setState("error");
        return res.json().then((json) => {
          setData(json);
          setState("ok");
        });
      })
      .catch(() => setState("error"));
  }, []);

  if (state === "unconfigured" || state === "error") return null;
  if (state !== "ok" || !data) {
    return (
      <div className="mb-6 rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-zinc-500">Chargement de la comparaison…</div>
    );
  }

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold text-white">Ce mois-ci ({data.periodeActuelle})</h2>
        <span className="text-xs text-zinc-500">comparé au mois dernier à date ({data.comparaison})</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CarteComparaison
          label="Chiffre d'affaires"
          valeur={formatPrice(data.ventes.valeurCents)}
          variationPct={data.ventes.variationPct}
          tendance={data.ventes.tendance}
        />
        <CarteComparaison
          label="Marge nette"
          valeur={formatPrice(data.marge.valeurCents)}
          variationPct={data.marge.variationPct}
          tendance={data.marge.tendance}
        />
        <CarteComparaison
          label="Commandes"
          valeur={data.commandes.valeur}
          variationPct={data.commandes.variationPct}
          tendance={data.commandes.tendance}
        />
        <CarteComparaison
          label="Panier moyen"
          valeur={formatPrice(data.panierMoyen.valeurCents)}
          variationPct={data.panierMoyen.variationPct}
          tendance={data.panierMoyen.tendance}
        />
      </div>
    </div>
  );
}
