import { useState } from "react";

function base64UrlToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushNotifications() {
  const [statut, setStatut] = useState("idle"); // idle | activation | actif | erreur
  const [erreur, setErreur] = useState("");

  const supporte = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

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
    } catch (e) {
      setErreur(e.message || "Échec de l'activation.");
      setStatut("erreur");
    }
  }

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
