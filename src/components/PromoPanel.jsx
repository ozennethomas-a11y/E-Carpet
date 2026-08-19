import { useEffect, useState, useCallback } from "react";

const STATUT_LABEL = {
  actif: "Actif",
  epuise: "Épuisé",
  expire: "Expiré",
  desactive: "Désactivé",
};

const STATUT_COULEUR = {
  actif: "text-emerald-400",
  epuise: "text-amber-400",
  expire: "text-zinc-500",
  desactive: "text-zinc-500",
};

function formatValeur(c) {
  return c.type === "percent" ? `${c.value}%` : `${(c.value / 100).toFixed(2)} €`;
}

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

const SOURCE_LABEL = {
  avis_photo: "Auto · récompense avis photo",
  affilie: "Auto · partenaire affilié",
};

const EMPTY_FORM = {
  code: "",
  type: "percent",
  value: "",
  usage: "1", // "1" | "illimite"
  duree: "illimite", // "date" | "illimite"
  expiresAt: "",
};

export default function PromoPanel() {
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [dernierCode, setDernierCode] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/promo");
      const data = await res.json();
      if (data.error) return setError(data.error);
      setCodes(data.codes);
    } catch {
      setError("Impossible de charger les codes promo.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function creer(e) {
    e.preventDefault();
    setFormError("");
    setDernierCode(null);
    if (!form.value || Number(form.value) <= 0) return setFormError("Indiquez une valeur supérieure à 0.");
    if (form.type === "percent" && Number(form.value) > 100) return setFormError("Un pourcentage ne peut pas dépasser 100.");
    if (form.duree === "date" && !form.expiresAt) return setFormError("Choisissez une date d'expiration.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          code: form.code,
          type: form.type,
          value: Number(form.value),
          maxUses: form.usage === "illimite" ? null : 1,
          expiresAt: form.duree === "date" ? form.expiresAt : null,
        }),
      });
      const data = await res.json();
      if (data.error) return setFormError(data.error);
      setDernierCode(data.code.code);
      setForm(EMPTY_FORM);
      load();
    } catch {
      setFormError("Échec de la création.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(id, active) {
    await fetch("/api/promo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "toggle", id, active }),
    });
    load();
  }

  if (error) return <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">{error}</p>;

  const actifs = codes?.filter((c) => c.status === "actif") || [];
  const anciens = codes?.filter((c) => c.status !== "actif") || [];

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={creer} className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Créer un code</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Code (laisser vide pour générer)</label>
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="Auto-généré si vide"
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Type de réduction</label>
            <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
              {[{ id: "percent", label: "Pourcentage" }, { id: "fixed", label: "Montant fixe" }].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t.id }))}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    form.type === t.id ? "bg-acid text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Valeur {form.type === "percent" ? "(%)" : "(€)"}
            </label>
            <input
              type="number"
              min="0"
              step={form.type === "percent" ? "1" : "0.01"}
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder={form.type === "percent" ? "10" : "5.00"}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Nombre d'utilisations</label>
            <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
              {[{ id: "1", label: "1 fois" }, { id: "illimite", label: "Illimité" }].map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, usage: u.id }))}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    form.usage === u.id ? "bg-acid text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Durée de validité</label>
            <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
              {[{ id: "illimite", label: "Illimitée" }, { id: "date", label: "Jusqu'à une date" }].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, duree: d.id }))}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    form.duree === d.id ? "bg-acid text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {form.duree === "date" && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Expire le</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
              />
            </div>
          )}
        </div>

        {formError && <p className="mt-3 text-xs text-red-400">{formError}</p>}
        {dernierCode && (
          <p className="mt-3 text-xs text-emerald-400">
            Code créé : <span className="font-display font-bold">{dernierCode}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded-full bg-acid px-5 py-2 font-display text-sm font-bold text-white disabled:opacity-60"
        >
          {submitting ? "Création…" : "Créer le code"}
        </button>
      </form>

      {!codes ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : (
        <>
          <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
            <h2 className="font-display text-base font-bold text-white">
              Codes actifs {actifs.length > 0 && <span className="chiffre ml-2 rounded-full bg-acid px-2 py-0.5 text-xs text-white">{actifs.length}</span>}
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              {actifs.length === 0 && <p className="text-sm text-zinc-500">Aucun code actif pour l'instant.</p>}
              {actifs.map((c) => (
                <CodeRow key={c.id} code={c} onToggle={toggle} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
            <h2 className="font-display text-base font-bold text-white">Anciens codes</h2>
            <div className="mt-4 flex flex-col gap-2">
              {anciens.length === 0 && <p className="text-sm text-zinc-500">Aucun code expiré, épuisé ou désactivé.</p>}
              {anciens.map((c) => (
                <CodeRow key={c.id} code={c} onToggle={toggle} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CodeRow({ code, onToggle }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-ink p-4">
      <div>
        <div className="flex items-center gap-2">
          <div className="font-display text-sm font-bold text-white">{code.code}</div>
          {SOURCE_LABEL[code.source] && (
            <span className="rounded-full border border-acid/30 px-2 py-0.5 text-[10px] font-semibold text-acid">
              {SOURCE_LABEL[code.source]}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          <span className="chiffre">{formatValeur(code)}</span> ·{" "}
          <strong className="chiffre text-zinc-300">
            {code.usedCount} utilisation{code.usedCount > 1 ? "s" : ""}
          </strong>
          {" "}(<span className="chiffre">{code.maxUses ?? "illimité"}</span>) ·{" "}
          {code.expiresAt ? `expire le ${formatDate(code.expiresAt)}` : "sans expiration"}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`font-display text-xs font-bold ${STATUT_COULEUR[code.status]}`}>{STATUT_LABEL[code.status]}</span>
        {code.status !== "expire" && code.status !== "epuise" && (
          <button
            onClick={() => onToggle(code.id, !code.active)}
            className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-400 transition-colors hover:text-white"
          >
            {code.active ? "Désactiver" : "Réactiver"}
          </button>
        )}
      </div>
    </div>
  );
}
