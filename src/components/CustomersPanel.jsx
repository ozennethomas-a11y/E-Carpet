import { useEffect, useState } from "react";
import { cachedFetch } from "../lib/adminCache";

function formatPrice(cents, currency = "eur") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}

export default function CustomersPanel() {
  const [clients, setClients] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    cachedFetch("/api/customers")
      .then((d) => (d.error ? setError(d.error) : setClients(d.clients)))
      .catch(() => setError("Impossible de charger les clients."));
  }, []);

  if (error) return <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">{error}</p>;
  if (!clients) return <p className="text-sm text-zinc-500">Chargement…</p>;
  if (clients.length === 0) return <p className="text-sm text-zinc-500">Aucun client pour l'instant.</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Ville</th>
            <th className="px-4 py-3">Commandes</th>
            <th className="px-4 py-3">Total dépensé</th>
            <th className="px-4 py-3">Dernière commande</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.email} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3">
                <div className="font-display font-bold text-white">{c.nom || c.email}</div>
                <div className="text-xs text-zinc-500">{c.email}</div>
              </td>
              <td className="px-4 py-3 text-zinc-400">{c.ville || "—"}</td>
              <td className="px-4 py-3 text-zinc-400"><span className="chiffre">{c.nbCommandes}</span></td>
              <td className="chiffre px-4 py-3 font-bold text-acid">{formatPrice(c.totalDepenseCents, c.currency)}</td>
              <td className="px-4 py-3 text-zinc-400">{new Date(c.derniereCommande).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
