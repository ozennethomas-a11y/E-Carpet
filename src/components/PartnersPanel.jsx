import { useEffect, useState, useCallback } from "react";
import { formatPrice } from "../cart";

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function Carte({ a, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-sm font-bold text-white">{a.name}</div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {a.email}
            {a.social && ` · ${a.social}`}
            {a.audience && ` · ${a.audience}`}
          </div>
          {a.message && <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-400">{a.message}</p>}
        </div>
        <div className="text-xs text-zinc-500">Candidature du {formatDate(a.createdAt)}</div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
    </div>
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

export default function PartnersPanel() {
  const [affiliates, setAffiliates] = useState(null);
  const [error, setError] = useState("");
  const [occupe, setOccupe] = useState(null);
  const [tauxParId, setTauxParId] = useState({});

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/affiliates");
      const data = await res.json();
      if (data.error) return setError(data.error);
      setAffiliates(data.affiliates);
    } catch {
      setError("Impossible de charger les partenaires.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function action(body) {
    setOccupe(body.id);
    try {
      const res = await fetch("/api/affiliates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) return setError(data.error);
      await load();
    } catch {
      setError("La modification n'a pas été enregistrée.");
    } finally {
      setOccupe(null);
    }
  }

  if (error) return <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">{error}</p>;
  if (!affiliates) return <p className="text-sm text-zinc-500">Chargement…</p>;

  const enAttente = affiliates.filter((a) => a.status === "en_attente");
  const actifs = affiliates.filter((a) => a.status === "actif");
  const inactifs = affiliates.filter((a) => a.status === "refuse" || a.status === "suspendu");

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">
          Candidatures en attente
          {enAttente.length > 0 && (
            <span className="chiffre ml-2 rounded-full bg-acid px-2 py-0.5 text-xs text-white">{enAttente.length}</span>
          )}
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          {enAttente.length === 0 && <p className="text-sm text-zinc-500">Aucune candidature en attente.</p>}
          {enAttente.map((a) => (
            <Carte key={a.id} a={a}>
              <label className="text-xs text-zinc-500">
                Commission
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={tauxParId[a.id] ?? 10}
                  onChange={(e) => setTauxParId((t) => ({ ...t, [a.id]: e.target.value }))}
                  className="ml-2 w-16 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-acid"
                />
                %
              </label>
              <Bouton
                ton="principal"
                disabled={occupe === a.id}
                onClick={() => action({ action: "approuver", id: a.id, commissionPercent: Number(tauxParId[a.id] ?? 10) })}
              >
                Approuver
              </Bouton>
              <Bouton ton="danger" disabled={occupe === a.id} onClick={() => action({ action: "refuser", id: a.id })}>
                Refuser
              </Bouton>
            </Carte>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Partenaires actifs</h2>
        <div className="mt-4 flex flex-col gap-3">
          {actifs.length === 0 && <p className="text-sm text-zinc-500">Aucun partenaire actif pour l'instant.</p>}
          {actifs.map((a) => (
            <Carte key={a.id} a={a}>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                Code <span className="font-bold text-white">{a.promoCode}</span> · <span className="chiffre">{a.commissionPercent}%</span>
              </span>
              <span className="text-xs text-zinc-500">
                Dû <span className="chiffre">{formatPrice(a.dueCents)}</span> · Versé <span className="chiffre">{formatPrice(a.paidCents)}</span>
              </span>
              <span className={`text-xs font-semibold ${a.stripePayoutsEnabled ? "text-emerald-400" : "text-zinc-500"}`}>
                {a.stripePayoutsEnabled ? "Stripe connecté" : "Stripe non connecté"}
              </span>
              <Bouton ton="danger" disabled={occupe === a.id} onClick={() => action({ action: "suspendre", id: a.id })}>
                Suspendre
              </Bouton>
            </Carte>
          ))}
        </div>
      </section>

      {inactifs.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-slate-deep p-5">
          <h2 className="font-display text-base font-bold text-white">Refusés / suspendus</h2>
          <div className="mt-4 flex flex-col gap-3">
            {inactifs.map((a) => (
              <Carte key={a.id} a={a}>
                <span className="text-xs text-zinc-500">Statut : {a.status === "refuse" ? "Refusé" : "Suspendu"}</span>
                {a.status === "suspendu" && (
                  <Bouton ton="principal" disabled={occupe === a.id} onClick={() => action({ action: "reactiver", id: a.id })}>
                    Réactiver
                  </Bouton>
                )}
              </Carte>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
