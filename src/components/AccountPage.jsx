import { useEffect, useState } from "react";
import { navigate } from "../navigation";
import { formatPrice } from "../cart";
import { ArrowIcon } from "./ui";

const STATUS_LABELS = {
  en_attente_paiement: "En attente de paiement",
  payee: "Payée",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
  remboursee: "Remboursée",
};

function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error

  async function submit(e) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/auth?action=request-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setState("sent");
    } catch {
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
        Entrez votre adresse email, nous vous envoyons un lien de connexion — pas de mot de passe à retenir.
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
      {state === "error" && <p className="mt-3 text-sm text-red-400">Une erreur est survenue, réessayez.</p>}
    </form>
  );
}

function OrderRow({ order }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <div>
          <div className="font-display font-bold">Commande n°{order.orderNumber}</div>
          <div className="text-sm text-zinc-400">
            {new Date(order.createdAt).toLocaleDateString("fr-FR")} · {STATUS_LABELS[order.status] || order.status}
          </div>
        </div>
        <div className="font-display font-bold text-acid">{formatPrice(order.totalCents, order.currency)}</div>
      </button>
      {open && (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-zinc-300">
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between">
              <span>{it.name} × {it.quantity}</span>
              <span>{formatPrice(it.unit_price_cents * it.quantity, order.currency)}</span>
            </div>
          ))}
          {order.trackingNumber && (
            <p className="pt-2 text-zinc-400">
              Suivi {order.trackingCarrier || ""} : <span className="text-white">{order.trackingNumber}</span>
            </p>
          )}
          {order.deliveryMode === "relais" && order.pickupPoint && (
            <p className="pt-2 text-zinc-400">
              Point relais : <span className="text-white">{order.pickupPoint.nom}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const params = new URLSearchParams(window.location.search);
  const erreur = params.get("erreur");

  useEffect(() => {
    fetch("/api/auth?action=me")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ customer: null }))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch("/api/auth?action=logout", { method: "POST" });
    setData({ customer: null });
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-white">
      <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <span className="rotate-180"><ArrowIcon className="h-4 w-4" /></span>
        Retour
      </a>

      <h1 className="font-display text-3xl font-bold">Mon compte</h1>

      {erreur && (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {erreur === "lien_expire" ? "Ce lien a expiré ou a déjà été utilisé, demandez-en un nouveau." : "Ce lien de connexion est invalide."}
        </p>
      )}

      {loading ? null : !data?.customer ? (
        <LoginForm />
      ) : (
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <p className="text-zinc-300">Connecté en tant que <strong className="text-white">{data.customer.email}</strong></p>
            <button onClick={logout} className="text-sm text-zinc-500 hover:text-white">Se déconnecter</button>
          </div>

          <h2 className="mt-8 font-display text-lg font-bold">Mes commandes</h2>
          {data.orders.length === 0 ? (
            <p className="mt-4 text-zinc-400">Aucune commande pour le moment.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.orders.map((o) => <OrderRow key={o.id} order={o} />)}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
