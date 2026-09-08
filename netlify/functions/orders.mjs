import { sql } from "./lib/_db.mjs";
import { sendEmail, orderShippedEmail, emailConfigured } from "./lib/_email.mjs";
import { getAdminFromRequest } from "./lib/_adminAuth.mjs";
import { marquerCommandePayee } from "./lib/_orderPaid.mjs";

// Marque une commande comme expédiée et envoie l'email de suivi. Réutilisé
// à la fois par l'action "expedier" (ligne par ligne) et par l'import CSV en
// masse "expedier-lot".
async function expedierCommande({ orderId, trackingNumber, trackingCarrier }) {
  const [order] = await sql()`
    update orders
    set status = 'expediee', tracking_number = ${trackingNumber}, tracking_carrier = ${trackingCarrier || null}, shipped_at = now()
    where id = ${orderId}
    returning id, order_number, email, shipping_address
  `;
  if (!order) return { ok: false };

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

  return { ok: true };
}

async function listOrders() {
  const orders = await sql()`
    select o.id, o.order_number, o.email, o.status, o.total_cents, o.currency, o.shipping_address,
           o.tracking_number, o.tracking_carrier, o.shipped_at, o.review_request_sent_at, o.created_at,
           o.discount_cents, o.packlink_draft_reference, o.shipping_cost_cents, p.code as promo_code
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
    shippingCostCents: o.shipping_cost_cents,
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

        const result = await expedierCommande({ orderId, trackingNumber, trackingCarrier });
        if (!result.ok) return Response.json({ error: "commande introuvable" }, { status: 404 });
        return Response.json({ ok: true });
      }

      // Enregistre le coût réel de l'étiquette d'expédition (Packlink ne
      // fournit pas le prix par API — le tarif moyen estimé est utilisé
      // ailleurs tant que ce champ est nul).
      if (body.action === "definir-cout-expedition") {
        const { orderId, shippingCostCents } = body;
        if (!orderId) return Response.json({ error: "commande manquante" }, { status: 400 });
        if (!Number.isFinite(shippingCostCents) || shippingCostCents < 0) {
          return Response.json({ error: "coût d'expédition invalide" }, { status: 400 });
        }

        const [order] = await sql()`
          update orders set shipping_cost_cents = ${shippingCostCents} where id = ${orderId}
          returning id
        `;
        if (!order) return Response.json({ error: "commande introuvable" }, { status: 404 });
        return Response.json({ ok: true });
      }

      // Import CSV en masse des numéros de suivi. Applique "expedier" ligne
      // par ligne côté serveur et rapporte les succès/échecs à la fin.
      if (body.action === "expedier-lot") {
        const { lignes } = body;
        if (!Array.isArray(lignes) || lignes.length === 0) {
          return Response.json({ error: "aucune ligne à importer" }, { status: 400 });
        }

        let succes = 0;
        const introuvables = [];
        for (const ligne of lignes) {
          const { orderNumber, trackingCarrier, trackingNumber } = ligne;
          if (!orderNumber || !trackingNumber) {
            introuvables.push(orderNumber || "?");
            continue;
          }
          const [order] = await sql()`select id from orders where order_number = ${orderNumber}`;
          if (!order) {
            introuvables.push(orderNumber);
            continue;
          }
          const result = await expedierCommande({ orderId: order.id, trackingNumber, trackingCarrier });
          if (result.ok) succes++;
          else introuvables.push(orderNumber);
        }

        return Response.json({ ok: true, succes, introuvables });
      }

      // Rattrapage manuel : marque une commande comme payée sans passer par
      // le webhook Stripe (ex. paiement confirmé par ailleurs — client
      // recontacté directement — pendant que le webhook était mal configuré).
      // N'envoie jamais l'email de confirmation automatiquement : à cocher
      // explicitement seulement si le client n'a pas déjà été prévenu autrement.
      if (body.action === "marquer-payee") {
        const { orderId, paymentIntent, envoyerEmail } = body;
        if (!orderId) return Response.json({ error: "commande manquante" }, { status: 400 });

        const result = await marquerCommandePayee(orderId, {
          paymentIntent: paymentIntent || null,
          envoyerEmail: !!envoyerEmail,
        });
        if (!result.ok) return Response.json({ error: result.reason }, { status: 409 });
        return Response.json({ ok: true });
      }

      // Supprime une commande jamais payée (panier abandonné). Restreint
      // volontairement au statut 'en_attente_paiement' : jamais de commande
      // payée/expédiée, même à la demande, pour ne pas perdre une preuve
      // comptable ou casser une commission d'affilié déjà due.
      if (body.action === "supprimer") {
        const { orderId } = body;
        if (!orderId) return Response.json({ error: "commande manquante" }, { status: 400 });

        const [order] = await sql()`select id, status from orders where id = ${orderId}`;
        if (!order) return Response.json({ error: "commande introuvable" }, { status: 404 });
        if (order.status !== "en_attente_paiement") {
          return Response.json({ error: "seule une commande en attente de paiement peut être supprimée" }, { status: 409 });
        }

        await sql()`delete from order_items where order_id = ${orderId}`;
        await sql()`delete from affiliate_commissions where order_id = ${orderId}`;
        await sql()`update stock_movements set order_id = null where order_id = ${orderId}`;
        await sql()`delete from orders where id = ${orderId}`;
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
