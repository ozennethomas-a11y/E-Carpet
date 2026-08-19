import { useState } from "react";

// Single-series charts: one hue (copper #e06a3b, validated ≥3:1 on the card surface).
// Text always wears text tokens, never the series colour.

export function Variation({ pct }) {
  if (pct === 0) return <span className="text-sm text-zinc-500">–</span>;
  const positif = pct > 0;
  return (
    <span className={`flex items-center gap-0.5 text-sm font-semibold ${positif ? "text-green-400" : "text-red-400"}`}>
      {positif ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

// Mini-graphique en aire, une valeur par point — pas d'axes, pas de légende,
// juste la tendance en un coup d'œil (façon sparkline Shopify).
export function Sparkline({ values }) {
  const w = 240;
  const h = 56;
  const max = Math.max(1, ...values);
  const step = w / Math.max(1, values.length - 1);
  const points = values.map((v, i) => [i * step, h - (v / max) * h]);
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const aire = `${path} L${w},${h} L0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-14 w-full" preserveAspectRatio="none">
      <path d={aire} fill="#e06a3b" fillOpacity="0.12" />
      <path d={path} fill="none" stroke="#e06a3b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Carte KPI façon dashboard Shopify : libellé, grande valeur, variation vs
// une période de référence, mini-tendance. Utilisée par OverviewDashboard
// (accueil) et FinanceComparison (onglet Finance) pour une présentation identique.
export function CarteComparaison({ label, valeur, variationPct, tendance, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="chiffre font-display text-2xl font-bold text-white sm:text-3xl">{valeur}</span>
        <Variation pct={variationPct} />
      </div>
      {hint && <div className="chiffre mt-1 text-xs text-zinc-500">{hint}</div>}
      <Sparkline values={tendance} />
    </div>
  );
}

export function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="chiffre mt-2 font-display text-3xl font-bold text-white sm:text-4xl">{value}</div>
      {hint && <div className="chiffre mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function frDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// data: [{ date, value, sub? }]. Par défaut lit visitors/views (compat historique) ;
// value/label/format permettent de réutiliser le graphique pour d'autres métriques
// (chiffre d'affaires, commandes…) sans dupliquer le composant.
export function ColumnChart({
  data,
  title,
  value = (d) => d.visitors,
  sub = (d) => d.views,
  tableHeaders = ["Visiteurs", "Pages vues"],
  formatValue = (n) => n,
  formatSub = (n) => n,
  tooltip,
}) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const vals = data.map(value);
  const max = Math.max(1, ...vals);
  // Label only the first, last and peak day — never a number on every bar.
  const peak = vals.reduce((best, v, i) => (v > vals[best] ? i : best), 0);
  const labelled = new Set([0, data.length - 1, peak]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-bold text-white">{title}</h2>
        <button
          onClick={() => setShowTable((s) => !s)}
          className="text-xs text-zinc-500 underline transition-colors hover:text-white cursor-pointer"
        >
          {showTable ? "Voir le graphique" : "Voir les données"}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-deep text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2 text-right">{tableHeaders[0]}</th>
                <th className="py-2 text-right">{tableHeaders[1]}</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {data.map((d) => (
                <tr key={d.date} className="border-t border-white/5">
                  <td className="py-1.5">{frDate(d.date)}</td>
                  <td className="chiffre py-1.5 text-right tabular-nums">{formatValue(value(d))}</td>
                  <td className="chiffre py-1.5 text-right tabular-nums">{formatSub(sub(d))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {/* Recessive grid */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-44">
            {[0, 0.5, 1].map((f) => (
              <div key={f} className="absolute inset-x-0 border-t border-white/5" style={{ top: `${f * 100}%` }} />
            ))}
          </div>

          <div className="relative flex h-44 items-end gap-[2px]">
            {data.map((d, i) => {
              const v = value(d);
              return (
                <div
                  key={d.date}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  className="group relative flex h-full flex-1 items-end"
                >
                  <div
                    className="w-full rounded-t-[4px] transition-opacity"
                    style={{
                      height: `${Math.max((v / max) * 100, v > 0 ? 2 : 0)}%`,
                      backgroundColor: "#e06a3b",
                      opacity: hover === null || hover === i ? 1 : 0.45,
                    }}
                  />
                  {hover === i && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-ink px-3 py-2 text-xs shadow-xl">
                      <div className="font-semibold text-white">{frDate(d.date)}</div>
                      <div className="chiffre mt-0.5 text-zinc-400">
                        {tooltip ? tooltip(d) : `${formatValue(v)} · ${formatSub(sub(d))}`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex gap-[2px] text-[10px] text-zinc-600">
            {data.map((d, i) => (
              <div key={d.date} className="flex-1 text-center">
                {labelled.has(i) ? frDate(d.date) : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Même structure que ColumnChart (titre, bascule tableau, survol) mais en
// courbe plutôt qu'en bâtons — pour les séries type "visiteurs par jour" où
// la tendance se lit mieux qu'une suite de barres.
export function LineChart({
  data,
  title,
  value = (d) => d.visitors,
  sub = (d) => d.views,
  tableHeaders = ["Visiteurs", "Pages vues"],
  formatValue = (n) => n,
  formatSub = (n) => n,
  tooltip,
}) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const vals = data.map(value);
  const max = Math.max(1, ...vals);
  const peak = vals.reduce((best, v, i) => (v > vals[best] ? i : best), 0);
  const labelled = new Set([0, data.length - 1, peak]);

  const W = 1000;
  const H = 176;
  const step = data.length > 1 ? W / (data.length - 1) : 0;
  const points = vals.map((v, i) => [data.length > 1 ? i * step : W / 2, H - (v / max) * (H - 4) - 2]);
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const aire = `${path} L${points[points.length - 1][0]},${H} L0,${H} Z`;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-bold text-white">{title}</h2>
        <button
          onClick={() => setShowTable((s) => !s)}
          className="text-xs text-zinc-500 underline transition-colors hover:text-white cursor-pointer"
        >
          {showTable ? "Voir le graphique" : "Voir les données"}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-deep text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2 text-right">{tableHeaders[0]}</th>
                <th className="py-2 text-right">{tableHeaders[1]}</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {data.map((d) => (
                <tr key={d.date} className="border-t border-white/5">
                  <td className="py-1.5">{frDate(d.date)}</td>
                  <td className="chiffre py-1.5 text-right tabular-nums">{formatValue(value(d))}</td>
                  <td className="chiffre py-1.5 text-right tabular-nums">{formatSub(sub(d))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-44">
            {[0, 0.5, 1].map((f) => (
              <div key={f} className="absolute inset-x-0 border-t border-white/5" style={{ top: `${f * 100}%` }} />
            ))}
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="relative h-44 w-full" preserveAspectRatio="none">
            <path d={aire} fill="#e06a3b" fillOpacity="0.12" />
            <path d={path} fill="none" stroke="#e06a3b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>

          {/* Zones de survol invisibles par-dessus la courbe, une par point */}
          <div className="absolute inset-0 flex">
            {data.map((d, i) => (
              <div
                key={d.date}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="relative h-full flex-1"
              >
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-ink px-3 py-2 text-xs shadow-xl">
                    <div className="font-semibold text-white">{frDate(d.date)}</div>
                    <div className="chiffre mt-0.5 text-zinc-400">
                      {tooltip ? tooltip(d) : `${formatValue(vals[i])} · ${formatSub(sub(d))}`}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-[2px] text-[10px] text-zinc-600">
            {data.map((d, i) => (
              <div key={d.date} className="flex-1 text-center">
                {labelled.has(i) ? frDate(d.date) : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function BarList({ title, items, empty = "Aucune donnée" }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <h2 className="mb-4 font-display text-base font-bold text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((it) => (
            <li key={it.label} className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="mb-1 truncate text-sm text-zinc-300" title={it.label}>
                  {it.label}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(it.value / max) * 100}%`, backgroundColor: "#e06a3b" }}
                  />
                </div>
              </div>
              <span className="chiffre font-display text-sm font-bold tabular-nums text-white">{it.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
