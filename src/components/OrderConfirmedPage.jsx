import { useEffect } from "react";
import { useCart } from "../cart";
import { navigate } from "../navigation";

export default function OrderConfirmedPage() {
  const cart = useCart();

  useEffect(() => {
    cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orderId = new URLSearchParams(window.location.search).get("order");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center text-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-acid/20 text-acid">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="mt-6 font-display text-3xl font-bold">Commande confirmée</h1>
      <p className="mt-3 text-zinc-400">
        Merci pour votre commande{orderId ? ` n°${orderId}` : ""}.
      </p>
      <button
        onClick={() => navigate("/")}
        className="mt-8 rounded-full bg-acid px-6 py-3 font-display text-sm font-bold text-white"
      >
        Retour à l'accueil
      </button>
    </main>
  );
}
