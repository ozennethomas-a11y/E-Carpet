import { useEffect, useState, useCallback } from "react";

const MODELES = [
  {
    id: "black-friday",
    label: "Black Friday",
    subject: "Black Friday chez E-Carpet 🖤 -30% sur votre tapis",
    html: `<h2>Black Friday est là.</h2><p>Profitez de -30% sur l'E-Carpet avec le code <strong>BLACKFRIDAY</strong>, valable jusqu'à dimanche minuit.</p><p><a href="https://e-carpet.shop">Voir l'offre</a></p>`,
  },
  {
    id: "noel",
    label: "Noël",
    subject: "🎄 Le cadeau parfait pour tout rider",
    html: `<h2>Joyeuses fêtes !</h2><p>Offrez (ou offrez-vous) l'E-Carpet avant Noël. Livraison garantie avant le 24 décembre pour toute commande passée avant le 20.</p><p><a href="https://e-carpet.shop">Commander</a></p>`,
  },
  { id: "vierge", label: "Vierge", subject: "", html: "" },
];

export default function MailingPanel() {
  const [recipientCount, setRecipientCount] = useState(null);
  const [campagnes, setCampagnes] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [erreur, setErreur] = useState("");
  const [modele, setModele] = useState("black-friday");
  const [subject, setSubject] = useState(MODELES[0].subject);
  const [html, setHtml] = useState(MODELES[0].html);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [confirmation, setConfirmation] = useState(false);

  const load = useCallback(async () => {
    setErreur("");
    try {
      const res = await fetch("/api/mailing");
      const data = await res.json();
      if (data.error) return setErreur(data.error);
      setRecipientCount(data.recipientCount);
      setConfigured(data.emailConfigured);
      setCampagnes(data.campagnes || []);
    } catch {
      setErreur("Impossible de charger les destinataires.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function choisirModele(id) {
    const m = MODELES.find((x) => x.id === id);
    setModele(id);
    setSubject(m.subject);
    setHtml(m.html);
    setResultat(null);
    setConfirmation(false);
  }

  async function envoyer() {
    setErreur("");
    setResultat(null);
    if (!subject.trim() || !html.trim()) return setErreur("Le sujet et le contenu sont requis.");
    if (!confirmation) return setConfirmation(true);

    setEnvoi(true);
    try {
      const res = await fetch("/api/mailing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, html }),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setResultat(res);
      setConfirmation(false);
      load();
    } catch (e) {
      setErreur(e.message || "Échec de l'envoi.");
    } finally {
      setEnvoi(false);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-white/10 bg-ink p-6 text-center">
        <p className="text-sm text-zinc-400">BREVO_API_KEY absente — le mailing ne peut pas fonctionner tant que l'envoi d'emails n'est pas configuré.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">
        Envoyez une offre (Black Friday, Noël, ou autre) à tous vos clients enregistrés. Un lien de désinscription est ajouté
        automatiquement à chaque email.
      </p>

      <div className="rounded-xl border border-white/10 bg-ink p-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">Modèle</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {MODELES.map((m) => (
            <button
              key={m.id}
              onClick={() => choisirModele(m.id)}
              className={`rounded-full border px-4 py-1.5 font-display text-xs font-bold transition-colors ${
                modele === m.id ? "border-acid bg-acid/10 text-acid" : "border-white/15 text-zinc-400 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Sujet</div>
          <input
            type="text"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setConfirmation(false);
            }}
            className="mt-2 w-full rounded-lg border border-white/15 bg-transparent p-3 text-sm text-white placeholder:text-zinc-500 focus:border-acid focus:outline-none"
            placeholder="Objet de l'email"
          />
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Contenu (HTML)</div>
          <textarea
            value={html}
            onChange={(e) => {
              setHtml(e.target.value);
              setConfirmation(false);
            }}
            rows={10}
            className="mt-2 w-full rounded-lg border border-white/15 bg-transparent p-3 font-mono text-xs text-white placeholder:text-zinc-500 focus:border-acid focus:outline-none"
            placeholder="<h2>Titre</h2><p>Votre offre...</p>"
          />
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Aperçu</div>
          <div className="mt-2 rounded-lg border border-white/10 bg-white p-4 text-black" dangerouslySetInnerHTML={{ __html: html || "<p>—</p>" }} />
        </div>

        {erreur && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{erreur}</p>}

        {resultat && (
          <p className="mt-4 rounded-xl border border-acid/30 bg-acid/10 px-4 py-3 text-sm text-acid">
            Envoyé à <span className="chiffre">{resultat.envoyes}/{resultat.total}</span> client(s).
            {resultat.echecs?.length > 0 && <span className="chiffre"> {resultat.echecs.length} échec(s).</span>}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={envoyer}
            disabled={envoi}
            className={`rounded-full px-4 py-1.5 font-display text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${
              confirmation ? "bg-red-500 text-white" : "bg-acid text-white"
            }`}
          >
            {envoi
              ? "Envoi..."
              : confirmation
                ? <>Confirmer l'envoi à <span className="chiffre">{recipientCount ?? "…"}</span> client(s)</>
                : <>Envoyer à <span className="chiffre">{recipientCount ?? "…"}</span> client(s)</>}
          </button>
          {confirmation && (
            <button onClick={() => setConfirmation(false)} className="text-xs text-zinc-500 underline hover:text-white">
              annuler
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-ink p-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">Campagnes envoyées</div>
        {campagnes.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">Aucune campagne envoyée pour l'instant.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {campagnes.map((c) => {
              const taux = c.sent_count > 0 ? Math.round((c.open_count / c.sent_count) * 100) : 0;
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{c.subject}</div>
                    <div className="text-xs text-zinc-500">{new Date(c.sent_at).toLocaleString("fr-FR")}</div>
                  </div>
                  <div className="text-right text-xs text-zinc-400">
                    <div className="chiffre">
                      <span className="font-display font-bold text-white">{c.sent_count}</span>/{c.recipient_count} reçu(s)
                    </div>
                    <div className="chiffre">
                      <span className="font-display font-bold text-acid">{c.open_count}</span> ouvert(s) · {taux}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
