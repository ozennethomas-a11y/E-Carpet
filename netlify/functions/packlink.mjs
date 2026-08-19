// Intégration Packlink PRO (pro.packlink.fr) pour la sélection de point
// relais Mondial Relay au moment de la commande, et pour la création du
// brouillon d'expédition (voir _packlink.mjs pour les détails de l'API et le
// partage avec stripe-webhook.mjs, qui crée le brouillon automatiquement dès
// qu'une commande point relais est payée).

import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { checkAndRecord } from "./lib/_rateLimit.mjs";
import { packlinkCredentials, packlinkGet, creerBrouillonPourCommande, MONDIAL_RELAY_SERVICE_ID } from "./lib/_packlink.mjs";

export default async (req, context) => {
  const key = packlinkCredentials();
  if (!key) return Response.json({ error: "PROPACKING_API_KEY manquante" }, { status: 200 });

  const url = new URL(req.url);

  try {
    if (req.method === "POST") {
      const auth = await getAdminFromRequest(req);
      if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

      const body = await req.json();

      // Recréation manuelle depuis l'admin : utile si le brouillon
      // automatique (déclenché au paiement) a échoué et doit être relancé.
      if (body.action === "creer-brouillon") {
        const { orderId } = body;
        if (!orderId) return Response.json({ error: "orderId manquant" }, { status: 400 });
        const resultat = await creerBrouillonPourCommande(orderId);
        if (!resultat) return Response.json({ error: "cette commande n'est pas en livraison point relais" }, { status: 400 });
        return Response.json({ ok: true, ...resultat });
      }

      return Response.json({ error: "action inconnue" }, { status: 400 });
    }

    if (url.searchParams.get("check")) {
      const auth = await getAdminFromRequest(req);
      if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

      const from = { country: "FR", zip: "75002" };
      const services = await packlinkGet(
        `/v1/services?from[country]=${from.country}&from[zip]=${from.zip}&to[country]=FR&to[zip]=69001` +
          `&packages[0][weight]=1&packages[0][width]=20&packages[0][height]=5&packages[0][length]=40`,
        key,
      );
      const mondialRelay = services.find((s) => s.carrier_name === "Mondial Relay");
      return Response.json({ authentification: "réussie", mondialRelay, nbServices: services.length });
    }

    // Points relais Mondial Relay les plus proches d'un code postal.
    if (url.searchParams.get("points")) {
      const limite = await checkAndRecord("packlink-points", req, context, { max: 30, windowMs: 60 * 1000 });
      if (limite.limited) return Response.json({ error: "trop de requêtes" }, { status: 429 });

      const country = url.searchParams.get("country") || "FR";
      const postal = url.searchParams.get("postal");
      if (!postal) return Response.json({ error: "code postal manquant" });

      const points = await packlinkGet(`/v1/dropoffs/${MONDIAL_RELAY_SERVICE_ID}/${country}/${postal}`, key);
      return Response.json({
        points: points.map((p) => ({
          id: p.id,
          nom: p.commerce_name,
          adresse: p.address,
          ville: p.city,
          codePostal: p.zip,
          telephone: p.phone,
          horaires: p.opening_times?.opening_times,
          lat: p.lat,
          long: p.long,
        })),
      });
    }

    return Response.json({ error: "utilisez ?check=1 ou ?points=1&postal=...&country=FR" });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/packlink" };
