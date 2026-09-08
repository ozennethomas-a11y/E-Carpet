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

// Les ventes PayPal et B2B sont saisies à la main : elles n'ont jamais
// transité par le site, mais doivent entrer dans le chiffre d'affaires.
const CANAL_LABEL = { site: "Site", paypal: "PayPal", b2b: "B2B" };

function formatPrice(cents, currency = "eur") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}

export default function OrdersPanel() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("toutes");
  const [recherche, setRecherche] = useState("");
  const [importOuvert, setImportOuvert] = useState(false);
  const [saisieOuverte, setSaisieOuverte] = useState(false);

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

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setRecherche(q);
  }, []);

  if (error) return <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">{error}</p>;
  if (!orders) return <p className="text-sm text-zinc-500">Chargement…</p>;

  const parFiltre = filter === "toutes" ? orders : orders.filter((o) => o.status === filter);
  const termeRecherche = recherche.trim().toLowerCase();
  const filtered = !termeRecherche
    ? parFiltre
    : parFiltre.filter((o) => {
        const addr = o.shippingAddress || {};
        const haystack = [o.orderNumber, o.email, addr.firstName, addr.lastName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(termeRecherche);
      });
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (nom, email, n° de commande)…"
          className="min-w-[260px] flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid"
        />
        <button
          onClick={() => setSaisieOuverte((v) => !v)}
          className="rounded-full border border-acid/40 bg-acid/10 px-4 py-2 text-xs text-white transition-colors hover:bg-acid/20"
        >
          {saisieOuverte ? "Annuler la saisie" : "Saisir une vente PayPal ou B2B"}
        </button>
        <button
          onClick={() => setImportOuvert((v) => !v)}
          className="rounded-full border border-white/15 px-4 py-2 text-xs text-zinc-300 transition-colors hover:text-white"
        >
          {importOuvert ? "Fermer l'import CSV" : "Importer des numéros de suivi (CSV)"}
        </button>
      </div>

      {saisieOuverte && <SaisieVenteManuelle onCree={() => { setSaisieOuverte(false); load(); }} />}

      {importOuvert && <ImportSuiviCSV onImported={load} />}

      {filtered.length === 0 && <p className="text-sm text-zinc-500">Aucune commande ne correspond.</p>}

      <div className="space-y-3">
        {filtered.map((o) => (
          <OrderRow key={o.id} order={o} onUpdated={load} />
        ))}
      </div>
    </div>
  );
}

// Saisie d'une vente réalisée hors du site. Historiquement, PayPal et le B2B
// n'existaient nulle part en base : le chiffre d'affaires affiché ne couvrait
// qu'une partie des ventes réelles, sans que rien ne l'indique.
//
// Aucun email n'est envoyé et aucun mouvement de stock n'est créé : ces ventes
// sont enregistrées après coup, le client a déjà été servi et le stock réel a
// déjà été recalé à la main.
function SaisieVenteManuelle({ onCree }) {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [canal, setCanal] = useState("paypal");
  const [date, setDate] = useState(aujourdhui);
  const [montant, setMontant] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const montantCents = Math.round(parseFloat(String(montant).replace(",", ".")) * 100);
  const valide = Number.isFinite(montantCents) && montantCents > 0 && date && date <= aujourdhui;

  async function enregistrer() {
    setErreur("");
    setEnvoi(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "creer-manuelle",
          channel: canal,
          date,
          totalCents: montantCents,
          quantity: parseInt(quantite, 10) || 1,
          nom,
          email,
          note,
        }),
      });
      const data = await res.json();
      if (data.error) return setErreur(data.error);
      invalidateCache("/api/orders");
      onCree();
    } catch {
      setErreur("Enregistrement impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  const champ = "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-acid";

  return (
    <div className="mb-4 rounded-2xl border border-acid/25 bg-acid/5 p-5">
      <h3 className="font-display text-sm font-bold text-white">Vente hors site</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
        Pour rattacher au chiffre d'affaires une vente encaissée par PayPal ou en direct B2B.
        Aucun email n'est envoyé au client, et le stock n'est pas modifié.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-400">
          Canal
          <select value={canal} onChange={(e) => setCanal(e.target.value)} className={`mt-1 ${champ}`}>
            <option value="paypal">PayPal</option>
            <option value="b2b">B2B (MF-World…)</option>
          </select>
        </label>
        <label className="text-xs text-zinc-400">
          Date de la vente
          <input type="date" max={aujourdhui} value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${champ}`} />
        </label>
        <label className="text-xs text-zinc-400">
          Montant encaissé (€)
          <input inputMode="decimal" placeholder="37,99" value={montant} onChange={(e) => setMontant(e.target.value)} className={`mt-1 ${champ}`} />
        </label>
        <label className="text-xs text-zinc-400">
          Nombre de tapis
          <input inputMode="numeric" value={quantite} onChange={(e) => setQuantite(e.target.value)} className={`mt-1 ${champ}`} />
        </label>
        <label className="text-xs text-zinc-400">
          Client (facultatif)
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom ou société" className={`mt-1 ${champ}`} />
        </label>
        <label className="text-xs text-zinc-400">
          Email (facultatif)
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${champ}`} />
        </label>
        <label className="text-xs text-zinc-400 sm:col-span-2">
          Note (facultatif)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Référence, facture…" className={`mt-1 ${champ}`} />
        </label>
      </div>

      {erreur && <p className="mt-3 text-xs text-red-400">{erreur}</p>}

      <button
        onClick={enregistrer}
        disabled={!valide || envoi}
        className="mt-4 rounded-full bg-acid px-5 py-2 text-xs font-bold text-white disabled:opacity-40"
      >
        {envoi ? "Enregistrement…" : "Enregistrer la vente"}
      </button>
    </div>
  );
}

