import { useEffect, useState } from "react";
import { cachedFetch } from "../lib/adminCache";

// Dernier rapport hebdomadaire, sur l'accueil du back-office.
//
// Doublon assumé avec l'email : l'email se perd, se classe, se lit sur un
// téléphone dans le métro. Le back-office est l'endroit où l'on revient pour
// retrouver « ce que disait le rapport de lundi », et c'est aussi le seul
// exemplaire consultable si l'envoi a échoué.

const COULEUR = {
  critique: "text-red-400",
  attention: "text-amber-400",
  info: "text-zinc-400",
};

function dateFr(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export default function RapportPanel() {
  const [rapport, setRapport] = useState(null);
  const [absent, setAbsent] = useState(false);

  useEffect(() => {
    cachedFetch("/api/rapport")
      .then((d) => (d?.rapport ? setRapport(d.rapport) : setAbsent(true)))
      .catch(() => setAbsent(true));
  }, []);

  // Aucun rapport encore produit : on l'annonce au lieu de laisser un vide que
  // l'on prendrait pour un bug. Le premier tombe le lundi suivant la mise en
  // ligne, il n'y a rien à faire d'ici là.
  if (absent) {
    return (
      <section className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Rapport hebdomadaire</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Aucun rapport n'a encore été produit. Le premier sera généré lundi à 8 h, puis envoyé par
          email et par notification.
        </p>
      </section>
    );
  }

  if (!rapport) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-bold text-white">Rapport hebdomadaire</h2>
        <span className="text-xs text-zinc-500">
          semaine du {dateFr(rapport.periode.debut)} au {dateFr(rapport.periode.fin)}
        </span>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ce qui a changé</div>
        <div className="mt-2 flex flex-col gap-1.5">
          {rapport.faits.map((f, i) => (
            <p key={i} className="text-sm leading-relaxed text-zinc-300">
              {f}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Anomalies en cours</div>
        {rapport.anomalies.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">Aucune anomalie détectée.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {rapport.anomalies.map((a, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-ink px-4 py-3">
                <div className={`text-sm font-semibold ${COULEUR[a.severite] || COULEUR.info}`}>{a.titre}</div>
                <div className="text-xs leading-relaxed text-zinc-500">{a.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">À faire cette semaine</div>
        {rapport.actions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">Rien de prioritaire à signaler.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {rapport.actions.map((a, i) => (
              <li key={i} className="rounded-xl border border-white/10 bg-ink px-4 py-3">
                <div className="text-sm font-semibold text-white">
                  {i + 1}. {a.titre}
                  {a.ou && <span className="ml-1 font-normal text-zinc-500">· onglet {a.ou}</span>}
                </div>
                <div className="text-xs leading-relaxed text-zinc-500">{a.pourquoi}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
