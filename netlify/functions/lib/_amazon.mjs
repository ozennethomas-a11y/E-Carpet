// Helpers Amazon SP-API partagés entre amazon.mjs (onglet Amazon) et
// finance.mjs (tableau de bord Finance) — extraits d'amazon.mjs pour éviter
// de dupliquer l'authentification et les appels API.

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

export async function amz(token, path) {
  const res = await fetch(`${API}${path}`, {
    headers: { authorization: `Bearer ${token}`, "x-amz-access-token": token },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readableError(json, res.status));
  return json;
}

// --- Finances : ce que vend réellement chaque commande, une fois les frais Amazon déduits. ---
export async function financesAmazon(token, depuis) {
  const params = new URLSearchParams({ PostedAfter: depuis });
  let json;
  try {
    json = await amz(token, `/finances/v0/financialEvents?${params}`);
  } catch (e) {
    return { erreur: String(e.message || e) };
  }
  const shipments = json.payload?.FinancialEvents?.ShipmentEventList || [];
  const refunds = json.payload?.FinancialEvents?.RefundEventList || [];

  let ventesBrutes = 0;
  const frais = {}; // par type : Commission, FixedClosingFee, ShippingHB, DigitalServicesFee...

  for (const s of shipments) {
    for (const item of s.ShipmentItemList || []) {
      for (const c of item.ItemChargeList || []) ventesBrutes += Number(c.ChargeAmount?.CurrencyAmount || 0);
      for (const f of item.ItemFeeList || []) {
        const montant = Number(f.FeeAmount?.CurrencyAmount || 0);
        frais[f.FeeType] = Math.round(((frais[f.FeeType] || 0) + montant) * 100) / 100;
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
  };
}
