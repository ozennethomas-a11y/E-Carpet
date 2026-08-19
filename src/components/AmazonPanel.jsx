import { useEffect, useState, useCallback } from "react";
import { StatTile, ColumnChart } from "./charts";

// Onglet « Amazon » : toutes les données que la Selling Partner API nous
// transmet, organisées en sous-parties. Lecture seule partout, sauf :
//  - Offre & stock : une proposition de modification est enregistrée, jamais
//    publiée automatiquement. La publication réelle demande un développement
//    et des tests supplémentaires avant d'être activée.
//  - Avis clients : envoie le bouton officiel Amazon « Demander un avis »,
//    une commande à la fois, sur clic explicite.

const eur = (n, devise = "EUR") =>
  Number(n).toLocaleString("fr-FR", { style: "currency", currency: devise, maximumFractionDigits: 2 });

const SOUS_ONGLETS = [
  { id: "ventes", label: "Ventes" },
  { id: "finances", label: "Finances" },
  { id: "commandes", label: "Commandes" },
  { id: "marketing", label: "Marketing" },
  { id: "offre", label: "Offre & stock" },
  { id: "avis", label: "Avis clients" },
  { id: "compte", label: "Compte" },
  { id: "messagerie", label: "Messagerie" },
];

function useSection(section, jours) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const q = new URLSearchParams({ section, ...(jours ? { days: jours } : {}) });
      const res = await fetch(`/api/amazon?${q}`);
      const json = await res.json();
      setData(json);
      setState(json.error || json.erreur ? "erreur" : "ok");
    } catch {
      setState("erreur");
      setData({ error: "Le serveur n'a pas répondu." });
    }
  }, [section, jours]);

  useEffect(() => { load(); }, [load]);
  return { data, state, reload: load };
}

function Erreur({ message }) {
  const aides = { missing_credentials: "Il manque des variables Amazon dans Netlify." };
  return (
    <div className="rounded-2xl border border-acid/30 bg-acid/10 p-6 text-sm leading-relaxed">
      <p className="font-display font-bold text-white">Amazon pas encore connecté</p>
      <p className="mt-2 text-zinc-300">{aides[message] || message}</p>
    </div>
  );
}

// ---------- Ventes ----------

