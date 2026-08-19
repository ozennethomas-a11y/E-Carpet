import { sql } from "./_db.mjs";
import { siteOrigin } from "./_siteOrigin.mjs";
import { sendEmail, affiliateApplicationReceivedEmail, affiliateMagicLinkEmail, emailConfigured } from "./_email.mjs";
import { randomToken } from "./_auth.mjs";
import {
  createAffiliateSession,
  affiliateSessionCookieHeader,
  getAffiliateFromRequest,
} from "./_affiliateAuth.mjs";
import { checkAndRecord } from "./_rateLimit.mjs";

const TOKEN_MINUTES = 15;
const clean = (v, max) => String(v ?? "").trim().slice(0, max);

export default async (req, context) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // --- Candidature publique : crée l'affilié en statut "en_attente".
  if (req.method === "POST" && action === "apply") {
    const limiteApply = await checkAndRecord("affiliate-apply", req, context, { max: 5, windowMs: 60 * 60 * 1000 });
    if (limiteApply.limited) return Response.json({ error: "trop de candidatures, réessayez plus tard" }, { status: 429 });

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "requête invalide" }, { status: 400 });
    }

    const email = clean(body.email, 200).toLowerCase();
    const name = clean(body.name, 100);
    if (!email || !email.includes("@") || !name) {
      return Response.json({ error: "nom ou email manquant" }, { status: 400 });
    }

    const [existing] = await sql()`select id from affiliates where email = ${email}`;
    if (existing) return Response.json({ error: "une candidature existe déjà pour cet email" }, { status: 400 });

    await sql()`
      insert into affiliates (email, name, social, audience, message)
      values (${email}, ${name}, ${clean(body.social, 120)}, ${clean(body.audience, 120)}, ${clean(body.message, 1000)})
    `;

    if (emailConfigured()) {
      const { subject, html } = affiliateApplicationReceivedEmail({ name });
      await sendEmail({ to: email, subject, html }).catch((e) =>
        console.error("[affiliate-auth] échec email candidature:", e.message),
      );
    }

    return Response.json({ ok: true });
  }

  // --- Connexion magic-link : uniquement pour un affilié déjà actif.
  if (req.method === "POST" && action === "request-link") {
    const limiteLink = await checkAndRecord("affiliate-request-link", req, context, { max: 5, windowMs: 15 * 60 * 1000 });
    if (limiteLink.limited) return Response.json({ error: "trop de tentatives, réessayez plus tard" }, { status: 429 });

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "requête invalide" }, { status: 400 });
    }
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return Response.json({ error: "email invalide" }, { status: 400 });

    // Réponse volontairement identique qu'un compte existe ou non (et quel que
    // soit son statut), pour ne pas laisser deviner quelles adresses ont
    // candidaté au programme partenaires.
    const genericOk = Response.json({ ok: true });

    const [affiliate] = await sql()`select id, status from affiliates where email = ${email}`;
    if (!affiliate || affiliate.status !== "actif") return genericOk;

    const token = randomToken();
    const expiresAt = new Date(Date.now() + TOKEN_MINUTES * 60 * 1000);
    await sql()`insert into affiliate_login_tokens (email, token, expires_at) values (${email}, ${token}, ${expiresAt})`;

    const origin = siteOrigin(req);
    const link = `${origin}/api/affiliate-auth?action=verify&token=${token}`;

    if (emailConfigured()) {
      const { subject, html } = affiliateMagicLinkEmail({ url: link });
      try {
        await sendEmail({ to: email, subject, html });
      } catch (e) {
        console.error("[affiliate-auth] échec envoi magic link:", e.message);
        return Response.json({ error: "échec de l'envoi de l'email" }, { status: 200 });
      }
    } else {
      console.log(`[affiliate-auth] BREVO_API_KEY absente — jeton ${token.slice(0, 4)}**** généré pour ${email}`);
    }

    return Response.json({ ok: true });
  }

  if (req.method === "GET" && action === "verify") {
    const token = url.searchParams.get("token");
    const origin = siteOrigin(req);
    if (!token) return Response.redirect(`${origin}/influenceurs/espace?erreur=lien_invalide`, 302);

    const limiteVerify = await checkAndRecord("affiliate-verify", req, context, { max: 20, windowMs: 15 * 60 * 1000 });
    if (limiteVerify.limited) return Response.redirect(`${origin}/influenceurs/espace?erreur=trop_de_tentatives`, 302);

    const [row] = await sql()`
      select id, email from affiliate_login_tokens where token = ${token} and used_at is null and expires_at > now()
    `;
    if (!row) return Response.redirect(`${origin}/influenceurs/espace?erreur=lien_expire`, 302);

    const [affiliate] = await sql()`select id, status from affiliates where email = ${row.email}`;
    if (!affiliate || affiliate.status !== "actif") {
      return Response.redirect(`${origin}/influenceurs/espace?erreur=compte_inactif`, 302);
    }

    await sql()`update affiliate_login_tokens set used_at = now() where id = ${row.id}`;
    const sessionToken = await createAffiliateSession(affiliate.id);

    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}/influenceurs/espace`, "Set-Cookie": affiliateSessionCookieHeader(sessionToken) },
    });
  }

  if (req.method === "POST" && action === "logout") {
    return Response.json({ ok: true }, { headers: { "Set-Cookie": affiliateSessionCookieHeader(null, { clear: true }) } });
  }

  if (req.method === "GET" && action === "me") {
    const affiliate = await getAffiliateFromRequest(req);
    if (!affiliate) return Response.json({ affiliate: null });

    const [promo] = affiliate.promo_code_id
      ? await sql()`select code from promo_codes where id = ${affiliate.promo_code_id}`
      : [null];

    const commissions = await sql()`
      select c.id, c.amount_cents, c.status, c.created_at, o.order_number, o.total_cents
      from affiliate_commissions c
      join orders o on o.id = c.order_id
      where c.affiliate_id = ${affiliate.id}
      order by c.created_at desc
    `;
    const payouts = await sql()`
      select id, amount_cents, status, created_at
      from affiliate_payouts
      where affiliate_id = ${affiliate.id}
      order by created_at desc
    `;

    const dueCents = commissions.filter((c) => c.status === "due").reduce((s, c) => s + c.amount_cents, 0);
    const paidCents = commissions.filter((c) => c.status === "payee").reduce((s, c) => s + c.amount_cents, 0);
    const validOrders = commissions.filter((c) => c.status !== "annulee");

    return Response.json({
      affiliate: {
        email: affiliate.email,
        name: affiliate.name,
        commissionPercent: affiliate.commission_percent,
        promoCode: promo?.code || null,
        campaignSlug: affiliate.campaign_slug,
        stripePayoutsEnabled: affiliate.stripe_payouts_enabled,
        hasStripeAccount: !!affiliate.stripe_account_id,
      },
      kpi: {
        ordersCount: validOrders.length,
        revenueCents: validOrders.reduce((s, c) => s + c.total_cents, 0),
        dueCents,
        paidCents,
      },
      commissions: commissions.map((c) => ({
        id: c.id,
        orderNumber: c.order_number,
        totalCents: c.total_cents,
        amountCents: c.amount_cents,
        status: c.status,
        createdAt: c.created_at,
      })),
      payouts: payouts.map((p) => ({
        id: p.id,
        amountCents: p.amount_cents,
        status: p.status,
        createdAt: p.created_at,
      })),
    });
  }

  return Response.json({ error: "action inconnue" }, { status: 400 });
};

export const config = { path: "/api/affiliate-auth" };
