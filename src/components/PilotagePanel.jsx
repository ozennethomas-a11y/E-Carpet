import { useCallback, useEffect, useState } from "react";
import { StatTile } from "./charts";
import { formatPrice } from "../cart";
import { cachedFetchWithStatus, invalidateCache } from "../lib/adminCache";

// Onglet « Pilotage » : à la différence de Finance qui constate, cet écran
// projette (runway, réassort, priorités). Règle de présentation appliquée
// partout ici : une valeur absente s'affiche « donnée insuffisante » avec sa
// raison, jamais un 0 ou un tiret qui pourrait se lire comme une mesure.

const JOURS = [90, 180, 365];

function Manquant({ raison }) {
  return <span className="text-sm font-normal text-zinc-500">donnée insuffisante{raison ? ` (${raison})` : ""}</span>;
}

function euros(cents) {
  return cents == null ? null : formatPrice(cents);
}

function Carte({ titre, sous, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <h2 className="font-display text-base font-bold text-white">{titre}</h2>
      {sous && <p className="mt-1 text-xs text-zinc-500">{sous}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Ligne({ label, valeur, accent = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-2 last:border-0">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className={`chiffre font-display text-sm font-bold ${accent ? "text-acid" : "text-white"}`}>{valeur}</span>
    </div>
  );
}

export default function PilotagePanel() {
  const [jours, setJours] = useState(180);
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ok | error | unconfigured
  const [form, setForm] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const url = `/api/pilotage?days=${jours}`;

  const load = useCallback(async () => {
    setState("loading");
    try {
      const { status, data: json } = await cachedFetchWithStatus(url);
      if (status === 503) return setState("unconfigured");
      if (status < 200 || status >= 300) return setState("error");
      setData(json);
      setState("ok");
      setForm((f) =>
        f || {
          tresorerie: json.parametres.tresorerieCents == null ? "" : (json.parametres.tresorerieCents / 100).toString(),
          delai: String(json.parametres.delaiReassortJours),
          couverture: String(json.parametres.couvertureCibleJours),
          securite: String(json.parametres.stockSecuriteJours),
        },
      );
    } catch {
      setState("error");
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  async function enregistrer(e) {
    e.preventDefault();
    setEnvoi(true);
    try {
      await fetch("/api/pilotage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "enregistrer-parametres",
          tresorerieCents: form.tresorerie === "" ? null : Math.round(Number(form.tresorerie) * 100),
          delaiReassortJours: Number(form.delai),
          couvertureCibleJours: Number(form.couverture),
          stockSecuriteJours: Number(form.securite),
        }),
      });
      for (const j of JOURS) invalidateCache(`/api/pilotage?days=${j}`);
      await load();
    } finally {
      setEnvoi(false);
    }
  }

  if (state === "unconfigured") {
    return (
      <p className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-zinc-300">
        La session admin n'est pas configurée sur ce déploiement.
      </p>
    );
  }
  if (state === "error") {
    return (
      <p className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-red-400">
        Impossible de charger les données de pilotage.
      </p>
    );
  }
  if (!data) return <p className="text-sm text-zinc-500">Chargement…</p>;
  // La fonction renvoie ses erreurs applicatives en 200 avec un champ error
  // (comme finance.mjs et stock.mjs) : sans ce garde-fou, l'écran planterait
  // en essayant de lire des blocs absents.
  if (data.error)
    return (
      <p className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-red-400">{data.error}</p>
    );

  const { tresorerie, burn, canaux, reassort, priorites, parametres, manques } = data;
  const canalSite = canaux.find((c) => c.canal === "Site");
  const canalAmazon = canaux.find((c) => c.canal === "Amazon");
  const runwaySansVente = tresorerie.sansVente;
  const runwayRythme = tresorerie.rythmeActuel;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {JOURS.map((j) => (
            <button
              key={j}
              onClick={() => setJours(j)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
                jours === j ? "bg-acid text-white" : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              {j} jours
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Fenêtre observée : {data.range.from} → {data.range.to}
        </p>
      </div>

      {manques.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
          <p className="font-semibold">Ce qui manque pour que ces chiffres soient fiables</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {manques.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Trésorerie et runway */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Runway sans nouvelle vente"
          value={runwaySansVente ? (runwaySansVente.infini ? "sans limite" : `${runwaySansVente.mois} mois`) : "non calculable"}
          hint={
            runwaySansVente
              ? "Trésorerie divisée par les charges mensuelles saisies"
              : tresorerie.reserves.join(" · ")
          }
        />
        <StatTile
          label="Runway au rythme de vente actuel"
          value={
            tresorerie.autofinance
              ? "activité autofinancée"
              : runwayRythme
                ? `${runwayRythme.mois} mois`
                : "non calculable"
          }
          hint={
            runwayRythme || tresorerie.autofinance
              ? "Charges mensuelles moins la marge dégagée par les ventes"
              : tresorerie.reserves.join(" · ")
          }
        />
        <StatTile
          label="Trésorerie renseignée"
          value={euros(tresorerie.soldeCents) || "non saisie"}
          hint={
            tresorerie.soldeDate
              ? `Au ${new Date(tresorerie.soldeDate).toLocaleDateString("fr-FR")}`
              : "À saisir ci-dessous pour activer le runway"
          }
        />
      </div>

      <Carte
        titre="Rythme de dépenses"
        sous={`Moyenne mensuelle sur la fenêtre. Les achats de stock en sont exclus : ce sont des investissements ponctuels, pas des charges courantes.`}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Ligne label="Charges de structure" valeur={euros(burn.burnStructureMensuelCents) || "non calculable"} />
            <Ligne label="Publicité" valeur={euros(burn.burnPubMensuelCents) || "non calculable"} />
            <Ligne label="Total mensuel" valeur={euros(burn.burnMensuelCents) || "non calculable"} accent />
          </div>
          <div className="sm:col-span-2">
            {burn.parCategorie.length === 0 ? (
              <p className="text-sm text-zinc-500">Aucune dépense saisie sur la fenêtre.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {burn.parCategorie.map((c) => (
                  <li key={c.category} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-zinc-400">{c.category}</span>
                    <span className="chiffre text-white">{formatPrice(c.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
            {burn.achatsStock.totalCents > 0 && (
              <p className="mt-3 text-xs text-zinc-500">
                Achats de stock sur la fenêtre : {formatPrice(burn.achatsStock.totalCents)} sur
                {" "}{burn.achatsStock.lots.length} lot(s), comptés à part.
              </p>
            )}
            {!burn.historiqueSuffisant && burn.nbDepenses > 0 && (
              <p className="mt-3 text-xs text-amber-300">
                Dépenses saisies sur {burn.moisAvecDepense} mois seulement : le rythme mensuel reste une extrapolation.
              </p>
            )}
          </div>
        </div>
      </Carte>

      {/* Marge par canal */}
      <div className="grid gap-4 lg:grid-cols-2">
        {canaux.map((c) =>
          !c.disponible ? (
            <Carte key={c.canal} titre={`Canal ${c.canal}`} sous="Marge nette après tous les coûts">
              <p className="text-sm text-zinc-500">Donnée insuffisante : {c.raison}</p>
            </Carte>
          ) : (
            <Carte
              key={c.canal}
              titre={`Canal ${c.canal}`}
              sous={`${c.commandes} commande(s), ${c.unites} unité(s) sur la fenêtre`}
            >
              <Ligne label="Chiffre d'affaires brut" valeur={formatPrice(c.caCents)} />
              <Ligne label="Coût produit" valeur={`- ${formatPrice(c.coutProduitCents)}`} />
              <Ligne label={c.fraisPlateformeLabel} valeur={`- ${formatPrice(c.fraisPlateformeCents)}`} />
              <Ligne label="Expédition (estimée)" valeur={`- ${formatPrice(c.expeditionCents)}`} />
              {c.commissionsCents > 0 && (
                <Ligne label="Commissions affiliés" valeur={`- ${formatPrice(c.commissionsCents)}`} />
              )}
              {c.remboursementsCents > 0 && (
                <Ligne label="Remboursements" valeur={`- ${formatPrice(c.remboursementsCents)}`} />
              )}
              <Ligne
                label="Marge nette"
                valeur={c.fiable ? `${formatPrice(c.margeCents)} · ${String(c.margePct).replace(".", ",")} %` : "à confirmer"}
                accent
              />
              {!c.fiable && (
                <p className="mt-2 text-xs text-amber-300">
                  {c.commandes === 0
                    ? "Aucune vente sur la fenêtre."
                    : `Marge incomplète : ${[...(c.produitsSansCout || []), ...(c.skuSansCout || [])].join(", ") || "frais manquants"}. Le chiffre affiché serait trop optimiste.`}
                </p>
              )}
            </Carte>
          ),
        )}
      </div>

      {/* Marge par produit, canal site (Amazon ne fournit que les quantités par SKU) */}
      <Carte
        titre="Marge par produit"
        sous="Canal site. Les frais Stripe, l'expédition et les commissions sont répartis au prorata du poids de chaque ligne dans la commande."
      >
        {(canalSite?.produits || []).length === 0 ? (
          <p className="text-sm text-zinc-500">Aucune vente site sur la fenêtre.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {canalSite.produits.map((p) => (
              <div key={p.productId} className="rounded-xl border border-white/10 bg-ink p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-zinc-300">{p.name}</span>
                  <span className="chiffre font-display text-sm font-bold text-white">
                    {p.margeUnitaireCents == null ? <Manquant raison="coût produit non renseigné" /> : `${formatPrice(p.margeUnitaireCents)} / unité`}
                  </span>
                </div>
                <p className="chiffre mt-1 text-xs text-zinc-500">
                  {p.unites} unité(s) · CA {formatPrice(p.caCents)}
                  {p.margeCents != null && ` · marge ${formatPrice(p.margeCents)}`}
                </p>
              </div>
            ))}
          </div>
        )}
        {canalAmazon?.disponible && canalAmazon.produits.length > 0 && (
          <p className="mt-3 text-xs text-zinc-500">
            Amazon : {canalAmazon.produits.map((p) => `${p.sku} (${p.unites} u.)`).join(", ")}. L'API Amazon ne détaille
            pas le chiffre d'affaires par SKU, seule la marge globale du canal est calculable.
          </p>
        )}
      </Carte>

      {/* Réassort */}
      <Carte
        titre="Prévision de réassort"
        sous={`Vitesse de vente calculée sur les sorties de stock réelles (site + Amazon) des ${data.range.jours} derniers jours.`}
      >
        <div className="flex flex-col gap-3">
          {reassort.produits.map((p) => (
            <div key={p.productId} className="rounded-xl border border-white/10 bg-ink p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-sm font-bold text-white">{p.name}</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    p.statut === "urgent"
                      ? "bg-acid text-white"
                      : p.statut === "a_commander"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-white/5 text-zinc-400"
                  }`}
                >
                  {p.statut === "urgent"
                    ? "à commander maintenant"
                    : p.statut === "a_commander"
                      ? "à commander sous 30 jours"
                      : p.statut === "ok"
                        ? "stock suffisant"
                        : "donnée insuffisante"}
                </span>
              </div>
              {p.statut === "donnees_insuffisantes" ? (
                <p className="mt-2 text-sm text-zinc-500">{p.raison}</p>
              ) : (
                <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  <Ligne label="Stock actuel" valeur={`${p.stock} unités`} />
                  <Ligne label="Vitesse de vente" valeur={`${String(p.velociteMensuelle).replace(".", ",")} u./mois`} />
                  <Ligne label="Rupture estimée" valeur={new Date(p.dateRupture).toLocaleDateString("fr-FR")} />
                  <Ligne label="Commander avant le" valeur={new Date(p.dateCommande).toLocaleDateString("fr-FR")} accent />
                  <Ligne label="Quantité conseillée" valeur={`${p.quantiteConseillee} unités`} />
                  <Ligne
                    label="Coût du réassort"
                    valeur={p.coutReassortCents == null ? <Manquant raison={p.coutReassortRaison} /> : formatPrice(p.coutReassortCents)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Carte>

      {/* Priorités d'investissement */}
      <Carte
        titre="Où mettre les prochains euros"
        sous="Score de 0 à 100, calculé à partir des chiffres ci-dessus. Une ligne sans score est une ligne que les données disponibles ne permettent pas de départager."
      >
        <div className="flex flex-col gap-3">
          {priorites.map((p) => (
            <div key={p.id} className="rounded-xl border border-white/10 bg-ink p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-sm font-bold text-white">{p.titre}</span>
                <span className="chiffre text-sm font-bold text-acid">
                  {p.score == null ? <Manquant /> : `${p.score}/100`}
                </span>
              </div>
              {p.score != null && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full" style={{ width: `${p.score}%`, backgroundColor: "#e06a3b" }} />
                </div>
              )}
              {(p.montantCents != null || p.gainAttenduCents != null) && (
                <p className="chiffre mt-2 text-xs text-zinc-400">
                  {p.montantCents != null && `Montant : ${formatPrice(p.montantCents)}`}
                  {p.montantCents != null && p.gainAttenduCents != null && " · "}
                  {p.gainAttenduCents != null && `${p.gainLabel} : ${formatPrice(p.gainAttenduCents)}`}
                </p>
              )}
              <ul className="mt-2 flex flex-col gap-1">
                {p.justification.map((j) => (
                  <li key={j} className="text-sm leading-relaxed text-zinc-400">
                    {j}
                  </li>
                ))}
              </ul>
              {p.donneesManquantes.length > 0 && (
                <p className="mt-2 text-xs text-amber-300">Données manquantes : {p.donneesManquantes.join(" · ")}</p>
              )}
              {p.composantes.length > 0 && (
                <p className="chiffre mt-2 text-xs text-zinc-600">
                  {p.composantes.map((c) => `${c.label} : ${c.valeur}`).join("  ·  ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </Carte>

      {/* Paramètres : les seules données que la base ne peut pas déduire seule. */}
      {form && (
        <Carte
          titre="Paramètres de pilotage"
          sous="Le solde bancaire ne transite pas par le site et le délai fournisseur n'est pas mesuré : sans ces valeurs, le runway et les dates de réassort restent non calculables."
        >
          <form onSubmit={enregistrer} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-zinc-500">
              Trésorerie disponible (€)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.tresorerie}
                onChange={(e) => setForm((f) => ({ ...f, tresorerie: e.target.value }))}
                className="mt-1 block w-36 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Délai fournisseur (jours)
              <input
                type="number"
                min="1"
                max="365"
                value={form.delai}
                onChange={(e) => setForm((f) => ({ ...f, delai: e.target.value }))}
                className="mt-1 block w-28 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Couverture cible (jours)
              <input
                type="number"
                min="7"
                max="730"
                value={form.couverture}
                onChange={(e) => setForm((f) => ({ ...f, couverture: e.target.value }))}
                className="mt-1 block w-28 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Stock de sécurité (jours)
              <input
                type="number"
                min="0"
                max="365"
                value={form.securite}
                onChange={(e) => setForm((f) => ({ ...f, securite: e.target.value }))}
                className="mt-1 block w-28 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
              />
            </label>
            <button
              type="submit"
              disabled={envoi}
              className="rounded-full bg-acid px-5 py-2 font-display text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
            >
              {envoi ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
          {!parametres.parametresSaisis && (
            <p className="mt-3 text-xs text-amber-300">
              Valeurs par défaut non confirmées : le délai fournisseur de {parametres.delaiReassortJours} jours est une
              hypothèse, pas une mesure.
            </p>
          )}
        </Carte>
      )}
    </div>
  );
}
