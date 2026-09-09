import { useCallback, useEffect, useState } from "react";
import { cachedFetch, invalidateCache } from "../lib/adminCache";

// Rapprochement bancaire. Remplace la recopie manuelle du relevé dans un
// classeur : on importe le CSV de la banque, les lignes qui correspondent à
// une dépense déjà saisie sont rattachées automatiquement, et il ne reste à
// traiter que ce qui est réellement ambigu.
//
// L'écran est trié par ce qui demande une action, pas par date : une ligne
// déjà rapprochée n'a plus rien à dire, elle n'a pas à occuper le haut de la
// page.

const STATUTS = {
  a_traiter: { label: "À traiter", classe: "text-amber-400 border-amber-500/30 bg-amber-500/5" },
  rapproche: { label: "Rapprochée", classe: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" },
  ignore: { label: "Écartée", classe: "text-zinc-500 border-white/10 bg-white/5" },
};

function euros(cents) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function jour(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

async function poster(corps) {
  const res = await fetch("/api/banque", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps),
  });
  return res.json();
}

export default function BanquePanel() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState("a_traiter");
  const [importOuvert, setImportOuvert] = useState(false);

  const charger = useCallback(async () => {
    setErreur("");
    try {
      const d = await cachedFetch("/api/banque");
      if (d.error) return setErreur(d.error);
      setData(d);
    } catch {
      setErreur("Impossible de charger le relevé.");
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const rafraichir = useCallback(async () => {
    invalidateCache("/api/banque");
    await charger();
  }, [charger]);

  if (erreur) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Rapprochement bancaire</h2>
        <p className="mt-2 text-sm text-red-400">{erreur}</p>
      </div>
    );
  }
  if (!data) return null;

  const { compte } = data;
  const lignes = data.lignes.filter((l) => filtre === "toutes" || l.status === filtre);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-bold text-white">Rapprochement bancaire</h2>
        <button
          onClick={() => setImportOuvert((v) => !v)}
          className="rounded-full border border-acid/40 bg-acid/10 px-4 py-1.5 text-xs text-white transition-colors hover:bg-acid/20"
        >
          {importOuvert ? "Fermer l'import" : "Importer un relevé"}
        </button>
      </div>

      {compte.a_traiter > 0 ? (
        <p className="mt-2 text-sm text-zinc-400">
          <span className="chiffre font-semibold text-amber-400">{compte.a_traiter}</span> ligne
          {compte.a_traiter > 1 ? "s" : ""} à traiter, soit{" "}
          <span className="chiffre">{euros(Math.abs(compte.a_traiter_debit_cents))}</span> de débits non rattachés.
        </p>
      ) : (
        <p className="mt-2 text-sm text-zinc-400">
          Tout est rapproché.{" "}
          <span className="chiffre">{compte.rapproche}</span> ligne{compte.rapproche > 1 ? "s" : ""} rattachée
          {compte.rapproche > 1 ? "s" : ""} à une dépense.
        </p>
      )}

      {importOuvert && <ImportReleve onImporte={rafraichir} />}

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ["a_traiter", `À traiter (${compte.a_traiter})`],
          ["rapproche", `Rapprochées (${compte.rapproche})`],
          ["ignore", `Écartées (${compte.ignore})`],
          ["toutes", "Toutes"],
        ].map(([cle, label]) => (
          <button
            key={cle}
            onClick={() => setFiltre(cle)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filtre === cle ? "border-acid bg-acid/10 text-white" : "border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {lignes.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucune ligne dans cette vue.</p>
        ) : (
          lignes.map((l) => <LigneBancaire key={l.id} ligne={l} categories={data.categories} onChange={rafraichir} />)
        )}
      </div>
    </div>
  );
}

