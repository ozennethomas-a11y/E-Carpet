import { useEffect, useState } from "react";

function base64UrlToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushNotifications({ inline = false }) {
  const [statut, setStatut] = useState("idle"); // idle | activation | actif | erreur
  const [erreur, setErreur] = useState("");
  const [abonnements, setAbonnements] = useState(null);

  const supporte = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  function charger() {
    fetch("/api/push?action=list")
      .then((r) => r.json())
      .then((d) => setAbonnements(d.abonnements || []))
      .catch(() => {});
  }

  useEffect(() => {
    if (inline) charger();
  }, [inline]);

  async function activer() {
    setErreur("");
    setStatut("activation");
    try {
      if (!supporte) throw new Error("Notifications non supportées sur cet appareil/navigateur.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Autorisation refusée.");

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const keyRes = await fetch("/api/push?action=vapid-public-key");
      const keyData = await keyRes.json();
      if (keyData.error) throw new Error(keyData.error);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(keyData.publicKey),
      });

      const deviceName = window.prompt("Nom de cet appareil (ex: iPhone de Thomas)", "iPhone") || "Cet appareil";
      const res = await fetch("/api/push?action=subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), deviceName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setStatut("actif");
      if (inline) charger();
    } catch (e) {
      setErreur(e.message || "Échec de l'activation.");
      setStatut("erreur");
    }
  }

  if (!inline) {
    return (
      <div className="relative inline-block">
        {statut === "actif" ? (
          <span className="text-xs text-emerald-400">Notifications activées</span>
        ) : (
          <button
            onClick={activer}
            disabled={statut === "activation"}
            className="text-xs text-zinc-500 underline decoration-dotted transition-colors hover:text-zinc-300 cursor-pointer disabled:opacity-60"
          >
            {statut === "activation" ? "Activation…" : "Activer les notifications"}
          </button>
        )}
        {erreur && <p className="mt-1 text-xs text-red-400">{erreur}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-xl rounded-2xl border border-white/10 bg-ink p-5">
      <p className="text-xs leading-relaxed text-zinc-400">
        Alerte reçue sur le téléphone (nouvelle commande payée, connexion à l'admin) — verrouillé sur un seul
        appareil. Une fois activé, il ne peut plus être changé ni retiré depuis cet écran, volontairement (pour
        qu'une session admin compromise ne puisse pas rediriger les alertes ailleurs).
      </p>

      {erreur && <p className="mt-2 text-xs text-red-400">{erreur}</p>}

      {abonnements === null ? (
        <p className="mt-3 text-xs text-zinc-500">Chargement…</p>
      ) : abonnements.length === 0 ? (
        <button
          onClick={activer}
          disabled={statut === "activation"}
          className="mt-3 rounded-full bg-acid px-4 py-2 text-xs font-bold text-white transition-colors hover:opacity-90 disabled:opacity-60 cursor-pointer"
        >
          {statut === "activation" ? "…" : "Activer sur cet appareil"}
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-deep p-3 text-xs text-zinc-300">
          <div className="font-semibold text-emerald-400">Verrouillé sur : {abonnements[0].deviceName || "Appareil"}</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            Activé le {new Date(abonnements[0].createdAt).toLocaleDateString("fr-FR")}
          </div>
        </div>
      )}
    </div>
  );
}
