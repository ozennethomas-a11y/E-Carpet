// Amazon Selling Partner API pour l'onglet « Amazon » du back-office.
//
// Lecture seule sur toutes les sections sauf « solliciter » (envoie le bouton
// officiel « Demander un avis » sur une commande précise, une par une, jamais
// en masse) et « offre/proposer » (enregistre une proposition de modification
// de fiche produit ; ne publie JAMAIS sans un clic explicite de validation).
//
// On n'interroge aucun champ contenant des données personnelles d'acheteur
// (nom, adresse), pour rester dans le périmètre des rôles non restreints.

import { getStore } from "@netlify/blobs";
import { credentials, getAccessToken, readableError, amz, financesAmazon } from "./lib/_amazon.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";

const PROPOSITIONS_KEY = "amazon-propositions";

// --- Marketplaces réellement actifs sur le compte, pas une liste figée. ---
const NOMS_PAYS = { FR: "France", DE: "Allemagne", NL: "Pays-Bas", PL: "Pologne", GB: "Royaume-Uni", ES: "Espagne", IT: "Italie", SE: "Suède", BE: "Belgique", IE: "Irlande", AE: "Émirats arabes unis" };

async function marketplacesActifs(token) {
  const json = await amz(token, "/sellers/v1/marketplaceParticipations");
  return (json.payload || [])
    .filter((p) => p.participation?.isParticipating)
    .map((p) => ({
      id: p.marketplace.id,
      code: p.marketplace.countryCode,
      nom: NOMS_PAYS[p.marketplace.countryCode] || p.marketplace.countryCode,
      devise: p.marketplace.defaultCurrencyCode,
      annoncesSuspendues: !!p.participation.hasSuspendedListings,
    }));
}

// --- Commandes (déjà existant, conservé pour /api/amazon?section=ventes ou sans paramètre) ---
async function commandes(token, marketplaceId, depuis) {
  const toutes = [];
  let nextToken = null;
  do {
    const params = new URLSearchParams({ MarketplaceIds: marketplaceId, CreatedAfter: depuis });
    if (nextToken) params.set("NextToken", nextToken);
    const json = await amz(token, `/orders/v0/orders?${params}`);
    toutes.push(...(json.payload?.Orders || []));
    nextToken = json.payload?.NextToken || null;
  } while (nextToken && toutes.length < 2000);
  return toutes;
}

function resumerCommandes(commandesList) {
  const valides = commandesList.filter((o) => o.OrderStatus !== "Canceled");
  const parJour = {};
  let ca = 0;
  let devise = "EUR";
  for (const o of valides) {
    const jour = (o.PurchaseDate || "").slice(0, 10);
    const montant = Number(o.OrderTotal?.Amount || 0);
    if (o.OrderTotal?.CurrencyCode) devise = o.OrderTotal.CurrencyCode;
    ca += montant;
    if (jour) parJour[jour] = { commandes: (parJour[jour]?.commandes || 0) + 1, ca: (parJour[jour]?.ca || 0) + montant };
  }
  return {
    commandes: valides.length,
    annulees: commandesList.length - valides.length,
    chiffreAffaires: Math.round(ca * 100) / 100,
    devise,
    panierMoyen: valides.length ? Math.round((ca / valides.length) * 100) / 100 : 0,
    serie: Object.entries(parJour).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, commandes: v.commandes, ca: Math.round(v.ca * 100) / 100 })),
    premiereCommande: commandesList[commandesList.length - 1] || null,
  };
}

// --- Stock et contenu de fiche : on découvre le SKU via une commande récente. ---
async function skuDuProduit(token, marketplaceId) {
  const params = new URLSearchParams({ MarketplaceIds: marketplaceId, CreatedAfter: new Date(Date.now() - 365 * 86400_000).toISOString() });
  const orders = await amz(token, `/orders/v0/orders?${params}`);
  const order = orders.payload?.Orders?.[0];
  if (!order) return null;
  const items = await amz(token, `/orders/v0/orders/${order.AmazonOrderId}/orderItems`);
  return items.payload?.OrderItems?.[0]?.SellerSKU || null;
}

