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

const MOTIF_LABEL = {
  numero: "numéro de commande cité",
  email: "adresse de l'expéditeur",
};

// Bloc SAV : commande rapprochée s'il y en a une, et brouillon à copier.
// Le brouillon ne part jamais d'ici : il n'existe aucun bouton d'envoi, le
// propriétaire colle le texte dans Outlook et envoie lui-même.
function BlocSav({ mail }) {
  const [texte, setTexte] = useState(mail.brouillon.corps);
  const [copie, setCopie] = useState(false);
  const r = mail.rapprochement;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      setCopie(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
      {r ? (
        <div className="text-xs">
          <span className="font-bold text-white">Commande n°{r.orderNumber}</span>
          <span className="text-zinc-400">
            {" "}
            · {r.statusLabel}
            {r.trackingNumber ? ` · suivi ${r.trackingNumber}${r.trackingCarrier ? ` (${r.trackingCarrier})` : ""}` : ""}
          </span>
          <div className="mt-0.5 text-[11px] text-zinc-500">Rapprochée par {MOTIF_LABEL[r.motif] || r.motif}.</div>
          {r.avertissement && <div className="mt-1 text-[11px] text-amber-300">{r.avertissement}</div>}
        </div>
      ) : (
        <div className="text-xs text-zinc-500">Aucune commande identifiée pour cet expéditeur.</div>
      )}

      <div className="mt-3 text-[11px] uppercase tracking-wider text-zinc-500">Brouillon · objet : {mail.brouillon.objet}</div>
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={Math.min(18, texte.split("\n").length + 1)}
        className="mt-1 w-full rounded-lg border border-white/10 bg-ink p-3 text-xs leading-relaxed text-zinc-300 focus:border-acid/50 focus:outline-none"
      />

      {mail.brouillon.aCompleter.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-amber-300">
          {mail.brouillon.aCompleter.map((c) => (
            <li key={c}>À vérifier : {c}</li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={copier}
          className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-zinc-300 hover:border-acid hover:text-white cursor-pointer"
        >
          {copie ? "Copié" : "Copier le brouillon"}
        </button>
        <span className="text-[11px] text-zinc-600">Relisez avant d'envoyer depuis Outlook.</span>
      </div>
    </div>
  );
}

export default function MailAlertsPanel({ limit }) {
  const [mails, setMails] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [erreur, setErreur] = useState("");
  const [ouvert, setOuvert] = useState(null);

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
        <button onClick={load} className="text-xs text-zinc-500 underline hover:text-white cursor-pointer">
          actualiser
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {affiches.map((m) => (
          <div key={m.id} className="rounded-lg border border-white/10 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${COULEURS[m.categorie] || COULEURS.Client}`}>
                    {m.categorie}
                  </span>
                  {m.rapprochement && (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      n°{m.rapprochement.orderNumber}
                    </span>
                  )}
                  <span className="truncate text-sm font-semibold text-white">{m.sujet || "(sans sujet)"}</span>
                </div>
                <div className="mt-1 truncate text-xs text-zinc-500">
                  {m.expediteur} · {new Date(m.recu).toLocaleString("fr-FR")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                {m.brouillon && (
                  <button
                    onClick={() => setOuvert(ouvert === m.id ? null : m.id)}
                    className="text-acid underline hover:text-white cursor-pointer"
                  >
                    {ouvert === m.id ? "masquer" : "répondre"}
                  </button>
                )}
                <a
                  href={`https://outlook.live.com/mail/0/inbox/id/${encodeURIComponent(m.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-500 underline hover:text-white"
                >
                  ouvrir
                </a>
              </div>
            </div>
            {ouvert === m.id && m.brouillon && <BlocSav mail={m} />}
          </div>
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