function ImportReleve({ onImporte }) {
  const [csv, setCsv] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState("");

  async function importer() {
    setErreur("");
    setResultat(null);
    setEnvoi(true);
    try {
      const d = await poster({ action: "importer", csv });
      if (d.error) return setErreur(d.error);
      setResultat(d);
      setCsv("");
      await onImporte();
    } catch {
      setErreur("Import impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  function fichier(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const lecteur = new FileReader();
    lecteur.onload = () => setCsv(String(lecteur.result || ""));
    lecteur.readAsText(f, "utf-8");
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-ink p-4">
      <p className="text-xs leading-relaxed text-zinc-400">
        Déposez l'export CSV de votre banque, ou collez-le ci-dessous. Les lignes déjà importées sont
        reconnues et ignorées : réimporter le même relevé ne crée pas de doublon.
      </p>

      <input
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={fichier}
        className="mt-3 block w-full text-xs text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-1.5 file:text-xs file:text-white"
      />

      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={5}
        placeholder="Date;Libellé;Montant&#10;03/09/2026;PRLV GOOGLE ADS;-45,20"
        className="mt-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none focus:border-acid"
      />

      {erreur && <p className="mt-2 text-xs text-red-400">{erreur}</p>}

      {resultat && (
        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
          <p>
            <span className="chiffre font-semibold">{resultat.ajoutees}</span> ligne(s) importée(s), dont{" "}
            <span className="chiffre font-semibold">{resultat.rapprochees}</span> rattachée(s) automatiquement à une
            dépense existante. <span className="chiffre">{resultat.aTraiter}</span> à traiter.
          </p>
          {resultat.doublons > 0 && (
            <p className="mt-1 text-zinc-400">
              <span className="chiffre">{resultat.doublons}</span> ligne(s) déjà connue(s), ignorée(s).
            </p>
          )}
          {resultat.lignesIgnorees?.length > 0 && (
            <div className="mt-2 text-amber-300">
              <p className="font-semibold">{resultat.lignesIgnorees.length} ligne(s) illisible(s) :</p>
              <ul className="mt-1 list-disc pl-4">
                {resultat.lignesIgnorees.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    ligne {e.ligne} — {e.raison}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <button
        onClick={importer}
        disabled={!csv.trim() || envoi}
        className="mt-3 rounded-full bg-acid px-5 py-2 text-xs font-bold text-white disabled:opacity-40"
      >
        {envoi ? "Import en cours…" : "Importer"}
      </button>
    </div>
  );
}

function LigneBancaire({ ligne, categories, onChange }) {
  const [categorie, setCategorie] = useState(ligne.suggestedCategory || categories[0]);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  const statut = STATUTS[ligne.status] || STATUTS.a_traiter;
  const debit = ligne.amountCents < 0;

  async function agir(corps) {
    setErreur("");
    setOccupe(true);
    try {
      const d = await poster(corps);
      if (d.error) return setErreur(d.error);
      await onChange();
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-ink p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm text-white">{ligne.label}</div>
          <div className="text-xs text-zinc-500">
            {jour(ligne.date)}
            {ligne.depense && ` · rattachée à « ${ligne.depense.category} »`}
            {ligne.note && ` · ${ligne.note}`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`chiffre font-display text-sm font-bold ${debit ? "text-white" : "text-emerald-400"}`}>
            {euros(ligne.amountCents)}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statut.classe}`}>
            {statut.label}
          </span>
        </div>
      </div>

      {ligne.status === "a_traiter" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {debit ? (
            <>
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-acid"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-ink">
                    {c}
                  </option>
                ))}
              </select>
              <button
                onClick={() => agir({ action: "creer-depense", id: ligne.id, category: categorie })}
                disabled={occupe}
                className="rounded-full bg-acid px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
              >
                Créer la dépense
              </button>
              {ligne.suggestedCategory && (
                <span className="text-[11px] text-zinc-500">catégorie proposée d'après le libellé</span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-zinc-500">
              Encaissement : déjà compté dans le chiffre d'affaires, à écarter.
            </span>
          )}
          <button
            onClick={() => agir({ action: "ignorer", id: ligne.id })}
            disabled={occupe}
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-zinc-300 hover:text-white disabled:opacity-40"
          >
            Écarter
          </button>
        </div>
      )}

      {ligne.status !== "a_traiter" && (
        <button
          onClick={() => agir({ action: "reouvrir", id: ligne.id })}
          disabled={occupe}
          className="mt-2 text-xs text-zinc-500 hover:text-white disabled:opacity-40"
        >
          Remettre à traiter
        </button>
      )}

      {erreur && <p className="mt-2 text-xs text-red-400">{erreur}</p>}
    </div>
  );
}
