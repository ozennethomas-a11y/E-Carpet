import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "ecarpet-panier";
const TOKEN_KEY = "ecarpet-panier-token";

function readStoredCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getCartToken() {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStoredCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const api = useMemo(
    () => ({
      items,
      token: getCartToken(),
      count: items.reduce((n, it) => n + it.quantity, 0),
      totalCents: items.reduce((n, it) => n + it.quantity * it.priceCents, 0),
      add(product, quantity = 1) {
        setItems((prev) => {
          const existing = prev.find((it) => it.productId === product.id);
          if (existing) {
            return prev.map((it) =>
              it.productId === product.id ? { ...it, quantity: it.quantity + quantity } : it,
            );
          }
          return [
            ...prev,
            {
              productId: product.id,
              sku: product.sku,
              name: product.name,
              priceCents: product.priceCents,
              currency: product.currency,
              quantity,
            },
          ];
        });
      },
      setQuantity(productId, quantity) {
        setItems((prev) =>
          quantity <= 0
            ? prev.filter((it) => it.productId !== productId)
            : prev.map((it) => (it.productId === productId ? { ...it, quantity } : it)),
        );
      },
      remove(productId) {
        setItems((prev) => prev.filter((it) => it.productId !== productId));
      },
      clear() {
        setItems([]);
        localStorage.removeItem(TOKEN_KEY);
      },
    }),
    [items],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé sous CartProvider");
  return ctx;
}

export function formatPrice(cents, currency = "eur") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}
