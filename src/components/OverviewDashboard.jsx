import { useEffect, useState } from "react";
import { CarteComparaison } from "./charts";
import { formatPrice } from "../cart";
import { cachedFetchWithStatus } from "../lib/adminCache";

export default function OverviewDashboard() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ok | error | unconfigured

  useEffect(() => {
    setState("loading");
    cachedFetchWithStatus("/api/overview")
      .then(({ status, data }) => {
        if (status === 503) return setState("unconfigured");
        if (status < 200 || status >= 300) return setState("error");
        setData(data);
        setState("ok");
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
      <div className="rounded-2xl border border-acid/40 bg-slate-deep p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Commandes en attente d'expédition</div>
        <div className="chiffre mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
          {data.enAttente.site + (data.enAttente.amazon ?? 0)}
        </div>
        <div className="chiffre mt-1 text-xs text-zinc-500">
          Site : {data.enAttente.site} · Amazon :{" "}
          {data.enAttente.amazon != null ? (
            data.enAttente.amazon
          ) : (
            <span title={data.enAttente.amazonRaison || ""}>indisponible{data.enAttente.amazonRaison ? ` — ${data.enAttente.amazonRaison}` : ""}</span>
          )}
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

      <div className="my-6 border-t border-white/10" />

      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-lg font-bold text-white">Livraisons en cours</h2>
        <p className="mt-1 text-xs text-zinc-500">Suivi en direct via Packlink, tous canaux confondus (site, Amazon, saisies manuelles).</p>

        {data.livraisons.indisponible ? (
          <p className="mt-4 text-sm text-zinc-500">Indisponible — {data.livraisons.raison}</p>
        ) : data.livraisons.liste.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Aucune livraison en cours.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Canal</th>
                  <th className="py-2 pr-3">Transporteur</th>
                  <th className="py-2 pr-3">Destination</th>
                  <th className="py-2 pr-3">Référence</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.livraisons.liste.map((l) => (
                  <tr key={l.reference} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="rounded-full bg-acid/10 px-2.5 py-1 text-xs font-semibold text-acid">{l.statut}</span>
                    </td>
                    <td className="py-2 pr-3 text-zinc-400">{l.source}</td>
                    <td className="py-2 pr-3 text-zinc-400">{l.transporteur}</td>
                    <td className="py-2 pr-3 text-zinc-400">
                      {l.destinataireVille ? `${l.destinataireVille} (${l.destinataireCodePostal || ""})` : "—"}
                    </td>
                    <td className="chiffre py-2 pr-3 text-zinc-500">{l.commandeRef || l.reference}</td>
                    <td className="chiffre py-2 text-zinc-500">{l.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
