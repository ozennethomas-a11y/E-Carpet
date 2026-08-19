import { sql } from "./lib/_db.mjs";
import { sendEmail, orderShippedEmail, emailConfigured } from "./lib/_email.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";

async function listOrders() {
  const orders = await sql()`
    select o.id, o.order_number, o.email, o.status, o.total_cents, o.currency, o.shipping_address,
           o.tracking_number, o.tracking_carrier, o.shipped_at, o.review_request_sent_at, o.created_at,
           o.discount_cents, o.packlink_draft_reference, p.code as promo_code
    from orders o
    left join promo_codes p on p.id = o.promo_code_id
    order by o.id desc
    limit 200
  `;
  const items = await sql()`
    select order_id, name, unit_price_cents, quantity
    from order_items
    where order_id = any(${orders.map((o) => o.id)})
  `;
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    email: o.email,
    status: o.status,
    totalCents: o.total_cents,
    currency: o.currency,
    shippingAddress: o.shipping_address,
    trackingNumber: o.tracking_number,
    trackingCarrier: o.tracking_carrier,
    packlinkDraftReference: o.packlink_draft_reference,
    shippedAt: o.shipped_at,
    reviewRequestSentAt: o.review_request_sent_at,
    discountCents: o.discount_cents,
    promoCode: o.promo_code,
    createdAt: o.created_at,
    items: items.filter((it) => it.order_id === o.id).map((it) => ({
      name: it.name,
      unitPriceCents: it.unit_price_cents,
      quantity: it.quantity,
    })),
  }));
}

export default async (req) => {
  const auth = await getAdminFromRequest(req);
  if (auth !== "ok") return Response.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });

  const url = new URL(req.url);

  try {
    if (req.method === "GET") {
      return Response.json({ orders: await listOrders() });
    }

    if (req.method === "POST") {
      const body = await req.json();

      if (body.action === "expedier") {
        const { orderId, trackingNumber, trackingCarrier } = body;
        if (!orderId || !trackingNumber) return Response.json({ error: "numéro de suivi manquant" }, { status: 400 });

        const [order] = await sql()`
          update orders
          set status = 'expediee', tracking_number = ${trackingNumber}, tracking_carrier = ${trackingCarrier || null}, shipped_at = now()
          where id = ${orderId}
          returning id, order_number, email, shipping_address
        `;
        if (!order) return Response.json({ error: "commande introuvable" }, { status: 404 });

        if (emailConfigured()) {
          const { subject, html } = orderShippedEmail({
            orderId: order.order_number,
            trackingNumber,
            trackingCarrier,
            deliveryMode: order.shipping_address?.deliveryMode,
            pickupPoint: order.shipping_address?.pickupPoint,
            address: order.shipping_address,
          });
          await sendEmail({ to: order.email, subject, html }).catch((e) => console.error("[orders] email expédition:", e.message));
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

export const config = { path: "/api/orders" };