function Ventes() {
  const [jours, setJours] = useState(30);
  const { data, state } = useSection("ventes", jours);

  if (state === "loading" && !data) return <p className="text-sm text-zinc-500">Interrogation d'Amazon…</p>;
  if (state === "erreur") return <Erreur message={data?.error || data?.erreur} />;

  const parJour = {};
  for (const p of data.parPays) {
    for (const j of p.serie || []) {
      parJour[j.date] = { commandes: (parJour[j.date]?.commandes || 0) + j.commandes, ca: (parJour[j.date]?.ca || 0) + j.ca };
    }
  }
  const debut = new Date(data.periode.depuis);
  const serie = [];
  for (let t = debut.getTime(); t <= Date.now(); t += 86400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    serie.push({ date, ...(parJour[date] || { commandes: 0, ca: 0 }) });
  }

  const actifs = data.parPays.filter((p) => !p.erreur);
  const vendeurs = actifs.filter((p) => p.commandes > 0);
  const zeroVente = actifs.filter((p) => p.commandes === 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          Depuis le {data.periode.depuis} · <span className="chiffre">{data.marketplaces.length}</span> marketplaces actifs
        </p>
        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setJours(d)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${jours === d ? "bg-acid text-white" : "text-zinc-400 hover:text-white"}`}>
              {d} jours
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Chiffre d'affaires" value={eur(data.total.chiffreAffaires)} />
        <StatTile label="Commandes" value={data.total.commandes} />
        <StatTile label="Panier moyen" value={data.total.commandes ? eur(data.total.chiffreAffaires / data.total.commandes) : "—"} />
      </div>

      {serie.length > 0 && (
        <ColumnChart
          title="Chiffre d'affaires par jour, tous marketplaces"
          data={serie}
          value={(d) => d.ca}
          sub={(d) => d.commandes}
          tableHeaders={["Chiffre d'affaires", "Commandes"]}
          formatValue={eur}
          tooltip={(d) => `${eur(d.ca)} · ${d.commandes} commande${d.commandes > 1 ? "s" : ""}`}
        />
      )}

      {vendeurs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {vendeurs.map((p) => (
            <div key={p.pays} className="rounded-2xl border border-white/10 bg-slate-deep p-5">
              <h2 className="font-display text-base font-bold text-white">{p.nom}</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div><div className="chiffre font-display text-xl font-bold text-white">{eur(p.chiffreAffaires, p.devise)}</div><div className="mt-1 text-xs text-zinc-500">CA</div></div>
                <div><div className="chiffre font-display text-xl font-bold text-white">{p.commandes}</div><div className="mt-1 text-xs text-zinc-500">Commandes</div></div>
                <div><div className="chiffre font-display text-xl font-bold text-white">{eur(p.panierMoyen, p.devise)}</div><div className="mt-1 text-xs text-zinc-500">Panier moyen</div></div>
              </div>
              {p.annulees > 0 && <p className="mt-3 text-xs text-zinc-500"><span className="chiffre">{p.annulees}</span> commande{p.annulees > 1 ? "s" : ""} annulée{p.annulees > 1 ? "s" : ""}.</p>}
            </div>
          ))}
        </div>
      )}

      {zeroVente.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
          <h2 className="font-display text-base font-bold text-white">Marketplaces sans vente</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Le compte y est actif mais aucune commande sur cette période. Vérifiez que la fiche produit y est bien traduite et publiée.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {zeroVente.map((p) => (
              <span key={p.pays} className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">{p.nom}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Finances ----------

function Finances() {
  const [jours, setJours] = useState(90);
  const { data, state } = useSection("finances", jours);

  if (state === "loading" && !data) return <p className="text-sm text-zinc-500">Interrogation d'Amazon…</p>;
  if (state === "erreur") return <Erreur message={data?.error || data?.erreur} />;

  const tauxRemb = data.ventesBrutes ? Math.round((-data.remboursements / data.ventesBrutes) * 1000) / 10 : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">Depuis le {data.periode.depuis} · relevé financier Amazon</p>
        <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
          {[30, 90, 180].map((d) => (
            <button key={d} onClick={() => setJours(d)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${jours === d ? "bg-acid text-white" : "text-zinc-400 hover:text-white"}`}>
              {d} jours
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Ventes brutes" value={eur(data.ventesBrutes)} />
        <StatTile label="Frais Amazon" value={eur(data.fraisAmazon)} hint={`${data.tauxCommission}% du brut`} />
        <StatTile label="Remboursements" value={eur(data.remboursements)} hint={tauxRemb > 15 ? `${tauxRemb}% des ventes, élevé` : `${tauxRemb}% des ventes`} />
        <StatTile label="Net perçu" value={eur(data.net)} />
      </div>

      {tauxRemb > 15 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-relaxed text-amber-200">
          Taux de remboursement de {tauxRemb}%, nettement au-dessus de la moyenne du secteur (2 à 5%).
          Vérifiez les motifs de retour dans Seller Central : un défaut produit récurrent ou une
          description trompeuse en sont les causes les plus fréquentes.
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Détail des frais Amazon</h2>
        <ul className="mt-4 flex flex-col gap-2.5">
          {data.fraisParType.filter((f) => f.montant !== 0).map((f) => (
            <li key={f.type} className="flex items-center justify-between border-t border-white/5 pt-2.5 text-sm">
              <span className="text-zinc-400">{f.type}</span>
              <span className="chiffre font-display font-bold tabular-nums text-white">{eur(f.montant)}</span>
            </li>
          ))}
          {data.fraisParType.every((f) => f.montant === 0) && <p className="text-sm text-zinc-500">Aucun frais sur la période.</p>}
        </ul>
      </div>

      <p className="text-xs leading-relaxed text-zinc-600">
        Ce relevé n'inclut pas les informations nécessaires pour générer une facture fiscale :
        pour votre comptabilité, le rapport officiel reste à télécharger dans Seller Central.
      </p>
    </div>
  );
}

