import { useEffect, useState, useCallback } from "react";
import { translations } from "../i18n/translations";

// Onglet « Avis » : modération. Deux blocs bien séparés, parce que les deux
// populations n'ont pas les mêmes droits.
//
//  - Pré-autorisation : les avis envoyés par les visiteurs, en attente. Rien ne
//    s'affiche sur le site tant que vous n'avez pas approuvé.
//  - Avis en ligne : ce que voit réellement un visiteur, y compris les avis
//    maison, qu'on peut mettre en veille mais jamais supprimer d'ici.

// Les avis maison viennent des traductions et gardent leurs quatre langues.
const MAISON = translations.fr.reviews.items.map((r, i) => ({ ...r, id: `base-${i}`, maison: true }));

function Etoiles({ note }) {
  return (
    <span className="text-acid" aria-label={`${note} sur 5`}>
      {"★".repeat(note)}
      <span className="text-zinc-700">{"★".repeat(5 - note)}</span>
    </span>
  );
}

function Carte({ avis, actions }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-ink p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-sm font-bold text-white">
            {avis.name}
            {avis.city && <span className="font-normal text-zinc-500"> · {avis.city}</span>}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {avis.scooter || "Modèle non précisé"}
            {avis.date && ` · reçu le ${avis.date}`}
            {avis.maison && " · avis maison, traduit en 4 langues"}
          </div>
        </div>
        <Etoiles note={avis.rating} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-zinc-300">{avis.text}</p>
      {(avis.photo || avis.email || avis.codePromo) && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {avis.photo && (
            <img src={avis.photo} alt="Photo jointe à l'avis" className="h-16 w-16 rounded-lg object-cover" />
          )}
          {avis.email && <span className="text-xs text-zinc-500">{avis.email}</span>}
          {avis.codePromo && (
            <span className="rounded-full border border-acid/40 px-3 py-1 text-xs font-bold text-acid">
              Code envoyé : {avis.codePromo}
            </span>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">{actions}</div>
    </article>
  );
}

function Bouton({ onClick, children, ton = "neutre", disabled }) {
  const styles = {
    principal: "bg-acid text-white",
    neutre: "border border-white/15 text-zinc-300 hover:text-white",
    danger: "border border-red-500/30 text-red-400 hover:bg-red-500/10",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-1.5 font-display text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${styles[ton]}`}
    >
      {children}
    </button>
  );
}

export default function AvisPanel() {
  const [etat, setEtat] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch("/api/avis");
      if (!res.ok) throw new Error();
      setEtat(await res.json());
      setErreur(null);
    } catch {
      setErreur("Impossible de charger les avis.");
    }
    setChargement(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const changer = async (id, statut) => {
    setOccupe(id);
    try {
      const res = await fetch("/api/avis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, statut }),
      });
      if (!res.ok) throw new Error();
      await charger();
    } catch {
      setErreur("La modification n'a pas été enregistrée.");
    }
    setOccupe(null);
  };

  if (chargement && !etat) return <p className="text-sm text-zinc-500">Chargement des avis…</p>;

  const masques = etat?.masques || [];
  const recus = etat?.avis || [];
  const enAttente = recus.filter((a) => a.statut === "en_attente");
  const refuses = recus.filter((a) => a.statut === "refuse");
  const enLigne = [
    ...MAISON.map((r) => ({ ...r, statut: masques.includes(r.id) ? "en_veille" : "en_ligne" })),
    ...recus.filter((a) => a.statut === "en_ligne" || a.statut === "en_veille"),
  ];
  const visibles = enLigne.filter((a) => a.statut === "en_ligne").length;

  return (
    <div className="flex flex-col gap-4">
      {erreur && (
        <p className="rounded-2xl border border-white/10 bg-slate-deep p-4 text-sm text-red-400">{erreur}</p>
      )}

      {/* Pré-autorisation */}
      <section className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-white">
            Pré-autorisation
            {enAttente.length > 0 && (
              <span className="chiffre ml-2 rounded-full bg-acid px-2 py-0.5 text-xs text-white">{enAttente.length}</span>
            )}
          </h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Avis envoyés par les visiteurs. Ils n'apparaissent nulle part sur le site tant que
          vous ne les avez pas approuvés.
        </p>

        {enAttente.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Aucun avis en attente.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {enAttente.map((a) => (
              <Carte
                key={a.id}
                avis={a}
                actions={
                  <>
                    <Bouton ton="principal" disabled={occupe === a.id} onClick={() => changer(a.id, "en_ligne")}>
                      Publier
                    </Bouton>
                    <Bouton ton="danger" disabled={occupe === a.id} onClick={() => changer(a.id, "refuse")}>
                      Refuser
                    </Bouton>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Avis en ligne */}
      <section className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Avis en ligne</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          <span className="chiffre">{visibles}</span> avis visible{visibles > 1 ? "s" : ""} sur le site. La mise en veille les retire
          de la page d'accueil sans rien effacer : vous pouvez les remettre à tout moment.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {enLigne.map((a) => (
            <div key={a.id} className={a.statut === "en_veille" ? "opacity-50" : ""}>
              <Carte
                avis={a}
                actions={
                  a.statut === "en_ligne" ? (
                    <Bouton disabled={occupe === a.id} onClick={() => changer(a.id, "en_veille")}>
                      Mettre en veille
                    </Bouton>
                  ) : (
                    <>
                      <span className="self-center text-xs text-zinc-500">En veille · invisible sur le site</span>
                      <Bouton ton="principal" disabled={occupe === a.id} onClick={() => changer(a.id, "en_ligne")}>
                        Remettre en ligne
                      </Bouton>
                    </>
                  )
                }
              />
            </div>
          ))}
        </div>
      </section>

      {refuses.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-deep p-5">
          <h2 className="font-display text-base font-bold text-white">Refusés</h2>
          <div className="mt-4 flex flex-col gap-3">
            {refuses.map((a) => (
              <div key={a.id} className="opacity-50">
                <Carte
                  avis={a}
                  actions={
                    <Bouton disabled={occupe === a.id} onClick={() => changer(a.id, "en_attente")}>
                      Remettre en attente
                    </Bouton>
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
