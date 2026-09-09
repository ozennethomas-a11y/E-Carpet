import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { detecterAnomalies } from "./lib/_anomalies.mjs";

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    const resultat = await detecterAnomalies();
    // Pas de cache : une anomalie servie depuis un cache périmé est pire
    // qu'une absence d'anomalie, puisqu'elle donne une fausse assurance.
    return Response.json(resultat, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/anomalies" };
