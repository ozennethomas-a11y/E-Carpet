import { useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { cachedFetch, invalidateCache } from "../lib/adminCache";

// Action la plus sensible du back-office : réservée à une preuve Face ID en
// direct, scopée à la toute première clé jamais enregistrée par cet admin —
// pas juste "être connecté" comme avant. Voir netlify/functions/webauthn.mjs
// (logout-all-options / logout-all-verify).
function DeconnecterTout() {
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState("");

  async function executer() {
    setEnCours(true);
    setErreur("");
    try {
      const res = await fetch("/api/webauthn?action=logout-all-options");
      const data = await res.json();
      if (data.error) return setErreur(data.error);

      const response = await startAuthentication({ optionsJSON: data.options });

      const verifyRes = await fetch("/api/webauthn?action=logout-all-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData.error) return setErreur(verifyData.error);
      setResultat(verifyData.nb);
      setConfirmation(false);
    } catch {
      setErreur("Face ID annulé ou indisponible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
      <p className="text-xs leading-relaxed text-red-200">
        Déconnecte immédiatement tous les appareils, tous comptes admin confondus (y compris le tien) — chacun
        redemandera une connexion complète. Réservé à une vérification Face ID de la toute première clé enregistrée
        (voir onglet Face ID). À utiliser en cas de doute sur une session compromise.
      </p>
      {resultat !== null && <p className="mt-2 text-xs text-emerald-400">{resultat} session(s) invalidée(s).</p>}
      {erreur && <p className="mt-2 text-xs text-red-400">{erreur}</p>}
      {!confirmation ? (
        <button
          onClick={() => setConfirmation(true)}
          className="mt-2 rounded-full border border-red-500/30 px-4 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer"
        >
          Déconnecter tous les appareils
        </button>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-red-400">Confirmer avec Face ID ?</span>
          <button
            onClick={executer}
            disabled={enCours}
            className="rounded-full bg-red-500/90 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60 cursor-pointer"
          >
            {enCours ? "…" : "Vérifier Face ID et tout déconnecter"}
          </button>
          <button
            onClick={() => setConfirmation(false)}
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-zinc-300 transition-colors hover:text-white cursor-pointer"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

function ConnexionsTab() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    cachedFetch("/api/admin-auth?action=history")
      .then((d) => (d.error ? setError(d.error) : setHistory(d.history)))
      .catch(() => setError("Impossible de charger l'historique."));
  }, []);

  if (error) return <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">{error}</p>;

  return (
    <div>
      <DeconnecterTout />
      {!history ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucune connexion enregistrée pour l'instant.</p>
      ) : (
        <ConnexionsTable history={history} />
      )}
    </div>
  );
}

function ConnexionsTable({ history }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3">Personne</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Adresse IP</th>
            <th className="px-4 py-3">Appareil</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3 font-display font-bold text-white">{h.name}</td>
              <td className="px-4 py-3 text-zinc-400">{new Date(h.createdAt).toLocaleString("fr-FR")}</td>
              <td className="px-4 py-3 text-zinc-400">{h.ip || "—"}</td>
              <td className="max-w-xs truncate px-4 py-3 text-xs text-zinc-500" title={h.userAgent || ""}>{h.userAgent || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComptesTab() {
  const [admins, setAdmins] = useState(null);
  const [error, setError] = useState("");
  const [nom, setNom] = useState("");
  const [creation, setCreation] = useState(false);
  const [erreurCreation, setErreurCreation] = useState("");
  const [nouveauCompte, setNouveauCompte] = useState(null); // { name, password, totpSecret, otpauthUri }

  function chargerAdmins() {
    cachedFetch("/api/admin-auth?action=admins")
      .then((d) => (d.error ? setError(d.error) : setAdmins(d.admins)))
      .catch(() => setError("Impossible de charger les comptes."));
  }

  useEffect(chargerAdmins, []);

  async function creerCompte(e) {
    e.preventDefault();
    setErreurCreation("");
    setCreation(true);
    try {
      const res = await fetch("/api/admin-auth?action=create-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nom }),
      });
      const d = await res.json();
      if (d.error) {
        setErreurCreation(d.error);
        return;
      }
      setNouveauCompte(d);
      setNom("");
      invalidateCache("/api/admin-auth?action=admins");
      chargerAdmins();
    } catch {
      setErreurCreation("Le serveur n'a pas répondu.");
    } finally {
      setCreation(false);
    }
  }

  if (error) return <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-6">
      <form onSubmit={creerCompte} className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-slate-deep p-5">
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Nouveau compte</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Prénom (ex: Maria)"
            className="w-full rounded-xl border border-white/10 bg-ink px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-acid/60"
          />
        </div>
        <button
          type="submit"
          disabled={creation || !nom.trim()}
          className="rounded-full bg-acid px-5 py-2.5 font-display text-sm font-bold text-white transition-colors hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {creation ? "Création…" : "Créer l'accès"}
        </button>
        {erreurCreation && <p className="w-full text-sm text-red-400">{erreurCreation}</p>}
      </form>

      {nouveauCompte && (
        <div className="rounded-2xl border border-acid/40 bg-acid/5 p-5">
          <p className="font-display font-bold text-white">
            Accès créé pour {nouveauCompte.admin.name} — à transmettre maintenant, ces informations ne seront plus jamais affichées.
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <p>
              <span className="text-zinc-500">Mot de passe : </span>
              <code className="rounded bg-black/30 px-2 py-1 text-acid">{nouveauCompte.password}</code>
            </p>
            <p>
              <span className="text-zinc-500">Code TOTP (à saisir manuellement dans Google Authenticator) : </span>
              <code className="rounded bg-black/30 px-2 py-1 text-acid">{nouveauCompte.totpSecret}</code>
            </p>
            <p className="text-xs text-zinc-500 break-all">{nouveauCompte.otpauthUri}</p>
          </div>
          <button
            onClick={() => setNouveauCompte(null)}
            className="mt-4 rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:text-white cursor-pointer"
          >
            J'ai noté ces informations
          </button>
        </div>
      )}

      {!admins ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">Compte</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-display font-bold text-white">{a.name}</td>
                  <td className="px-4 py-3 text-zinc-400">{a.isOwner ? "Propriétaire" : "Accès standard"}</td>
                  <td className="px-4 py-3 text-zinc-400">{new Date(a.createdAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminAccessPanel({ tab }) {
  if (tab === "comptes") return <ComptesTab />;
  return <ConnexionsTab />;
}
