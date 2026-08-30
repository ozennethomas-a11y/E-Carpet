import { sql } from "./lib/_db.mjs";
import { constantTimeEqual } from "./lib/_crypto.mjs";
import { marquerCommandePayee } from "./lib/_orderPaid.mjs";

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

      await marquerCommandePayee(orderId, { paymentIntent: session.payment_intent, envoyerEmail: true });
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
