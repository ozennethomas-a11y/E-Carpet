import { sql } from "./lib/_db.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { decryptToken } from "./lib/_socialCrypto.mjs";

const META_API = "https://graph.facebook.com/v19.0";

// La gestion des publicités TikTok utilise une API et une app séparées
// ("TikTok for Business Ads"), distinctes de l'app Content Posting déjà
// configurée — non créée pour l'instant.
const RESEAUX_SUPPORTES = ["facebook", "instagram"];

async function compteConnecte(network) {
  const [row] = await sql()`select account_id, access_token_enc, meta from social_accounts where network = ${network}`;
  if (!row) return null;
  return { accountId: row.account_id, accessToken: await decryptToken(row.access_token_enc), meta: row.meta };
}

// Le compte publicitaire (act_XXXXX) rattaché à la Page ; nécessite que le
// jeton ait la permission ads_management (accordée par la config Meta Login
// for Business). Si absente, l'appel échoue avec un message Meta explicite,
// remonté tel quel plutôt que masqué.
async function compteAnnonceur(accessToken) {
  const res = await fetch(`${META_API}/me/adaccounts?fields=account_id,name&access_token=${accessToken}`).then((r) => r.json());
  if (res.error) throw new Error(res.error.message);
  const compte = res.data?.[0];
  if (!compte) throw new Error("aucun compte publicitaire trouvé sur ce compte Meta");
  return `act_${compte.account_id}`;
}

async function creerCampagne({ network, name, dailyBudgetCents, postId }) {
  const compte = await compteConnecte("facebook"); // le compte publicitaire est toujours celui de la Page
  if (!compte) throw new Error("compte Facebook non connecté (requis pour gérer les publicités, y compris Instagram)");
  if (!postId) throw new Error("un identifiant de publication (postId) est requis pour créer une campagne");
  // Facebook : postId doit être le object_story_id renvoyé par social-publish.mjs
  // (déjà au format "pageid_postid" — ne pas le reconstruire ici, sous peine de
  // dupliquer le préfixe de page). Instagram : postId est l'identifiant du
  // média IG (champ "postId" renvoyé par publierInstagram), qui utilise un
  // paramètre différent côté Marketing API (source_instagram_media_id, pas
  // object_story_id) car un média Instagram n'a pas de "story id" Facebook.

  const adAccount = await compteAnnonceur(compte.accessToken);
  const token = compte.accessToken;

  const campagne = await fetch(`${META_API}/${adAccount}/campaigns`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      objective: "OUTCOME_ENGAGEMENT",
      status: "PAUSED",
      special_ad_categories: [],
      access_token: token,
    }),
  }).then((r) => r.json());
  if (campagne.error) throw new Error(campagne.error.message);

  const adset = await fetch(`${META_API}/${adAccount}/adsets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `${name} — ensemble`,
      campaign_id: campagne.id,
      daily_budget: dailyBudgetCents,
      billing_event: "IMPRESSIONS",
      optimization_goal: "POST_ENGAGEMENT",
      targeting: { geo_locations: { countries: ["FR"] } },
      status: "PAUSED",
      access_token: token,
    }),
  }).then((r) => r.json());
  if (adset.error) throw new Error(adset.error.message);

  const creativeBody =
    network === "instagram" ? { source_instagram_media_id: postId, access_token: token } : { object_story_id: postId, access_token: token };

  const creative = await fetch(`${META_API}/${adAccount}/adcreatives`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(creativeBody),
  }).then((r) => r.json());
  if (creative.error) throw new Error(creative.error.message);

  const ad = await fetch(`${META_API}/${adAccount}/ads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `${name} — annonce`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: "PAUSED",
      access_token: token,
    }),
  }).then((r) => r.json());
  if (ad.error) throw new Error(ad.error.message);

  return { campaignId: campagne.id, adId: ad.id };
}

async function changerStatut(row, statut) {
  const compte = await compteConnecte("facebook");
  if (!compte) throw new Error("compte Facebook non connecté");
  const res = await fetch(`${META_API}/${row.external_id}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: statut, access_token: compte.accessToken }),
  }).then((r) => r.json());
  if (res.error) throw new Error(res.error.message);
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    if (req.method === "GET") {
      const campagnes = await sql()`select * from social_campaigns order by created_at desc`;
      return Response.json({ campagnes });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { network, name, dailyBudgetCents, postId } = body;

      if (!RESEAUX_SUPPORTES.includes(network)) {
        return Response.json({ error: "réseau non supporté pour les publicités (TikTok Ads pas encore configuré)" }, { status: 400 });
      }
      if (!name || !dailyBudgetCents || dailyBudgetCents < 100) {
        return Response.json({ error: "nom et budget quotidien (minimum 1€) requis" }, { status: 400 });
      }

      const [row] = await sql()`
        insert into social_campaigns (network, name, objective, daily_budget_cents, post_id, status)
        values (${network}, ${name}, 'OUTCOME_ENGAGEMENT', ${dailyBudgetCents}, ${postId || null}, 'creating')
        returning *
      `;

      try {
        const { campaignId } = await creerCampagne({ network, name, dailyBudgetCents, postId });
        const [maj] = await sql()`
          update social_campaigns set external_id = ${campaignId}, status = 'PAUSED', error = null where id = ${row.id} returning *
        `;
        return Response.json({ campagne: maj, note: "créée en pause côté Meta — activez-la manuellement dans Meta Ads Manager après vérification." });
      } catch (e) {
        const [maj] = await sql()`update social_campaigns set status = 'failed', error = ${String(e.message || e)} where id = ${row.id} returning *`;
        return Response.json({ campagne: maj, error: String(e.message || e) }, { status: 200 });
      }
    }

    if (req.method === "PATCH") {
      const body = await req.json().catch(() => ({}));
      const { id, action } = body;
      const [row] = await sql()`select * from social_campaigns where id = ${id}`;
      if (!row) return Response.json({ error: "campagne introuvable" }, { status: 404 });
      if (!row.external_id) return Response.json({ error: "campagne jamais créée côté Meta" }, { status: 400 });

      const statut = action === "activer" ? "ACTIVE" : "PAUSED";
      try {
        await changerStatut(row, statut);
        const [maj] = await sql()`update social_campaigns set status = ${statut} where id = ${id} returning *`;
        return Response.json({ campagne: maj });
      } catch (e) {
        return Response.json({ error: String(e.message || e) }, { status: 200 });
      }
    }

    return Response.json({ error: "méthode non autorisée" }, { status: 405 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/social-ads" };
