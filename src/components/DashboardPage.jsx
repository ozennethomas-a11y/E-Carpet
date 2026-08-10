import { useEffect, useState, useCallback } from "react";
import { navigate } from "../navigation";
import { StatTile, ColumnChart, BarList } from "./charts";
import LinksManager from "./LinksManager";
import SeoPanel from "./SeoPanel";
import AdsPanel from "./AdsPanel";

const RANGES = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
];

const TABS = [
  { id: "analyse", label: "Analyse" },
  { id: "liens", label: "Liens" },
  { id: "seo", label: "SEO" },
  { id: "campagnes", label: "Campagnes" },
];

export default function DashboardPage() {
  const [pw, setPw] = useState(() => sessionStorage.getItem("ec-dash-pw") || "");
  const [input, setInput] = useState("");
  const [tab, setTab] = useState("analyse");
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ok | denied | error | unconfigured

  const load = useCallback(async (password, range) => {
    if (!password) return;
    setState("loading");
    try {
      const res = await fetch(`/api/stats?days=${range}`, {
        headers: { "x-dashboard-password": password },
      });
      if (res.status === 401) {
        setState("denied");
        sessionStorage.removeItem("ec-dash-pw");
        setPw("");
        return;
      }
      if (res.status === 503) return setState("unconfigured");
      if (!res.ok) return setState("error");
      setData(await res.json());
      setState("ok");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (pw) load(pw, days);
  }, [pw, days, load]);

  useEffect(() => {
    document.title = "Admin · E-Carpet";
  }, []);

  const submit = (e) => {
    e.preventDefault();
    sessionStorage.setItem("ec-dash-pw", input);
    setPw(input);
  };

  if (!pw) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4">
        <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-deep p-8">
          <h1 className="font-display text-2xl font-bold text-white">Admin</h1>
          <p className="mt-2 text-sm text-zinc-400">Espace privé. Entrez le mot de passe.</p>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            className="mt-5 w-full rounded-xl border border-white/10 bg-ink px-4 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60"
          />
          {state === "denied" && <p className="mt-3 text-sm text-red-400">Mot de passe incorrect.</p>}
          <button
            type="submit"
            className="mt-4 w-full rounded-full bg-acid px-6 py-3 font-display font-bold text-white cursor-pointer"
          >
            Entrer
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Admin</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {data ? `${data.range.from} → ${data.range.to}` : "Chargement…"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  days === r.days ? "bg-acid text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate("/")}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:text-white cursor-pointer"
          >
            Retour au site
          </button>
        </div>
      </header>

      {/* Sections */}
      <nav className="mb-6 flex gap-6 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px border-b-2 px-1 pb-3 font-display text-sm font-bold transition-colors cursor-pointer ${
              tab === t.id
                ? "border-acid text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {state === "unconfigured" && (
        <p className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-zinc-300">
          La variable <code className="text-acid">DASHBOARD_PASSWORD</code> n'est pas encore définie dans Netlify.
        </p>
      )}
      {state === "error" && (
        <p className="rounded-2xl border border-white/10 bg-slate-deep p-6 text-sm text-red-400">
          Impossible de charger les statistiques.
        </p>
      )}
      {state === "loading" && !data && <p className="text-sm text-zinc-500">Chargement…</p>}

      {tab === "liens" && <LinksManager password={pw} campaigns={data?.campaigns || []} />}

      {tab === "seo" && <SeoPanel password={pw} />}

      {tab === "campagnes" && <AdsPanel password={pw} />}

      {tab === "analyse" && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Visiteurs" value={data.kpi.visitors.toLocaleString("fr-FR")} hint="uniques par jour, cumulés" />
            <StatTile label="Pages vues" value={data.kpi.views.toLocaleString("fr-FR")} />
            <StatTile label="Pages / visiteur" value={data.kpi.perVisit.toString().replace(".", ",")} />
          </div>

          <div className="mt-4">
            <ColumnChart data={data.series} title="Visiteurs par jour" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <BarList
              title="Liens tagués (réseaux, influenceurs)"
              items={data.campaigns || []}
              empty="Aucune visite via un lien tagué pour l'instant."
            />
            <BarList title="Sources de trafic" items={data.sources} />
            <BarList title="Pays" items={data.countries} />
            <BarList title="Villes" items={data.cities} />
            <BarList title="Pages les plus vues" items={data.pages} />
            <BarList title="Appareils" items={data.devices} />
            <BarList title="Langue du navigateur" items={data.languages} />
          </div>

          <p className="mt-8 text-xs leading-relaxed text-zinc-600">
            Mesure sans cookies ni identifiant persistant : un visiteur est un hachage anonyme qui change chaque jour.
            Un même visiteur revenant sur plusieurs jours est donc compté une fois par jour. Les robots identifiés sont exclus.
          </p>
        </>
      )}
    </main>
  );
}
