import { useEffect, useMemo, useState } from "react";
import { navigate } from "../navigation";
import { formatPrice } from "../cart";
import { ArrowIcon } from "./ui";
import { StatTile } from "./charts";

const COMMISSION_LABELS = { due: "En attente", annulee: "Annulée", payee: "Versée" };

function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [erreur, setErreur] = useState("");

  async function submit(e) {
    e.preventDefault();
    setState("sending");
    setErreur("");
    try {
      const res = await fetch("/api/affiliate-auth?action=request-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setState("sent");
    } catch (e) {
      setErreur(e.message || "Une erreur est survenue, réessayez.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-zinc-300">
          Un lien de connexion a été envoyé à <strong className="text-white">{email}</strong>. Vérifiez votre boîte mail (valable 15 minutes).
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8">
      <p className="text-zinc-300">
        Entrez l'adresse email de votre candidature, nous vous envoyons un lien de connexion.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr"
          className="flex-1 rounded-full border border-white/15 bg-transparent px-5 py-3 text-white placeholder:text-zinc-500 focus:border-acid focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="rounded-full bg-acid px-6 py-3 font-display text-sm font-bold text-white disabled:opacity-60"
        >
          {state === "sending" ? "Envoi..." : "Recevoir le lien"}
        </button>
      </div>
      {state === "error" && <p className="mt-3 text-sm text-red-400">{erreur}</p>}
      <p className="mt-4 text-xs text-zinc-500">
        Pas encore partenaire ?{" "}
        <button type="button" onClick={() => navigate("/influenceurs")} className="underline hover:text-white">
          Découvrir le programme
        </button>
      </p>
    </form>
  );
}

export default function AffiliateSpacePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [payoutState, setPayoutState] = useState("idle"); // idle | envoi | erreur
  const [payoutErreur, setPayoutErreur] = useState("");
  const [lienCopie, setLienCopie] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const erreur = params.get("erreur");

  const affiliateLink = useMemo(() => {
    if (!data?.affiliate?.campaignSlug) return null;
    const p = new URLSearchParams({ utm_source: "affilie", utm_campaign: data.affiliate.campaignSlug });
    return `${window.location.origin}/?${p.toString()}`;
  }, [data?.affiliate?.campaignSlug]);

  async function copierLien() {
    if (!affiliateLink) return;
    try {
      await navigator.clipboard.writeText(affiliateLink);
      setLienCopie(true);
      setTimeout(() => setLienCopie(false), 1600);
    } catch {
      /* clipboard bloqué */
    }
  }

  const load = () =>
    fetch("/api/affiliate-auth?action=me")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ affiliate: null }))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  async function logout() {
    await fetch("/api/affiliate-auth?action=logout", { method: "POST" });
    setData({ affiliate: null });
  }

  async function connecterStripe() {
    const res = await fetch("/api/affiliate-stripe?action=onboard", { method: "POST" });
    const d = await res.json();
    if (d.url) window.location.href = d.url;
  }

  async function demanderVirement() {
    setPayoutState("envoi");
    setPayoutErreur("");
    try {
      const res = await fetch("/api/affiliate-stripe?action=payout", { method: "POST" });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      await load();
      setPayoutState("idle");
    } catch (e) {
      setPayoutErreur(e.message || "Échec de la demande de virement.");
      setPayoutState("erreur");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-white">
      <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <span className="rotate-180"><ArrowIcon className="h-4 w-4" /></span>
        Retour
      </a>

      <h1 className="font-display text-3xl font-bold">Espace partenaire</h1>

      {erreur && (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {erreur === "lien_expire"
            ? "Ce lien a expiré ou a déjà été utilisé, demandez-en un nouveau."
            : erreur === "compte_inactif"
            ? "Votre candidature n'est pas encore validée."
            : "Ce lien de connexion est invalide."}
        </p>
      )}

      {loading ? null : !data?.affiliate ? (
        <LoginForm />
      ) : (
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <p className="text-zinc-300">
              Connecté en tant que <strong className="text-white">{data.affiliate.name}</strong>
            </p>
            <button onClick={logout} className="text-sm text-zinc-500 hover:text-white">Se déconnecter</button>
          </div>

          <div className="mt-6 rounded-2xl border border-acid/30 bg-acid/5 p-5">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Votre code promo</div>
            <div className="mt-1 font-display text-2xl font-bold text-acid">{data.affiliate.promoCode}</div>
            <div className="mt-1 text-xs text-zinc-500">{data.affiliate.commissionPercent}% de commission sur chaque commande</div>
          </div>

          {affiliateLink && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Votre lien personnel</div>
              <p className="mt-1 text-xs text-zinc-500">
                Pratique pour suivre l'origine de vos visites. C'est votre code {data.affiliate.promoCode} qui doit être
                saisi à la commande pour déclencher votre commission.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 truncate rounded-full border border-white/15 bg-transparent px-4 py-2 text-sm text-zinc-300">
                  {affiliateLink}
                </div>
                <button
                  onClick={copierLien}
                  className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
                >
                  {lienCopie ? "Copié !" : "Copier"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <StatTile label="Commandes générées" value={data.kpi.ordersCount.toLocaleString("fr-FR")} />
            <StatTile label="Chiffre d'affaires généré" value={formatPrice(data.kpi.revenueCents)} />
            <StatTile label="Commission due" value={formatPrice(data.kpi.dueCents)} />
            <StatTile label="Commission versée" value={formatPrice(data.kpi.paidCents)} />
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            {!data.affiliate.hasStripeAccount ? (
              <>
                <p className="text-sm text-zinc-300">Connectez votre compte bancaire pour pouvoir demander un virement.</p>
                <button
                  onClick={connecterStripe}
                  className="mt-3 rounded-full bg-acid px-5 py-2.5 font-display text-sm font-bold text-white"
                >
                  Connecter mon compte bancaire
                </button>
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                  Vous serez redirigé vers <strong className="text-zinc-400">Stripe</strong>, la plateforme de paiement
                  qui traite vos virements. E-Carpet ne voit jamais votre IBAN ni vos documents d'identité —
                  ils sont saisis directement sur le formulaire sécurisé de Stripe, jamais sur notre site.
                  C'est gratuit et ça prend quelques minutes.
                </p>
              </>
            ) : !data.affiliate.stripePayoutsEnabled ? (
              <p className="text-sm text-zinc-400">
                Votre compte Stripe est en cours de vérification. Vous pourrez demander un virement une fois activé.
              </p>
            ) : (
              <>
                <p className="text-sm text-zinc-300">
                  Solde disponible : <strong className="text-white">{formatPrice(data.kpi.dueCents)}</strong>
                  {data.kpi.dueCents < 2000 && " (minimum 20 € pour demander un virement)"}
                </p>
                <button
                  onClick={demanderVirement}
                  disabled={data.kpi.dueCents < 2000 || payoutState === "envoi"}
                  className="mt-3 rounded-full bg-acid px-5 py-2.5 font-display text-sm font-bold text-white disabled:opacity-40"
                >
                  {payoutState === "envoi" ? "Demande en cours…" : "Demander un virement"}
                </button>
                {payoutState === "erreur" && <p className="mt-2 text-sm text-red-400">{payoutErreur}</p>}
              </>
            )}
          </div>

          <h2 className="mt-8 font-display text-lg font-bold">Historique des commandes</h2>
          {data.commissions.length === 0 ? (
            <p className="mt-4 text-zinc-400">Aucune commande pour le moment.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {data.commissions.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  <div>
                    <div className="font-display font-bold">Commande n°{c.orderNumber}</div>
                    <div className="text-xs text-zinc-500">{new Date(c.createdAt).toLocaleDateString("fr-FR")}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-acid">{formatPrice(c.amountCents)}</div>
                    <div className="text-xs text-zinc-500">{COMMISSION_LABELS[c.status]}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.payouts.length > 0 && (
            <>
              <h2 className="mt-8 font-display text-lg font-bold">Virements</h2>
              <div className="mt-4 space-y-2">
                {data.payouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                    <div className="text-xs text-zinc-500">{new Date(p.createdAt).toLocaleDateString("fr-FR")}</div>
                    <div className="font-display font-bold text-white">{formatPrice(p.amountCents)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
