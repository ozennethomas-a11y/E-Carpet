import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";

export default function FaceIdSettings() {
  const [ouvert, setOuvert] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [erreur, setErreur] = useState("");
  const [activation, setActivation] = useState(false);

  function charger() {
    fetch("/api/webauthn?action=list")
      .then((r) => r.json())
      .then((d) => setCredentials(d.credentials || []))
      .catch(() => setErreur("Impossible de charger les appareils."));
  }

  useEffect(() => {
    if (ouvert) charger();
  }, [ouvert]);

  async function activer() {
    setErreur("");
    setActivation(true);
    try {
      const res = await fetch("/api/webauthn?action=register-options");
      const data = await res.json();
      if (data.error) return setErreur(data.error);

      const response = await startRegistration({ optionsJSON: data.options });

      const deviceName = window.prompt("Nom de cet appareil (ex: iPhone de Thomas)", "iPhone") || "Cet appareil";
      const verifyRes = await fetch("/api/webauthn?action=register-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, deviceName }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData.error) return setErreur(verifyData.error);
      charger();
    } catch (e) {
      setErreur(e.name === "NotAllowedError" ? "Activation annulée." : "Face ID/Touch ID n'a pas pu être activé sur cet appareil.");
    } finally {
      setActivation(false);
    }
  }

  async function supprimer(id) {
    await fetch("/api/webauthn?action=delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    charger();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOuvert((v) => !v)}
        className="text-xs text-zinc-500 underline decoration-dotted transition-colors hover:text-zinc-300 cursor-pointer"
      >
        Gérer Face ID
      </button>

      {ouvert && (
        <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-2xl border border-white/10 bg-slate-deep p-4 shadow-2xl">
          <p className="text-xs leading-relaxed text-zinc-400">
            Active Face ID/Touch ID sur cet appareil pour te connecter sans mot de passe ni code — 3 appareils maximum.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-300/80">
            Sur iPhone/iPad/Mac liés au même compte iCloud, une clé activée sur l'un peut se synchroniser
            automatiquement sur les autres (trousseau iCloud) — ce n'est pas visible ci-dessous. Vérifie la
            "dernière utilisation" de chaque appareil pour repérer une activité inattendue.
          </p>

          {erreur && <p className="mt-2 text-xs text-red-400">{erreur}</p>}

          <button
            onClick={activer}
            disabled={activation}
            className="mt-3 w-full rounded-full bg-acid px-4 py-2 text-xs font-bold text-white transition-colors hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            {activation ? "…" : "Activer sur cet appareil"}
          </button>

          {credentials === null ? (
            <p className="mt-3 text-xs text-zinc-500">Chargement…</p>
          ) : credentials.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">Aucun appareil activé pour l'instant.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {credentials.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2 text-xs text-zinc-300">
                  <div>
                    <div>{c.deviceName || "Appareil"}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      Dernière utilisation :{" "}
                      {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString("fr-FR") : "jamais"}
                    </div>
                  </div>
                  <button onClick={() => supprimer(c.id)} className="shrink-0 text-red-400 hover:text-red-300 cursor-pointer">
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
