// Suivi manuel des influenceurs contactés (distinct de `affiliates`, qui ne
// concerne que ceux ayant un compte actif sur l'espace partenaire). Tableau
// éditable dans l'admin, onglet Réseaux sociaux > Influenceurs.
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { sql } from "./lib/_db.mjs";

function toApi(row) {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform || "",
    followers: row.followers || "",
    contact: row.contact || "",
    offer: row.offer || "",
    status: row.status,
    publication: row.publication || "",
    onSite: row.on_site,
    nextAction: row.next_action || "",
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  const url = new URL(req.url);

  try {
    if (req.method === "GET") {
      const rows = await sql()`select * from influencer_contacts order by updated_at desc, id desc`;
      return Response.json({ influenceurs: rows.map(toApi) });
    }

    if (req.method === "POST") {
      const body = await req.json();

      if (body.action === "creer") {
        const name = String(body.name || "").trim();
        if (!name) return Response.json({ error: "nom manquant" }, { status: 400 });
        const [row] = await sql()`
          insert into influencer_contacts (name, platform, followers, contact, offer, status, publication, on_site, next_action, note)
          values (${name}, ${body.platform || null}, ${body.followers || null}, ${body.contact || null},
                  ${body.offer || null}, ${body.status || "a_contacter"}, ${body.publication || null},
                  ${!!body.onSite}, ${body.nextAction || null}, ${body.note || null})
          returning *
        `;
        return Response.json({ influenceur: toApi(row) });
      }

      if (body.action === "modifier") {
        const { id } = body;
        if (!id) return Response.json({ error: "id manquant" }, { status: 400 });
        const [existant] = await sql()`select id from influencer_contacts where id = ${id}`;
        if (!existant) return Response.json({ error: "introuvable" }, { status: 404 });

        const [row] = await sql()`
          update influencer_contacts set
            name = ${String(body.name || "").trim() || "—"},
            platform = ${body.platform || null},
            followers = ${body.followers || null},
            contact = ${body.contact || null},
            offer = ${body.offer || null},
            status = ${body.status || "a_contacter"},
            publication = ${body.publication || null},
            on_site = ${!!body.onSite},
            next_action = ${body.nextAction || null},
            note = ${body.note || null},
            updated_at = now()
          where id = ${id}
          returning *
        `;
        return Response.json({ influenceur: toApi(row) });
      }

      if (body.action === "supprimer") {
        const { id } = body;
        if (!id) return Response.json({ error: "id manquant" }, { status: 400 });
        await sql()`delete from influencer_contacts where id = ${id}`;
        return Response.json({ ok: true });
      }

      return Response.json({ error: "action inconnue" }, { status: 400 });
    }

    return Response.json({ error: "méthode non supportée" }, { status: 405 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/influencers" };
