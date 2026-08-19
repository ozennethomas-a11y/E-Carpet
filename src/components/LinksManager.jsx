import { useEffect, useState, useCallback } from "react";

const SUGGESTIONS = ["tiktok", "instagram", "youtube", "facebook", "snapchat", "email", "qrcode", "colis", "flyer", "amazon"];

// Mirrors shared/sources.mjs so the live preview matches what the server saves.
const PRETTY = {
  tiktok: "TikTok", instagram: "Instagram", insta: "Instagram", ig: "Instagram",
  facebook: "Facebook", fb: "Facebook", youtube: "YouTube", snapchat: "Snapchat",
  pinterest: "Pinterest", amazon: "Amazon", google: "Google", linkedin: "LinkedIn",
  x: "X", twitter: "X", email: "E-mail", qrcode: "QR code", colis: "Colis", flyer: "Flyer",
};

const slug = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const pretty = (s) => (s ? PRETTY[s] || s.charAt(0).toUpperCase() + s.slice(1) : "");

export default function LinksManager({ campaigns = [] }) {
  const [links, setLinks] = useState([]);
  const [source, setSource] = useState("");
  const [campaign, setCampaign] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);

  const visitsFor = (label) => campaigns.find((c) => c.label === label)?.value ?? 0;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/links");
      if (res.ok) setLinks((await res.json()).links || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const s = slug(source);
  const c = slug(campaign);
  const preview = s ? `https://e-carpet.shop/?utm_source=${s}${c ? `&utm_campaign=${c}` : ""}` : "";

  const add = async (e) => {
    e.preventDefault();
    setError("");
    if (!s) return setError("Indiquez au moins une source (ex. tiktok).");
    setBusy(true);
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: s, campaign: c, note }),
      });
      if (res.status === 409) setError("Ce lien existe déjà.");
      else if (!res.ok) setError("Impossible d'enregistrer ce lien.");
      else {
        setSource("");
        setCampaign("");
        setNote("");
        await load();
      }
    } catch {
      setError("Erreur réseau.");
    }
    setBusy(false);
  };

  const remove = async (id) => {
    setLinks((l) => l.filter((x) => x.id !== id)); // optimistic
    await fetch(`/api/links?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  const copy = async (link) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(link.id);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <>
      {/* Create */}
      <form onSubmit={add} className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Créer un lien</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Un lien par emplacement (bio TikTok, story, influenceur…) pour savoir d'où viennent vos visiteurs.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-400">Source *</span>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              list="sources-suggestions"
              placeholder="tiktok"
              className="rounded-xl border border-white/10 bg-ink px-4 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60"
            />
            <datalist id="sources-suggestions">
              {SUGGESTIONS.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-400">Emplacement</span>
            <input
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder="bio"
              className="rounded-xl border border-white/10 bg-ink px-4 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-400">Note (optionnel)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bio du profil TikTok"
              className="rounded-xl border border-white/10 bg-ink px-4 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60"
            />
          </label>
        </div>

        {preview && (
          <div className="mt-4 rounded-xl border border-white/10 bg-ink p-3">
            <div className="text-xs text-zinc-500">Aperçu · apparaîtra sous le nom «&nbsp;{pretty(s)}{c ? ` · ${c}` : ""}&nbsp;»</div>
            <code className="mt-1 block break-all text-xs text-acid">{preview}</code>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-full bg-acid px-6 py-3 font-display text-sm font-bold text-white transition-shadow hover:shadow-[0_0_30px_-8px_rgba(224,106,59,0.7)] disabled:opacity-60 cursor-pointer"
        >
          {busy ? "Enregistrement…" : "Ajouter le lien"}
        </button>
      </form>

      {/* List */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="mb-4 font-display text-base font-bold text-white">
          Mes liens {links.length > 0 && <span className="text-zinc-500">({links.length})</span>}
        </h2>

        {links.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Aucun lien enregistré. Créez le premier ci-dessus, par exemple source «&nbsp;tiktok&nbsp;» et emplacement «&nbsp;bio&nbsp;».
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {links.map((l) => (
              <li key={l.id} className="rounded-xl border border-white/10 bg-ink p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold text-white">{l.label}</div>
                    {l.note && <div className="mt-0.5 text-xs text-zinc-500">{l.note}</div>}
                    <code className="mt-2 block break-all text-xs text-zinc-400">{l.url}</code>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-300">
                      <span className="font-display font-bold text-white tabular-nums">{visitsFor(l.label)}</span> visite
                      {visitsFor(l.label) > 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => copy(l)}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-acid/40 hover:text-white cursor-pointer"
                    >
                      {copied === l.id ? "Copié !" : "Copier"}
                    </button>
                    <button
                      onClick={() => remove(l.id)}
                      aria-label={`Supprimer le lien ${l.label}`}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-400 cursor-pointer"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 text-xs leading-relaxed text-zinc-600">
          Le nombre de visites correspond à la période choisie dans l'onglet Analyse. Supprimer un lien ici ne
          supprime pas les visites déjà enregistrées : cela retire seulement le lien de cette liste.
        </p>
      </div>
    </>
  );
}
