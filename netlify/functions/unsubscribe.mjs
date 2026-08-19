import { sql } from "./_db.mjs";
import { verifyUnsubscribeToken } from "./_unsubscribe.mjs";

function page({ title, message }) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}
.card{max-width:480px}h1{font-size:1.4rem}p{color:#a1a1aa}a{color:#e06a3b}</style>
</head><body><div class="card"><h1>${title}</h1><p>${message}</p><p><a href="/">Retour au site</a></p></div></body></html>`;
}

export default async (req) => {
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const token = url.searchParams.get("token") || "";

  if (!email || !token || !(await verifyUnsubscribeToken(email, token))) {
    return new Response(page({ title: "Lien invalide", message: "Ce lien de désinscription n'est pas valide." }), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  await sql()`update customers set marketing_opt_out = true where email = ${email}`;

  return new Response(
    page({ title: "Désinscription confirmée", message: `${email} ne recevra plus nos emails promotionnels (Black Friday, Noël, offres...).` }),
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
};

export const config = { path: "/api/unsubscribe" };
