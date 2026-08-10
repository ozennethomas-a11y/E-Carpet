import { useEffect, useState, useCallback, useMemo } from "react";

// Onglet « Campagnes » : mots-clés réels du Keyword Planner et prévision de coût.
// Rien n'est dépensé ici. La création de campagne se fera en statut « en pause »,
// et uniquement après validation explicite.

const MOIS = {
  JANUARY: "janv.", FEBRUARY: "févr.", MARCH: "mars", APRIL: "avr.",
  MAY: "mai", JUNE: "juin", JULY: "juil.", AUGUST: "août",
  SEPTEMBER: "sept.", OCTOBER: "oct.", NOVEMBER: "nov.", DECEMBER: "déc.",
};

const eur = (n) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

const COULEUR_CONCURRENCE = {
  faible: "text-emerald-400",
  moyenne: "text-amber-400",
  forte: "text-red-400",
};

/** Les trois mois où la demande est la plus forte : c'est le « quand » de la campagne. */
function meilleursMois(keywords) {
  const total = {};
  for (const k of keywords) {
    for (const m of k.saisonnalite || []) {
      total[m.mois] = (total[m.mois] || 0) + m.volume;
    }
  }
  return Object.entries(total)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([mois]) => MOIS[mois] || mois);
}

function Erreur({ message }) {
  const aides = {
    missing_credentials:
      "Il manque des variables dans Netlify. Ajoutez-les, puis relancez un déploiement.",
  };
  return (
    <div className="rounded-2xl border border-acid/30 bg-acid/10 p-6 text-sm leading-relaxed">
      <p className="font-display font-bold text-white">Google Ads pas encore connecté</p>
      <p className="mt-2 text-zinc-300">{aides[message] || message}</p>
    </div>
  );
}

export default function AdsPanel({ password }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [choisis, setChoisis] = useState(() => new Set());
  const [budget, setBudget] = useState(10);
  const [cpc, setCpc] = useState(0.5);
  const [prevision, setPrevision] = useState(null);
  const [calcul, setCalcul] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/ads", { headers: { "x-dashboard-password": password } });
      const json = await res.json();
      setData(json);
      setState(json.error ? "erreur" : "ok");
      // Présélection : les dix mots-clés les plus recherchés, le point de départ le plus sain.
      if (json.keywords) setChoisis(new Set(json.keywords.slice(0, 10).map((k) => k.motCle)));
    } catch {
      setState("erreur");
      setData({ error: "Le serveur n'a pas répondu." });
    }
  }, [password]);

  useEffect(() => { load(); }, [load]);

  const keywords = data?.keywords || [];
  const selection = useMemo(() => keywords.filter((k) => choisis.has(k.motCle)), [keywords, choisis]);
  const saison = useMemo(() => meilleursMois(selection), [selection]);

  const bascule = (motCle) => {
    setChoisis((prev) => {
      const next = new Set(prev);
      next.has(motCle) ? next.delete(motCle) : next.add(motCle);
      return next;
    });
    setPrevision(null); // la prévision ne vaut plus pour la nouvelle sélection
  };

  const estimer = async () => {
    setCalcul(true);
    setPrevision(null);
    try {
      const res = await fetch("/api/ads", {
        method: "POST",
        headers: { "content-type": "application/json", "x-dashboard-password": password },
        body: JSON.stringify({
          keywords: selection.map((k) => k.motCle),
          dailyBudget: Number(budget),
          cpcBid: Number(cpc),
        }),
      });
      setPrevision(await res.json());
    } catch {
      setPrevision({ error: "Le calcul n'a pas abouti." });
    }
    setCalcul(false);
  };

  if (state === "loading") return <p className="text-sm text-zinc-500">Interrogation de Google Ads…</p>;
  if (state === "erreur") return <Erreur message={data?.error || "Erreur inconnue."} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Mots-clés réels</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Volumes de recherche mensuels mesurés par Google en France. Cochez ceux que vous
          voulez cibler : la prévision de coût se calcule sur votre sélection.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="pb-2 w-8"></th>
                <th className="pb-2">Mot-clé</th>
                <th className="pb-2 text-right">Recherches / mois</th>
                <th className="pb-2 text-right">Concurrence</th>
                <th className="pb-2 text-right">Coût par clic</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {keywords.map((k) => (
                <tr key={k.motCle} className="border-t border-white/5">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={choisis.has(k.motCle)}
                      onChange={() => bascule(k.motCle)}
                      aria-label={`Cibler ${k.motCle}`}
                      className="size-4 accent-acid cursor-pointer"
                    />
                  </td>
                  <td className="max-w-[240px] truncate py-2" title={k.motCle}>{k.motCle}</td>
                  <td className="py-2 text-right tabular-nums text-white">
                    {k.volume.toLocaleString("fr-FR")}
                  </td>
                  <td className={`py-2 text-right ${COULEUR_CONCURRENCE[k.concurrence] || "text-zinc-500"}`}>
                    {k.concurrence}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {k.cpcBas ? `${eur(k.cpcBas)} à ${eur(k.cpcHaut)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Combien ça va coûter</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {selection.length} mot{selection.length > 1 ? "s" : ""}-clé{selection.length > 1 ? "s" : ""} sélectionné
          {selection.length > 1 ? "s" : ""}. Prévisions fournies par Google, sur 30 jours.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-xs text-zinc-400">
            Budget par jour
            <input
              type="number" min="1" step="1" value={budget}
              onChange={(e) => { setBudget(e.target.value); setPrevision(null); }}
              className="mt-1 block w-28 rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-acid/60"
            />
          </label>
          <label className="text-xs text-zinc-400">
            Enchère max par clic
            <input
              type="number" min="0.05" step="0.05" value={cpc}
              onChange={(e) => { setCpc(e.target.value); setPrevision(null); }}
              className="mt-1 block w-28 rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-acid/60"
            />
          </label>
          <button
            onClick={estimer}
            disabled={!selection.length || calcul}
            className="rounded-full bg-acid px-6 py-2.5 font-display text-sm font-bold text-white transition-opacity cursor-pointer disabled:opacity-40"
          >
            {calcul ? "Calcul…" : "Estimer"}
          </button>
        </div>

        {prevision?.error && <p className="mt-4 text-sm text-amber-400">{prevision.error}</p>}

        {prevision && !prevision.error && (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-4">
              {[
                ["Coût sur 30 jours", eur(prevision.coutEstime)],
                ["Clics attendus", prevision.clics.toLocaleString("fr-FR")],
                ["Impressions", prevision.impressions.toLocaleString("fr-FR")],
                ["Coût par clic", eur(prevision.cpcMoyen)],
              ].map(([label, valeur]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-ink p-4">
                  <div className="font-display text-2xl font-bold text-white">{valeur}</div>
                  <div className="mt-1 text-xs text-zinc-500">{label}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Période retenue : du {prevision.periode.du} au {prevision.periode.au}, à {eur(prevision.budgetQuotidien)} par jour.
              {saison.length > 0 && ` Demande la plus forte en ${saison.join(", ")}.`}
            </p>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5 text-xs leading-relaxed text-zinc-500">
        Cette page est en lecture seule : consulter ces chiffres ne crée aucune campagne et ne
        dépense rien. La création se fera toujours en statut « en pause », et il vous restera à
        l'activer vous-même dans Google Ads.
      </div>
    </div>
  );
}