// Import en masse : colle un CSV (numéro de commande, transporteur, numéro
// de suivi) et applique "expedier" ligne par ligne côté serveur.
function ImportSuiviCSV({ onImported }) {
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState("");

  function parserCSV(brut) {
    return brut
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((ligne) => {
        const [orderNumber, trackingCarrier, trackingNumber] = ligne.split(/[,;\t]/).map((c) => (c || "").trim());
        return { orderNumber, trackingCarrier, trackingNumber };
      })
      .filter((l) => l.orderNumber && l.trackingNumber);
  }

  async function importer() {
    setErreur("");
    setResultat(null);
    const lignes = parserCSV(texte);
    if (lignes.length === 0) return setErreur("Aucune ligne valide (attendu : n° commande, transporteur, n° de suivi).");
    setEnvoi(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "expedier-lot", lignes }),
      });
      const data = await res.json();
      if (data.error) return setErreur(data.error);
      setResultat(data);
      invalidateCache("/api/orders");
      onImported();
    } catch {
      setErreur("Échec de l'import.");
    } finally {
      setEnvoi(false);
    }
  }

  function importerFichier(e) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const reader = new FileReader();
    reader.onload = () => setTexte(String(reader.result || ""));
    reader.readAsText(fichier);
  }

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-ink p-4">
      <p className="mb-2 text-xs text-zinc-500">
        Une ligne par commande, colonnes séparées par virgule/point-virgule/tabulation : numéro de commande,
        transporteur, numéro de suivi.
      </p>
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={5}
        placeholder={"123456,Mondial Relay,ABC123\n789012,Colissimo,DEF456"}
        className="mb-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none focus:border-acid"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept=".csv,text/csv,text/plain" onChange={importerFichier} className="text-xs text-zinc-400" />
        <button
          onClick={importer}
          disabled={envoi}
          className="rounded-full bg-acid px-5 py-2 font-display text-sm font-bold text-white disabled:opacity-60"
        >
          {envoi ? "…" : "Importer"}
        </button>
      </div>
      {erreur && <p className="mt-2 text-xs text-red-400">{erreur}</p>}
      {resultat && (
        <p className="mt-2 text-xs text-emerald-400">
          <span className="chiffre">{resultat.succes}</span> commande{resultat.succes > 1 ? "s" : ""} mise
          {resultat.succes > 1 ? "s" : ""} à jour
          {resultat.introuvables?.length > 0 && (
            <>
              , <span className="chiffre">{resultat.introuvables.length}</span> numéro
              {resultat.introuvables.length > 1 ? "s" : ""} introuvable{resultat.introuvables.length > 1 ? "s" : ""} :{" "}
              {resultat.introuvables.join(", ")}
            </>
          )}
        </p>
      )}
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
  const [marquagePaiement, setMarquagePaiement] = useState(false);
  const [erreurPaiement, setErreurPaiement] = useState("");
  const [envoyerEmailPaiement, setEnvoyerEmailPaiement] = useState(false);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState("");

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

  async function marquerPayee() {
    setErreurPaiement("");
    setMarquagePaiement(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "marquer-payee", orderId: order.id, envoyerEmail: envoyerEmailPaiement }),
      });
      const data = await res.json();
      if (data.error) return setErreurPaiement(data.error);
      invalidateCache("/api/orders");
      onUpdated();
    } catch {
      setErreurPaiement("Échec de l'opération.");
    } finally {
      setMarquagePaiement(false);
    }
  }

  async function supprimer() {
    setErreurSuppression("");
    setSuppression(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "supprimer", orderId: order.id }),
      });
      const data = await res.json();
      if (data.error) return setErreurSuppression(data.error);
      invalidateCache("/api/orders");
      onUpdated();
    } catch {
      setErreurSuppression("Échec de la suppression.");
    } finally {
      setSuppression(false);
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
        {order.channel && order.channel !== "site" && (
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
            {CANAL_LABEL[order.channel] || order.channel}
          </span>
        )}
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
              <div>
                Expédiée{order.trackingCarrier ? ` via ${order.trackingCarrier}` : ""} — suivi {order.trackingNumber}
              </div>
              <CoutExpedition order={order} onUpdated={onUpdated} />
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
          ) : order.status === "en_attente_paiement" ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs leading-relaxed text-amber-200">
                Toujours "en attente de paiement" ? Si vous avez confirmé ailleurs (Stripe, le client) que le
                paiement a bien été reçu, vous pouvez rattraper la commande manuellement.
              </p>
              <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={envoyerEmailPaiement}
                  onChange={(e) => setEnvoyerEmailPaiement(e.target.checked)}
                  className="cursor-pointer"
                />
                Envoyer l'email de confirmation au client
              </label>
              <button
                onClick={marquerPayee}
                disabled={marquagePaiement}
                className="mt-2 rounded-full border border-amber-500/40 px-4 py-1.5 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500/10 disabled:opacity-60"
              >
                {marquagePaiement ? "…" : "Marquer comme payée"}
              </button>
              {erreurPaiement && <p className="mt-1 text-xs text-red-400">{erreurPaiement}</p>}

              <div className="mt-3 border-t border-amber-500/20 pt-3">
                <p className="text-xs leading-relaxed text-zinc-500">
                  Panier abandonné, jamais payé ? Vous pouvez supprimer définitivement cette commande.
                </p>
                {!confirmationSuppression ? (
                  <button
                    onClick={() => setConfirmationSuppression(true)}
                    className="mt-2 rounded-full border border-red-500/30 px-4 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer"
                  >
                    Supprimer la commande
                  </button>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-red-400">Suppression définitive, confirmez :</span>
                    <button
                      onClick={supprimer}
                      disabled={suppression}
                      className="rounded-full bg-red-500/90 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60 cursor-pointer"
                    >
                      {suppression ? "…" : "Oui, supprimer"}
                    </button>
                    <button
                      onClick={() => setConfirmationSuppression(false)}
                      className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-zinc-300 transition-colors hover:text-white cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                )}
                {erreurSuppression && <p className="mt-1 text-xs text-red-400">{erreurSuppression}</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Rien à faire pour l'instant.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Coût réel de l'étiquette (Packlink ne fournit pas le prix par API — voir
// netlify/functions/shipping.mjs). Tant qu'il n'est pas renseigné, rien ne
// s'affiche pour éviter un "0 €" trompeur.
function CoutExpedition({ order, onUpdated }) {
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(order.shippingCostCents != null ? String(order.shippingCostCents / 100) : "");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function enregistrer() {
    setErreur("");
    const montant = Number(String(valeur).replace(",", "."));
    if (!Number.isFinite(montant) || montant < 0) return setErreur("Montant invalide.");
    setEnvoi(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "definir-cout-expedition", orderId: order.id, shippingCostCents: Math.round(montant * 100) }),
      });
      const data = await res.json();
      if (data.error) return setErreur(data.error);
      invalidateCache("/api/orders");
      onUpdated();
      setEdition(false);
    } catch {
      setErreur("Échec de l'enregistrement.");
    } finally {
      setEnvoi(false);
    }
  }

  if (!edition) {
    return (
      <div className="mt-1 flex items-center gap-2 text-xs text-emerald-300/80">
        {order.shippingCostCents != null ? (
          <span>Coût d'expédition réel : <span className="chiffre">{formatPrice(order.shippingCostCents, order.currency)}</span></span>
        ) : (
          <span className="text-zinc-500">Coût d'expédition réel non renseigné</span>
        )}
        <button onClick={() => setEdition(true)} className="text-zinc-400 underline decoration-dotted hover:text-white">
          {order.shippingCostCents != null ? "modifier" : "renseigner"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <input
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        placeholder="Ex. 4,90"
        className="w-24 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-acid"
      />
      <span className="text-xs text-zinc-500">€</span>
      <button
        onClick={enregistrer}
        disabled={envoi}
        className="rounded-full bg-acid px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
      >
        {envoi ? "…" : "Enregistrer"}
      </button>
      <button onClick={() => setEdition(false)} className="text-xs text-zinc-400 hover:text-white">
        Annuler
      </button>
      {erreur && <p className="w-full text-xs text-red-400">{erreur}</p>}
    </div>
  );
}
