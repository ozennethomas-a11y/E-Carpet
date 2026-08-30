// Onglet « Expédition » du back-office : coût d'expédition par mois, comparé
// entre domicile (site), point relais (site) et Amazon (toujours livré à
// domicile par le vendeur, jamais en point relais).
//
// Site : aucun coût réel n'est enregistré nulle part (le brouillon Packlink
// ne fait que préparer l'étiquette, rien n'est acheté via l'API — voir
// lib/_packlink.mjs). On applique donc un tarif moyen fixe par mode de
// livraison, au nombre réel de commandes expédiées ce mois-là.
// Amazon : coût réel, tiré du même relevé financier que l'onglet Finances.
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { credentials as amazonCredentials, getAccessToken as amazonToken, financesAmazon } from "./lib/_amazon.mjs";
import { TARIF_DOMICILE_CENTS, TARIF_RELAIS_CENTS, coutsExpeditionSite } from "./lib/_shipping.mjs";

function bornesMois(moisParam) {
  const valide = moisParam && /^\d{4}-\d{2}$/.test(moisParam);
  const [an, mois] = valide ? moisParam.split("-").map(Number) : [null, null];
  const maintenant = new Date();
  const [anEffectif, moisEffectif] = valide ? [an, mois] : [maintenant.getUTCFullYear(), maintenant.getUTCMonth() + 1];
  const debut = new Date(Date.UTC(anEffectif, moisEffectif - 1, 1));
  const fin = new Date(Date.UTC(anEffectif, moisEffectif, 1));
  const label = `${anEffectif}-${String(moisEffectif).padStart(2, "0")}`;
  return { debut, fin, label };
}

async function coutAmazon(debut, fin) {
  const c = amazonCredentials();
  if (c.missing) return { indisponible: true, raison: "identifiants Amazon manquants" };
  try {
    const token = await amazonToken(c);
    const data = await financesAmazon(token, debut.toISOString(), fin.toISOString());
    if (data.erreur) return { indisponible: true, raison: data.erreur };
    const fraisPort = data.fraisParType.find((f) => f.type === "ShippingHB");
    return {
      count: data.parCommande?.length || 0,
      coutCents: Math.round(Math.abs(fraisPort?.montant || 0) * 100),
    };
  } catch (e) {
    return { indisponible: true, raison: String(e.message || e) };
  }
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  const url = new URL(req.url);
  const { debut, fin, label } = bornesMois(url.searchParams.get("month"));

  const [site, amazon] = await Promise.all([
    coutsExpeditionSite(debut.toISOString(), fin.toISOString()),
    coutAmazon(debut, fin),
  ]);

  const totalCents =
    site.domicile.coutCents + site.relais.coutCents + (amazon.indisponible ? 0 : amazon.coutCents);

  return Response.json(
    {
      mois: label,
      tarifs: { domicileCents: TARIF_DOMICILE_CENTS, relaisCents: TARIF_RELAIS_CENTS },
      domicile: site.domicile,
      relais: site.relais,
      amazon,
      totalCents,
    },
    { headers: { "cache-control": "no-store" } },
  );
};

export const config = { path: "/api/shipping" };
