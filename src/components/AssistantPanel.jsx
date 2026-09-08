import { useEffect, useRef, useState } from "react";

// Questions proposées au premier affichage : elles montrent ce que l'assistant
// sait faire mieux qu'un texte d'explication.
const EXEMPLES = [
  "Quel est mon chiffre d'affaires sur les 30 derniers jours ?",
  "Combien de stock me reste-t-il, et quand vais-je être en rupture ?",
  "Quels sont mes meilleurs clients ?",
  "Où en est le suivi des influenceurs ?",
];

// Noms d'outils rendus lisibles pour l'affichage « sources consultées ».
const LABEL_OUTIL = {
  ventes_periode: "ventes de la période",
  ventes_par_mois: "ventes par mois",
  commandes_recentes: "commandes récentes",
  stock_actuel: "stock",
  depenses_periode: "dépenses",
  lots_couts: "coûts par lot",
  clients_top: "clients",
  affilies_performance: "affiliés",
  influenceurs_suivi: "influenceurs",
  codes_promo: "codes promo",
};

function Bulle({ message }) {
  const estMoi = message.role === "user";
  return (
    <div className={`flex ${estMoi ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          estMoi ? "bg-acid text-white" : "border border-white/10 bg-slate-deep text-zinc-200"
        }`}
      >
        {message.content}
        {!estMoi && message.outils?.length > 0 && (
          <div className="mt-2.5 border-t border-white/10 pt-2 text-xs text-zinc-500">
            Données consultées : {message.outils.map((o) => LABEL_OUTIL[o] || o).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

const OLLAMA_URL = "http://localhost:11434";
const MODELE_LOCAL = "qwen2.5:7b"; // modèle léger qui sait appeler des outils

// Boucle de conversation en mode LOCAL : le modèle tourne sur la machine de
// l'admin (Ollama, gratuit), donc c'est le navigateur qui orchestre. Les outils
// restent exécutés côté serveur — le navigateur n'a jamais accès à la base.
async function repondreEnLocal(historique, onOutil) {
  const cfg = await fetch("/api/assistant?action=outils").then((r) => r.json());
  const outils = cfg.outils.map((o) => ({
    type: "function",
    function: { name: o.name, description: o.description, parameters: o.input_schema },
  }));

  const messages = [
    { role: "system", content: cfg.systeme },
    ...historique.map(({ role, content }) => ({ role, content })),
  ];

  for (let i = 0; i < 4; i++) {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: MODELE_LOCAL, messages, tools: outils, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama a répondu ${res.status}`);
    const data = await res.json();
    const msg = data.message || {};
    messages.push(msg);

    const appels = msg.tool_calls || [];
    if (appels.length === 0) {
      return { reply: msg.content || "Pas de réponse.", outils: [] };
    }

    for (const appel of appels) {
      const nom = appel.function?.name;
      onOutil?.(nom);
      const resultat = await fetch("/api/assistant?action=outil", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nom, input: appel.function?.arguments || {} }),
      }).then((r) => r.json());
      // tool_call_id : renseigné quand Ollama le fournit, ignoré sinon.
      messages.push({ role: "tool", tool_call_id: appel.id, content: JSON.stringify(resultat) });
    }
  }
  return { reply: "Trop d'allers-retours, reformulez la question plus précisément.", outils: [] };
}

export default function AssistantPanel() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [cleManquante, setCleManquante] = useState(false);
  const [modeLocal, setModeLocal] = useState(false);
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, enCours]);

  async function envoyer(texte) {
    const contenu = (texte ?? question).trim();
    if (!contenu || enCours) return;

    setErreur("");
    setQuestion("");
    const suite = [...messages, { role: "user", content: contenu }];
    setMessages(suite);
    setEnCours(true);

    try {
      if (modeLocal) {
        const outilsVus = [];
        const r = await repondreEnLocal(suite, (nom) => outilsVus.push(nom));
        setMessages([...suite, { role: "assistant", content: r.reply, outils: [...new Set(outilsVus)] }]);
        return;
      }

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // On n'envoie que le fil de la conversation, sans les métadonnées
        // d'affichage (outils consultés).
        body: JSON.stringify({ messages: suite.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();

      if (data.error === "missing_credentials") {
        setCleManquante(true);
        setMessages(messages);
        return;
      }
      if (data.error) {
        setErreur(data.error);
        setMessages(messages);
        return;
      }
      setMessages([...suite, { role: "assistant", content: data.reply, outils: data.outils || [] }]);
    } catch (e) {
      setErreur(
        modeLocal
          ? `Impossible de joindre Ollama sur votre machine (${e.message}). Vérifiez qu'il tourne et qu'il autorise ce site (voir les instructions ci-dessous).`
          : "Le serveur n'a pas répondu.",
      );
      setMessages(messages);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-white/10 bg-slate-deep p-4">
        <p className="text-xs leading-relaxed text-zinc-400">
          Posez une question sur vos données réelles : ventes, stock, clients, coûts, affiliés,
          influenceurs. L'assistant lit la base pour répondre et indique à chaque fois les données
          qu'il a consultées. Il ne peut rien modifier — lecture seule.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Modèle :</span>
          {[
            { id: false, label: "Cloud (~0,5 centime / question)" },
            { id: true, label: "Local (gratuit)" },
          ].map((m) => (
            <button
              key={String(m.id)}
              onClick={() => setModeLocal(m.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                modeLocal === m.id
                  ? "bg-acid text-white"
                  : "border border-white/15 text-zinc-400 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {modeLocal && (
        <div className="rounded-2xl border border-white/10 bg-ink p-4 text-xs leading-relaxed text-zinc-400">
          <div className="font-semibold text-white">Mode local — à installer une fois sur votre Mac</div>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              Installer Ollama depuis <span className="text-zinc-300">ollama.com</span>, puis télécharger le
              modèle : <code className="rounded bg-black/40 px-1 text-acid">ollama pull {MODELE_LOCAL}</code>
            </li>
            {window.location.hostname === "localhost" ? (
              <li>
                Rien d'autre à faire : Ollama autorise déjà les adresses locales. Il doit simplement
                être lancé.
              </li>
            ) : (
              <li>
                Autoriser ce site à joindre Ollama, sinon le navigateur bloque la requête. Sur Mac, une
                fois pour toutes :{" "}
                <code className="rounded bg-black/40 px-1 text-acid">
                  launchctl setenv OLLAMA_ORIGINS "{window.location.origin}"
                </code>{" "}
                puis quitter Ollama (icône dans la barre de menu) et le relancer. Sans ce redémarrage,
                le réglage n'est pas pris en compte.
              </li>
            )}
          </ol>
          <p className="mt-2 text-zinc-500">
            Le modèle tourne alors sur votre machine : aucun coût, aucune donnée envoyée à un service
            externe. En contrepartie il est moins fin que le mode cloud, et ne fonctionne que depuis
            cet ordinateur, allumé et Ollama lancé.
          </p>
        </div>
      )}

      {cleManquante && !modeLocal && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs leading-relaxed text-zinc-300">
          <div className="font-semibold text-white">Clé API manquante pour le mode cloud</div>
          <p className="mt-1">
            Créez une clé sur <span className="text-white">console.anthropic.com</span> et ajoutez-la dans
            les variables d'environnement Netlify sous le nom{" "}
            <code className="rounded bg-black/40 px-1 text-acid">ANTHROPIC_API_KEY</code>. Ou basculez sur
            le mode local, gratuit.
          </p>
        </div>
      )}

      {messages.length === 0 ? (
        <div className="flex flex-col gap-2">
          {EXEMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => envoyer(ex)}
              className="rounded-xl border border-white/10 bg-ink px-4 py-3 text-left text-sm text-zinc-300 transition-colors hover:border-acid/40 hover:text-white cursor-pointer"
            >
              {ex}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <Bulle key={i} message={m} />
          ))}
        </div>
      )}

      {enCours && <p className="text-sm text-zinc-500">L'assistant consulte vos données…</p>}
      {erreur && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{erreur}</p>
      )}
      <div ref={finRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          envoyer();
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Poser une question…"
          className="flex-1 rounded-full border border-white/15 bg-ink px-5 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60"
        />
        <button
          type="submit"
          disabled={enCours || !question.trim()}
          className="rounded-full bg-acid px-6 py-3 font-display text-sm font-bold text-white transition-colors hover:opacity-90 disabled:opacity-40 cursor-pointer"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
