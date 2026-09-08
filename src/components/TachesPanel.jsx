import { useEffect, useState } from "react";
import { cachedFetch } from "../lib/adminCache";

// État des automatisations. Volontairement affiché sur l'accueil : une tâche
// morte ne se signale pas d'elle-même, il faut donc que l'information soit
// sous les yeux sans avoir à la chercher.

const ETATS = {
  ok: { label: "OK", classe: "text-emerald-400", point: "bg-emerald-400" },
  erreur: { label: "En échec", classe: "text-red-400", point: "bg-red-400" },
  en_retard: { label: "Silencieuse", classe: "text-amber-400", point: "bg-amber-400" },
  jamais_executee: { label: "Jamais exécutée", classe: "text-zinc-500", point: "bg-zinc-600" },
};

function depuis(date) {
  if (!date) return "jamais";
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 48) return `il y a ${heures} h`;
  return `il y a ${Math.round(heures / 24)} j`;
}

export default function TachesPanel() {
  const [taches, setTaches] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    cachedFetch("/api/taches")
      .then((d) => (d.error ? setErreur(d.error) : setTaches(d.taches)))
      .catch(() => setErreur("Impossible de charger l'état des tâches."));
  }, []);

  if (erreur) return null; // ne casse jamais l'accueil
  if (!taches) return null;

  const problemes = taches.filter((t) => t.etat === "erreur" || t.etat === "en_retard");

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-bold text-white">Automatisations</h2>
        {problemes.length > 0 ? (
          <span className="text-xs font-semibold text-amber-400">
            {problemes.length} tâche{problemes.length > 1 ? "s" : ""} à vérifier
          </span>
        ) : (
          <span className="text-xs text-zinc-500">Tout tourne normalement</span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {taches.map((t) => {
          const etat = ETATS[t.etat] || ETATS.jamais_executee;
          return (
            <div
              key={t.task}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-ink px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${etat.point}`} />
                <div>
                  <div className="text-sm font-semibold text-white">{t.label}</div>
                  <div className="text-xs text-zinc-500">
                    {depuis(t.derniereExecution)}
                    {t.detail && ` · ${t.detail}`}
                  </div>
                </div>
              </div>
              <span className={`text-xs font-semibold ${etat.classe}`}>{etat.label}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        « Silencieuse » signifie que la tâche n'a pas tourné depuis bien plus longtemps que prévu —
        c'est le signal d'une panne qui, sinon, passerait inaperçue. Un échec déclenche aussi une
        notification.
      </p>
    </section>
  );
}
