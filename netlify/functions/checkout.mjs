import { sql } from "./lib/_db.mjs";
import { siteOrigin } from "./lib/_siteOrigin.mjs";
import { findOrCreateCustomer } from "./lib/_customers.mjs";
import { findValidPromo, computeDiscountCents } from "./lib/_promo.mjs";
import { stripeSecretKey, stripeRequest } from "./lib/_stripe.mjs";

const SHIPPING_CENTS = { relais: 499, domicile: 699 };

function stripeCredentials() {
  return stripeSecretKey();
}

export default async (req) => {
  const key = stripeCredentials();
  if (!key) {
    return Response.json(
      { error: "STRIPE_SECRET_KEY manquante côté serveur. Ajoutez-la dans Netlify puis redéployez." },
      { status: 200 },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "requête invalide" }, { status: 400 });
  }

  const { items, email, address, cartToken, promoCode } = body || {};
  if (!Array.isArray(items) || items.length === 0) return Response.json({ error: "panier vide" }, { status: 400 });
  if (!email || !address?.postalCode) {
    return Response.json({ error: "adresse incomplète" }, { status: 400 });
  }
  if (address.deliveryMode === "relais" && !address.pickupPoint) {
    return Response.json({ error: "point relais manquant" }, { status: 400 });
  }
  if (address.deliveryMode !== "relais" && (!address.line1 || !address.city)) {
    return Response.json({ error: "adresse incomplète" }, { status: 400 });
  }
  const shippingCents = SHIPPING_CENTS[address.deliveryMode] ?? SHIPPING_CENTS.domicile;

  try {
    const productIds = items.map((it) => it.productId);
    const products = await sql()`select id, sku, name, price_cents, currency, stock from products where id = any(${productIds}) and active = true`;

    const lines = items.map((it) => {
      const p = products.find((row) => row.id === it.productId);
      if (!p) throw new Error(`produit ${it.productId} introuvable`);
      if (it.quantity < 1 || it.quantity > 20) throw new Error("quantité invalide");
      if (p.stock < it.quantity) throw new Error(`stock insuffisant pour ${p.name}`);
      return { product: p, quantity: it.quantity };
    });

    const subtotalCents = lines.reduce((n, l) => n + l.quantity * l.product.price_cents, 0);
    const currency = lines[0].product.currency;

    let promo = null;
    let discountCents = 0;
    if (promoCode) {
      const result = await findValidPromo(promoCode);
      if (result.error) throw new Error(`code promo : ${result.error}`);
      promo = result.row;
      discountCents = computeDiscountCents(promo, subtotalCents);
    }

    const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;

    const customer = await findOrCreateCustomer(email);

    // Numéro à 6 chiffres montré au client, distinct de l'id interne : quelques
    // essais suffisent largement vu la taille de l'espace (900 000 valeurs).
    let order;
    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      const orderNumber = 100000 + Math.floor(Math.random() * 900000);
      try {
        [order] = await sql()`
          insert into orders (order_number, customer_id, email, status, total_cents, currency, shipping_address, promo_code_id, discount_cents)
          values (${orderNumber}, ${customer.id}, ${email}, 'en_attente_paiement', ${totalCents}, ${currency}, ${JSON.stringify(address)}::jsonb, ${promo?.id ?? null}, ${discountCents})
          returning id, order_number
        `;
      } catch (e) {
        if (!String(e.message || e).toLowerCase().includes("unique") || attempt === 4) throw e;
      }
    }

    for (const l of lines) {
      await sql()`
        insert into order_items (order_id, product_id, name, unit_price_cents, quantity)
        values (${order.id}, ${l.product.id}, ${l.product.name}, ${l.product.price_cents}, ${l.quantity})
      `;
    }

    const origin = siteOrigin(req);

    let discounts;
    if (discountCents > 0) {
      const coupon = await stripeRequest(
        "/coupons",
        { duration: "once", amount_off: discountCents, currency, name: `Code ${promo.code}` },
        key,
      );
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripeRequest(
      "/checkout/sessions",
      {
        mode: "payment",
        customer_email: email,
        line_items: [
          ...lines.map((l) => ({
            quantity: l.quantity,
            price_data: {
              currency: l.product.currency,
              unit_amount: l.product.price_cents,
              product_data: { name: l.product.name },
            },
          })),
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: shippingCents,
              product_data: {
                name: address.deliveryMode === "relais" ? "Livraison en point relais" : "Livraison à domicile",
              },
            },
          },
        ],
        discounts,
        success_url: `${origin}/commande-confirmee?order=${order.order_number}`,
        cancel_url: `${origin}/commande`,
        metadata: { orderId: String(order.id) },
      },
      key,
    );

    await sql()`update orders set stripe_session_id = ${session.id} where id = ${order.id}`;

    if (cartToken) {
      await sql()`update carts set converted_at = now() where token = ${cartToken}`;
    }

    return Response.json({ url: session.url });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/checkout" };
