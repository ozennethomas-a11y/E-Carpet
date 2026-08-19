import { sql } from "./_db.mjs";
import { sendEmail, cartReminderEmail, emailConfigured } from "./_email.mjs";

// Relance envoyée si le panier n'a pas bougé depuis 2h et n'a pas abouti à
// une commande, une seule fois par panier. On ignore les paniers trop vieux
// (plus de 7 jours) pour éviter de relancer une intention obsolète.
export default async () => {
  if (!emailConfigured()) {
    console.log("[cron-cart-reminder] BREVO_API_KEY absente, rien à faire");
    return new Response("skipped");
  }

  const carts = await sql()`
    select id, email, items
    from carts
    where email is not null
      and converted_at is null
      and reminder_sent_at is null
      and updated_at <= now() - interval '2 hours'
      and updated_at >= now() - interval '7 days'
  `;

  for (const cart of carts) {
    const items = Array.isArray(cart.items) ? cart.items : [];
    if (items.length === 0) continue;
    const { subject, html } = cartReminderEmail({ items });
    try {
      await sendEmail({ to: cart.email, subject, html });
      await sql()`update carts set reminder_sent_at = now() where id = ${cart.id}`;
      console.log(`[cron-cart-reminder] envoyé pour le panier ${cart.id}`);
    } catch (e) {
      console.error(`[cron-cart-reminder] échec panier ${cart.id}:`, e.message);
    }
  }

  return new Response(`${carts.length} email(s) traité(s)`);
};

export const config = { schedule: "0 * * * *" };
