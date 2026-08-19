import { sql } from "./lib/_db.mjs";
import { siteOrigin } from "./lib/_siteOrigin.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { sendEmail, emailConfigured } from "./lib/_email.mjs";
import { unsubscribeToken } from "./lib/_unsubscribe.mjs";

function withFooter(html, unsubscribeUrl, pixelUrl) {
  return `${html}
<hr style="margin-top:32px;border:none;border-top:1px solid #e5e5e5">
<p style="color:#999;font-size:12px;margin-top:12px">
  Vous recevez cet email car vous êtes client E-Carpet.
  <a href="${unsubscribeUrl}" style="color:#999">Se désinscrire</a>
</p>
<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none">`;
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    if (req.method === "GET") {
      const [{ count }] = await sql()`select count(*)::int as count from customers where marketing_opt_out = false`;
      const campagnes = await sql()`
        select c.id, c.subject, c.recipient_count, c.sent_count, c.sent_at,
               count(s.opened_at)::int as open_count
        from mailing_campaigns c
        left join mailing_sends s on s.campaign_id = c.id
        group by c.id
        order by c.sent_at desc
      `;
      return Response.json({ recipientCount: count, emailConfigured: emailConfigured(), campagnes });
    }

    if (req.method === "POST") {
      if (!emailConfigured()) return Response.json({ error: "BREVO_API_KEY absente" }, { status: 503 });

      const body = await req.json().catch(() => ({}));
      const subject = String(body.subject || "").trim();
      const html = String(body.html || "").trim();
      if (!subject || !html) return Response.json({ error: "sujet et contenu requis" }, { status: 400 });

      const origin = siteOrigin(req);
      const destinataires = await sql()`select email from customers where marketing_opt_out = false`;

      const [campagne] = await sql()`
        insert into mailing_campaigns (subject, recipient_count)
        values (${subject}, ${destinataires.length})
        returning id
      `;

      let envoyes = 0;
      const echecs = [];
      for (const { email } of destinataires) {
        try {
          const [envoi] = await sql()`
            insert into mailing_sends (campaign_id, email) values (${campagne.id}, ${email}) returning id
          `;
          const token = await unsubscribeToken(email);
          const unsubscribeUrl = `${origin}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
          const pixelUrl = `${origin}/api/mailing-pixel?id=${envoi.id}`;
          await sendEmail({ to: email, subject, html: withFooter(html, unsubscribeUrl, pixelUrl) });
          envoyes++;
        } catch (e) {
          echecs.push({ email, error: String(e.message || e) });
        }
      }

      await sql()`update mailing_campaigns set sent_count = ${envoyes} where id = ${campagne.id}`;

      return Response.json({ envoyes, total: destinataires.length, echecs });
    }

    return Response.json({ error: "méthode non autorisée" }, { status: 405 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/mailing" };
