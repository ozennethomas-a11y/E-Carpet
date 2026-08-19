import { sql } from "./_db.mjs";
import { sendEmail, magicLinkEmail, emailConfigured } from "./_email.mjs";
import { findOrCreateCustomer } from "./_customers.mjs";
import { randomToken, createSession, sessionCookieHeader, getCustomerFromRequest, SESSION_COOKIE } from "./_auth.mjs";
import { checkAndRecord } from "./_rateLimit.mjs";
import { siteOrigin } from "./_siteOrigin.mjs";

const TOKEN_MINUTES = 15;

export default async (req, context) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (req.method === "POST" && action === "request-link") {
    const limite = await checkAndRecord("auth-request-link", req, context, { max: 5, windowMs: 15 * 60 * 1000 });
    if (limite.limited) {
      return Response.json({ error: `trop de tentatives, réessayez dans ${Math.ceil(limite.retryAfterSeconds / 60)} min` }, { status: 429 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "requête invalide" }, { status: 400 });
    }
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return Response.json({ error: "email invalide" }, { status: 400 });

    const customer = await findOrCreateCustomer(email);
    const token = randomToken();
    const expiresAt = new Date(Date.now() + TOKEN_MINUTES * 60 * 1000);
    await sql()`insert into login_tokens (email, token, expires_at) values (${customer.email}, ${token}, ${expiresAt})`;

    const origin = siteOrigin(req);
    const link = `${origin}/api/auth?action=verify&token=${token}`;

    if (emailConfigured()) {
      const { subject, html } = magicLinkEmail({ url: link });
      try {
        await sendEmail({ to: customer.email, subject, html });
      } catch (e) {
        console.error("[auth] échec envoi magic link:", e.message);
        return Response.json({ error: "échec de l'envoi de l'email" }, { status: 200 });
      }
    } else {
      // Le lien complet (avec le jeton de connexion) n'est jamais journalisé :
      // les logs Netlify persistent et un jeton valide y donnerait un accès direct.
      console.log(`[auth] BREVO_API_KEY absente — jeton ${token.slice(0, 4)}**** généré pour ${customer.email}`);
    }

    return Response.json({ ok: true });
  }

  if (req.method === "GET" && action === "verify") {
    const token = url.searchParams.get("token");
    const origin = siteOrigin(req);
    if (!token) return Response.redirect(`${origin}/compte?erreur=lien_invalide`, 302);

    const limite = await checkAndRecord("auth-verify", req, context, { max: 20, windowMs: 15 * 60 * 1000 });
    if (limite.limited) return Response.redirect(`${origin}/compte?erreur=trop_de_tentatives`, 302);

    const [row] = await sql()`select id, email from login_tokens where token = ${token} and used_at is null and expires_at > now()`;
    if (!row) return Response.redirect(`${origin}/compte?erreur=lien_expire`, 302);

    await sql()`update login_tokens set used_at = now() where id = ${row.id}`;
    const customer = await findOrCreateCustomer(row.email);
    const sessionToken = await createSession(customer.id);

    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}/compte`, "Set-Cookie": sessionCookieHeader(sessionToken) },
    });
  }

  if (req.method === "POST" && action === "logout") {
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookieHeader(null, { clear: true }) } });
  }

  if (req.method === "GET" && action === "me") {
    const customer = await getCustomerFromRequest(req);
    if (!customer) return Response.json({ customer: null });

    const orders = await sql()`
      select id, order_number, status, total_cents, currency, shipping_address, tracking_number, tracking_carrier, created_at
      from orders
      where customer_id = ${customer.id} or email = ${customer.email}
      order by created_at desc
    `;
    const orderIds = orders.map((o) => o.id);
    const items = orderIds.length
      ? await sql()`select order_id, name, unit_price_cents, quantity from order_items where order_id = any(${orderIds})`
      : [];

    return Response.json({
      customer: { email: customer.email, firstName: customer.first_name, lastName: customer.last_name },
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        totalCents: o.total_cents,
        currency: o.currency,
        deliveryMode: o.shipping_address?.deliveryMode,
        pickupPoint: o.shipping_address?.pickupPoint,
        trackingNumber: o.tracking_number,
        trackingCarrier: o.tracking_carrier,
        createdAt: o.created_at,
        items: items.filter((it) => it.order_id === o.id),
      })),
    });
  }

  return Response.json({ error: "action inconnue" }, { status: 400 });
};

export const config = { path: "/api/auth" };
