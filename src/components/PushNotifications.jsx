import { useEffect, useState } from "react";

function base64UrlToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function ensureSubscription() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Autorisation refusée.");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const keyRes = await fetch("/api/push?action=vapid-public-key");
  const keyData = await keyRes.json();
  if (keyData.error) throw new Error(keyData.error);

  const existante = await reg.pushManager.getSubscription();
  return existante || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(keyData.publicKey) });
}

// Bloc verrouillé : alerte de connexion, un seul appareil, jamais modifiable
// une fois défini.
function AlerteConnexion() {
  const [statut, setStatut] = useState("idle");
  const [erreur, setErreur] = useState("");
  const [appareil, setAppareil] = useState(null);

  function charger() {
    fetch("/api/push?action=connexion-list")
      .then((r) => r.json())
      .then((d) => setAppareil(d.appareil || null))
      .catch(() => {});
  }

  useEffect(charger, []);

  async function activer() {
    setErreur("");
    setStatut("activation");
    try {
      const subscription = await ensureSubscription();
      const deviceName = window.prompt("Nom de cet appareil (ex: iPhone de Thomas)", "iPhone") || "Cet appareil";
      const res = await fetch("/api/push?action=connexion-subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), deviceName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      charger();
    } catch (e) {
      setErreur(e.message || "Échec de l'activation.");
    } finally {
      setStatut("idle");
    }
  }

  return (
    <div className="max-w-xl rounded-2xl border border-white/10 bg-ink p-5">
      <h3 className="font-display text-sm font-bold text-white">Alerte de connexion</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
        Prévient à chaque connexion à l'admin (mot de passe ou Face ID) — verrouillé sur un seul appareil,
        volontairement. Une fois activé, il ne peut plus être changé ni retiré depuis cet écran, pour qu'une
        session admin compromise ne puisse pas rediriger cette alerte de sécurité ailleurs.
      </p>

      {erreur && <p className="mt-2 text-xs text-red-400">{erreur}</p>}

      {appareil === null ? (
        <button
          onClick={activer}
          disabled={statut === "activation"}
          className="mt-3 rounded-full bg-acid px-4 py-2 text-xs font-bold text-white transition-colors hover:opacity-90 disabled:opacity-60 cursor-pointer"
        >
          {statut === "activation" ? "…" : "Activer sur cet appareil"}
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-deep p-3 text-xs text-zinc-300">
          <div className="font-semibold text-emerald-400">Verrouillé sur : {appareil.deviceName || "Appareil"}</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            Activé le {new Date(appareil.createdAt).toLocaleDateString("fr-FR")}
          </div>
        </div>
      )}
    </div>
  );
}

// Bloc libre : notifications générales (commandes...), plusieurs appareils,
// ajout/retrait sans restriction.
function NotificationsGenerales() {
  const [statut, setStatut] = useState("idle");
  const [erreur, setErreur] = useState("");
  const [abonnements, setAbonnements] = useState(null);

  function charger() {
    fetch("/api/push?action=list")
      .then((r) => r.json())
      .then((d) => setAbonnements(d.abonnements || []))
      .catch(() => {});
  }

  useEffect(charger, []);

  async function activer() {
    setErreur("");
    setStatut("activation");
    try {
      const subscription = await ensureSubscription();
      const deviceName = window.prompt("Nom de cet appareil (ex: iPhone de Thomas)", "iPhone") || "Cet appareil";
      const res = await fetch("/api/push?action=subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), deviceName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      charger();
    } catch (e) {
      setErreur(e.message || "Échec de l'activation.");
    } finally {
      setStatut("idle");
    }
  }

  async function retirer(id) {
    await fetch("/api/push?action=supprimer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    charger();
  }

  return (
    <div className="mt-4 max-w-xl rounded-2xl border border-white/10 bg-ink p-5">
      <h3 className="font-display text-sm font-bold text-white">Autres notifications</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
        Nouvelle commande payée, etc. Libre : plusieurs appareils possibles, ajout et retrait sans restriction.
      </p>

      {erreur && <p className="mt-2 text-xs text-red-400">{erreur}</p>}

      <button
        onClick={activer}
        disabled={statut === "activation"}
        className="mt-3 rounded-full bg-acid px-4 py-2 text-xs font-bold text-white transition-colors hover:opacity-90 disabled:opacity-60 cursor-pointer"
      >
        {statut === "activation" ? "…" : "Activer sur cet appareil"}
      </button>

      {abonnements === null ? (
        <p className="mt-3 text-xs text-zinc-500">Chargement…</p>
      ) : abonnements.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">Aucun appareil activé pour l'instant.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {abonnements.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2 rounded-xl border border-white/10 bg-slate-deep p-3 text-xs text-zinc-300">
              <div>
                <div className="font-semibold text-zinc-200">{a.deviceName || "Appareil"}</div>
                <div className="mt-0.5 text-[11px] text-zinc-500">Activé le {new Date(a.createdAt).toLocaleDateString("fr-FR")}</div>
              </div>
              <button onClick={() => retirer(a.id)} className="shrink-0 text-red-400 hover:text-red-300 cursor-pointer">
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PushNotifications({ inline = false }) {
  const supporte = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  if (!inline) return null;

  if (!supporte) {
    return <p className="text-xs text-zinc-500">Notifications non supportées sur cet appareil/navigateur.</p>;
  }

  return (
    <div>
      <AlerteConnexion />
      <NotificationsGenerales />
    </div>
  );
}
