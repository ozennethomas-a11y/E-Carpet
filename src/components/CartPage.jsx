import { useEffect, useState } from "react";
import { useCart, formatPrice } from "../cart";
import { navigate } from "../navigation";
import { ArrowIcon } from "./ui";

export default function CartPage() {
  const cart = useCart();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProduct(d.products?.[0] || null))
      .catch(() => {});
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-white">
      <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <span className="rotate-180"><ArrowIcon className="h-4 w-4" /></span>
        Retour
      </a>

      <h1 className="font-display text-3xl font-bold">Votre panier</h1>

      {cart.items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-zinc-300">Votre panier est vide.</p>
          {product && (
            <button
              onClick={() => cart.add(product, 1)}
              className="mt-6 rounded-full bg-acid px-6 py-3 font-display text-sm font-bold text-white"
            >
              Ajouter {product.name} — {formatPrice(product.priceCents, product.currency)}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {cart.items.map((it) => (
            <div key={it.productId} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-4">
                <img
                  src="/images/tapis-dessus-detoure.webp"
                  alt="Tapis E-Carpet vu de dessus"
                  className="h-28 w-28 shrink-0 rounded-xl bg-white object-contain p-2"
                />
                <div>
                  <div className="font-display font-bold">{it.name}</div>
                  <div className="text-sm text-zinc-400">{formatPrice(it.priceCents, it.currency)} / unité</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-full border border-white/15">
                  <button
                    className="px-3 py-1.5 text-lg text-zinc-300"
                    onClick={() => cart.setQuantity(it.productId, it.quantity - 1)}
                    aria-label="Diminuer la quantité"
                  >
                    −
                  </button>
                  <span className="w-8 text-center">{it.quantity}</span>
                  <button
                    className="px-3 py-1.5 text-lg text-zinc-300"
                    onClick={() => cart.setQuantity(it.productId, it.quantity + 1)}
                    aria-label="Augmenter la quantité"
                  >
                    +
                  </button>
                </div>
                <button
                  className="text-sm text-zinc-500 hover:text-red-400"
                  onClick={() => cart.remove(it.productId)}
                >
                  Retirer
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-white/10 pt-6">
            <span className="text-lg text-zinc-300">Total</span>
            <span className="font-display text-2xl font-bold text-acid">
              {formatPrice(cart.totalCents, cart.items[0]?.currency)}
            </span>
          </div>

          <button
            onClick={() => navigate("/commande")}
            className="w-full rounded-full bg-acid px-6 py-4 text-center font-display text-base font-bold text-white shadow-[0_0_40px_-8px_rgba(224,106,59,0.6)]"
          >
            Passer commande
          </button>
        </div>
      )}
    </main>
  );
}
