// Onglet « Expédition » du back-office : coût d'expédition par mois, comparé
// entre domicile (site), point relais (site) et Amazon (toujours livré à
// domicile par le vendeur, jamais en point relais).
//
// Site ET Amazon : aucun coût réel n'est disponible via API pour les
// étiquettes achetées sur Packlink (le brouillon Packlink ne fait que
// préparer l'étiquette, le prix réel n'y est jamais exposé — voir
// lib/_packlink.mjs), et le frais "ShippingHB" d'Amazon reste à 0 puisque
// les étiquettes ne passent jamais par le service de port d'Amazon lui-même.
// On applique donc le même tarif moyen fixe domicile aux commandes Amazon
// (toujours livrées à domicile) qu'aux commandes domicile du site.
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { credentials as amazonCredentials, getAccessToken as amazonToken, financesAmazon } from "./lib/_amazon.mjs";
import { TARIF_DOMICILE_CENTS, TARIF_RELAIS_CENTS, coutsExpeditionSite } from "./lib/_shipping.mjs";

function bornesMois(moisParam) {
  const valide = moisParam && /^\d{4}-\d{2}$/.test(moisParam);
  const [an, mois] = valide ? moisParam.split("-").map(Number) : [null, null];
  const maintenant = new Date();
  const [anEffectif, moisEffectif] = valide ? [an, mois] : [maintenant.getUTCFullYear(), maintenant.getUTCMonth() + 1];
  const debut = new Date(Date.UTC(anEffectif, moisEffectif - 1, 1));
  // Jamais dans le futur : Amazon refuse un PostedBefore postérieur à
  // maintenant (~2 min de tolérance), ce qu'était toujours le 1er jour du
  // mois suivant pour le mois en cours.
  // Marge de 5 minutes (pas juste "maintenant") : Amazon a rejeté un
  // PostedBefore égal à l'heure exacte de la requête ("should be no later
  // than 2 minutes from now"), probablement à cause du temps écoulé entre le
  // calcul de cette date et l'arrivée réelle de la requête chez Amazon.
  const finMoisCalendaire = new Date(Date.UTC(anEffectif, moisEffectif, 1));
  const marge = new Date(maintenant.getTime() - 5 * 60 * 1000);
  const fin = finMoisCalendaire > marge ? marge : finMoisCalendaire;
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
    const count = data.parCommande?.length || 0;
    return { count, coutCents: count * TARIF_DOMICILE_CENTS };
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
