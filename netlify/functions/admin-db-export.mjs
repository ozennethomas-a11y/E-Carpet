// Expose ponctuellement la chaîne de connexion réelle de la base de
// production, pour migration Netlify DB → Neon en direct (2026-08-31).
// Protégé par la session admin. À SUPPRIMER dès la migration terminée et
// vérifiée : ce n'est pas une fonctionnalité destinée à rester en production.
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { getConnectionString } from "@netlify/database";

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    return Response.json({ connectionString: getConnectionString() });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/admin-db-export" };
