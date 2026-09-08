import Anthropic from "@anthropic-ai/sdk";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { definitionsOutils, executerOutil } from "./lib/_assistantTools.mjs";

// Assistant conversationnel du back-office : répond aux questions sur les
// données réelles de l'entreprise en interrogeant la base via des outils de
// LECTURE SEULE (voir lib/_assistantTools.mjs).
//
// Choix d'architecture :
//  - Boucle d'outils écrite à la main plutôt que le "tool runner" du SDK :
//    on a besoin d'un plafond d'itérations strict (la fonction Netlify a un
//    temps d'exécution limité) et de journaliser chaque appel d'outil.
//  - Aucune écriture possible : l'assistant ne peut pas modifier une commande,
//    un prix ou un stock. Il lit, il répond.

// Haiku 4.5 : choisi pour le coût (~1 centime par question, ~5x moins qu'Opus)
// et surtout pour la latence — Opus 5 dépassait systématiquement le temps
// d'exécution maximal d'une fonction Netlify, même sur une question simple.
// Lire des chiffres et les commenter ne demande pas un modèle de raisonnement.
// Attention : ce modèle n'accepte NI output_config.effort NI thinking adaptatif
// (erreur 400) — d'où l'absence de ces paramètres dans l'appel ci-dessous.
const MODELE = "claude-haiku-4-5";
const MAX_ITERATIONS = 4; // plafond dur : au-delà, on rend la main plutôt que d'expirer
const MAX_MESSAGES = 24; // historique conservé, pour borner le coût d'un long échange

// Contexte métier donné au modèle. Les limites connues des données y figurent
// explicitement : sans ça, l'assistant répondrait avec assurance sur des
// chiffres que le système ne voit pas (voir le rapport de rapprochement
// bancaire), ce qui est pire que de ne pas répondre.
const SYSTEME = `Tu es l'assistant du back-office d'E-Carpet, une entreprise française qui vend un tapis de protection en silicone pour trottinettes électriques (produit unique, 34,99 €), via son site et via Amazon.

Tu réponds à Thomas, le fondateur, en français, de façon directe et concise.

Règles de fond :
- Tu ne réponds JAMAIS de mémoire sur un chiffre : tu appelles les outils pour lire les données réelles, puis tu réponds à partir de ce qu'ils renvoient.
- Tous les montants renvoyés par les outils sont en CENTIMES. Convertis-les en euros dans ta réponse (ex : 3499 → 34,99 €).
- Si un outil ne renvoie rien ou échoue, dis-le clairement. Ne comble jamais un trou par une estimation présentée comme un fait.
- RÈGLE ABSOLUE : si un résultat d'outil contient un champ "limites", tu DOIS reprendre ces limites dans ta réponse, en une ou deux lignes à la fin. Ce n'est pas optionnel : ces chiffres seraient trompeurs sans elles. Même chose si "commandes_exclues" est supérieur à 0 : dis combien de commandes ne sont pas comptées.
- Quand un chiffre mérite une nuance, donne-la brièvement plutôt que de laisser croire à une précision qu'il n'a pas.

Limites connues des données, à signaler quand elles rendent une réponse partielle :
- Les ventes PayPal et les ventes B2B directes (MF-World) ne sont PAS dans le système : historiquement elles représentaient une grande partie du chiffre d'affaires client. Toute question sur le CA total est donc minorée.
- Le coût d'expédition réel n'est renseigné que sur une partie des commandes ; le reste est estimé ailleurs dans le back-office à un tarif moyen.
- Les achats de stock fournisseur ne sont pas tous saisis, donc une marge calculée ici peut être optimiste.

Dates : tu ne connais pas la date du jour par toi-même, elle t'est donnée ci-dessous. Pour une question du type "ce mois-ci", "les 30 derniers jours", "cette année", calcule les bornes à partir de CETTE date, jamais d'une date supposée. En cas de doute, n'envoie pas de dates du tout : les outils utilisent alors les 30 derniers jours par défaut. Vérifie toujours le champ "periode" que l'outil te renvoie : s'il ne correspond pas à ce que demandait la question, refais l'appel avec les bonnes bornes plutôt que de commenter le mauvais résultat.

Style : pas de préambule, pas de reformulation de la question. Tu vas droit au chiffre et à ce qu'il implique.

Format : texte brut uniquement. N'utilise NI markdown (pas de **gras**, pas de #, pas de \`code\`), NI tableau — la réponse est affichée telle quelle, les symboles de mise en forme apparaîtraient en clair. Pour une liste, une simple ligne commençant par un tiret suffit.`;

