import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { dernierRapport, collecterSnapshot, construireRapport } from "./lib/_rapport.mjs";

// Dernier rapport hebdomadaire, pour le back-office.
//
// `?maintenant=1` recalcule un rapport à la volée sans l'enregistrer ni rien
// envoyer : utile le jour où l'on veut voir la semaine en cours sans attendre
// lundi, et pour vérifier le rendu après une modification des seuils.
export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    const url = new URL(req.url);
    if (url.searchParams.get("maintenant")) {
      return Response.json({ rapport: construireRapport(await collecterSnapshot()), aperçu: true });
    }
    return Response.json({ rapport: await dernierRapport() }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/rapport" };
