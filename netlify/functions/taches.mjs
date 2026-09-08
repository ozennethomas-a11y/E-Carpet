import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { etatDesTaches } from "./lib/_taches.mjs";
import { sql } from "./lib/_db.mjs";

// État des tâches planifiées, pour l'écran d'accueil du back-office.
export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  const url = new URL(req.url);

  // Historique détaillé d'une tâche, pour comprendre une panne récurrente.
  if (url.searchParams.get("historique")) {
    const task = url.searchParams.get("historique");
    const lignes = await sql()`
      select status, detail, duration_ms, started_at
      from cron_runs where task = ${task}
      order by started_at desc limit 20
    `;
    return Response.json({ lignes });
  }

  return Response.json({ taches: await etatDesTaches() });
};

export const config = { path: "/api/taches" };
