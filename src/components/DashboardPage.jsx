import { useEffect, useState, useCallback } from "react";
import { navigate } from "../navigation";
import { StatTile, LineChart } from "./charts";
import { formatPrice } from "../cart";
import LinksManager from "./LinksManager";
import SeoPanel from "./SeoPanel";
import AdsPanel from "./AdsPanel";
import AvisPanel from "./AvisPanel";
import BlogPanel from "./BlogPanel";
import PeriodPicker from "./PeriodPicker";
import AmazonPanel from "./AmazonPanel";
import OrdersPanel from "./OrdersPanel";
import CustomersPanel from "./CustomersPanel";
import PromoPanel from "./PromoPanel";
import PartnersPanel from "./PartnersPanel";
import FinancePanel from "./FinancePanel";
import StockPanel from "./StockPanel";
import ShippingPanel from "./ShippingPanel";
import SocialPanel from "./SocialPanel";
import MailingPanel from "./MailingPanel";
import MailAlertsPanel from "./MailAlertsPanel";
import OverviewDashboard from "./OverviewDashboard";
import AdminAccessPanel from "./AdminAccessPanel";
import FaceIdSettings from "./FaceIdSettings";
import PushNotifications from "./PushNotifications";
import { startAuthentication } from "@simplewebauthn/browser";
import { cachedFetchWithStatus, prefetch, clearCache } from "../lib/adminCache";

