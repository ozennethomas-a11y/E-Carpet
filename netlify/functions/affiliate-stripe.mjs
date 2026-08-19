import { sql } from "./_db.mjs";
import { stripeSecretKey, stripeRequest } from "./_stripe.mjs";
import { getAffiliateFromRequest } from "./_affiliateAuth.mjs";

const MIN_PAYOUT_CENTS = 2000;

function siteOrigin(req) {
  const fromEnv = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return new URL(req.url).origin;
}

export default async (req) => {
  const key = stripeSecretKey();
  if (!key) return Response.json({ error: "STRIPE_SECRET_KEY manquante côté serveur." }, { status: 200 });

  const affiliate = await getAffiliateFromRequest(req);
  if (!affiliate) return Response.json({ error: "non connecté" }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const origin = siteOrigin(req);

  try {
    if (req.method === "POST" && action === "onboard") {
      let accountId = affiliate.stripe_account_id;

      if (!accountId) {
        const account = await stripeRequest(
          "/accounts",
          {
            type: "express",
            email: affiliate.email,
            business_type: "individual",
            capabilities: { transfers: { requested: true } },
            metadata: { affiliateId: String(affiliate.id) },
          },
          key,
        );
        accountId = account.id;
        await sql()`update affiliates set stripe_account_id = ${accountId} where id = ${affiliate.id}`;
      }

      const accountLink = await stripeRequest(
        "/account_links",
        {
          account: accountId,
          refresh_url: `${origin}/influenceurs/espace`,
          return_url: `${origin}/influenceurs/espace`,
          type: "account_onboarding",
        },
        key,
      );

      return Response.json({ url: accountLink.url });
    }

    if (req.method === "POST" && action === "payout") {
      if (!affiliate.stripe_account_id || !affiliate.stripe_payouts_enabled) {
        return Response.json({ error: "compte bancaire non connecté" }, { status: 400 });
      }

      // Réclame atomiquement les commissions dues avant d'appeler Stripe : cet
      // UPDATE...WHERE status='due' ne peut renvoyer une même ligne qu'à une
      // seule requête concurrente, ce qui empêche deux clics (ou deux appels
      // concurrents) de déclencher deux virements pour le même solde.
      const claimed = await sql()`
        update affiliate_commissions set status = 'en_cours'
        where affiliate_id = ${affiliate.id} and status = 'due'
        returning id, amount_cents
      `;
      const totalCents = claimed.reduce((s, c) => s + c.amount_cents, 0);

      if (totalCents < MIN_PAYOUT_CENTS) {
        if (claimed.length) {
          await sql()`update affiliate_commissions set status = 'due' where id = any(${claimed.map((c) => c.id)})`;
        }
        return Response.json({ error: "solde insuffisant (minimum 20 €)" }, { status: 400 });
      }

      let transfer;
      try {
        transfer = await stripeRequest(
          "/transfers",
          {
            amount: totalCents,
            currency: "eur",
            destination: affiliate.stripe_account_id,
            transfer_group: `affiliate_${affiliate.id}`,
          },
          key,
        );
      } catch (e) {
        // Le virement Stripe a échoué : on relâche les commissions réclamées
        // pour ne pas les laisser bloquées en 'en_cours' indéfiniment.
        await sql()`update affiliate_commissions set status = 'due' where id = any(${claimed.map((c) => c.id)})`;
        throw e;
      }

      await sql()`
        insert into affiliate_payouts (affiliate_id, amount_cents, stripe_transfer_id, status)
        values (${affiliate.id}, ${totalCents}, ${transfer.id}, 'effectue')
      `;
      await sql()`
        update affiliate_commissions set status = 'payee' where id = any(${claimed.map((c) => c.id)})
      `;

      return Response.json({ ok: true });
    }

    return Response.json({ error: "action inconnue" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
};

export const config = { path: "/api/affiliate-stripe" };
