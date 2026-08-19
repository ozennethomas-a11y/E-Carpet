// Microsoft Graph (boîte Outlook e-carpet@outlook.com), utilisé par mail-alerts.mjs.

const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPE = "offline_access Mail.ReadWrite";

// Règles de classement, évaluées dans cet ordre (la première qui correspond gagne).
// "Client" est la catégorie par défaut si rien d'autre ne correspond, puisqu'un
// expéditeur externe inconnu est le plus souvent un client.
const REGLES = [
  { categorie: "Urgent", test: (m) => m.importance === "high" },
  {
    categorie: "Banque / Finance",
    test: (m) => /stripe|banque|virement|relevé|prélèvement|facture bancaire/i.test(m.texte),
  },
  { categorie: "Amazon / Marketplaces", test: (m) => /amazon|seller.?central/i.test(m.texte) },
  {
    categorie: "Fournisseur",
    test: (m) => /facture fournisseur|commande fournisseur|bon de livraison|expédition/i.test(m.texte),
  },
  {
    categorie: "Marketing / Pub",
    test: (m) => m.listUnsubscribe || /newsletter|promo(tion)?|désabonn/i.test(m.texte),
  },
];

export function credentials() {
  const need = ["OUTLOOK_CLIENT_ID", "OUTLOOK_CLIENT_SECRET", "OUTLOOK_REFRESH_TOKEN"];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) return { missing };
  return {
    clientId: process.env.OUTLOOK_CLIENT_ID,
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
    refreshToken: process.env.OUTLOOK_REFRESH_TOKEN,
  };
}

export async function getAccessToken(c) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: c.refreshToken,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      scope: SCOPE,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      json.error === "invalid_grant"
        ? "refresh token Outlook invalide ou révoqué : relancez scripts/outlook-mail-token.mjs"
        : json.error_description || json.error || "échec de l'authentification Outlook",
    );
  }
  return json.access_token;
}

function classer(message) {
  const texte = `${message.subject || ""} ${message.bodyPreview || ""} ${message.from?.emailAddress?.address || ""}`.toLowerCase();
  const listUnsubscribe = (message.internetMessageHeaders || []).some((h) => h.name?.toLowerCase() === "list-unsubscribe");
  const contexte = { texte, listUnsubscribe, importance: message.importance };
  const regle = REGLES.find((r) => r.test(contexte));
  return regle?.categorie || "Client";
}

/** Récupère les mails non lus, les classe, et applique la catégorie dans Outlook si absente. */
export async function mailsImportants(token) {
  const params = new URLSearchParams({
    "$filter": "isRead eq false",
    "$select": "id,subject,from,receivedDateTime,importance,bodyPreview,categories,internetMessageHeaders",
    "$top": "50",
    "$orderby": "receivedDateTime desc",
  });
  const res = await fetch(`${GRAPH}/me/mailFolders/inbox/messages?${params}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `erreur HTTP ${res.status}`);

  const mails = [];
  for (const m of json.value || []) {
    const categorie = classer(m);
    if (!(m.categories || []).includes(categorie)) {
      await fetch(`${GRAPH}/me/messages/${m.id}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ categories: [...(m.categories || []), categorie] }),
      }).catch(() => {}); // le classement est une aide, pas un blocage si Graph refuse
    }
    mails.push({
      id: m.id,
      sujet: m.subject,
      expediteur: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "(inconnu)",
      email: m.from?.emailAddress?.address,
      recu: m.receivedDateTime,
      urgent: m.importance === "high",
      categorie,
      apercu: m.bodyPreview,
    });
  }
  return mails;
}
