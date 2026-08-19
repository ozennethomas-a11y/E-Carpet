import { useEffect, useState } from "react";
import { navigate } from "../navigation";
import MailAlertsPanel from "./MailAlertsPanel";

export default function MailsPage() {
  const [connecte, setConnecte] = useState(null);

  useEffect(() => {
    fetch("/api/admin-auth?action=me")
      .then((r) => r.json())
      .then((d) => setConnecte(!!d.connecte))
      .catch(() => setConnecte(false));
  }, []);

  useEffect(() => {
    document.title = "Mails · Admin · E-Carpet";
  }, []);

  useEffect(() => {
    if (connecte === false) navigate("/admin");
  }, [connecte]);

  if (!connecte) return null;

  return (
    <main className="min-h-svh bg-ink px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-white">Tous les mails importants</h1>
          <button
            onClick={() => navigate("/admin")}
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
          >
            Retour à l'admin
          </button>
        </div>
        <div className="mt-6">
          <MailAlertsPanel />
        </div>
      </div>
    </main>
  );
}
