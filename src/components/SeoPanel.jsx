import { useEffect, useState, useCallback } from "react";
import { StatTile, ColumnChart, BarList } from "./charts";

// Onglet « SEO » du dashboard : données Search Console + Core Web Vitals.

function Table({ title, rows, note }) {
  if (!rows?.length) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <h2 className="font-display text-base font-bold text-white">{title}</h2>
      {note && <p className="mt-1 text-xs text-zinc-500">{note}</p>}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="pb-2">Requête</th>
              <th className="pb-2 text-right">Clics</th>
              <th className="pb-2 text-right">Vues</th>
              <th className="pb-2 text-right">CTR</th>
              <th className="pb-2 text-right">Position</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-white/5">
                <td className="max-w-[240px] truncate py-2" title={r.label}>{r.label}</td>
                <td className="py-2 text-right tabular-nums text-white">{r.clicks}</td>
                <td className="py-2 text-right tabular-nums">{r.impressions}</td>
                <td className="py-2 text-right tabular-nums">{r.ctr}%</td>
                <td className="py-2 text-right tabular-nums">{r.position}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Vitals({ ps }) {
  if (!ps) return null;

  if (ps.error) {
    const messages = {
      cle_manquante:
        "Sans clé API, Google partage un quota mondial qui est actuellement saturé. Ajoutez PAGESPEED_API_KEY dans Netlify (clé gratuite, 25 000 mesures par jour) pour activer cette section.",
      quota_depasse: "Quota de mesures dépassé pour aujourd'hui. La section reviendra demain.",
    };
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-deep p-6">
        <h2 className="font-display text-base font-bold text-white">Performances (mobile)</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {messages[ps.error] || `Mesure indisponible (${ps.error}).`}
        </p>
      </div>
    );
  }

  const couleur = (n) => (n >= 90 ? "text-emerald-400" : n >= 50 ? "text-amber-400" : "text-red-400");
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <h2 className="mb-4 font-display text-base font-bold text-white">Performances (mobile)</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div>
          <div className={`font-display text-3xl font-bold ${couleur(ps.performance)}`}>{ps.performance}</div>
          <div className="mt-1 text-xs text-zinc-500">Performance</div>
        </div>
        <div>
          <div className={`font-display text-3xl font-bold ${couleur(ps.seo)}`}>{ps.seo}</div>
          <div className="mt-1 text-xs text-zinc-500">SEO technique</div>
        </div>
        {[["LCP", ps.lcp], ["CLS", ps.cls], ["Blocage", ps.tbt]].map(([k, v]) => (
          <div key={k}>
            <div className="font-display text-xl font-bold text-white">{v || "—"}</div>
            <div className="mt-1 text-xs text-zinc-500">{k}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-zinc-600">
        Mesuré en direct par Google sur la page d'accueil, en simulation mobile. Le LCP est le temps
        d'affichage du plus gros élément visible : c'est lui qui pèse le plus sur le classement.
      </p>
    </div>
  );
}

export default function SeoPanel() {
  const [days, setDays] = useState(28);
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/seo?days=${days}`);
      if (!res.ok) return setState("error");
      setData(await res.json());
      setState("ok");
    } catch {
      setState("error");
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const g = data?.gsc;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {data?.range ? `Search Console · ${data.range.startDate} → ${data.range.endDate}` : "Chargement…"}
        </p>
        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
          {[7, 28, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                days === d ? "bg-acid text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {d} jours
            </button>
          ))}
        </div>
      </div>

      {state === "loading" && !data && <p className="text-sm text-zinc-500">Chargement des données Google…</p>}
      {state === "error" && (
        <p className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-red-400">
          Impossible de charger les données SEO.
        </p>
      )}

      {data?.gscError === "missing_credentials" && (
        <div className="rounded-2xl border border-acid/30 bg-acid/10 p-6 text-sm leading-relaxed text-zinc-200">
          <p className="font-display font-bold text-white">Search Console pas encore connectée</p>
          <p className="mt-2 text-zinc-300">
            Ajoutez la variable <code className="text-acid">GSC_SERVICE_ACCOUNT</code> dans Netlify
            (contenu du fichier JSON du compte de service), puis relancez un déploiement.
            Les Core Web Vitals ci-dessous fonctionnent déjà, eux ne demandent aucune clé.
          </p>
        </div>
      )}
      {data?.gscError && data.gscError !== "missing_credentials" && (
        <div className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-amber-400">
          Search Console a répondu : {data.gscError}
        </div>
      )}

      {g && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatTile label="Clics" value={g.totals.clicks.toLocaleString("fr-FR")} />
            <StatTile label="Impressions" value={g.totals.impressions.toLocaleString("fr-FR")} />
            <StatTile label="CTR moyen" value={`${String(g.totals.ctr).replace(".", ",")} %`} />
            <StatTile label="Position moyenne" value={String(g.totals.position).replace(".", ",")} />
          </div>

          {g.series?.length > 0 && (
            <ColumnChart
              title="Clics depuis Google, par jour"
              data={g.series.map((d) => ({ date: d.date, visitors: d.clicks, views: d.impressions }))}
            />
          )}

          <Table
            title="Occasions à saisir"
            note="Requêtes déjà bien vues mais peu cliquées. Réécrire le titre de la page, ou publier un article dédié, transforme ces vues en visites."
            rows={g.opportunities}
          />

          <Table title="Vos requêtes" rows={g.queries} />

          <BarList
            title="Pages les plus vues dans Google"
            items={g.pages.map((p) => ({
              label: p.label.replace("https://e-carpet.shop", "") || "/",
              value: p.clicks,
            }))}
          />
        </>
      )}

      <Vitals ps={data?.pagespeed} />
    </div>
  );
}
