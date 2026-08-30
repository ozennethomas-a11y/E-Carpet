import { sql } from "./_db.mjs";
import { sendEmail, orderConfirmationEmail, affiliateSaleNotificationEmail, emailConfigured } from "./_email.mjs";
import { stripeSecretKey, stripeRequest } from "./_stripe.mjs";
import { creerBrouillonPourCommande } from "./_packlink.mjs";

// Logique déclenchée quand une commande passe payée : déduction du stock,
// code promo/commission affilié, brouillon Packlink, email de confirmation.
// Utilisée par le webhook Stripe (paiement en temps réel) et par l'action
// admin "marquer payée" (rattrapage manuel, ex. webhook resté mal configuré
// un temps) — `envoyerEmail: false` permet ce second cas d'éviter de
// prévenir le client une seconde fois s'il a déjà été contacté autrement.
export async function marquerCommandePayee(orderId, { paymentIntent = null, envoyerEmail = true } = {}) {
  const [order] = await sql()`
    select o.id, o.order_number, o.status, o.email, o.total_cents, o.currency, o.shipping_address,
           o.promo_code_id, o.discount_cents, p.code as promo_code
    from orders o
    left join promo_codes p on p.id = o.promo_code_id
    where o.id = ${orderId}
  `;
  if (!order || order.status !== "en_attente_paiement") return { ok: false, reason: "commande introuvable ou déjà traitée" };

  await sql()`update orders set status = 'payee', stripe_payment_intent_id = ${paymentIntent} where id = ${orderId}`;

  // Frais Stripe réel (pas une estimation) : demande le paiement avec sa
  // charge/transaction de solde développées. N'empêche pas le reste si
  // Stripe est momentanément indisponible.
  const key = stripeSecretKey();
  if (key && paymentIntent) {
    try {
      const pi = await stripeRequest(`/payment_intents/${paymentIntent}`, { expand: ["latest_charge.balance_transaction"] }, key, {
        method: "GET",
      });
      const feeCents = pi.latest_charge?.balance_transaction?.fee;
      if (feeCents != null) {
        await sql()`update orders set stripe_fee_cents = ${feeCents} where id = ${orderId}`;
      }
    } catch (e) {
      console.error(`[marquerCommandePayee] échec récupération frais Stripe commande ${orderId}:`, e.message);
    }
  }

  const items = await sql()`select product_id, name, unit_price_cents, quantity from order_items where order_id = ${orderId}`;
  for (const it of items) {
    await sql()`update products set stock = greatest(stock - ${it.quantity}, 0) where id = ${it.product_id}`;
    // Journal des mouvements de stock (onglet Stock du back-office). Le check
    // "status !== en_attente_paiement" plus haut garantit qu'on n'entre dans
    // ce bloc qu'une seule fois par commande.
    await sql()`
      insert into stock_movements (product_id, type, quantity, source, movement_date, order_id)
      values (${it.product_id}, 'sortie', ${it.quantity}, 'vente_site', now(), ${orderId})
    `;
  }

  if (order.promo_code_id) {
    // Incrément gardé par la condition max_uses dans la même requête : deux
    // paiements concurrents utilisant un code à usage unique ne peuvent pas
    // tous les deux réussir cet UPDATE. On journalise le cas sinon pour
    // vérification manuelle.
    const [incremented] = await sql()`
      update promo_codes set used_count = used_count + 1
      where id = ${order.promo_code_id} and (max_uses is null or used_count < max_uses)
      returning id
    `;
    if (!incremented) {
      console.error(`[marquerCommandePayee] commande ${order.id} : code promo ${order.promo_code_id} déjà épuisé — à vérifier manuellement`);
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

      if (commission && emailConfigured()) {
        const { subject, html } = affiliateSaleNotificationEmail({
          name: affiliate.name,
          amountCents,
          spaceUrl: "https://e-carpet.shop/influenceurs/espace",
        });
        await sendEmail({ to: affiliate.email, subject, html }).catch((e) =>
          console.error(`[marquerCommandePayee] échec email notification vente affilié ${affiliate.id}:`, e.message),
        );
      }
    }
  }

  console.log(`[marquerCommandePayee] commande ${order.id} marquée payée`);

  // Brouillon Packlink (point relais uniquement) : aucun envoi n'est
  // facturé/commandé, seulement préparé. Un échec ici ne doit jamais faire
  // échouer le reste — l'admin peut recréer le brouillon manuellement.
  try {
    await creerBrouillonPourCommande(orderId);
  } catch (e) {
    console.error(`[marquerCommandePayee] échec création brouillon Packlink commande ${orderId}:`, e.message);
  }

  if (envoyerEmail && emailConfigured()) {
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
      .then(() => console.log(`[marquerCommandePayee] email de confirmation envoyé pour la commande ${order.id}`))
      .catch((e) => console.error(`[marquerCommandePayee] échec email confirmation commande ${order.id}:`, e.message));
  } else if (!envoyerEmail) {
    console.log(`[marquerCommandePayee] email volontairement non envoyé pour la commande ${order.id}`);
  }

  return { ok: true };
}
