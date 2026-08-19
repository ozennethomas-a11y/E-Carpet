import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCart, formatPrice } from "../cart";
import { navigate } from "../navigation";
import { ArrowIcon } from "./ui";

const SHIPPING_CENTS = { relais: 499, domicile: 699 };

const EMPTY = {
  email: "",
  phone: "",
  firstName: "",
  lastName: "",
  deliveryMode: "domicile",
  line1: "",
  line2: "",
  postalCode: "",
  city: "",
  country: "FR",
  pickupPoint: null,
};

export default function CheckoutPage() {
  const cart = useCart();
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [points, setPoints] = useState([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState(null); // { code, discountCents } une fois validé
  const [promoError, setPromoError] = useState("");
  const [checkingPromo, setCheckingPromo] = useState(false);

  useEffect(() => {
    if (cart.items.length === 0) navigate("/panier");
  }, [cart.items.length]);

  useEffect(() => {
    if (form.deliveryMode !== "relais" || form.country !== "FR" || !/^\d{5}$/.test(form.postalCode)) {
      setPoints([]);
      return;
    }
    setLoadingPoints(true);
    const controller = new AbortController();
    fetch(`/api/packlink?points=1&postal=${form.postalCode}&country=FR`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setPoints(d.points || []))
      .catch(() => {})
      .finally(() => setLoadingPoints(false));
    return () => controller.abort();
  }, [form.deliveryMode, form.postalCode, form.country]);

  // Synchronise le panier côté serveur dès qu'un email valide est saisi,
  // pour permettre une relance email si la commande n'est pas finalisée.
  useEffect(() => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return;
    const timeout = setTimeout(() => {
      fetch("/api/cart-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: cart.token,
          email: form.email,
          items: cart.items.map((it) => ({ productId: it.productId, name: it.name, quantity: it.quantity })),
        }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timeout);
  }, [form.email, cart.items, cart.token]);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function applyPromo(e) {
    e.preventDefault();
    if (!promoInput.trim()) return;
    setPromoError("");
    setCheckingPromo(true);
    try {
      const res = await fetch(`/api/promo-check?code=${encodeURIComponent(promoInput)}&subtotal=${cart.totalCents}`);
      const data = await res.json();
      if (!data.valid) {
        setPromo(null);
        setPromoError(data.error || "Code invalide.");
        return;
      }
      setPromo({ code: data.code, discountCents: data.discountCents });
    } catch {
      setPromoError("Impossible de vérifier ce code, réessayez.");
    } finally {
      setCheckingPromo(false);
    }
  }

  function retirerPromo() {
    setPromo(null);
    setPromoInput("");
    setPromoError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (form.deliveryMode === "relais" && !form.pickupPoint) {
      setError("Choisissez un point relais avant de continuer.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: cart.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
          email: form.email,
          address: form,
          cartToken: cart.token,
          promoCode: promo?.code || undefined,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Une erreur est survenue, réessayez.");
    } catch {
      setError("Impossible de contacter le serveur, réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  if (cart.items.length === 0) return null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-white">
      <a href="/panier" onClick={(e) => { e.preventDefault(); navigate("/panier"); }} className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <span className="rotate-180"><ArrowIcon className="h-4 w-4" /></span>
        Retour au panier
      </a>

      <h1 className="font-display text-3xl font-bold">Livraison</h1>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom" value={form.lastName} onChange={set("lastName")} required />
          <Field label="Prénom" value={form.firstName} onChange={set("firstName")} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" type="email" value={form.email} onChange={set("email")} required />
          <Field label="Téléphone" type="tel" value={form.phone} onChange={set("phone")} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-zinc-400">Mode de livraison</label>
          <div className="grid grid-cols-2 gap-3">
            <DeliveryOption
              label="À domicile"
              description={`Livré directement chez vous — ${formatPrice(SHIPPING_CENTS.domicile)}`}
              selected={form.deliveryMode === "domicile"}
              onClick={() => setForm((f) => ({ ...f, deliveryMode: "domicile" }))}
            />
            <DeliveryOption
              label="Point relais"
              description={`On vous propose le plus proche — ${formatPrice(SHIPPING_CENTS.relais)}`}
              selected={form.deliveryMode === "relais"}
              onClick={() => setForm((f) => ({ ...f, deliveryMode: "relais", pickupPoint: null }))}
            />
          </div>
        </div>

        {form.deliveryMode === "domicile" ? (
          <>
            <Field label="Adresse" value={form.line1} onChange={set("line1")} required />
            <Field label="Complément (optionnel)" value={form.line2} onChange={set("line2")} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Code postal" value={form.postalCode} onChange={set("postalCode")} required />
              <Field label="Ville" value={form.city} onChange={set("city")} required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-zinc-400">Pays</label>
              <select
                value={form.country}
                onChange={set("country")}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-acid"
              >
                <option value="FR">France</option>
                <option value="DE">Allemagne</option>
                <option value="BE">Belgique</option>
                <option value="ES">Espagne</option>
                <option value="IT">Italie</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <Field
              label="Code postal"
              value={form.postalCode}
              onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value, pickupPoint: null }))}
              required
            />
            {loadingPoints && <p className="text-sm text-zinc-500">Recherche des points relais…</p>}
            {!loadingPoints && /^\d{5}$/.test(form.postalCode) && points.length === 0 && (
              <p className="text-sm text-zinc-500">Aucun point relais trouvé pour ce code postal.</p>
            )}
            {points.length > 0 && (
              <>
                <PickupMap
                  points={points}
                  selected={form.pickupPoint}
                  onSelect={(p) => setForm((f) => ({ ...f, pickupPoint: p }))}
                  onPointsChange={setPoints}
                />
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-white/10 p-2">
                  {points.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, pickupPoint: p }))}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                        form.pickupPoint?.id === p.id
                          ? "border-acid bg-acid/10"
                          : "border-white/10 bg-white/5 hover:border-white/30"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            form.pickupPoint?.id === p.id ? "bg-acid text-white" : "bg-white/10 text-zinc-300"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-display text-sm font-bold text-white">{p.nom}</div>
                          <div className="mt-0.5 text-xs text-zinc-400">
                            {p.adresse}, {p.codePostal} {p.ville}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <div className="border-t border-white/10 pt-6">
          <label className="mb-1.5 block text-sm text-zinc-400">Code promo</label>
          {promo ? (
            <div className="flex items-center justify-between rounded-xl border border-acid/40 bg-acid/10 px-4 py-3">
              <span className="text-sm text-white">
                Code <strong>{promo.code}</strong> appliqué
              </span>
              <button type="button" onClick={retirerPromo} className="text-xs text-zinc-400 underline underline-offset-4 hover:text-white">
                Retirer
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-acid"
              />
              <button
                type="button"
                onClick={applyPromo}
                disabled={checkingPromo || !promoInput.trim()}
                className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white transition-colors hover:border-acid disabled:opacity-50"
              >
                {checkingPromo ? "…" : "Appliquer"}
              </button>
            </div>
          )}
          {promoError && <p className="mt-2 text-xs text-red-400">{promoError}</p>}
        </div>

        <div className="space-y-2 border-t border-white/10 pt-6">
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>Sous-total</span>
            <span>{formatPrice(cart.totalCents, cart.items[0]?.currency)}</span>
          </div>
          {promo && (
            <div className="flex items-center justify-between text-sm text-acid">
              <span>Réduction ({promo.code})</span>
              <span>-{formatPrice(promo.discountCents, cart.items[0]?.currency)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>Livraison</span>
            <span>{formatPrice(SHIPPING_CENTS[form.deliveryMode])}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-lg text-zinc-300">Total</span>
            <span className="font-display text-2xl font-bold text-acid">
              {formatPrice(
                Math.max(0, cart.totalCents - (promo?.discountCents || 0)) + SHIPPING_CENTS[form.deliveryMode],
                cart.items[0]?.currency,
              )}
            </span>
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-acid px-6 py-4 text-center font-display text-base font-bold text-white shadow-[0_0_40px_-8px_rgba(224,106,59,0.6)] disabled:opacity-60"
        >
          {submitting ? "Redirection vers le paiement…" : "Procéder au paiement"}
        </button>
      </form>
    </main>
  );
}

// Carte interactive (Leaflet + tuiles OpenStreetMap, aucune clé API requise) :
// déplaçable et zoomable, avec un marqueur numéroté par point relais. Créée
// impérativement (pas via react-leaflet) pour rester légère ; recrée les
// marqueurs à chaque changement de points/sélection, mais garde la même
// instance de carte tant que le conteneur ne change pas.
function pinIcon(number, actif) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${actif ? "#e06a3b" : "#18181b"};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"><span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700">${number}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

function PickupMap({ points, selected, onSelect, onPointsChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onPointsChangeRef = useRef(onPointsChange);
  onPointsChangeRef.current = onPointsChange;

  // displayPoints est la liste réellement affichée sur la carte : elle part
  // de `points` (recherche par code postal) mais peut ensuite être remplacée
  // par une recherche automatique déclenchée par un déplacement de la carte,
  // sans attendre une nouvelle saisie de code postal.
  const [displayPoints, setDisplayPoints] = useState(points);
  const lastAppliedIdsKeyRef = useRef("");
  const shouldFitRef = useRef(true);
  const programmaticMoveRef = useRef(false);
  const moveTimeoutRef = useRef(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);

  // Nouvelle recherche par code postal (vient du parent) : on recadre la vue.
  // Une mise à jour venant de notre propre recherche "au survol de la carte"
  // repasse par ce même prop (via onPointsChange) : on la reconnaît grâce à
  // lastAppliedIdsKeyRef pour ne pas la traiter une deuxième fois.
  useEffect(() => {
    const newIds = points
      .filter((p) => p.lat && p.long)
      .map((p) => p.id)
      .join(",");
    if (newIds === lastAppliedIdsKeyRef.current) return;
    lastAppliedIdsKeyRef.current = newIds;
    shouldFitRef.current = true;
    setDisplayPoints(points);
  }, [points]);

  const valides = displayPoints.filter((p) => p.lat && p.long);
  const idsKey = valides.map((p) => p.id).join(",");

  async function chercherAutourDuCentre() {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    setRechercheEnCours(true);
    try {
      const geo = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat}&lon=${center.lng}&zoom=16&addressdetails=1`,
        { headers: { Accept: "application/json" } },
      ).then((r) => r.json());
      const postal = geo?.address?.postcode;
      if (!postal || !/^\d{5}$/.test(postal)) return;
      const data = await fetch(`/api/packlink?points=1&postal=${postal}&country=FR`).then((r) => r.json());
      const nouveaux = data.points || [];
      if (!nouveaux.length) return;
      const newIds = nouveaux
        .filter((p) => p.lat && p.long)
        .map((p) => p.id)
        .join(",");
      if (newIds === idsKey) return;
      lastAppliedIdsKeyRef.current = newIds;
      shouldFitRef.current = false; // on garde la vue actuelle de l'utilisateur
      setDisplayPoints(nouveaux);
      onPointsChangeRef.current?.(nouveaux);
    } catch {
      // silencieux : on garde les points déjà affichés
    } finally {
      setRechercheEnCours(false);
    }
  }

  // Crée la carte une seule fois, avec des tuiles CartoDB Voyager (plus
  // lisibles que les tuiles OSM par défaut) et une recherche automatique de
  // points relais quand l'utilisateur déplace la carte.
  useEffect(() => {
    if (!containerRef.current || valides.length === 0) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, { scrollWheelZoom: true });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(mapRef.current);

      mapRef.current.on("moveend", () => {
        if (programmaticMoveRef.current) {
          programmaticMoveRef.current = false;
          return;
        }
        clearTimeout(moveTimeoutRef.current);
        moveTimeoutRef.current = setTimeout(chercherAutourDuCentre, 700);
      });
    }
    const map = mapRef.current;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = valides.map((p, i) => {
      const marker = L.marker([Number(p.lat), Number(p.long)], { icon: pinIcon(i + 1, false) }).addTo(map);
      marker.on("click", () => onSelectRef.current(p));
      return marker;
    });

    if (shouldFitRef.current) {
      shouldFitRef.current = false;
      programmaticMoveRef.current = true;
      const bounds = L.latLngBounds(valides.map((p) => [Number(p.lat), Number(p.long)]));
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    }

    setTimeout(() => map.invalidateSize(), 0);
  }, [idsKey]);

  // Ne met à jour que la couleur du marqueur sélectionné, sans toucher à la vue.
  useEffect(() => {
    markersRef.current.forEach((marker, i) => {
      marker.setIcon(pinIcon(i + 1, valides[i]?.id === selected?.id));
    });
  }, [selected?.id, idsKey]);

  useEffect(
    () => () => {
      clearTimeout(moveTimeoutRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  if (valides.length === 0) return null;

  return (
    <div className="relative">
      <div ref={containerRef} className="h-72 overflow-hidden rounded-xl border border-white/10" />
      {rechercheEnCours && (
        <div className="absolute right-3 top-3 rounded-full bg-ink/90 px-3 py-1 text-xs text-zinc-300 shadow">
          Recherche des points relais…
        </div>
      )}
    </div>
  );
}

function DeliveryOption({ label, description, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        selected ? "border-acid bg-acid/10" : "border-white/15 bg-white/5 hover:border-white/30"
      }`}
    >
      <div className="font-display text-sm font-bold text-white">{label}</div>
      <div className="mt-0.5 text-xs text-zinc-400">{description}</div>
    </button>
  );
}

function Field({ label, ...props }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-zinc-400">{label}</label>
      <input
        {...props}
        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-acid"
      />
    </div>
  );
}
