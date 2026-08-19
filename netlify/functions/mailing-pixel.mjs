import { sql } from "./_db.mjs";

// GIF transparent 1x1, le format le plus universellement supporté par les
// clients mail comme image de suivi.
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7"), (c) => c.charCodeAt(0));

export default async (req) => {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));

  if (id) {
    // "opened_at is null" : on ne compte que la première ouverture, les
    // rechargements du client mail (répondre, transférer...) ne gonflent
    // pas artificiellement le taux d'ouverture.
    try {
      await sql()`update mailing_sends set opened_at = now() where id = ${id} and opened_at is null`;
    } catch {
      // id inconnu ou erreur DB : le pixel doit rester renvoyé sans erreur
    }
  }

  return new Response(PIXEL, {
    headers: { "content-type": "image/gif", "cache-control": "no-store" },
  });
};

export const config = { path: "/api/mailing-pixel" };
