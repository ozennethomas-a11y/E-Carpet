import { useEffect, useMemo, useState } from "react";
import { cachedFetch } from "../lib/adminCache";

function formatPrice(cents, currency = "eur") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}

const COLONNES_TRIABLES = {
  nom: (c) => (c.nom || c.email).toLowerCase(),
  ville: (c) => (c.ville || "").toLowerCase(),
  nbCommandes: (c) => c.nbCommandes,
  totalDepenseCents: (c) => c.totalDepenseCents,
  derniereCommande: (c) => new Date(c.derniereCommande).getTime(),
};

function EnTeteTriable({ label, colonne, triPar, triSens, onTri }) {
  const actif = triPar === colonne;
  return (
    <th
      className="cursor-pointer select-none px-4 py-3 hover:text-zinc-300"
      onClick={() => onTri(colonne)}
    >
      {label}
      <span className="ml-1 text-zinc-600">{actif ? (triSens === "asc" ? "▲" : "▼") : "↕"}</span>
    </th>
  );
}

export default function CustomersPanel() {
  const [clients, setClients] = useState(null);
  const [error, setError] = useState("");
  const [recherche, setRecherche] = useState("");
  const [triPar, setTriPar] = useState("totalDepenseCents");
  const [triSens, setTriSens] = useState("desc");

  useEffect(() => {
    cachedFetch("/api/customers")
      .then((d) => (d.error ? setError(d.error) : setClients(d.clients)))
      .catch(() => setError("Impossible de charger les clients."));
  }, []);

  const onTri = (colonne) => {
    if (triPar === colonne) {
      setTriSens((s) => (s === "asc" ? "desc" : "asc"));
    } else {
      setTriPar(colonne);
      setTriSens("desc");
    }
  };

  const clientsAffiches = useMemo(() => {
    if (!clients) return null;
    const q = recherche.trim().toLowerCase();
    const filtres = q
      ? clients.filter((c) => (c.nom || "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      : clients;
    const extracteur = COLONNES_TRIABLES[triPar] || COLONNES_TRIABLES.totalDepenseCents;
    const tries = [...filtres].sort((a, b) => {
      const va = extracteur(a);
      const vb = extracteur(b);
      if (va < vb) return triSens === "asc" ? -1 : 1;
      if (va > vb) return triSens === "asc" ? 1 : -1;
      return 0;
    });
    return tries;
  }, [clients, recherche, triPar, triSens]);

  if (error) return <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">{error}</p>;
  if (!clients) return <p className="text-sm text-zinc-500">Chargement…</p>;
  if (clients.length === 0) return <p className="text-sm text-zinc-500">Aucun client pour l'instant.</p>;

  return (
    <div>
      <div className="mb-3">
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un client (nom, email)…"
          className="w-full max-w-sm rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-acid/50 focus:outline-none"
        />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
              <EnTeteTriable label="Client" colonne="nom" triPar={triPar} triSens={triSens} onTri={onTri} />
              <EnTeteTriable label="Ville" colonne="ville" triPar={triPar} triSens={triSens} onTri={onTri} />
              <EnTeteTriable label="Commandes" colonne="nbCommandes" triPar={triPar} triSens={triSens} onTri={onTri} />
              <EnTeteTriable label="Total dépensé" colonne="totalDepenseCents" triPar={triPar} triSens={triSens} onTri={onTri} />
              <EnTeteTriable label="Dernière commande" colonne="derniereCommande" triPar={triPar} triSens={triSens} onTri={onTri} />
              <th className="px-4 py-3">Commandes</th>
            </tr>
          </thead>
          <tbody>
            {clientsAffiches.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  Aucun client ne correspond à la recherche.
                </td>
              </tr>
            ) : (
              clientsAffiches.map((c) => (
                <tr key={c.email} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-display font-bold text-white">{c.nom || c.email}</div>
                    <div className="text-xs text-zinc-500">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{c.ville || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400"><span className="chiffre">{c.nbCommandes}</span></td>
                  <td className="chiffre px-4 py-3 font-bold text-acid">{formatPrice(c.totalDepenseCents, c.currency)}</td>
                  <td className="px-4 py-3 text-zinc-400">{new Date(c.derniereCommande).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/admin?section=site&tab=commandes&q=${encodeURIComponent(c.email)}`}
                      className="text-xs font-semibold text-acid hover:underline"
                    >
                      Voir ses commandes
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