async function ficheProduit(token, sellerId, sku, marketplaceId) {
  const params = new URLSearchParams({ marketplaceIds: marketplaceId, includedData: "summaries,attributes,issues,offers" });
  const json = await amz(token, `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}?${params}`);
  const resume = json.summaries?.[0] || {};
  const a = json.attributes || {};
  const texte = (champ) => a[champ]?.[0]?.value || null;
  return {
    sku: json.sku,
    asin: resume.asin,
    statut: resume.status || [],
    titre: resume.itemName,
    image: resume.mainImage?.link,
    couleur: texte("color"),
    fabricant: texte("manufacturer"),
    stock: a.fulfillment_availability?.[0]?.quantity ?? null,
    differenciation: texte("title_differentiation"),
    problemes: (json.issues || []).map((i) => ({ gravite: i.severity, message: i.message })),
    derniereMiseAJour: resume.lastUpdatedDate,
  };
}

// --- Sollicitation d'avis : uniquement le bouton officiel, une commande à la fois. ---
async function actionsDisponibles(token, orderId, marketplaceId) {
  const json = await amz(token, `/solicitations/v1/orders/${orderId}?marketplaceIds=${marketplaceId}`);
  return (json._embedded?.actions || []).map((a) => a.name || a);
}

// Le quota de la Solicitations API est trop bas pour interroger l'éligibilité
// de chaque commande à chaque ouverture de l'onglet (429 en quelques appels).
// On calcule donc l'éligibilité localement à partir de la fenêtre officielle
// d'Amazon (5 à 30 jours après livraison) : l'appel réel à l'API n'a lieu qu'au
// moment de l'envoi, sur une seule commande, sur clic explicite.
function eligiblePourSollicitation(order) {
  const livraison = order.LatestDeliveryDate || order.EarliestDeliveryDate;
  if (!livraison) return false;
  const jours = (Date.now() - new Date(livraison).getTime()) / 86400_000;
  return jours >= 5 && jours <= 30;
}

async function commandesRecentesPourAvis(token, marketplaceId) {
  const depuis = new Date(Date.now() - 40 * 86400_000).toISOString();
  const params = new URLSearchParams({ MarketplaceIds: marketplaceId, CreatedAfter: depuis });
  const json = await amz(token, `/orders/v0/orders?${params}`);
  const commandesList = (json.payload?.Orders || []).filter((o) => o.OrderStatus === "Shipped");

  return commandesList.slice(0, 20).map((o) => {
    // Date de livraison (pas d'achat) : c'est elle qui compte pour la fenêtre
    // d'éligibilité Amazon (5 à 30 jours après livraison), donc c'est elle
    // qu'il faut voir pour savoir quand envoyer la demande d'avis.
    const livraison = o.LatestDeliveryDate || o.EarliestDeliveryDate || null;
    const joursDepuisLivraison = livraison ? Math.floor((Date.now() - new Date(livraison).getTime()) / 86400_000) : null;
    return {
      commande: o.AmazonOrderId,
      dateAchat: (o.PurchaseDate || "").slice(0, 10),
      dateLivraison: livraison ? livraison.slice(0, 10) : null,
      joursDepuisLivraison,
      montant: o.OrderTotal?.Amount,
      eligible: eligiblePourSollicitation(o),
    };
  });
}

