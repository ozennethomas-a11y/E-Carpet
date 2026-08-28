import { useEffect, useState, useCallback } from "react";
import { cachedFetch, invalidateCache } from "../lib/adminCache";

const STATUT_LABEL = {
  en_attente_paiement: "En attente de paiement",
  payee: "Payée",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
  remboursee: "Remboursée",
};

const STATUT_COULEUR = {
  en_attente_paiement: "text-zinc-500",
  payee: "text-acid",
  expediee: "text-emerald-400",
  livree: "text-emerald-400",
  annulee: "text-red-400",
  remboursee: "text-red-400",
};

function formatPrice(cents, currency = "eur") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}

export default function OrdersPanel() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("toutes");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await cachedFetch("/api/orders");
      if (data.error) return setError(data.error);
      setOrders(data.orders);
    } catch {
      setError("Impossible de charger les commandes.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">{error}</p>;
  if (!orders) return <p className="text-sm text-zinc-500">Chargement…</p>;

  const filtered = filter === "toutes" ? orders : orders.filter((o) => o.status === filter);
  const aExpedier = orders.filter((o) => o.status === "payee").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["toutes", "payee", "expediee", "en_attente_paiement"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              filter === f ? "border-acid bg-acid/10 text-white" : "border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            {f === "toutes" ? <>Toutes (<span className="chiffre">{orders.length}</span>)</> : STATUT_LABEL[f]}
            {f === "payee" && aExpedier > 0 ? <> — <span className="chiffre">{aExpedier}</span> à expédier</> : ""}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p className="text-sm text-zinc-500">Aucune commande dans cette catégorie.</p>}

      <div className="space-y-3">
        {filtered.map((o) => (
          <OrderRow key={o.id} order={o} onUpdated={load} />
        ))}
      </div>
    </div>
  );
}

function OrderRow({ order, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("Mondial Relay");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [creationBrouillon, setCreationBrouillon] = useState(false);
  const [erreurBrouillon, setErreurBrouillon] = useState("");

  const addr = order.shippingAddress || {};
  const isRelais = addr.deliveryMode === "relais";

  async function creerBrouillon() {
    setErreurBrouillon("");
    setCreationBrouillon(true);
    try {
      const res = await fetch("/api/packlink", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "creer-brouillon", orderId: order.id }),
      });
      const data = await res.json();
      if (data.error) return setErreurBrouillon(data.error);
      invalidateCache("/api/orders");
      onUpdated();
    } catch {
      setErreurBrouillon("Échec de la création du brouillon.");
    } finally {
      setCreationBrouillon(false);
    }
  }

  async function expedier(e) {
    e.preventDefault();
    setError("");
    if (!tracking.trim()) return setError("Numéro de suivi requis.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "expedier", orderId: order.id, trackingNumber: tracking, trackingCarrier: carrier }),
      });
      const data = await res.json();
      if (data.error) return setError(data.error);
      invalidateCache("/api/orders");
      onUpdated();
    } catch {
      setError("Échec de l'envoi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-ink">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <div>
          <div className="font-display text-sm font-bold text-white">
            Commande n°<span className="chiffre">{order.orderNumber}</span>
            {(addr.firstName || addr.lastName) && <> — {addr.firstName} {addr.lastName}</>} — {order.email}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {new Date(order.createdAt).toLocaleDateString("fr-FR")} · <span className="chiffre">{formatPrice(order.totalCents, order.currency)}</span> ·{" "}
            {isRelais ? "Point relais" : "Domicile"}
            {order.promoCode && <> · code {order.promoCode} (-<span className="chiffre">{formatPrice(order.discountCents, order.currency)}</span>)</>}
          </div>
        </div>
        <span className={`font-display text-xs font-bold ${STATUT_COULEUR[order.status]}`}>{STATUT_LABEL[order.status]}</span>
      </button>

      {open && (
        <div className="border-t border-white/10 px-5 py-4 text-sm">
          <div className="mb-3">
            <div className="font-bold text-zinc-300">Articles</div>
            {order.items.map((it, i) => (
              <div key={i} className="text-zinc-400">
                {it.name} × <span className="chiffre">{it.quantity}</span> — <span className="chiffre">{formatPrice(it.unitPriceCents * it.quantity, order.currency)}</span>
              </div>
            ))}
          </div>

          <div className="mb-3">
            <div className="font-bold text-zinc-300">Livraison</div>
            {isRelais && addr.pickupPoint ? (
              <div className="text-zinc-400">
                {addr.firstName} {addr.lastName}
                <br />
                Point relais : {addr.pickupPoint.nom}
                <br />
                {addr.pickupPoint.adresse}, {addr.pickupPoint.codePostal} {addr.pickupPoint.ville}
              </div>
            ) : (
              <div className="text-zinc-400">
                {addr.firstName} {addr.lastName}
                <br />
                {addr.line1} {addr.line2}
                <br />
                {addr.postalCode} {addr.city}, {addr.country}
              </div>
            )}
            {addr.phone && <div className="text-zinc-400">Tél : {addr.phone}</div>}
          </div>

          {isRelais && order.status !== "en_attente_paiement" && order.status !== "annulee" && (
            <div className="mb-3">
              <div className="font-bold text-zinc-300">Brouillon Packlink</div>
              {order.packlinkDraftReference ? (
                <div className="text-zinc-400">
                  Réf. <span className="chiffre">{order.packlinkDraftReference}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Pas encore créé.</span>
                  <button
                    onClick={creerBrouillon}
                    disabled={creationBrouillon}
                    className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300 transition-colors hover:text-white disabled:opacity-60"
                  >
                    {creationBrouillon ? "…" : "Créer le brouillon"}
                  </button>
                </div>
              )}
              {erreurBrouillon && <p className="mt-1 text-xs text-red-400">{erreurBrouillon}</p>}
            </div>
          )}

          {order.status === "expediee" || order.status === "livree" ? (
            <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-emerald-400">
              Expédiée{order.trackingCarrier ? ` via ${order.trackingCarrier}` : ""} — suivi {order.trackingNumber}
            </div>
          ) : order.status === "payee" ? (
            <form onSubmit={expedier} className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Transporteur</label>
                <input
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="Mondial Relay, Colissimo…"
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Numéro de suivi</label>
                <input
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-acid px-5 py-2 font-display text-sm font-bold text-white disabled:opacity-60"
              >
                {submitting ? "…" : "Marquer expédiée"}
              </button>
              {error && <p className="w-full text-xs text-red-400">{error}</p>}
            </form>
          ) : (
            <p className="text-xs text-zinc-500">Rien à faire pour l'instant.</p>
          )}
        </div>
      )}
    </div>
  );
}
