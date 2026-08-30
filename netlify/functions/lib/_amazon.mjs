// Helpers Amazon SP-API partagés entre amazon.mjs (onglet Amazon) et
// finance.mjs (tableau de bord Finance) — extraits d'amazon.mjs pour éviter
// de dupliquer l'authentification et les appels API.

import { getStore } from "@netlify/blobs";

const AUTH_URL = "https://api.amazon.com/auth/o2/token";
const API = "https://sellingpartnerapi-eu.amazon.com";

export function credentials() {
  const need = ["AMAZON_REFRESH_TOKEN", "AMAZON_CLIENT_ID", "AMAZON_CLIENT_SECRET", "AMAZON_SELLER_ID"];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) return { missing };
  return {
    refreshToken: process.env.AMAZON_REFRESH_TOKEN,
    clientId: process.env.AMAZON_CLIENT_ID,
    clientSecret: process.env.AMAZON_CLIENT_SECRET,
    sellerId: process.env.AMAZON_SELLER_ID,
  };
}

export async function getAccessToken(c) {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: c.refreshToken,
      client_id: c.clientId,
      client_secret: c.clientSecret,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      json.error === "invalid_grant"
        ? "refresh token Amazon invalide ou révoqué : réautorisez l'application dans Seller Central"
        : json.error_description || json.error || "échec de l'authentification Amazon",
    );
  }
  return json.access_token;
}

export function readableError(json, status) {
  const detail = json?.errors?.[0];
  if (detail?.code === "Unauthorized") return "l'application n'a pas ce rôle sur le compte vendeur";
  if (status === 403) return "accès refusé : vérifiez que l'app est bien approuvée en production";
  if (status === 429) return "trop de requêtes envoyées à Amazon, réessayez dans une minute";
  return detail?.message || `erreur HTTP ${status}`;
}

// Cache court (Netlify Blobs, partagé entre toutes les invocations) sur les
// lectures SP-API : le quota Amazon sur /orders/v0/orders est très strict
// (~1 requête/min), et plusieurs écrans du site (Accueil, onglet Amazon,
// synchronisation du Stock) interrogent indépendamment la même donnée —
// sans ce cache, les visiter l'un après l'autre épuise le quota en quelques
// secondes et déclenche des erreurs "trop de requêtes" en cascade.
const CACHE_TTL_MS = 3 * 60 * 1000;

export async function amz(token, path) {
  const store = getStore("amazon-api-cache");
  const cached = await store.get(path, { type: "json" }).catch(() => null);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.json;

  const res = await fetch(`${API}${path}`, {
    headers: { authorization: `Bearer ${token}`, "x-amz-access-token": token },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readableError(json, res.status));

  await store.setJSON(path, { at: Date.now(), json }).catch(() => {});
  return json;
}

// --- Finances : ce que vend réellement chaque commande, une fois les frais Amazon déduits. ---
// `jusqua` (optionnel) borne la période, pour pouvoir isoler un mois précis
// plutôt que "tout depuis telle date". Pagination gérée jusqu'au bout
// (NextToken) : un mois avec beaucoup de commandes tient sur plusieurs pages,
// s'arrêter à la première sous-estimait les frais réels sur les périodes chargées.
export async function financesAmazon(token, depuis, jusqua) {
  const evenements = [];
  let nextToken = null;
  let page = 0;
  do {
    const params = new URLSearchParams({ PostedAfter: depuis });
    if (jusqua) params.set("PostedBefore", jusqua);
    if (nextToken) params.set("NextToken", nextToken);
    let json;
    try {
      json = await amz(token, `/finances/v0/financialEvents?${params}`);
    } catch (e) {
      if (page === 0) return { erreur: String(e.message || e) };
      break; // déjà des données valides sur les pages précédentes : on les garde plutôt que de tout perdre
    }
    evenements.push(json.payload?.FinancialEvents);
    nextToken = json.payload?.NextToken || null;
    page += 1;
  } while (nextToken && page < 20);

  const shipments = evenements.flatMap((e) => e?.ShipmentEventList || []);
  const refunds = evenements.flatMap((e) => e?.RefundEventList || []);

  let ventesBrutes = 0;
  const frais = {}; // par type : Commission, FixedClosingFee, ShippingHB, DigitalServicesFee...
  const parCommandeMap = new Map(); // AmazonOrderId -> { orderId, date, ventesBrutes, frais, totalFrais, items }

  for (const s of shipments) {
    const orderId = s.AmazonOrderId;
    const date = s.PostedDate;
    if (!parCommandeMap.has(orderId)) {
      parCommandeMap.set(orderId, { orderId, date, ventesBrutes: 0, frais: {}, totalFrais: 0, items: [] });
    }
    const ligne = parCommandeMap.get(orderId);

    for (const item of s.ShipmentItemList || []) {
      // SKU + quantité : nécessaire pour calculer le coût de revient réel des
      // ventes Amazon (voir finance.mjs), pas seulement les frais Amazon.
      if (item.SellerSKU && item.QuantityShipped) {
        ligne.items.push({ sku: item.SellerSKU, quantity: Number(item.QuantityShipped) });
      }
      for (const c of item.ItemChargeList || []) {
        const montant = Number(c.ChargeAmount?.CurrencyAmount || 0);
        ventesBrutes += montant;
        ligne.ventesBrutes = Math.round((ligne.ventesBrutes + montant) * 100) / 100;
      }
      for (const f of item.ItemFeeList || []) {
        const montant = Number(f.FeeAmount?.CurrencyAmount || 0);
        frais[f.FeeType] = Math.round(((frais[f.FeeType] || 0) + montant) * 100) / 100;
        ligne.frais[f.FeeType] = Math.round(((ligne.frais[f.FeeType] || 0) + montant) * 100) / 100;
        ligne.totalFrais = Math.round((ligne.totalFrais + montant) * 100) / 100;
      }
    }
  }

  let remboursements = 0;
  for (const r of refunds) {
    for (const item of r.ShipmentItemAdjustmentList || []) {
      for (const c of item.ItemChargeAdjustmentList || []) remboursements += Number(c.ChargeAmount?.CurrencyAmount || 0);
    }
  }

  const totalFrais = Object.values(frais).reduce((s, v) => s + v, 0);
  return {
    ventesBrutes: Math.round(ventesBrutes * 100) / 100,
    fraisAmazon: Math.round(totalFrais * 100) / 100,
    fraisParType: Object.entries(frais)
      .map(([type, montant]) => ({ type, montant }))
      .sort((a, b) => a.montant - b.montant),
    remboursements: Math.round(remboursements * 100) / 100,
    net: Math.round((ventesBrutes + totalFrais + remboursements) * 100) / 100,
    tauxCommission: ventesBrutes ? Math.round((-totalFrais / ventesBrutes) * 1000) / 10 : 0,
    parCommande: [...parCommandeMap.values()].sort((a, b) => new Date(b.date) - new Date(a.date)),
  };
}