// Vue par défaut de chaque onglet, téléchargée en une fois à la connexion
// pour qu'ensuite changer d'onglet n'attende plus aucune requête réseau.
function urlsAPrecharger(isOwner) {
  const urls = [
    "/api/overview",
    "/api/mail-alerts",
    "/api/stats?days=30",
    "/api/orders",
    "/api/customers",
    "/api/promo",
    "/api/affiliates",
    "/api/avis",
    "/api/links",
    "/api/mailing",
    "/api/stock",
    `/api/shipping?month=${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    "/api/cost-batches",
    "/api/seo?days=28",
    "/api/finance?days=30",
    "/api/finance-comparison",
    "/api/social-auth?action=status",
    "/api/social-schedule",
    "/api/social-ads",
    "/api/ads",
    "/api/amazon?section=ventes&days=30",
    `/api/amazon?section=finances&month=${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    "/api/amazon?section=commandes",
    "/api/amazon?section=offre",
    "/api/amazon?section=avis",
    "/api/amazon?section=compte",
    "/api/amazon-ads",
  ];
  if (isOwner) urls.push("/api/admin-auth?action=history", "/api/admin-auth?action=admins");
  return urls;
}

const SECTIONS = [
  { id: "accueil", label: "Accueil" },
  {
    id: "site",
    label: "Site",
    tabs: [
      { id: "analyse", label: "Analyse" },
      { id: "commandes", label: "Commandes" },
      { id: "clients", label: "Clients" },
      { id: "promos", label: "Codes promo" },
      { id: "influenceurs", label: "Influenceurs" },
      { id: "avis", label: "Avis" },
      { id: "liens", label: "Liens" },
      { id: "blog", label: "Blog" },
      { id: "mailing", label: "Mailing" },
    ],
  },
  { id: "amazon", label: "Amazon" },
  { id: "finance", label: "Finance" },
  { id: "expedition", label: "Expédition" },
  { id: "stock", label: "Stock" },
  { id: "social", label: "Réseaux sociaux" },
  {
    id: "google",
    label: "Google",
    tabs: [
      { id: "seo", label: "SEO" },
      { id: "campagnes", label: "Campagnes" },
    ],
  },
  {
    id: "acces",
    label: "Accès",
    ownerOnly: true,
    tabs: [
      { id: "connexions", label: "Connexions" },
      { id: "comptes", label: "Comptes" },
    ],
  },
];

export default function DashboardPage() {
  const [connecte, setConnecte] = useState(null); // null = vérification en cours
  const [nom, setNom] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [totp, setTotp] = useState("");
  const [erreurConnexion, setErreurConnexion] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [monNom, setMonNom] = useState("");
  // Onglet/section lus depuis l'URL au premier rendu, pour qu'un rafraîchissement
  // de page (F5) reste sur le même écran au lieu de revenir sur Accueil.
  const paramsInitiaux = new URLSearchParams(window.location.search);
  const sectionInitiale = SECTIONS.some((s) => s.id === paramsInitiaux.get("section")) ? paramsInitiaux.get("section") : "accueil";
  const sectionAvecTabs = SECTIONS.find((s) => s.id === sectionInitiale);
  const tabInitial =
    sectionAvecTabs?.tabs?.some((t) => t.id === paramsInitiaux.get("tab")) ? paramsInitiaux.get("tab") : sectionAvecTabs?.tabs?.[0]?.id || "analyse";

  const [section, setSection] = useState(sectionInitiale);
  const [tab, setTab] = useState(tabInitial);
  const [periodeFinance, setPeriodeFinance] = useState({ mode: "jours", days: 30 });
  const [flouter, setFlouter] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rafraichissement, setRafraichissement] = useState(false);
  const activeSection = SECTIONS.find((s) => s.id === section);
  const visibleSections = SECTIONS.filter((s) => !s.ownerOnly || isOwner);
  // Google et Amazon interrogent des API externes à quota limité : une fois
  // la section ouverte, on la garde montée (juste masquée) pour ne plus
  // jamais refaire de requête en changeant d'onglet ou de section.
  const [visited, setVisited] = useState(new Set(["accueil", "site", sectionInitiale]));

  // Remplace l'URL (sans empiler d'entrée d'historique) pour que F5 recharge
  // sur la même section/onglet.
  function majUrl(sectionId, tabId) {
    const params = new URLSearchParams();
    params.set("section", sectionId);
    if (tabId) params.set("tab", tabId);
    window.history.replaceState({}, "", `/admin?${params.toString()}`);
  }

  function selectSection(s) {
    setSection(s.id);
    setVisited((v) => (v.has(s.id) ? v : new Set(v).add(s.id)));
    const premierTab = s.tabs?.[0]?.id;
    if (premierTab) setTab(premierTab);
    majUrl(s.id, premierTab);
  }

  function selectTab(tabId) {
    setTab(tabId);
    majUrl(section, tabId);
  }
  // La période ne concerne que l'onglet Analyse : soit un nombre de jours
  // glissants, soit deux dates choisies au calendrier.
  const [periode, setPeriode] = useState({ mode: "jours", days: 30 });
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ok | denied | error | unconfigured

  const load = useCallback(async (range) => {
    setState("loading");
    const query =
      range.mode === "dates"
        ? `from=${range.from}&to=${range.to}`
        : `days=${range.days}`;
    try {
      const { status, data: json } = await cachedFetchWithStatus(`/api/stats?${query}`);
      if (status === 401) {
        setConnecte(false);
        return;
      }
      if (status === 503) return setState("unconfigured");
      if (status < 200 || status >= 300) return setState("error");
      setData(json);
      setState("ok");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin-auth?action=me")
      .then((r) => r.json())
      .then((d) => {
        setConnecte(!!d.connecte);
        setIsOwner(!!d.isOwner);
        setMonNom(d.name || "");
      })
      .catch(() => setConnecte(false));
  }, []);

  useEffect(() => {
    if (connecte) load(periode);
  }, [connecte, periode, load]);

  // Précharge en arrière-plan la vue par défaut de tous les onglets dès la
  // connexion confirmée : les fetch() faits ensuite par chaque panneau
  // trouvent déjà la réponse en cache et s'affichent sans attente.
  useEffect(() => {
    if (connecte) prefetch(urlsAPrecharger(isOwner));
  }, [connecte, isOwner]);

  useEffect(() => {
    document.title = "Admin · E-Carpet";
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErreurConnexion("");
    setEnvoi(true);
    try {
      const res = await fetch("/api/admin-auth?action=login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nom, password: motDePasse, totp }),
      });
      const d = await res.json();
      if (d.error) {
        setErreurConnexion(d.error);
        return;
      }
      setMotDePasse("");
      setTotp("");
      setConnecte(true);
      fetch("/api/admin-auth?action=me")
        .then((r) => r.json())
        .then((d) => {
          setIsOwner(!!d.isOwner);
          setMonNom(d.name || "");
        });
    } catch {
      setErreurConnexion("Le serveur n'a pas répondu.");
    } finally {
      setEnvoi(false);
    }
  }

  async function connexionFaceId() {
    setErreurConnexion("");
    setEnvoi(true);
    try {
      const res = await fetch("/api/webauthn?action=login-options");
      const data = await res.json();
      if (data.error) return setErreurConnexion(data.error);

      const response = await startAuthentication({ optionsJSON: data.options });

      const verifyRes = await fetch("/api/webauthn?action=login-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, state: data.state }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData.error) return setErreurConnexion(verifyData.error);
      setConnecte(true);
      fetch("/api/admin-auth?action=me")
        .then((r) => r.json())
        .then((d) => {
          setIsOwner(!!d.isOwner);
          setMonNom(d.name || "");
        });
    } catch (e) {
      // Toujours afficher un message, même pour "NotAllowedError" : ce code
      // couvre aussi bien une annulation volontaire qu'un vrai échec (timeout,
      // activation utilisateur perdue en PWA sur iOS...) — le masquer
      // systématiquement donnait l'impression que rien ne se passait du tout.
      setErreurConnexion(
        e.name === "NotAllowedError"
          ? "Connexion Face ID annulée ou indisponible sur cet appareil."
          : "Face ID non disponible ou non activé sur cet appareil.",
      );
    } finally {
      setEnvoi(false);
    }
  }

  if (connecte === null) return null;

  if (!connecte) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4">
        <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-deep p-8">
          <h1 className="font-display text-2xl font-bold text-white">Admin</h1>
          <p className="mt-2 text-sm text-zinc-400">Espace privé. Nom, mot de passe et code de vérification.</p>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom"
            autoFocus
            className="mt-5 w-full rounded-xl border border-white/10 bg-ink px-4 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60"
          />
          <input
            type="password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            placeholder="Mot de passe"
            className="mt-3 w-full rounded-xl border border-white/10 bg-ink px-4 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60"
          />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
            placeholder="Code à 6 chiffres"
            className="mt-3 w-full rounded-xl border border-white/10 bg-ink px-4 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60"
          />
          {erreurConnexion && <p className="mt-3 text-sm text-red-400">{erreurConnexion}</p>}
          <button
            type="submit"
            disabled={envoi}
            className="mt-4 w-full rounded-full bg-acid px-6 py-3 font-display font-bold text-white cursor-pointer disabled:opacity-60"
          >
            {envoi ? "Connexion…" : "Entrer"}
          </button>
          <button
            type="button"
            onClick={connexionFaceId}
            disabled={envoi}
            className="mt-2 w-full rounded-full border border-white/15 px-6 py-3 font-display text-sm font-bold text-zinc-300 transition-colors hover:text-white cursor-pointer disabled:opacity-60"
          >
            Se connecter avec Face ID
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-3 w-full text-center text-xs text-zinc-500 transition-colors hover:text-white cursor-pointer"
          >
            Retour au site
          </button>
        </form>
      </main>
    );
  }

  function queryFinance(periode) {
    return periode.mode === "dates" ? `from=${periode.from}&to=${periode.to}` : `days=${periode.days}`;
  }

  async function exporterExcel() {
    const res = await fetch(`/api/export-excel?${queryFinance(periodeFinance)}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `e-carpet-rapport-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exporterCsv() {
    const res = await fetch(`/api/finance?export=csv&${queryFinance(periodeFinance)}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Vide le cache et refait toutes les requêtes : la clé change pour forcer
  // le remontage de chaque panneau (qui relit alors des données fraîches),
  // pendant que la vue Analyse (gérée ici, pas dans un panneau autonome) est
  // rechargée explicitement.
  async function toutRafraichir() {
    setRafraichissement(true);
    clearCache();
    prefetch(urlsAPrecharger(isOwner));
    setRefreshKey((k) => k + 1);
    await load(periode);
    setRafraichissement(false);
  }

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Admin</h1>
          {monNom && (
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-xs text-zinc-500">Connecté en tant que {monNom}</p>
              <span className="text-zinc-700">·</span>
              <FaceIdSettings />
              <span className="text-zinc-700">·</span>
              <PushNotifications />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {section === "finance" && (
            <>
              <button
                onClick={exporterExcel}
                className="rounded-full bg-acid px-3 py-1.5 font-display text-xs font-bold text-white transition-colors hover:opacity-90 cursor-pointer"
              >
                Rapport complet (Excel)
              </button>
              <button
                onClick={exporterCsv}
                className="rounded-full border border-white/15 px-3 py-1.5 font-display text-xs font-bold text-zinc-300 transition-colors hover:text-white cursor-pointer"
              >
                Exporter (CSV)
              </button>
            </>
          )}
          <button
            onClick={toutRafraichir}
            disabled={rafraichissement}
            title="Rafraîchir toutes les données"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-300 transition-colors hover:text-white disabled:opacity-50 cursor-pointer"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-5 w-5 ${rafraichissement ? "animate-spin" : ""}`}
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
          <button
            onClick={() => setFlouter((f) => !f)}
            title={flouter ? "Afficher les données" : "Flouter les données (mode démo)"}
            aria-pressed={flouter}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors cursor-pointer ${
              flouter ? "border-acid bg-acid/10 text-acid" : "border-white/10 text-zinc-300 hover:text-white"
            }`}
          >
            {flouter ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-3.22 4.44M14.12 14.12a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1 1l22 22" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Sections : défilement horizontal tactile sur mobile plutôt que
          repli à la ligne, pour garder une seule barre d'onglets compacte. */}
      <nav className="no-scrollbar mb-3 -mx-3 flex gap-5 overflow-x-auto whitespace-nowrap border-b border-white/10 px-3 sm:mx-0 sm:gap-6 sm:px-0">
        {visibleSections.map((s) => (
          <button
            key={s.id}
            onClick={() => selectSection(s)}
            aria-current={section === s.id ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-1 pb-3 font-display text-sm font-bold transition-colors cursor-pointer ${
              section === s.id
                ? "border-acid text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {activeSection?.tabs && (
        <nav className="no-scrollbar mb-6 -mx-3 flex flex-nowrap gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
          {activeSection.tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
                tab === t.id
                  ? "bg-acid text-white"
                  : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <div key={refreshKey} className={flouter ? "mode-demo" : ""}>

      {section === "accueil" && (
        <>
          <OverviewDashboard />
          <MailAlertsPanel limit={5} />
        </>
      )}

      {section === "finance" && <FinancePanel periode={periodeFinance} onPeriodeChange={setPeriodeFinance} />}
      {section === "expedition" && <ShippingPanel />}
      {section === "stock" && <StockPanel />}
      {section === "social" && <SocialPanel />}
      {section === "acces" && isOwner && <AdminAccessPanel tab={tab} />}

      {section === "site" && tab === "analyse" && state === "unconfigured" && (
        <p className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-zinc-300">
          La variable <code className="text-acid">DASHBOARD_PASSWORD</code> n'est pas encore définie dans Netlify.
        </p>
      )}
      {section === "site" && tab === "analyse" && state === "error" && (
        <p className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-red-400">
          Impossible de charger les statistiques.
        </p>
      )}
      {section === "site" && tab === "analyse" && state === "loading" && !data && (
        <p className="text-sm text-zinc-500">Chargement…</p>
      )}

      {section === "site" && tab === "commandes" && <OrdersPanel />}

      {section === "site" && tab === "clients" && <CustomersPanel />}

      {section === "site" && tab === "promos" && <PromoPanel />}

      {section === "site" && tab === "influenceurs" && <PartnersPanel />}

      {section === "site" && tab === "liens" && <LinksManager campaigns={data?.campaigns || []} />}

      {visited.has("google") && (
        <div className={section === "google" ? "contents" : "hidden"}>
          <div className={tab === "seo" ? "contents" : "hidden"}>
            <SeoPanel />
          </div>
          <div className={tab === "campagnes" ? "contents" : "hidden"}>
            <AdsPanel />
          </div>
        </div>
      )}

      {section === "site" && tab === "avis" && <AvisPanel />}

      {section === "site" && tab === "blog" && <BlogPanel />}

      {section === "site" && tab === "mailing" && <MailingPanel />}

      {visited.has("amazon") && (
        <div className={section === "amazon" ? "contents" : "hidden"}>
          <AmazonPanel />
        </div>
      )}

      {section === "site" && tab === "analyse" && (
        <div className="mb-4">
          <PeriodPicker
            periode={periode}
            onChange={setPeriode}
            resume={
              data
                ? `${data.range.days} jour${data.range.days > 1 ? "s" : ""} · ${data.range.from} → ${data.range.to}`
                : "Chargement…"
            }
          />
        </div>
      )}

      {section === "site" && tab === "analyse" && data && (
        <>
          <div>
            <LineChart data={data.series} title="Visiteurs par jour" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Visiteurs" value={data.kpi.visitors.toLocaleString("fr-FR")} hint="uniques par jour, cumulés" />
            {[
              { title: "Liens tagués", items: data.campaigns || [], empty: "Aucune visite via un lien tagué" },
              { title: "Pays", items: data.countries },
              { title: "Villes", items: data.cities },
              { title: "Appareils", items: data.devices },
              { title: "Langue", items: data.languages },
            ].map(({ title, items, empty }) => {
              const top = [...items].sort((a, b) => b.value - a.value)[0];
              return (
                <StatTile
                  key={title}
                  label={title}
                  value={top ? top.value.toLocaleString("fr-FR") : "—"}
                  hint={top ? top.label : empty || "Aucune donnée"}
                />
              );
            })}
          </div>

          <p className="mt-8 text-xs leading-relaxed text-zinc-600">
            Mesure sans cookies ni identifiant persistant : un visiteur est un hachage anonyme qui change chaque jour.
            Un même visiteur revenant sur plusieurs jours est donc compté une fois par jour. Les robots identifiés sont exclus.
          </p>

          {data.commerce && (
            <>
              <h2 className="mb-4 mt-10 font-display text-xl font-bold text-white">Commande</h2>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatTile
                  label="Chiffre d'affaires"
                  value={formatPrice(data.commerce.revenueCents)}
                  hint={`${data.commerce.ordersCount} commande${data.commerce.ordersCount > 1 ? "s" : ""} payée${data.commerce.ordersCount > 1 ? "s" : ""}`}
                />
                <StatTile label="Panier moyen" value={formatPrice(data.commerce.aovCents)} />
                <StatTile
                  label="Taux de conversion"
                  value={`${data.commerce.conversionRate.toString().replace(".", ",")} %`}
                  hint="commandes payées / visiteurs"
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <StatTile
                  label="Paniers abandonnés"
                  value={data.commerce.abandonedCarts.toLocaleString("fr-FR")}
                  hint={`${data.commerce.abandonRate.toString().replace(".", ",")} % des paniers créés`}
                />
                <StatTile
                  label="Codes promo utilisés"
                  value={data.commerce.promoOrders.toLocaleString("fr-FR")}
                  hint={`${data.commerce.promoRate.toString().replace(".", ",")} % des commandes`}
                />
              </div>

              <div className="mt-4">
                <LineChart
                  data={data.commerce.series}
                  title="Chiffre d'affaires par jour"
                  value={(d) => d.revenueCents}
                  sub={(d) => d.orders}
                  tableHeaders={["CA", "Commandes"]}
                  formatValue={(n) => formatPrice(n)}
                  tooltip={(d) => `${formatPrice(d.revenueCents)} · ${d.orders} commande${d.orders > 1 ? "s" : ""}`}
                />
              </div>
            </>
          )}
        </>
      )}
      </div>
    </main>
  );
}