// La date du jour doit être injectée à chaque appel : aucun modèle ne la
// connaît, et sans elle un "les 30 derniers jours" est interprété au hasard
// (constaté en test : un modèle local a calculé sur mars 2023 et annoncé 0 €
// avec assurance). Effet de bord assumé : le préfixe change chaque jour, donc
// la mise en cache ne peut porter que sur une journée — la justesse prime.
function systeme() {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return `${SYSTEME}\n\nDate du jour : ${aujourdhui}.`;
}

function clefApi() {
  return process.env.ANTHROPIC_API_KEY || null;
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // --- Mode local (gratuit) : le modèle tourne sur la machine de l'admin
  // (Ollama), donc la boucle de conversation vit dans le navigateur. Le serveur
  // ne fournit alors que deux choses : la liste des outils, et leur exécution.
  // La base de données n'est jamais exposée au navigateur, seulement le
  // résultat d'un outil nommé — mêmes garanties qu'en mode cloud.
  if (req.method === "GET" && action === "outils") {
    return Response.json({ outils: definitionsOutils(), systeme: systeme() });
  }

  if (req.method === "POST" && action === "outil") {
    const { name, input } = await req.json().catch(() => ({}));
    if (typeof name !== "string") return Response.json({ erreur: "nom d'outil manquant" }, { status: 400 });
    console.log("[assistant/local] outil:", name, JSON.stringify(input || {}));
    return Response.json(await executerOutil(name, input));
  }

  const apiKey = clefApi();
  if (!apiKey) {
    // Même convention que les autres intégrations (mail-alerts, social) :
    // on ne casse pas l'écran, on explique ce qui manque.
    return Response.json(
      { error: "missing_credentials", variables: ["ANTHROPIC_API_KEY"] },
      { status: 200 },
    );
  }

  if (req.method !== "POST") return Response.json({ error: "méthode non supportée" }, { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "requête invalide" }, { status: 400 });
  }

  const historique = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  if (historique.length === 0) return Response.json({ error: "aucun message" }, { status: 400 });

  const client = new Anthropic({ apiKey });
  const messages = historique.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 4000),
  }));

  // Journal des outils consultés, renvoyé à l'écran : l'utilisateur voit sur
  // quelles données la réponse s'appuie, plutôt que de devoir faire confiance.
  const outilsConsultes = [];

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const reponse = await client.messages.create({
        model: MODELE,
        max_tokens: 2000,
        // Mise en cache du préfixe stable (consignes + outils). Mesuré le
        // 08/09/2026 : elle ne se déclenche PAS encore, le préfixe (~2 500
        // jetons) restant sous le minimum cachable du modèle. On la laisse en
        // place car elle prendra effet si les consignes ou les outils
        // grossissent. Coût constaté sans cache : ~0,5 centime par question.
        system: [{ type: "text", text: systeme(), cache_control: { type: "ephemeral" } }],
        tools: definitionsOutils(),
        messages,
      });

      const u = reponse.usage || {};
      console.log(
        "[assistant] tokens — entrée:", u.input_tokens,
        "cache_lu:", u.cache_read_input_tokens,
        "cache_ecrit:", u.cache_creation_input_tokens,
        "sortie:", u.output_tokens,
      );

      if (reponse.stop_reason === "refusal") {
        return Response.json({
          reply: "Je ne peux pas répondre à cette demande.",
          outils: outilsConsultes,
        });
      }

      if (reponse.stop_reason === "tool_use") {
        const appels = reponse.content.filter((b) => b.type === "tool_use");
        messages.push({ role: "assistant", content: reponse.content });

        const resultats = [];
        for (const appel of appels) {
          console.log("[assistant] outil:", appel.name, JSON.stringify(appel.input || {}));
          outilsConsultes.push(appel.name);
          const donnees = await executerOutil(appel.name, appel.input);
          resultats.push({
            type: "tool_result",
            tool_use_id: appel.id,
            content: JSON.stringify(donnees),
          });
        }
        messages.push({ role: "user", content: resultats });
        continue;
      }

      const texte = reponse.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      return Response.json({
        reply: texte || "Je n'ai pas réussi à formuler de réponse.",
        outils: [...new Set(outilsConsultes)],
      });
    }

    return Response.json({
      reply:
        "La question demande trop d'allers-retours pour être traitée d'un coup. Essayez de la découper en questions plus précises.",
      outils: [...new Set(outilsConsultes)],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "clé API Anthropic invalide" }, { status: 200 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "trop de requêtes, réessayez dans un instant" }, { status: 200 });
    }
    console.error("[assistant] échec:", e.message);
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/assistant" };
