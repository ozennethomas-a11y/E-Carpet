import { useState } from "react";

// Sélecteur de période de l'onglet Analyse : raccourcis courants, ou deux dates
// choisies au calendrier. Le champ date natif ouvre le calendrier du système,
// donc pas de dépendance supplémentaire et l'accessibilité clavier est acquise.

const RACCOURCIS = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
];

const iso = (d) => d.toISOString().slice(0, 10);
const AUJOURDHUI = () => iso(new Date());

function formatFr(s) {
  if (!s) return "";
  return new Date(`${s}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const champ =
  "rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none transition-colors focus:border-acid/60 [color-scheme:dark]";

export default function PeriodPicker({ periode, onChange, resume }) {
  const [ouvert, setOuvert] = useState(false);
  const [debut, setDebut] = useState(periode.from || "");
  const [fin, setFin] = useState(periode.to || AUJOURDHUI());

  const surMesure = periode.mode === "dates";

  const appliquer = () => {
    if (!debut || !fin) return;
    onChange({ mode: "dates", from: debut, to: fin });
    setOuvert(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">{resume}</p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
            {RACCOURCIS.map((r) => {
              const actif = !surMesure && periode.days === r.days;
              return (
                <button
                  key={r.days}
                  onClick={() => { setOuvert(false); onChange({ mode: "jours", days: r.days }); }}
                  aria-pressed={actif}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    actif ? "bg-acid text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setOuvert((v) => !v)}
            aria-expanded={ouvert}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              surMesure
                ? "border-acid/50 bg-acid/15 text-acid"
                : "border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {surMesure ? `${formatFr(periode.from)} → ${formatFr(periode.to)}` : "Choisir des dates"}
          </button>
        </div>
      </div>

      {ouvert && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-slate-deep p-4">
          <label className="text-xs text-zinc-400">
            Du
            <input type="date" value={debut} max={fin || AUJOURDHUI()} onChange={(e) => setDebut(e.target.value)} className={`mt-1 block ${champ}`} />
          </label>
          <label className="text-xs text-zinc-400">
            Au
            <input type="date" value={fin} min={debut} max={AUJOURDHUI()} onChange={(e) => setFin(e.target.value)} className={`mt-1 block ${champ}`} />
          </label>
          <button
            onClick={appliquer}
            disabled={!debut || !fin}
            className="rounded-full bg-acid px-5 py-2 font-display text-xs font-bold text-white cursor-pointer disabled:opacity-40"
          >
            Appliquer
          </button>
          {surMesure && (
            <button
              onClick={() => { setOuvert(false); onChange({ mode: "jours", days: 30 }); }}
              className="text-xs text-zinc-500 underline underline-offset-4 transition-colors hover:text-white cursor-pointer"
            >
              Revenir aux 30 derniers jours
            </button>
          )}
        </div>
      )}
    </div>
  );
}
