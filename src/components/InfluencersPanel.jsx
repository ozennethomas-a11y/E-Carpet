import { useEffect, useState } from "react";
import { cachedFetch, invalidateCache } from "../lib/adminCache";

const STATUTS = [
  { id: "a_contacter", label: "À contacter" },
  { id: "en_cours", label: "En cours" },
  { id: "termine", label: "Terminé" },
];

const CHAMPS = [
  { id: "name", label: "Nom", type: "text", width: "min-w-[160px]" },
  { id: "platform", label: "Plateforme", type: "text", width: "min-w-[120px]" },
  { id: "followers", label: "Followers", type: "text", width: "min-w-[90px]" },
  { id: "contact", label: "Contact", type: "text", width: "min-w-[160px]" },
  { id: "offer", label: "Offre", type: "text", width: "min-w-[100px]" },
  { id: "status", label: "Statut", type: "select", width: "min-w-[130px]" },
  { id: "publication", label: "Publication", type: "text", width: "min-w-[200px]" },
  { id: "onSite", label: "Sur le site", type: "checkbox", width: "min-w-[80px]" },
  { id: "nextAction", label: "Prochaine action", type: "text", width: "min-w-[220px]" },
  { id: "note", label: "Note", type: "text", width: "min-w-[160px]" },
];

function ligneVide() {
  return { name: "", platform: "", followers: "", contact: "", offer: "", status: "a_contacter", publication: "", onSite: false, nextAction: "", note: "" };
}

export default function InfluencersPanel() {
  const [lignes, setLignes] = useState(null);
  const [erreur, setErreur] = useState("");
  const [edition, setEdition] = useState({}); // id -> ligne modifiée en cours
  const [enregistrement, setEnregistrement] = useState(null); // id en cours de sauvegarde
  const [nouvelle, setNouvelle] = useState(null);

  async function charger() {
    setErreur("");
    try {
      const data = await cachedFetch("/api/influencers");
      if (data.error) return setErreur(data.error);
      setLignes(data.influenceurs);
    } catch {
      setErreur("Impossible de charger le tableau.");
    }
  }

  useEffect(() => {
    charger();
  }, []);

  function valeur(ligne, champ) {
    const brouillon = edition[ligne.id];
    return brouillon ? brouillon[champ] : ligne[champ];
  }

  function modifier(ligne, champ, val) {
    setEdition((e) => ({ ...e, [ligne.id]: { ...(e[ligne.id] || ligne), [champ]: val } }));
  }

  async function sauvegarder(ligne) {
    const brouillon = edition[ligne.id];
    if (!brouillon) return;
    setEnregistrement(ligne.id);
    try {
      const res = await fetch("/api/influencers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "modifier", id: ligne.id, ...brouillon }),
      });
      const data = await res.json();
      if (data.error) return setErreur(data.error);
      setEdition((e) => {
        const { [ligne.id]: _, ...reste } = e;
        return reste;
      });
      invalidateCache("/api/influencers");
      await charger();
    } finally {
      setEnregistrement(null);
    }
  }

  async function supprimer(ligne) {
    if (!window.confirm(`Retirer ${ligne.name} du tableau ?`)) return;
    setEnregistrement(ligne.id);
    try {
      await fetch("/api/influencers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "supprimer", id: ligne.id }),
      });
      invalidateCache("/api/influencers");
      await charger();
    } finally {
      setEnregistrement(null);
    }
  }

  async function ajouter() {
    if (!nouvelle?.name?.trim()) return setErreur("Le nom est obligatoire.");
    setEnregistrement("nouvelle");
    try {
      const res = await fetch("/api/influencers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "creer", ...nouvelle }),
      });
      const data = await res.json();
      if (data.error) return setErreur(data.error);
      setNouvelle(null);
      invalidateCache("/api/influencers");
      await charger();
    } finally {
      setEnregistrement(null);
    }
  }

  function Cellule({ ligne, champ }) {
    const val = valeur(ligne, champ.id);
    if (champ.type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={!!val}
          onChange={(e) => modifier(ligne, champ.id, e.target.checked)}
          className="cursor-pointer"
        />
      );
    }
    if (champ.type === "select") {
      return (
        <select
          value={val}
          onChange={(e) => modifier(ligne, champ.id, e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-deep px-2 py-1 text-xs text-white cursor-pointer"
        >
          {STATUTS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        value={val || ""}
        onChange={(e) => modifier(ligne, champ.id, e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-slate-deep px-2 py-1 text-xs text-white"
      />
    );
  }

  if (erreur) return <p className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{erreur}</p>;
  if (lignes === null) return <p className="mt-6 text-sm text-zinc-500">Chargement...</p>;

  return (
    <div className="mt-6">
      <p className="text-sm text-zinc-400">
        Tableau éditable, directement modifiable ligne par ligne. Chaque cellule se met à jour au clic sur "Enregistrer".
      </p>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
              {CHAMPS.map((c) => (
                <th key={c.id} className={`py-2 px-3 ${c.width}`}>{c.label}</th>
              ))}
              <th className="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => {
              const modifie = !!edition[ligne.id];
              return (
                <tr key={ligne.id} className="border-b border-white/5 last:border-0">
                  {CHAMPS.map((c) => (
                    <td key={c.id} className="py-2 px-3 align-top">
                      <Cellule ligne={ligne} champ={c} />
                    </td>
                  ))}
                  <td className="py-2 px-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => sauvegarder(ligne)}
                        disabled={!modifie || enregistrement === ligne.id}
                        className="rounded-full bg-acid px-3 py-1 text-xs font-bold text-white disabled:opacity-30 cursor-pointer"
                      >
                        {enregistrement === ligne.id ? "…" : "Enregistrer"}
                      </button>
                      <button
                        onClick={() => supprimer(ligne)}
                        disabled={enregistrement === ligne.id}
                        className="rounded-full border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-30 cursor-pointer"
                      >
                        Retirer
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {nouvelle ? (
              <tr className="border-b border-white/5 bg-acid/5">
                {CHAMPS.map((c) => (
                  <td key={c.id} className="py-2 px-3 align-top">
                    {c.type === "checkbox" ? (
                      <input type="checkbox" checked={!!nouvelle[c.id]} onChange={(e) => setNouvelle((n) => ({ ...n, [c.id]: e.target.checked }))} className="cursor-pointer" />
                    ) : c.type === "select" ? (
                      <select value={nouvelle[c.id]} onChange={(e) => setNouvelle((n) => ({ ...n, [c.id]: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-slate-deep px-2 py-1 text-xs text-white cursor-pointer">
                        {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={nouvelle[c.id] || ""} onChange={(e) => setNouvelle((n) => ({ ...n, [c.id]: e.target.value }))} placeholder={c.label} className="w-full rounded-lg border border-white/10 bg-slate-deep px-2 py-1 text-xs text-white" />
                    )}
                  </td>
                ))}
                <td className="py-2 px-3">
                  <div className="flex gap-1.5">
                    <button onClick={ajouter} disabled={enregistrement === "nouvelle"} className="rounded-full bg-acid px-3 py-1 text-xs font-bold text-white disabled:opacity-60 cursor-pointer">
                      {enregistrement === "nouvelle" ? "…" : "Ajouter"}
                    </button>
                    <button onClick={() => setNouvelle(null)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300 cursor-pointer">Annuler</button>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {!nouvelle && (
        <button
          onClick={() => setNouvelle(ligneVide())}
          className="mt-3 rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold text-zinc-300 hover:text-white cursor-pointer"
        >
          + Ajouter un influenceur
        </button>
      )}
    </div>
  );
}