async function envoyerSollicitation(token, orderId, marketplaceId) {
  const res = await fetch(`${API}/solicitations/v1/orders/${orderId}/solicitations/productReviewAndSellerFeedback?marketplaceIds=${marketplaceId}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "x-amz-access-token": token },
  });
  if (res.status === 201 || res.status === 204) return { ok: true };
  const json = await res.json().catch(() => ({}));
  throw new Error(readableError(json, res.status));
}

// --- Commandes à expédier : confirmer l'envoi déclenche l'email de suivi
// automatique d'Amazon (transporteur + numéro), sans rien construire nous-mêmes. ---

const TRANSPORTEURS = [
  { code: "La Poste - Colissimo", nom: "Colissimo" },
  { code: "Mondial Relay", nom: "Mondial Relay" },
  { code: "Chronopost", nom: "Chronopost" },
  { code: "UPS", nom: "UPS" },
  { code: "DHL", nom: "DHL" },
  { code: "GLS", nom: "GLS" },
  { code: "Autre", nom: "Autre transporteur" },
];

async function commandesAExpedier(token, marketplaceId) {
  const depuis = new Date(Date.now() - 30 * 86400_000).toISOString();
  const params = new URLSearchParams({ MarketplaceIds: marketplaceId, CreatedAfter: depuis });
  const json = await amz(token, `/orders/v0/orders?${params}`);
  return (json.payload?.Orders || [])
    .filter((o) => ["Unshipped", "PartiallyShipped"].includes(o.OrderStatus))
    .map((o) => ({
      commande: o.AmazonOrderId,
      date: (o.PurchaseDate || "").slice(0, 10),
      montant: o.OrderTotal?.Amount,
      statut: o.OrderStatus,
      dateLimiteExpedition: o.LatestShipDate,
      pointRelais: o.ShipServiceLevel === "Std FR Dom_6" || /relais|pickup|locker/i.test(o.ShipServiceLevel || ""),
    }));
}

/** Soumet la confirmation d'expédition. Amazon envoie alors lui-même son e-mail de suivi. */
async function confirmerExpedition(token, c, orderId, marketplaceId, transporteur, suivi) {
  const doc = {
    header: { sellerId: c.sellerId, version: "2.0" },
    messages: [
      {
        messageId: 1,
        orderId,
        fulfillmentDate: new Date().toISOString(),
        carrierCode: transporteur,
        carrierName: transporteur,
        shippingMethod: "Standard",
        trackingNumber: suivi,
        items: [], // toutes les lignes de la commande sont considérées expédiées
      },
    ],
  };

  // 1. Créer le document du flux
  const createRes = await fetch(`${API}/feeds/2021-06-30/documents`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "x-amz-access-token": token, "content-type": "application/json" },
    body: JSON.stringify({ contentType: "text/xml; charset=UTF-8" }),
  });
  const createJson = await createRes.json();
  if (!createRes.ok) throw new Error(readableError(createJson, createRes.status));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
<Header><DocumentVersion>1.01</DocumentVersion><MerchantIdentifier>${c.sellerId}</MerchantIdentifier></Header>
<MessageType>OrderFulfillment</MessageType>
<Message><MessageID>1</MessageID><OrderFulfillment>
<AmazonOrderID>${orderId}</AmazonOrderID>
<FulfillmentDate>${new Date().toISOString()}</FulfillmentDate>
<FulfillmentData><CarrierCode>${transporteur}</CarrierCode><ShippingMethod>Standard</ShippingMethod><ShipperTrackingNumber>${suivi}</ShipperTrackingNumber></FulfillmentData>
</OrderFulfillment></Message>
</AmazonEnvelope>`;

  await fetch(createJson.url, { method: "PUT", headers: { "content-type": "text/xml; charset=UTF-8" }, body: xml });

  // 2. Soumettre le flux avec ce document
  const feedRes = await fetch(`${API}/feeds/2021-06-30/feeds`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "x-amz-access-token": token, "content-type": "application/json" },
    body: JSON.stringify({ feedType: "POST_ORDER_FULFILLMENT_DATA", marketplaceIds: [marketplaceId], inputFeedDocumentId: createJson.feedDocumentId }),
  });
  const feedJson = await feedRes.json();
  if (!feedRes.ok) throw new Error(readableError(feedJson, feedRes.status));
  return { ok: true, feedId: feedJson.feedId };
}

