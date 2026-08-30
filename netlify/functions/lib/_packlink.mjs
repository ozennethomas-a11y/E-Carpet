// Helpers Packlink PRO partagés entre packlink.mjs (recherche de points
// relais + création manuelle de brouillon depuis l'admin) et
// stripe-webhook.mjs (création automatique du brouillon dès qu'une commande
// point relais est payée).
//
// Vérifié en direct le 2026-08-12 contre l'API production (compte réel), à
// partir de la doc du client Crystal open-source de Packlink :
// https://github.com/wout/packlink.cr
//
//   - Authentification : header "Authorization: <clé>" (pas de préfixe Bearer)
//   - POST /v1/shipments { content, contentvalue, dropoff_point_id, service_id,
//         shipment_custom_reference, source, packages, from, to, additional_data }
//       → crée un BROUILLON (tous les champs sont optionnels, aucun envoi
//         n'est facturé/commandé auprès du transporteur). Retourne
//         { reference }, réutilisable ensuite comme shipment_reference.
//   - POST /v1/orders { order_reference, total_amount, shipments: [...] }
//       → création de l'envoi réel, facturé. PAS ENCORE BRANCHÉ ICI : on ne
//         passe aucune commande transporteur tant que le flux n'a pas été
//         validé avec vous.

import { sql } from "./_db.mjs";

const API = "https://api.packlink.com";
export const MONDIAL_RELAY_SERVICE_ID = 30463;

// Adresse d'expédition E-Carpet (voir src/data/legal.js).
const ADRESSE_EXPEDITEUR = {
  name: "E-Carpet",
  surname: "",
  email: "service-client@e-carpet.shop",
  phone: "0000000000",
  street1: "5 Cour Moderne",
  zip_code: "59000",
  city: "Lille",
  country: "FR",
};

// Dimensions réelles d'un carton "Tapis Unitaire" (mesurées, voir compte
// Packlink) : 0,9 kg, 45 × 8 × 6 cm. Pour plusieurs tapis dans le même
// colis, seule la largeur augmente proportionnellement (les tapis sont
// empilés côte à côte dans le même tube) ; longueur et hauteur ne changent
// pas, et le poids est proportionnel à la quantité.
const COLIS_UNITAIRE = { poidsKg: 0.9, longueurCm: 45, largeurCm: 8, hauteurCm: 6 };

function colisPourQuantite(quantite) {
  return {
    weight: Math.round(COLIS_UNITAIRE.poidsKg * quantite * 100) / 100,
    length: COLIS_UNITAIRE.longueurCm,
    width: COLIS_UNITAIRE.largeurCm * quantite,
    height: COLIS_UNITAIRE.hauteurCm,
  };
}

export function packlinkCredentials() {
  return process.env.PROPACKING_API_KEY || null;
}

export async function packlinkGet(path, key) {
  const res = await fetch(`${API}${path}`, { headers: { authorization: key } });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${path}: ${JSON.stringify(json)}`);
  return json;
}

async function packlinkPost(path, key, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { authorization: key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${path}: ${JSON.stringify(json)}`);
  return json;
}

// Crée le brouillon Packlink pour une commande en livraison point relais et
// enregistre la référence obtenue sur la commande. Ne fait rien (retourne
// null) si la commande n'est pas en mode "relais" ou si un brouillon existe
// déjà. Les erreurs sont volontairement avalées par l'appelant (webhook
// Stripe) : un souci Packlink ne doit jamais faire échouer la confirmation
// de paiement.
export async function creerBrouillonPourCommande(orderId) {
  const key = packlinkCredentials();
  if (!key) throw new Error("PROPACKING_API_KEY manquante");

  const [order] = await sql()`
    select id, order_number, email, total_cents, shipping_address, packlink_draft_reference
    from orders where id = ${orderId}
  `;
  if (!order) throw new Error("commande introuvable");
  if (order.packlink_draft_reference) return { reference: order.packlink_draft_reference, dejaExistant: true };

  const adresse = order.shipping_address;
  if (adresse?.deliveryMode !== "relais" || !adresse.pickupPoint) return null;

  const items = await sql()`select quantity from order_items where order_id = ${orderId}`;
  const quantite = items.reduce((s, it) => s + it.quantity, 0) || 1;
  const colis = colisPourQuantite(quantite);

  const draft = await packlinkPost("/v1/shipments", key, {
    content: "Autres",
    contentvalue: 20,
    dropoff_point_id: adresse.pickupPoint.id,
    service_id: MONDIAL_RELAY_SERVICE_ID,
    shipment_custom_reference: order.order_number ? String(order.order_number) : `commande-${order.id}`,
    source: "e-carpet-website",
    packages: [colis],
    from: ADRESSE_EXPEDITEUR,
    to: {
      name: adresse.firstName || "",
      surname: adresse.lastName || "",
      email: order.email,
      phone: adresse.phone || "",
      street1: adresse.pickupPoint.adresse || "",
      zip_code: adresse.pickupPoint.codePostal || adresse.postalCode || "",
      city: adresse.pickupPoint.ville || "",
      country: adresse.country || "FR",
    },
  });

  await sql()`update orders set packlink_draft_reference = ${draft.reference} where id = ${orderId}`;
  return { reference: draft.reference, colis };
}

const STATUTS_TERMINES = new Set(["DELIVERED", "CANCELED"]);
const LIBELLE_STATUT = {
  READY_TO_PRINT: "Étiquette à imprimer",
  AWAITING_COMPLETION: "En attente de finalisation",
  IN_TRANSIT: "En transit",
  PICKED_UP: "Récupéré par le transporteur",
  DELIVERED: "Livré",
  CANCELED: "Annulé",
};

const LIBELLE_SOURCE = {
  amazon_inbound: "Amazon",
  "e-carpet-website": "Site",
  PRO: "Packlink (manuel)",
};

// Livraisons en cours, tous canaux confondus (site + Amazon + créées à la
// main dans Packlink) : Packlink est la seule source qui voit vraiment le
// statut de transit réel, notre base ne sait dire que "expédié" ou non.
export async function livraisonsEnCours(key, { limite = 15 } = {}) {
  const json = await packlinkGet("/v1/shipments", key);
  return (json.shipments || [])
    .filter((s) => !s.canceled && !STATUTS_TERMINES.has(s.status))
    .slice(0, limite)
    .map((s) => ({
      reference: s.reference,
      commandeRef: s.shipment_custom_reference || null,
      statut: LIBELLE_STATUT[s.status] || s.status,
      source: LIBELLE_SOURCE[s.source] || s.source,
      transporteur: s.carrier,
      destinataireVille: s.delivery?.city || null,
      destinataireCodePostal: s.delivery?.zip_code || null,
      date: s.orderDate,
    }));
}
