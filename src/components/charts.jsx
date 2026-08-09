import { useState } from "react";

// Single-series charts: one hue (copper #e06a3b, validated ≥3:1 on the card surface).
// Text always wears text tokens, never the series colour.

export function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function frDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function ColumnChart({ data, title }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.visitors));
  // Label only the first, last and peak day — never a number on every bar.
  const peak = data.reduce((best, d, i) => (d.visitors > data[best].visitors ? i : best), 0);
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
                <th className="py-2 text-right">Visiteurs</th>
                <th className="py-2 text-right">Pages vues</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {data.map((d) => (
                <tr key={d.date} className="border-t border-white/5">
                  <td className="py-1.5">{frDate(d.date)}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.visitors}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.views}</td>
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
            {data.map((d, i) => (
              <div
                key={d.date}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="group relative flex h-full flex-1 items-end"
              >
                <div
                  className="w-full rounded-t-[4px] transition-opacity"
                  style={{
                    height: `${Math.max((d.visitors / max) * 100, d.visitors > 0 ? 2 : 0)}%`,
                    backgroundColor: "#e06a3b",
                    opacity: hover === null || hover === i ? 1 : 0.45,
                  }}
                />
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-ink px-3 py-2 text-xs shadow-xl">
                    <div className="font-semibold text-white">{frDate(d.date)}</div>
                    <div className="mt-0.5 text-zinc-400">
                      {d.visitors} visiteur{d.visitors > 1 ? "s" : ""} · {d.views} vue{d.views > 1 ? "s" : ""}
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
              <span className="font-display text-sm font-bold tabular-nums text-white">{it.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
