// Coût d'expédition estimé des commandes du site (domicile/relais) : partagé
// entre shipping.mjs (onglet Expédition) et finance.mjs (marge nette), pour
// ne pas dupliquer les tarifs ni la logique de comptage.
import { sql } from "./_db.mjs";

export const TARIF_DOMICILE_CENTS = 730;
export const TARIF_RELAIS_CENTS = 418;

export async function coutsExpeditionSite(debut, fin) {
  const rows = await sql()`
    select shipping_address->>'deliveryMode' as mode
    from orders
    where shipped_at >= ${debut} and shipped_at < ${fin}
  `;
  const domicile = rows.filter((r) => r.mode !== "relais").length;
  const relais = rows.filter((r) => r.mode === "relais").length;
  return {
    domicile: { count: domicile, coutCents: domicile * TARIF_DOMICILE_CENTS },
    relais: { count: relais, coutCents: relais * TARIF_RELAIS_CENTS },
  };
}
