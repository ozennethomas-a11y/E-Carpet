// Coût d'expédition des commandes du site : partagé entre shipping.mjs
// (onglet Expédition) et finance.mjs (marge nette), pour ne pas dupliquer les
// tarifs ni la logique de comptage.
//
// Packlink n'expose pas le prix de l'étiquette par API. Le coût réel est donc
// saisi à la main, commande par commande, dans orders.shipping_cost_cents —
// et tant qu'il ne l'est pas, on applique un tarif forfaitaire.
//
// Ce module privilégie TOUJOURS le coût réel quand il est connu, et ne
// retombe sur le forfait que pour les commandes non renseignées. Il renvoie
// aussi le décompte des deux, parce qu'une marge calculée à moitié sur des
// estimations n'a pas la même valeur qu'une marge mesurée, et que
// l'utilisateur doit pouvoir faire la différence.
import { sql } from "./_db.mjs";

export const TARIF_DOMICILE_CENTS = 730;
export const TARIF_RELAIS_CENTS = 418;

export async function coutsExpeditionSite(debut, fin) {
  const rows = await sql()`
    select shipping_address->>'deliveryMode' as mode, shipping_cost_cents
    from orders
    where shipped_at >= ${debut} and shipped_at < ${fin}
  `;

  let reelCents = 0;
  let reelCount = 0;
  const estime = {
    domicile: { count: 0, coutCents: 0 },
    relais: { count: 0, coutCents: 0 },
  };

  for (const r of rows) {
    // Un coût réel de 0 est une valeur légitime (étiquette offerte) : on ne
    // teste donc pas la véracité mais la présence.
    if (r.shipping_cost_cents != null) {
      reelCents += r.shipping_cost_cents;
      reelCount++;
      continue;
    }
    const cle = r.mode === "relais" ? "relais" : "domicile";
    const tarif = cle === "relais" ? TARIF_RELAIS_CENTS : TARIF_DOMICILE_CENTS;
    estime[cle].count++;
    estime[cle].coutCents += tarif;
  }

  const estimeCents = estime.domicile.coutCents + estime.relais.coutCents;
  const estimeCount = estime.domicile.count + estime.relais.count;

  return {
    // Conservés sous leurs anciens noms : l'onglet Expédition les affiche.
    domicile: estime.domicile,
    relais: estime.relais,
    reel: { count: reelCount, coutCents: reelCents },
    totalCents: reelCents + estimeCents,
    // Part du coût d'expédition réellement mesurée, entre 0 et 1. Sert à
    // qualifier la marge affichée plutôt qu'à la corriger.
    couverture: reelCount + estimeCount ? reelCount / (reelCount + estimeCount) : null,
    estimeCount,
  };
}
