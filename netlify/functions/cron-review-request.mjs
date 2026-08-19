import { sql } from "./lib/_db.mjs";
import { sendEmail, reviewRequestEmail, emailConfigured } from "./lib/_email.mjs";

// Demande d'avis envoyée 7 jours après expédition, une seule fois par commande.
export default async () => {
  if (!emailConfigured()) {
    console.log("[cron-review-request] BREVO_API_KEY absente, rien à faire");
    return new Response("skipped");
  }

  const orders = await sql()`
    select id, order_number, email, shipping_address
    from orders
    where status in ('expediee', 'livree')
      and shipped_at is not null
      and shipped_at <= now() - interval '7 days'
      and review_request_sent_at is null
  `;

  for (const order of orders) {
    const [item] = await sql()`select name from order_items where order_id = ${order.id} limit 1`;
    const { subject, html } = reviewRequestEmail({
      orderId: order.order_number,
      productName: item?.name,
      firstName: order.shipping_address?.firstName,
    });
    try {
      await sendEmail({ to: order.email, subject, html });
      await sql()`update orders set review_request_sent_at = now() where id = ${order.id}`;
      console.log(`[cron-review-request] envoyé pour la commande ${order.id}`);
    } catch (e) {
      console.error(`[cron-review-request] échec commande ${order.id}:`, e.message);
    }
  }

  return new Response(`${orders.length} email(s) traité(s)`);
};

export const config = { schedule: "0 9 * * *" };
