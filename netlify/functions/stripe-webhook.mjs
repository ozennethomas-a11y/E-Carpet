import { sql } from "./lib/_db.mjs";
import { sendEmail, orderConfirmationEmail, affiliateSaleNotificationEmail, emailConfigured } from "./lib/_email.mjs";
import { stripeSecretKey, stripeRequest } from "./lib/_stripe.mjs";
import { constantTimeEqual } from "./lib/_crypto.mjs";
import { creerBrouillonPourCommande } from "./lib/_packlink.mjs";

// Vérifie la signature Stripe sans dépendance externe : HMAC-SHA256 sur
// "{timestamp}.{payload}" comparé au(x) header(s) v1 de Stripe-Signature.
async function verifyStripeSignature(payload, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const signedPayload = `${parts.t}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(hex, parts.v1 || "");
}

export default async (req) => {
  console.log("[stripe-webhook] invoked");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "STRIPE_WEBHOOK_SECRET manquante" }, { status: 200 });

  const payload = await req.text();
  const sigHeader = req.headers.get("stripe-signature") || "";

  const valid = await verifyStripeSignature(payload, sigHeader, secret).catch(() => false);
  if (!valid) return Response.json({ error: "signature invalide" }, { status: 400 });

  const event = JSON.parse(payload);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = Number(session.metadata?.orderId);
      if (!orderId) return Response.json({ received: true });

      const [order] = await sql()`
        select o.id, o.order_number, o.status, o.email, o.total_cents, o.currency, o.shipping_address,
               o.promo_code_id, o.discount_cents, p.code as promo_code
        from orders o
        left join promo_codes p on p.id = o.promo_code_id
        where o.id = ${orderId}
      `;
      if (!order || order.status !== "en_attente_paiement") return Response.json({ received: true });

      await sql()`update orders set status = 'payee', stripe_payment_intent_id = ${session.payment_intent} where id = ${orderId}`;

      // Frais Stripe réel (pas une estimation) : demande le paiement avec sa
      // charge/transaction de solde développées. N'empêche pas le reste du
      // webhook si Stripe est momentanément indisponible.
      const key = stripeSecretKey();
      if (key && session.payment_intent) {
        try {
          const pi = await stripeRequest(
            `/payment_intents/${session.payment_intent}`,
            { expand: ["latest_charge.balance_transaction"] },
            key,
            { method: "GET" },
          );
          const feeCents = pi.latest_charge?.balance_transaction?.fee;
          if (feeCents != null) {
            await sql()`update orders set stripe_fee_cents = ${feeCents} where id = ${orderId}`;
          }
        } catch (e) {
          console.error(`[stripe-webhook] échec récupération frais Stripe commande ${orderId}:`, e.message);
        }
      }

      const items = await sql()`select product_id, name, unit_price_cents, quantity from order_items where order_id = ${orderId}`;
      for (const it of items) {
        await sql()`update products set stock = greatest(stock - ${it.quantity}, 0) where id = ${it.product_id}`;
        // Journal des mouvements de stock (onglet Stock du back-office). Le
        // check "status !== en_attente_paiement" plus haut garantit qu'on
        // n'entre dans ce bloc qu'une seule fois par commande, même si
        // Stripe rejoue le webhook.
        await sql()`
          insert into stock_movements (product_id, type, quantity, source, movement_date, order_id)
          values (${it.product_id}, 'sortie', ${it.quantity}, 'vente_site', now(), ${orderId})
        `;
      }

      if (order.promo_code_id) {
        // Incrément gardé par la condition max_uses dans la même requête : deux
        // paiements concurrents utilisant un code à usage unique ne peuvent pas
        // tous les deux réussir cet UPDATE (l'un des deux ne trouvera plus de
        // ligne correspondante une fois le seuil atteint). Le paiement Stripe a
        // déjà eu lieu à ce stade — on ne peut pas l'annuler, mais on évite au
        // moins de laisser le compteur dépasser la limite prévue, et on journalise
        // le cas pour vérification manuelle.
        const [incremented] = await sql()`
          update promo_codes set used_count = used_count + 1
          where id = ${order.promo_code_id} and (max_uses is null or used_count < max_uses)
          returning id
        `;
        if (!incremented) {
          console.error(
            `[stripe-webhook] commande ${order.id} : code promo ${order.promo_code_id} déjà épuisé au moment du paiement (course concurrente) — à vérifier manuellement`,
          );
        }

        // Un code promo peut appartenir à un partenaire affilié : dans ce cas, la
        // commande lui rapporte une commission sur le montant payé.
        const [affiliate] = await sql()`select id, email, name, commission_percent from affiliates where promo_code_id = ${order.promo_code_id}`;
        if (affiliate) {
          const amountCents = Math.round((order.total_cents * affiliate.commission_percent) / 100);
          const [commission] = await sql()`
            insert into affiliate_commissions (affiliate_id, order_id, amount_cents)
            values (${affiliate.id}, ${order.id}, ${amountCents})
            on conflict (order_id) do nothing
            returning id
          `;
          await sql()`update orders set affiliate_id = ${affiliate.id} where id = ${order.id}`;

          // Notification seulement sur une insertion réelle (pas sur un rejeu du
          // webhook Stripe pour le même événement, protégé par le on conflict ci-dessus).
          if (commission && emailConfigured()) {
            const { subject, html } = affiliateSaleNotificationEmail({
              name: affiliate.name,
              amountCents,
              spaceUrl: "https://e-carpet.shop/influenceurs/espace",
            });
            await sendEmail({ to: affiliate.email, subject, html }).catch((e) =>
              console.error(`[stripe-webhook] échec email notification vente affilié ${affiliate.id}:`, e.message),
            );
          }
        }
      }

      console.log(`[stripe-webhook] commande ${order.id} marquée payée`);

      // Brouillon Packlink (point relais uniquement) : aucun envoi n'est
      // facturé/commandé, seulement préparé pour que l'admin n'ait plus qu'à
      // valider l'expédition une fois le colis déposé. Un échec ici ne doit
      // jamais faire échouer la confirmation de paiement — l'admin peut
      // recréer le brouillon manuellement depuis l'onglet Commandes.
      try {
        await creerBrouillonPourCommande(orderId);
      } catch (e) {
        console.error(`[stripe-webhook] échec création brouillon Packlink commande ${orderId}:`, e.message);
      }

      if (emailConfigured()) {
        const { subject, html } = orderConfirmationEmail({
          orderId: order.order_number,
          items,
          totalCents: order.total_cents,
          currency: order.currency,
          discountCents: order.discount_cents,
          promoCode: order.promo_code,
          deliveryMode: order.shipping_address?.deliveryMode,
          pickupPoint: order.shipping_address?.pickupPoint,
          address: order.shipping_address,
        });
        await sendEmail({ to: order.email, subject, html })
          .then(() => console.log(`[stripe-webhook] email de confirmation envoyé pour la commande ${order.id}`))
          .catch((e) => console.error(`[stripe-webhook] échec email confirmation commande ${order.id}:`, e.message));
      } else {
        console.log("[stripe-webhook] BREVO_API_KEY absente, email non envoyé");
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object;
      if (!charge.payment_intent) return Response.json({ received: true });

      const [order] = await sql()`select id, status from orders where stripe_payment_intent_id = ${charge.payment_intent}`;
      if (!order) return Response.json({ received: true });

      await sql()`update orders set status = 'remboursee' where id = ${order.id}`;

      // La commission n'a de sens que si la vente tient toujours. Si elle a déjà
      // été versée au partenaire, on ne la retire pas automatiquement (réconciliation manuelle).
      await sql()`update affiliate_commissions set status = 'annulee' where order_id = ${order.id} and status = 'due'`;

      console.log(`[stripe-webhook] commande ${order.id} marquée remboursée`);
    } else if (event.type === "account.updated") {
      const account = event.data.object;
      await sql()`update affiliates set stripe_payouts_enabled = ${!!account.payouts_enabled} where stripe_account_id = ${account.id}`;
    }
    return Response.json({ received: true });
  } catch (e) {
    console.error("[stripe-webhook] erreur:", e.message);
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/stripe-webhook" };
