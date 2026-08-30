import { useEffect, useState } from "react";
import { StatTile } from "./charts";
import { formatPrice } from "../cart";
import { cachedFetch } from "../lib/adminCache";

const MOIS_NOMS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function moisActuel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function decalerMois(mois, delta) {
  const [an, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(an, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function ShippingPanel() {
  const [mois, setMois] = useState(moisActuel());
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    setErreur("");
    cachedFetch(`/api/shipping?month=${mois}`)
      .then((d) => (d.error ? setErreur(d.error) : setData(d)))
      .catch(() => setErreur("Impossible de charger les coûts d'expédition."));
  }, [mois]);

  if (erreur) return <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">{erreur}</p>;
  if (!data) return <p className="text-sm text-zinc-500">Chargement…</p>;

  const [an, m] = mois.split("-").map(Number);
  const estMoisEnCours = mois === moisActuel();
  const totalCommandes = data.domicile.count + data.relais.count + (data.amazon.indisponible ? 0 : data.amazon.count);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {totalCommandes} envoi{totalCommandes > 1 ? "s" : ""} sur le mois
        </p>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
          <button
            onClick={() => setMois((v) => decalerMois(v, -1))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-white cursor-pointer"
            aria-label="Mois précédent"
          >
            ‹
          </button>
          <span className="min-w-[110px] text-center text-xs font-semibold text-white">
            {MOIS_NOMS[m - 1]} {an}
          </span>
          <button
            onClick={() => setMois((v) => decalerMois(v, 1))}
            disabled={estMoisEnCours}
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-white disabled:opacity-30 cursor-pointer"
            aria-label="Mois suivant"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Coût total estimé" value={formatPrice(data.totalCents)} />
        <StatTile
          label="Domicile · Site"
          value={formatPrice(data.domicile.coutCents)}
          hint={`${data.domicile.count} envoi(s) · ${formatPrice(data.tarifs.domicileCents)}/envoi`}
        />
        <StatTile
          label="Point relais · Site"
          value={formatPrice(data.relais.coutCents)}
          hint={`${data.relais.count} envoi(s) · ${formatPrice(data.tarifs.relaisCents)}/envoi`}
        />
        <StatTile
          label="Amazon (domicile)"
          value={data.amazon.indisponible ? "—" : formatPrice(data.amazon.coutCents)}
          hint={data.amazon.indisponible ? data.amazon.raison : `${data.amazon.count} commande(s) · ${formatPrice(data.tarifs.domicileCents)}/envoi (estimé)`}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Comparaison par canal</h2>
        <ul className="mt-4 flex flex-col gap-2.5">
          {[
            { label: "Domicile (site)", coutCents: data.domicile.coutCents, count: data.domicile.count },
            { label: "Point relais (site)", coutCents: data.relais.coutCents, count: data.relais.count },
            {
              label: "Amazon (toujours domicile)",
              coutCents: data.amazon.indisponible ? 0 : data.amazon.coutCents,
              count: data.amazon.indisponible ? 0 : data.amazon.count,
            },
          ].map((ligne) => (
            <li key={ligne.label} className="flex items-center justify-between gap-3 border-t border-white/5 pt-2.5 text-sm">
              <span className="text-zinc-400">{ligne.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-xs text-zinc-600">
                  {ligne.count} envoi{ligne.count > 1 ? "s" : ""} · {ligne.count ? formatPrice(Math.round(ligne.coutCents / ligne.count)) : "—"}/envoi
                </span>
                <span className="chiffre font-display font-bold tabular-nums text-white">{formatPrice(ligne.coutCents)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs leading-relaxed text-zinc-600">
        Domicile, point relais (site) et Amazon (toujours domicile) sont tous estimés à un tarif moyen fixe par envoi
        ({formatPrice(data.tarifs.domicileCents)} et {formatPrice(data.tarifs.relaisCents)}) : Packlink n'expose pas le prix
        réel des étiquettes via son API, et Amazon ne facture rien pour l'expédition tant que l'étiquette n'est pas achetée
        via son propre service de port.
      </p>
    </div>
  );
}
