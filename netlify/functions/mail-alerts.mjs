import { sql } from "./lib/_db.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { credentials, getAccessToken, mailsImportants } from "./lib/_outlookMail.mjs";
import { analyserMail, construireBrouillon, iaConfiguree, reformulerBrouillon } from "./lib/_sav.mjs";

// Commandes servant au rapprochement. On charge la liste une seule fois, puis
// les fonctions pures de _sav.mjs décident : aucune requête n'est faite dans la
// boucle sur les mails. Colonnes réduites au strict nécessaire au brouillon.
async function commandesPourRapprochement() {
  const rows = await sql()`
    select order_number, email, status, tracking_number, tracking_carrier,
           shipped_at, shipping_address, created_at
    from orders
    order by id desc
    limit 200
  `;
  return rows.map((o) => ({
    orderNumber: o.order_number,
    email: o.email,
    status: o.status,
    trackingNumber: o.tracking_number,
    trackingCarrier: o.tracking_carrier,
    shippedAt: o.shipped_at,
    shippingAddress: o.shipping_address,
    createdAt: o.created_at,
  }));
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  // Reformulation d'un brouillon déjà affiché. Rien n'est envoyé : la réponse
  // repart dans l'interface, le propriétaire copie et envoie lui-même.
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body.action !== "reformuler") return Response.json({ error: "action inconnue" }, { status: 400 });
      const brouillon = construireBrouillon({ mail: body.mail || {}, commande: body.commande || null });
      const resultat = await reformulerBrouillon(brouillon, { faits: body.faits || "" });
      return Response.json({ brouillon: resultat });
    } catch (e) {
      return Response.json({ error: String(e.message || e) }, { status: 200 });
    }
  }

  const c = credentials();
  if (c.missing) return Response.json({ error: "missing_credentials", variables: c.missing }, { status: 200 });

  try {
    const token = await getAccessToken(c);
    const mails = await mailsImportants(token);

    // Le rapprochement ne doit jamais faire échouer l'affichage des mails :
    // si la base est injoignable, on retombe sur la liste sans SAV.
    let commandes = [];
    let savIndisponible = null;
    try {
      commandes = await commandesPourRapprochement();
    } catch (e) {
      savIndisponible = String(e.message || e);
    }

    // Un brouillon de SAV n'a de sens que pour un message de client : inutile
    // d'en proposer un sous une newsletter ou un relevé bancaire. On en fait
    // quand même un si une commande est rapprochée, quelle que soit la
    // catégorie, parce que le classement automatique peut se tromper.
    const enrichis = mails.map((m) => {
      if (savIndisponible) return m;
      const sav = analyserMail(m, commandes);
      const pertinent = m.categorie === "Client" || m.categorie === "Urgent" || sav.rapprochement;
      return pertinent ? { ...m, ...sav } : m;
    });

    return Response.json(
      {
        mails: enrichis,
        urgents: enrichis.filter((m) => m.urgent).length,
        ia: iaConfiguree(),
        savIndisponible,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/mail-alerts" };