// ---------- Offre & stock ----------

// ---------- Commandes ----------

function LigneCommande({ c, marketplaceId, transporteurs, onExpediee }) {
  const [ouvert, setOuvert] = useState(false);
  const [transporteur, setTransporteur] = useState(transporteurs[0]?.code || "");
  const [suivi, setSuivi] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  const [gabarits, setGabarits] = useState(null);
  const [texteMessage, setTexteMessage] = useState("");
  const [envoiMessage, setEnvoiMessage] = useState(false);
  const [messageEnvoye, setMessageEnvoye] = useState(false);

  const chargerGabarits = async () => {
    if (gabarits) return;
    try {
      const res = await fetch(`/api/amazon?section=gabarits&orderId=${c.commande}&marketplaceId=${marketplaceId}`);
      const json = await res.json();
      setGabarits(json);
    } catch {
      setGabarits({ confirmDeliveryDetails: false });
    }
  };

  const expedier = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await fetch("/api/amazon?section=expedier", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: c.commande, marketplaceId, transporteur, suivi }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "échec");
      onExpediee(c.commande);
    } catch (e) {
      setErreur(String(e.message || e));
    }
    setEnvoi(false);
  };

  const envoyerMessage = async () => {
    setEnvoiMessage(true);
    try {
      const res = await fetch("/api/amazon?section=message-livraison", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: c.commande, marketplaceId, texte: texteMessage }),
      });
      if (res.ok) setMessageEnvoye(true);
    } finally {
      setEnvoiMessage(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-ink p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-white">{c.commande}</div>
          <div className="text-xs text-zinc-500">
            {c.date} · <span className="chiffre">{c.montant} €</span> · limite d'expédition {c.dateLimiteExpedition?.slice(0, 10)}
            {c.pointRelais && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-zinc-300">point relais probable</span>}
          </div>
        </div>
        <button onClick={() => setOuvert((v) => !v)} className="rounded-full border border-white/15 px-4 py-1.5 font-display text-xs font-bold text-zinc-300 transition-colors hover:text-white cursor-pointer">
          {ouvert ? "Fermer" : "Confirmer l'expédition"}
        </button>
      </div>

      {ouvert && (
        <form onSubmit={expedier} className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap gap-3">
            <select value={transporteur} onChange={(e) => setTransporteur(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-deep px-3 py-2 text-sm text-white outline-none focus:border-acid/60">
              {transporteurs.map((t) => <option key={t.code} value={t.code}>{t.nom}</option>)}
            </select>
            <input value={suivi} onChange={(e) => setSuivi(e.target.value)} placeholder="Numéro de suivi"
              className="flex-1 rounded-xl border border-white/10 bg-slate-deep px-3 py-2 text-sm text-white outline-none focus:border-acid/60" />
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            Amazon envoie automatiquement au client son e-mail de suivi standard, avec ce transporteur
            et ce numéro. Rien d'autre n'est nécessaire pour un envoi classique.
          </p>
          <button type="submit" disabled={envoi || !suivi.trim()} className="self-start rounded-full bg-acid px-5 py-2 font-display text-xs font-bold text-white cursor-pointer disabled:opacity-40">
            {envoi ? "Envoi…" : "Confirmer et notifier le client"}
          </button>
          {erreur && <p className="text-xs text-red-400">{erreur}</p>}

          {c.pointRelais && (
            <div className="mt-2 rounded-xl border border-white/10 bg-slate-deep p-3">
              <button type="button" onClick={chargerGabarits} className="text-xs text-zinc-400 underline underline-offset-4 transition-colors hover:text-white cursor-pointer">
                Vérifier si un message complémentaire est possible pour cette commande
              </button>
              {gabarits && !gabarits.confirmDeliveryDetails && (
                <p className="mt-2 text-xs text-amber-400">
                  Amazon ne propose aucun gabarit de message pour cette commande en ce moment.
                  Le mail de suivi standard reste le seul canal disponible.
                </p>
              )}
              {gabarits?.confirmDeliveryDetails && !messageEnvoye && (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea value={texteMessage} onChange={(e) => setTexteMessage(e.target.value)} rows={2}
                    placeholder="Précisions sur le retrait en point relais (horaires, adresse...)"
                    className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-xs text-white outline-none focus:border-acid/60" />
                  <button type="button" onClick={envoyerMessage} disabled={envoiMessage || !texteMessage.trim()}
                    className="self-start rounded-full border border-acid/40 px-4 py-1.5 text-xs font-bold text-acid cursor-pointer disabled:opacity-40">
                    {envoiMessage ? "Envoi…" : "Envoyer ce message via Amazon"}
                  </button>
                </div>
              )}
              {messageEnvoye && <p className="mt-2 text-xs text-emerald-400">Message envoyé.</p>}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

function Commandes() {
  const { data, state, reload } = useSection("commandes");
  const [expediees, setExpediees] = useState(new Set());

  if (state === "loading" && !data) return <p className="text-sm text-zinc-500">Interrogation d'Amazon…</p>;
  if (state === "erreur") return <Erreur message={data?.error} />;

  const restantes = data.commandes.filter((c) => !expediees.has(c.commande));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5 text-sm leading-relaxed text-zinc-400">
        Confirmer une expédition ici déclenche l'e-mail de suivi <strong className="text-zinc-200">automatique</strong> d'Amazon
        vers le client, avec le transporteur et le numéro de suivi. Pour un point relais, un message
        complémentaire peut être proposé selon ce qu'Amazon autorise sur cette commande précise.
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">
          À expédier {restantes.length > 0 && <span className="chiffre ml-2 rounded-full bg-acid px-2 py-0.5 text-xs text-white">{restantes.length}</span>}
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          {restantes.length === 0 && <p className="text-sm text-zinc-500">Aucune commande en attente d'expédition.</p>}
          {restantes.map((c) => (
            <LigneCommande key={c.commande} c={c} marketplaceId={data.marketplaceId} transporteurs={data.transporteurs}
              onExpediee={(id) => { setExpediees((s) => new Set([...s, id])); reload(); }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Marketing (Amazon Ads) ----------

function Marketing() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    fetch("/api/amazon-ads")
      .then((r) => r.json())
      .then((json) => { setData(json); setState(json.error ? "erreur" : "ok"); })
      .catch(() => { setState("erreur"); setData({ error: "Le serveur n'a pas répondu." }); });
  }, []);

  if (state === "loading") return <p className="text-sm text-zinc-500">Interrogation d'Amazon Ads…</p>;

  if (data?.error === "missing_credentials") {
    return (
      <div className="rounded-2xl border border-acid/30 bg-acid/10 p-6 text-sm leading-relaxed">
        <p className="font-display font-bold text-white">Amazon Ads pas encore connecté</p>
        <p className="mt-2 text-zinc-300">
          Inscription en cours d'approbation par Amazon (environ 1 jour ouvré). Une fois le
          Client ID, le Client Secret et le refresh token obtenus via
          <code className="mx-1 text-acid">scripts/amazon-ads-token.mjs</code>
          et ajoutés dans Netlify, cette page affichera vos campagnes Sponsored Products.
        </p>
      </div>
    );
  }

  if (data?.error === "profil manquant") {
    return (
      <div className="rounded-2xl border border-acid/30 bg-acid/10 p-6 text-sm leading-relaxed">
        <p className="font-display font-bold text-white">Un profil publicitaire reste à choisir</p>
        <p className="mt-2 text-zinc-300">
          Ajoutez <code className="text-acid">AMAZON_ADS_PROFILE_ID</code> dans Netlify avec l'une de ces valeurs :
        </p>
        <ul className="mt-3 flex flex-col gap-1">
          {(data.profils || []).map((p) => (
            <li key={p.id} className="text-zinc-300">
              <span className="text-acid">{p.id}</span> · {p.pays} · {p.devise}
              {p.id === data.suggestion && <span className="ml-2 text-xs text-zinc-500">(France, suggéré)</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (state === "erreur") {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-amber-400">
        Amazon Ads a répondu : {data?.error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5 text-sm leading-relaxed text-zinc-400">
        Lecture seule pour l'instant : consulter vos campagnes ici ne modifie rien. La création ou
        la pause de campagne demandera, comme pour Google Ads, une validation explicite avant
        publication.
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Campagnes Sponsored Products</h2>
        <div className="mt-4 flex flex-col gap-2">
          {(data.campagnes || []).length === 0 && <p className="text-sm text-zinc-500">Aucune campagne active pour l'instant.</p>}
          {(data.campagnes || []).map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-ink p-4 text-sm">
              <div>
                <div className="text-white">{c.nom}</div>
                <div className="text-xs text-zinc-500">{c.cible} · budget <span className="chiffre">{c.budgetQuotidien} €/jour</span></div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${c.statut === "enabled" ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-zinc-400"}`}>{c.statut}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Offre() {
  const { data, state, reload } = useSection("offre");
  const [champ, setChamp] = useState("titre");
  const [valeur, setValeur] = useState("");
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState(false);

  if (state === "loading" && !data) return <p className="text-sm text-zinc-500">Interrogation d'Amazon…</p>;
  if (state === "erreur" || data?.erreur) return <Erreur message={data?.error || data?.erreur} />;

  const f = data.fiche;

  const proposer = async (e) => {
    e.preventDefault();
    if (!valeur.trim()) return;
    setEnvoi(true);
    try {
      await fetch("/api/amazon?section=proposer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku: f.sku, champ, valeurActuelle: f[champ === "titre" ? "titre" : "differenciation"], valeurProposee: valeur, note }),
      });
      setValeur(""); setNote("");
      reload();
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {f.problemes.length > 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm leading-relaxed text-red-200">
          <p className="font-display font-bold text-white">Amazon signale {f.problemes.length} problème{f.problemes.length > 1 ? "s" : ""} sur cette fiche</p>
          <ul className="mt-2 flex flex-col gap-2">
            {f.problemes.map((p, i) => <li key={i}>{p.message}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <div className="flex gap-4">
          {f.image && <img src={f.image} alt="" className="size-24 shrink-0 rounded-xl border border-white/10 object-cover" />}
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              {f.statut.map((s) => (
                <span key={s} className={`rounded-full px-2 py-0.5 text-xs ${s === "BUYABLE" ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-zinc-400"}`}>{s}</span>
              ))}
            </div>
            <h2 className="mt-2 font-display text-base font-bold text-white">{f.titre}</h2>
            <p className="mt-1 text-xs text-zinc-500">SKU {f.sku} · ASIN {f.asin} · MAJ {f.derniereMiseAJour?.slice(0, 10)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-ink p-4">
            <div className="chiffre font-display text-2xl font-bold text-white">{f.stock ?? "—"}</div>
            <div className="mt-1 text-xs text-zinc-500">Unités en stock</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-ink p-4">
            <div className="text-sm text-white">{f.couleur || "—"}</div>
            <div className="mt-1 text-xs text-zinc-500">Couleur déclarée</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-ink p-4">
            <div className="text-sm text-white">{f.fabricant || "—"}</div>
            <div className="mt-1 text-xs text-zinc-500">Fabricant déclaré</div>
          </div>
        </div>

        {f.differenciation && (
          <div className="mt-4 rounded-xl border border-white/10 bg-ink p-4">
            <div className="text-xs text-zinc-500">Sous-titre / différenciation</div>
            <p className="mt-1 text-sm text-zinc-300">{f.differenciation}</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Proposer une modification</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Rien n'est publié sur Amazon automatiquement. Cette proposition est enregistrée ici ;
          la publication réelle sur la fiche demande une validation supplémentaire de votre part
          une fois qu'on aura testé le circuit ensemble.
        </p>
        <form onSubmit={proposer} className="mt-4 flex flex-col gap-3">
          <select value={champ} onChange={(e) => setChamp(e.target.value)}
            className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-acid/60">
            <option value="titre">Titre</option>
            <option value="differenciation">Sous-titre</option>
          </select>
          <textarea value={valeur} onChange={(e) => setValeur(e.target.value)} rows={2} placeholder="Nouvelle valeur proposée"
            className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-acid/60" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Pourquoi ce changement ? (optionnel)"
            className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-acid/60" />
          <button type="submit" disabled={envoi || !valeur.trim()}
            className="self-start rounded-full bg-acid px-5 py-2 font-display text-xs font-bold text-white cursor-pointer disabled:opacity-40">
            Enregistrer la proposition
          </button>
        </form>
      </div>

      {data.propositions.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
          <h2 className="font-display text-base font-bold text-white">Propositions en attente</h2>
          <div className="mt-4 flex flex-col gap-3">
            {data.propositions.map((p) => (
              <div key={p.id} className="rounded-xl border border-white/10 bg-ink p-4 text-sm">
                <div className="text-xs text-zinc-500">{p.date} · {p.champ}</div>
                <p className="mt-1 text-zinc-300">{p.valeurProposee}</p>
                {p.note && <p className="mt-1 text-xs text-zinc-500">{p.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Avis clients ----------

function AvisClients() {
  const { data, state, reload } = useSection("avis");
  const [envoiEnCours, setEnvoiEnCours] = useState(null);
  const [envoyes, setEnvoyes] = useState(new Set());

  if (state === "loading" && !data) return <p className="text-sm text-zinc-500">Interrogation d'Amazon…</p>;
  if (state === "erreur") return <Erreur message={data?.error} />;

  const envoyer = async (commande, marketplaceId) => {
    setEnvoiEnCours(commande);
    try {
      const res = await fetch("/api/amazon?section=avis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: commande, marketplaceId }),
      });
      if (res.ok) setEnvoyes((s) => new Set([...s, commande]));
    } finally {
      setEnvoiEnCours(null);
    }
  };

  const eligibles = data.commandes.filter((c) => c.eligible);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5 text-sm leading-relaxed text-zinc-400">
        Ceci déclenche le bouton officiel Amazon <strong className="text-zinc-200">« Demander un avis »</strong>,
        commande par commande, sur clic explicite. Amazon envoie lui-même l'e-mail avec son propre
        gabarit ; nous n'écrivons ni n'envoyons rien nous-mêmes. Une commande n'est éligible que
        dans une fenêtre de 5 à 30 jours après livraison, et une seule fois.
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">
          Commandes éligibles {eligibles.length > 0 && <span className="chiffre ml-2 rounded-full bg-acid px-2 py-0.5 text-xs text-white">{eligibles.length}</span>}
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          {data.commandes.length === 0 && <p className="text-sm text-zinc-500">Aucune commande récente sur {data.marketplace}.</p>}
          {data.commandes.map((c) => (
            <div key={c.commande} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-ink p-4">
              <div>
                <div className="text-sm text-white">{c.commande}</div>
                <div className="text-xs text-zinc-500">{c.date} · <span className="chiffre">{c.montant} €</span></div>
              </div>
              {envoyes.has(c.commande) ? (
                <span className="text-xs text-emerald-400">Demande envoyée</span>
              ) : c.eligible ? (
                <button onClick={() => envoyer(c.commande, data.marketplaceId)} disabled={envoiEnCours === c.commande}
                  className="rounded-full bg-acid px-4 py-1.5 font-display text-xs font-bold text-white cursor-pointer disabled:opacity-40">
                  {envoiEnCours === c.commande ? "Envoi…" : "Demander un avis"}
                </button>
              ) : (
                <span className="text-xs text-zinc-600">Pas encore éligible</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Compte ----------

function Compte() {
  const { data, state } = useSection("compte");
  if (state === "loading" && !data) return <p className="text-sm text-zinc-500">Interrogation d'Amazon…</p>;
  if (state === "erreur") return <Erreur message={data?.error} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">Marketplaces actifs</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Ce que l'API confirme comme réellement ouvert pour votre compte, indépendamment de ce qui
          a été configuré manuellement. Utile pour repérer une annonce suspendue avant qu'elle ne
          coûte des ventes.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {data.marketplaces.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-ink p-3 text-sm">
              <span className="text-zinc-300">{m.nom}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${m.annoncesSuspendues ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                {m.annoncesSuspendues ? "annonces suspendues" : "actif"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Messagerie ----------

function Messagerie() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm leading-relaxed text-zinc-300">
      <p className="font-display font-bold text-white">Pas d'accès en lecture aux messages acheteurs</p>
      <p className="mt-3">
        L'API Amazon ne permet pas de lire les messages envoyés par les clients, ni d'y répondre
        librement. La <em>Messaging API</em> ne sert qu'à <strong className="text-white">envoyer</strong> un
        nombre limité de messages prédéfinis par Amazon (confirmation de livraison, information
        légale…), jamais un message libre. Il n'existe donc pas de moyen conforme de construire un
        agent qui lirait et répondrait automatiquement aux clients : Amazon l'interdit précisément
        pour éviter les réponses automatisées non supervisées.
      </p>
      <p className="mt-3">
        Pour la relation client, il faut continuer à passer par la messagerie de Seller Central.
        Ce que je peux en revanche automatiser dans le respect des règles Amazon, c'est la
        sollicitation d'avis via le bouton officiel : voir l'onglet <strong className="text-white">Avis clients</strong>.
      </p>
    </div>
  );
}

export default function AmazonPanel() {
  const [sous, setSous] = useState("ventes");
  // Chaque sous-partie interroge l'API Amazon, dont le quota se remplit vite.
  // Une fois visitée, elle reste montée (juste masquée) : changer d'onglet ne
  // refait plus jamais la même requête.
  const [visited, setVisited] = useState(new Set(["ventes"]));

  function goTo(id) {
    setSous(id);
    setVisited((v) => (v.has(id) ? v : new Set(v).add(id)));
  }

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2 rounded-full border border-white/10 bg-white/5 p-1">
        {SOUS_ONGLETS.map((s) => (
          <button key={s.id} onClick={() => goTo(s.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${sous === s.id ? "bg-acid text-white" : "text-zinc-400 hover:text-white"}`}>
            {s.label}
          </button>
        ))}
      </nav>

      {visited.has("ventes") && <div className={sous === "ventes" ? "contents" : "hidden"}><Ventes /></div>}
      {visited.has("finances") && <div className={sous === "finances" ? "contents" : "hidden"}><Finances /></div>}
      {visited.has("commandes") && <div className={sous === "commandes" ? "contents" : "hidden"}><Commandes /></div>}
      {visited.has("marketing") && <div className={sous === "marketing" ? "contents" : "hidden"}><Marketing /></div>}
      {visited.has("offre") && <div className={sous === "offre" ? "contents" : "hidden"}><Offre /></div>}
      {visited.has("avis") && <div className={sous === "avis" ? "contents" : "hidden"}><AvisClients /></div>}
      {visited.has("compte") && <div className={sous === "compte" ? "contents" : "hidden"}><Compte /></div>}
      {visited.has("messagerie") && <div className={sous === "messagerie" ? "contents" : "hidden"}><Messagerie /></div>}
    </div>
  );
}
