import { getStore } from "@netlify/blobs";
import { sql } from "./lib/_db.mjs";
import { siteOrigin } from "./lib/_siteOrigin.mjs";
import { campaignLabelOf } from "./shared/sources.mjs";
import { sendEmail, affiliateApplicationReceivedEmail, affiliateMagicLinkEmail, emailConfigured } from "./lib/_email.mjs";
import { randomToken } from "./lib/_auth.mjs";
import {
  createAffiliateSession,
  affiliateSessionCookieHeader,
  getAffiliateFromRequest,
} from "./lib/_affiliateAuth.mjs";
import { checkAndRecord } from "./lib/_rateLimit.mjs";

const TOKEN_MINUTES = 15;
const clean = (v, max) => String(v ?? "").trim().slice(0, max);
const RESEAUX_AFFILIES = ["TikTok", "Instagram", "Facebook", "YouTube"];

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

    // Réseaux sociaux : au moins un des quatre proposés (liste fermée, pas de
    // texte libre), chacun avec son lien de profil et son nombre d'abonnés —
    // condition posée pour évaluer sérieusement une candidature, et pouvoir
    // vérifier le profil en cliquant dessus.
    const networksIn = Array.isArray(body.networks) ? body.networks : [];
    const networks = networksIn.map((n) => ({
      platform: clean(n?.platform, 20),
      link: clean(n?.link, 300),
      followers: clean(n?.followers, 20),
    }));
    if (networks.length === 0) {
      return Response.json({ error: "sélectionnez au moins un réseau social" }, { status: 400 });
    }
    for (const n of networks) {
      if (!RESEAUX_AFFILIES.includes(n.platform)) {
        return Response.json({ error: "réseau social invalide" }, { status: 400 });
      }
      if (!n.link || !/^https?:\/\//.test(n.link)) {
        return Response.json({ error: `lien de profil manquant ou invalide pour ${n.platform}` }, { status: 400 });
      }
      if (!/^\d+$/.test(n.followers)) {
        return Response.json({ error: `nombre d'abonnés manquant pour ${n.platform}` }, { status: 400 });
      }
    }
    const platformsLabel = networks.map((n) => n.platform).join(", ");
    const followersLabel = networks.map((n) => `${n.platform}: ${n.followers}`).join(" · ");

    // Code choisi par le candidat lui-même (voir AffiliateApplyPage.jsx) —
    // utilisé tel quel à l'approbation, à la place d'un code généré à partir
    // du nom. Vérifié dès la candidature pour que le candidat sache tout de
    // suite s'il doit en choisir un autre, plutôt qu'au moment de
    // l'approbation par l'admin, bien plus tard.
    const promoCode = clean(body.promoCode, 20).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (promoCode.length < 4) {
      return Response.json({ error: "le code promo doit faire au moins 4 caractères (lettres/chiffres)" }, { status: 400 });
    }

    const [existing] = await sql()`select id from affiliates where email = ${email}`;
    if (existing) return Response.json({ error: "une candidature existe déjà pour cet email" }, { status: 400 });

    const [codePris] = await sql()`select id from promo_codes where code = ${promoCode}`;
    if (codePris) return Response.json({ error: "ce code promo est déjà utilisé, choisissez-en un autre" }, { status: 400 });
    const [codeDejaDemande] = await sql()`
      select id from affiliates where requested_promo_code = ${promoCode} and status != 'refuse'
    `;
    if (codeDejaDemande) return Response.json({ error: "ce code promo est déjà réservé par une autre candidature, choisissez-en un autre" }, { status: 400 });

    // Provenance de la candidature (utm_source du lien suivi). Sans elle, on
    // compte les inscriptions sans jamais savoir quelle relance les a
    // produites — et donc sans pouvoir refaire ce qui marche.
    const source = clean(body.source, 40) || null;

    await sql()`
      insert into affiliates (email, name, social, audience, networks, message, requested_promo_code, source)
      values (${email}, ${name}, ${platformsLabel}, ${followersLabel}, ${JSON.stringify(networks)}::jsonb, ${clean(body.message, 1000)}, ${promoCode}, ${source})
    `;

    // Fait apparaître la candidature dans le tableau de suivi influenceurs
    // (Réseaux sociaux > Influenceurs) au même endroit que le reste du
    // démarchage manuel, pour une vue unique de tout ce qui est en cours —
    // par email plutôt que par nom, pour retrouver la même personne si elle
    // recandidate ou était déjà suivie manuellement sous un autre nom.
    const prochaineAction = source
      ? `Étudier la candidature au programme d'affiliation (venue de : ${source})`
      : "Étudier la candidature au programme d'affiliation";
    const [dejaSuivi] = await sql()`select id from influencer_contacts where contact = ${email}`;
    if (dejaSuivi) {
      await sql()`
        update influencer_contacts
        set name = ${name}, platform = ${platformsLabel}, followers = ${followersLabel}, status = 'en_cours',
            next_action = ${prochaineAction}, updated_at = now()
        where id = ${dejaSuivi.id}
      `;
    } else {
      await sql()`
        insert into influencer_contacts (name, platform, followers, contact, status, next_action)
        values (${name}, ${platformsLabel}, ${followersLabel}, ${email}, 'en_cours', ${prochaineAction})
      `;
    }

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

    // Nombre de clics sur le lien personnel : compté par track.mjs à chaque
    // visite taguée (?utm_source=affilie&utm_campaign=<campaignSlug>), stocké
    // par jour dans le même store "analytics" que le reste des statistiques
    // du site — on additionne juste tous les jours connus pour ce libellé.
    let clicksCount = 0;
    if (affiliate.campaign_slug) {
      const label = campaignLabelOf("affilie", affiliate.campaign_slug);
      const store = getStore("analytics");
      const idx = await store.get("index", { type: "json" }).catch(() => null);
      const jours = await Promise.all(
        (idx?.days || []).map((date) => store.get(`day/${date}`, { type: "json" }).catch(() => null)),
      );
      clicksCount = jours.reduce((s, d) => s + (d?.campaigns?.[label] || 0), 0);
    }

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
        clicksCount,
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
