import { useEffect, useState } from "react";

// « Ce qui demande ton attention » : le seul écran du back-office qui dit où
// aller, au lieu d'attendre qu'on pense à regarder.
//
// Volontairement placé en haut de l'accueil et masqué quand tout va bien —
// un bandeau permanent finit par ne plus être lu, alors qu'un bandeau qui
// n'apparaît que lorsqu'il a quelque chose à dire garde sa valeur d'alerte.

const SEVERITES = {
  critique: {
    label: "Critique",
    cadre: "border-red-500/30 bg-red-500/5",
    texte: "text-red-400",
    point: "bg-red-400",
  },
  attention: {
    label: "À vérifier",
    cadre: "border-amber-500/30 bg-amber-500/5",
    texte: "text-amber-400",
    point: "bg-amber-400",
  },
  info: {
    label: "Pour information",
    cadre: "border-white/10 bg-white/5",
    texte: "text-zinc-400",
    point: "bg-zinc-500",
  },
};

export default function AnomaliesPanel({ onNaviguer }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Sans cache : voir le commentaire de anomalies.mjs.
    fetch("/api/anomalies")
      .then((r) => r.json())
      .then((d) => (d.error ? null : setData(d)))
      .catch(() => null);
  }, []);

  if (!data || data.anomalies.length === 0) return null;

  const { critique, attention } = data.compte;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-bold text-white">Ce qui demande ton attention</h2>
        <span className="text-xs text-zinc-500">
          {critique > 0 && <span className="font-semibold text-red-400">{critique} critique{critique > 1 ? "s" : ""}</span>}
          {critique > 0 && attention > 0 && " · "}
          {attention > 0 && <span className="text-amber-400">{attention} à vérifier</span>}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {data.anomalies.map((a, i) => {
          const s = SEVERITES[a.severite] || SEVERITES.info;
          return (
            <div key={`${a.code}-${i}`} className={`rounded-xl border p-4 ${s.cadre}`}>
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.point}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="font-display text-sm font-bold text-white">{a.titre}</h3>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${s.texte}`}>{s.label}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{a.detail}</p>
                  {a.action && onNaviguer && (
                    <button
                      onClick={() => onNaviguer(a.action)}
                      className="mt-2 text-xs font-semibold text-acid hover:underline"
                    >
                      Aller à {a.action.label} →
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {data.erreurs?.length > 0 && (
        <p className="mt-3 text-xs text-zinc-500">
          {data.erreurs.length} détecteur(s) en échec — cette liste est peut-être incomplète :{" "}
          {data.erreurs.map((e) => e.detecteur).join(", ")}.
        </p>
      )}
    </section>
  );
}