// --- Message complémentaire (ex. instructions point relais) : on ne propose que
// les gabarits qu'Amazon confirme réellement disponibles pour cette commande. ---
async function gabaritsDisponibles(token, orderId, marketplaceId) {
  const json = await amz(token, `/messaging/v1/orders/${orderId}/messagingActions?marketplaceIds=${marketplaceId}`);
  return (json._embedded?.actions || []).map((a) => a.name);
}

async function envoyerMessageLivraison(token, orderId, marketplaceId, texte) {
  const res = await fetch(`${API}/messaging/v1/orders/${orderId}/messages/confirmDeliveryDetails?marketplaceIds=${marketplaceId}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "x-amz-access-token": token, "content-type": "application/json" },
    body: JSON.stringify({ text: texte.slice(0, 2000) }),
  });
  if (res.status === 201 || res.status === 200) return { ok: true };
  const json = await res.json().catch(() => ({}));
  throw new Error(readableError(json, res.status));
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") {
    return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });
  }

  const c = credentials();
  if (c.missing) {
    return Response.json({ error: "missing_credentials", variables: c.missing }, { status: 200 });
  }

  const url = new URL(req.url);
  const section = url.searchParams.get("section") || "ventes";
  const jours = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10), 1), 365);
  const depuis = new Date(Date.now() - jours * 86400_000).toISOString();

  try {
    const token = await getAccessToken(c);
    const marketplaces = await marketplacesActifs(token);
    const store = getStore("analytics");

    if (section === "compte") {
      return Response.json({ marketplaces }, { headers: { "cache-control": "no-store" } });
    }

    if (section === "finances") {
      // Mois calendaire (YYYY-MM, défaut : mois en cours) plutôt qu'un simple
      // "N derniers jours" : permet de voir exactement ce qui a été payé sur
      // un mois donné, et de remonter dans l'historique mois par mois.
      const moisParam = url.searchParams.get("month");
      const moisValide = moisParam && /^\d{4}-\d{2}$/.test(moisParam);
      const [an, mois] = moisValide ? moisParam.split("-").map(Number) : [null, null];
      const debutMois = moisValide ? new Date(Date.UTC(an, mois - 1, 1)) : null;
      // Jamais dans le futur : Amazon refuse un PostedBefore postérieur à
      // maintenant, ce qu'était toujours le 1er jour du mois suivant pour le
      // mois en cours.
      const finMoisCalendaire = moisValide ? new Date(Date.UTC(an, mois, 1)) : null;
      const finMois = finMoisCalendaire && finMoisCalendaire > new Date() ? new Date() : finMoisCalendaire;

      const depuisFinances = moisValide ? debutMois.toISOString() : depuis;
      const jusquaFinances = moisValide ? finMois.toISOString() : undefined;

      const data = await financesAmazon(token, depuisFinances, jusquaFinances);
      return Response.json(
        { periode: { mois: moisValide ? moisParam : null, jours, depuis: depuisFinances.slice(0, 10) }, ...data },
        { headers: { "cache-control": "no-store" } },
      );
    }

    if (section === "offre") {
      const principal = marketplaces.find((m) => m.code === "FR") || marketplaces[0];
      if (!principal) return Response.json({ erreur: "aucun marketplace actif" });
      const sku = await skuDuProduit(token, principal.id);
      if (!sku) return Response.json({ erreur: "aucune commande trouvée, impossible de retrouver le SKU" });

      const [fiche, existante] = await Promise.all([
        ficheProduit(token, c.sellerId, sku, principal.id),
        store.get(PROPOSITIONS_KEY, { type: "json" }).catch(() => null),
      ]);
      const propositions = (existante?.propositions || []).filter((p) => p.sku === sku && p.statut === "en_attente");
      return Response.json({ fiche, propositions }, { headers: { "cache-control": "no-store" } });
    }

    if (section === "proposer" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { sku, champ, valeurActuelle, valeurProposee, note } = body;
      if (!sku || !champ || !valeurProposee) {
        return Response.json({ error: "sku, champ et valeurProposee sont requis" }, { status: 400 });
      }
      const existante = await store.get(PROPOSITIONS_KEY, { type: "json" }).catch(() => null);
      const propositions = existante?.propositions || [];
      propositions.unshift({
        id: `p-${Date.now().toString(36)}`,
        sku, champ, valeurActuelle, valeurProposee, note: note || "",
        statut: "en_attente",
        date: new Date().toISOString().slice(0, 10),
      });
      await store.setJSON(PROPOSITIONS_KEY, { propositions: propositions.slice(0, 200) });
      return Response.json({ ok: true });
    }

    if (section === "avis") {
      if (req.method === "POST") {
        const { orderId, marketplaceId } = await req.json().catch(() => ({}));
        if (!orderId || !marketplaceId) return Response.json({ error: "orderId et marketplaceId requis" }, { status: 400 });
        await envoyerSollicitation(token, orderId, marketplaceId);
        return Response.json({ ok: true });
      }
      const principal = marketplaces.find((m) => m.code === "FR") || marketplaces[0];
      if (!principal) return Response.json({ commandes: [] });
      const commandesEligibles = await commandesRecentesPourAvis(token, principal.id);
      return Response.json({ marketplace: principal.code, commandes: commandesEligibles }, { headers: { "cache-control": "no-store" } });
    }

    if (section === "commandes") {
      const principal = marketplaces.find((m) => m.code === "FR") || marketplaces[0];
      if (!principal) return Response.json({ commandes: [] });
      const liste = await commandesAExpedier(token, principal.id);
      return Response.json({ marketplace: principal.code, marketplaceId: principal.id, transporteurs: TRANSPORTEURS, commandes: liste }, { headers: { "cache-control": "no-store" } });
    }

    if (section === "expedier" && req.method === "POST") {
      const { orderId, marketplaceId, transporteur, suivi } = await req.json().catch(() => ({}));
      if (!orderId || !marketplaceId || !transporteur || !suivi) {
        return Response.json({ error: "orderId, marketplaceId, transporteur et suivi sont requis" }, { status: 400 });
      }
      const res = await confirmerExpedition(token, c, orderId, marketplaceId, transporteur, suivi);
      return Response.json(res);
    }

    // Gabarits de message réellement proposés par Amazon pour cette commande précise.
    if (section === "gabarits") {
      const orderId = url.searchParams.get("orderId");
      const marketplaceId = url.searchParams.get("marketplaceId");
      if (!orderId || !marketplaceId) return Response.json({ error: "orderId et marketplaceId requis" }, { status: 400 });
      const gabarits = await gabaritsDisponibles(token, orderId, marketplaceId);
      return Response.json({ gabarits, confirmDeliveryDetails: gabarits.includes("confirmDeliveryDetails") });
    }

    if (section === "message-livraison" && req.method === "POST") {
      const { orderId, marketplaceId, texte } = await req.json().catch(() => ({}));
      if (!orderId || !marketplaceId || !texte) {
        return Response.json({ error: "orderId, marketplaceId et texte sont requis" }, { status: 400 });
      }
      const res = await envoyerMessageLivraison(token, orderId, marketplaceId, texte);
      return Response.json(res);
    }

    // section par défaut : ventes, sur tous les marketplaces actifs
    const parPays = await Promise.all(
      marketplaces.map(async (m) => {
        try {
          const liste = await commandes(token, m.id, depuis);
          return { pays: m.code, nom: m.nom, ...resumerCommandes(liste) };
        } catch (e) {
          return { pays: m.code, nom: m.nom, erreur: String(e.message || e) };
        }
      }),
    );
    const ok = parPays.filter((p) => !p.erreur);
    const total = {
      commandes: ok.reduce((s, p) => s + p.commandes, 0),
      chiffreAffaires: Math.round(ok.reduce((s, p) => s + p.chiffreAffaires, 0) * 100) / 100,
      devise: ok[0]?.devise || "EUR",
    };
    return Response.json(
      { periode: { jours, depuis: depuis.slice(0, 10) }, total, parPays, marketplaces },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/amazon" };
