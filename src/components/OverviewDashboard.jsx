import { useEffect, useState } from "react";
import { CarteComparaison } from "./charts";
import { formatPrice } from "../cart";

export default function OverviewDashboard() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ok | error | unconfigured

  useEffect(() => {
    setState("loading");
    fetch("/api/overview")
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
      <div className="mb-6 rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-zinc-500">Chargement de l'aperçu…</div>
    );
  }

  return (
    <div className="mb-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-acid/40 bg-slate-deep p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Commandes en attente d'expédition · Site</div>
          <div className="chiffre mt-2 font-display text-3xl font-bold text-white sm:text-4xl">{data.enAttente.site}</div>
        </div>
        <div className="rounded-2xl border border-acid/40 bg-slate-deep p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Commandes en attente d'expédition · Amazon</div>
          <div className="chiffre mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
            {data.enAttente.amazon != null ? data.enAttente.amazon : "—"}
          </div>
          {data.enAttente.amazon == null && <div className="chiffre mt-1 text-xs text-zinc-500">indisponible</div>}
        </div>
      </div>

      <div className="my-6 border-t border-white/10" />

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold text-white">Aujourd'hui</h2>
        <span className="text-xs text-zinc-500">comparé à {data.comparaison}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CarteComparaison
          label="Chiffre d'affaires"
          valeur={formatPrice(data.ventes.valeurCents)}
          variationPct={data.ventes.variationPct}
          tendance={data.ventes.tendance}
        />
        <CarteComparaison
          label="Commandes"
          valeur={data.commandes.valeur}
          variationPct={data.commandes.variationPct}
          tendance={data.commandes.tendance}
        />
        {!data.canal.indisponible && (
          <CarteComparaison
            label="Part Amazon vs Site"
            valeur={`${data.canal.amazonPct}% Amazon`}
            variationPct={data.canal.variationPct}
            tendance={data.canal.tendance}
            hint={`${data.canal.sitePct}% Site`}
          />
        )}
        <CarteComparaison
          label="Sessions site"
          valeur={data.sessions.valeur}
          variationPct={data.sessions.variationPct}
          tendance={data.sessions.tendance}
        />
        <CarteComparaison
          label="Taux de conversion"
          valeur={`${data.conversion.valeurPct}%`}
          variationPct={data.conversion.variationPct}
          tendance={data.conversion.tendance}
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
