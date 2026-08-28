import { useEffect, useState, useCallback } from "react";
import { cachedFetch } from "../lib/adminCache";

const COULEURS = {
  Urgent: "border-red-400/30 bg-red-400/10 text-red-300",
  "Banque / Finance": "border-amber-400/30 bg-amber-400/10 text-amber-300",
  "Amazon / Marketplaces": "border-orange-400/30 bg-orange-400/10 text-orange-300",
  Fournisseur: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  "Marketing / Pub": "border-zinc-400/30 bg-zinc-400/10 text-zinc-400",
  Client: "border-acid/30 bg-acid/10 text-acid",
};

export default function MailAlertsPanel({ limit }) {
  const [mails, setMails] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [erreur, setErreur] = useState("");

  const load = useCallback(async () => {
    setErreur("");
    try {
      const data = await cachedFetch("/api/mail-alerts");
      if (data.error === "missing_credentials") return setConfigured(false);
      if (data.error) return setErreur(data.error);
      setMails(data.mails);
    } catch {
      setErreur("Impossible de charger les mails.");
    }
  }, []);

  const affiches = limit ? mails?.slice(0, limit) : mails;

  useEffect(() => {
    load();
  }, [load]);

  if (!configured) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-center">
        <p className="text-sm text-zinc-400">
          Boîte Outlook non connectée — variables <code className="text-acid">OUTLOOK_CLIENT_ID</code> /{" "}
          <code className="text-acid">OUTLOOK_CLIENT_SECRET</code> / <code className="text-acid">OUTLOOK_REFRESH_TOKEN</code>{" "}
          absentes.
        </p>
      </div>
    );
  }

  if (erreur) {
    return <p className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-sm text-red-300">{erreur}</p>;
  }

  if (!mails) return <p className="text-sm text-zinc-500">Chargement…</p>;

  if (mails.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-center">
        <p className="text-sm text-zinc-400">Aucun mail non lu — boîte à jour.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-zinc-500">Mails importants</div>
        <button onClick={load} className="text-xs text-zinc-500 underline hover:text-white">
          actualiser
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {affiches.map((m) => (
          <a
            key={m.id}
            href={`https://outlook.live.com/mail/0/inbox/id/${encodeURIComponent(m.id)}`}
            target="_blank"
            rel="noreferrer"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-3 hover:border-white/20"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${COULEURS[m.categorie] || COULEURS.Client}`}>
                  {m.categorie}
                </span>
                <span className="truncate text-sm font-semibold text-white">{m.sujet || "(sans sujet)"}</span>
              </div>
              <div className="mt-1 truncate text-xs text-zinc-500">
                {m.expediteur} · {new Date(m.recu).toLocaleString("fr-FR")}
              </div>
            </div>
          </a>
        ))}
      </div>
      {limit && mails.length > limit && (
        <a
          href="/admin/mails"
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-center text-xs text-zinc-500 underline hover:text-white"
        >
          Voir plus ({mails.length - limit} de plus)
        </a>
      )}
    </div>
  );
}
