import { getStore } from "@netlify/blobs";
import { sql } from "./_db.mjs";
import { sendEmail, affiliateApprovedEmail, emailConfigured } from "./_email.mjs";
import { slug, campaignLabelOf } from "./shared/sources.mjs";
import { getAdminFromRequest } from "./_adminAuth.mjs";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomSuffix(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function siteOrigin(req) {
  const fromEnv = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return new URL(req.url).origin;
}

// Réutilise le même store et la même clé que links.mjs, pour que le lien créé
// à l'approbation d'un affilié apparaisse dans l'onglet Liens comme n'importe
// quel autre lien tagué.
async function addTaggedLink(origin, source, campaign, note) {
  const store = getStore("analytics");
  const data = await store.get("links", { type: "json" }).catch(() => null);
  const links = Array.isArray(data?.links) ? data.links : [];
  const label = campaignLabelOf(source, campaign);
  if (links.some((l) => l.label === label)) return label;

  const p = new URLSearchParams({ utm_source: source, utm_campaign: campaign });
  links.unshift({
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    source,
    campaign,
    label,
    note,
    url: `${origin}/?${p.toString()}`,
    created: new Date().toISOString(),
  });
  await store.setJSON("links", { links });
  return label;
}

async function createAffiliatePromoCode(name, commissionPercent) {
  const base = slug(name).toUpperCase().replace(/-/g, "").slice(0, 6) || "PARTENAIRE";
  for (let essai = 0; essai < 5; essai++) {
    const code = `${base}${randomSuffix()}`;
    try {
      const [row] = await sql()`
        insert into promo_codes (code, type, value, source) values (${code}, 'percent', ${commissionPercent}, 'affilie')
        returning id, code
      `;
      return row;
    } catch (e) {
      if (!String(e.message || e).toLowerCase().includes("unique")) throw e;
    }
  }
  throw new Error("impossible de générer un code promo unique");
}

function toJson(a) {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    social: a.social,
    audience: a.audience,
    message: a.message,
    status: a.status,
    commissionPercent: a.commission_percent,
    promoCode: a.promo_code || null,
    campaignSlug: a.campaign_slug,
    stripeAccountId: a.stripe_account_id,
    stripePayoutsEnabled: a.stripe_payouts_enabled,
    dueCents: Number(a.due_cents || 0),
    paidCents: Number(a.paid_cents || 0),
    createdAt: a.created_at,
  };
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  try {
    if (req.method === "GET") {
      const rows = await sql()`
        select a.*, p.code as promo_code,
          coalesce(sum(c.amount_cents) filter (where c.status = 'due'), 0) as due_cents,
          coalesce(sum(c.amount_cents) filter (where c.status = 'payee'), 0) as paid_cents
        from affiliates a
        left join promo_codes p on p.id = a.promo_code_id
        left join affiliate_commissions c on c.affiliate_id = a.id
        group by a.id, p.code
        order by a.id desc
      `;
      return Response.json({ affiliates: rows.map(toJson) });
    }

    if (req.method === "POST") {
      const body = await req.json();

      if (body.action === "approuver") {
        if (!body.id) return Response.json({ error: "id manquant" }, { status: 400 });
        const commissionPercent = Math.min(100, Math.max(1, Math.round(Number(body.commissionPercent) || 10)));

        const [affiliate] = await sql()`select * from affiliates where id = ${body.id}`;
        if (!affiliate) return Response.json({ error: "candidature introuvable" }, { status: 404 });
        if (affiliate.status === "actif") return Response.json({ error: "déjà actif" }, { status: 400 });

        const promo = await createAffiliatePromoCode(affiliate.name, commissionPercent);
        const campaignSlug = slug(affiliate.name) || `partenaire-${affiliate.id}`;
        await addTaggedLink(siteOrigin(req), "affilie", campaignSlug, affiliate.name);

        await sql()`
          update affiliates
          set status = 'actif', commission_percent = ${commissionPercent}, promo_code_id = ${promo.id}, campaign_slug = ${campaignSlug}
          where id = ${affiliate.id}
        `;

        if (emailConfigured()) {
          const origin = siteOrigin(req);
          const { subject, html } = affiliateApprovedEmail({
            name: affiliate.name,
            promoCode: promo.code,
            commissionPercent,
            affiliateLink: `${origin}/?${new URLSearchParams({ utm_source: "affilie", utm_campaign: campaignSlug }).toString()}`,
            spaceUrl: `${origin}/influenceurs/espace`,
          });
          await sendEmail({ to: affiliate.email, subject, html }).catch((e) =>
            console.error("[affiliates] échec email approbation:", e.message),
          );
        }

        return Response.json({ ok: true });
      }

      if (body.action === "refuser" || body.action === "suspendre") {
        if (!body.id) return Response.json({ error: "id manquant" }, { status: 400 });
        const status = body.action === "refuser" ? "refuse" : "suspendu";
        await sql()`update affiliates set status = ${status} where id = ${body.id}`;
        return Response.json({ ok: true });
      }

      if (body.action === "reactiver") {
        if (!body.id) return Response.json({ error: "id manquant" }, { status: 400 });
        await sql()`update affiliates set status = 'actif' where id = ${body.id}`;
        return Response.json({ ok: true });
      }

      if (body.action === "modifier-commission") {
        if (!body.id) return Response.json({ error: "id manquant" }, { status: 400 });
        const commissionPercent = Math.min(100, Math.max(1, Math.round(Number(body.commissionPercent))));
        if (!Number.isFinite(commissionPercent)) return Response.json({ error: "taux invalide" }, { status: 400 });

        const [affiliate] = await sql()`select promo_code_id from affiliates where id = ${body.id}`;
        if (!affiliate) return Response.json({ error: "affilié introuvable" }, { status: 404 });

        await sql()`update affiliates set commission_percent = ${commissionPercent} where id = ${body.id}`;
        if (affiliate.promo_code_id) {
          await sql()`update promo_codes set value = ${commissionPercent} where id = ${affiliate.promo_code_id}`;
        }
        return Response.json({ ok: true });
      }

      return Response.json({ error: "action inconnue" }, { status: 400 });
    }

    return Response.json({ error: "méthode non supportée" }, { status: 405 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/affiliates" };
