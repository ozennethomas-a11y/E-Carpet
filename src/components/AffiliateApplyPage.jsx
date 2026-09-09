import { useState } from "react";
import { navigate } from "../navigation";
import { ArrowIcon } from "./ui";

const RESEAUX = ["TikTok", "Instagram", "Facebook", "YouTube"];

const EMPTY = { name: "", email: "", promoCode: "", message: "" };

// Le lien envoyé à un créateur déjà connu porte ce qu'on sait de lui, pour
// qu'il n'ait pas à le retaper : ?nom=…&reseau=TikTok&abonnes=24900&lien=…
//
// L'email n'est volontairement JAMAIS transmis dans l'URL. Une adresse dans
// un lien se retrouve dans l'historique du navigateur, les journaux serveur
// et les référents — le créateur la saisit lui-même, c'est le seul champ que
// le pré-remplissage ne touche pas.
function prealable() {
  if (typeof window === "undefined") return { form: EMPTY, reseaux: {}, source: null };
  const p = new URLSearchParams(window.location.search);
  const nom = (p.get("nom") || "").slice(0, 80);
  const reseau = RESEAUX.find((r) => r.toLowerCase() === (p.get("reseau") || "").toLowerCase());
  const abonnes = (p.get("abonnes") || "").slice(0, 20);
  const lien = (p.get("lien") || "").slice(0, 300);

  return {
    form: { ...EMPTY, name: nom },
    // Un réseau n'est pré-coché que s'il fait partie de la liste fermée : un
    // paramètre inventé ne doit pas créer une case qui n'existe pas.
    reseaux: reseau ? { [reseau]: { link: lien, followers: abonnes } } : {},
    // utm_source alimente déjà le suivi d'audience (voir track.mjs) ; on le
    // transmet aussi à la candidature, sinon on saurait compter les
    // inscriptions sans jamais savoir quelle relance les a produites.
    source: (p.get("utm_source") || p.get("ref") || "").slice(0, 40) || null,
  };
}

export default function AffiliateApplyPage() {
  const [depart] = useState(prealable);
  const [form, setForm] = useState(depart.form);
  // Un réseau peut être sélectionné sans être encore rempli (lien/abonnés
  // vides) : { platform: { link, followers } }.
  const [reseaux, setReseaux] = useState(depart.reseaux);
  const [state, setState] = useState("idle"); // idle | envoi | envoye | erreur
  const [erreur, setErreur] = useState("");

  function basculerReseau(platform) {
    setReseaux((r) => {
      const next = { ...r };
      if (next[platform]) delete next[platform];
      else next[platform] = { link: "", followers: "" };
      return next;
    });
  }

  function majReseau(platform, champ, valeur) {
    setReseaux((r) => ({ ...r, [platform]: { ...r[platform], [champ]: valeur } }));
  }

  async function submit(e) {
    e.preventDefault();
    setErreur("");

    const networks = Object.entries(reseaux).map(([platform, v]) => ({
      platform,
      link: v.link.trim(),
      followers: v.followers.trim(),
    }));
    if (networks.length === 0) {
      setErreur("Sélectionnez au moins un réseau social.");
      return;
    }
    if (networks.some((n) => !n.link || !n.followers)) {
      setErreur("Indiquez le lien et le nombre d'abonnés pour chaque réseau sélectionné.");
      return;
    }

    setState("envoi");
    try {
      const res = await fetch("/api/affiliate-auth?action=apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, networks, source: depart.source }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setState("envoye");
    } catch (e) {
      setErreur(e.message || "Une erreur est survenue, réessayez.");
      setState("erreur");
    }
  }

  return (
    <>
      <header className="fixed top-4 left-4 right-4 z-50">
        <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-ink/80 px-5 py-3 backdrop-blur-xl shadow-2xl">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="cursor-pointer" aria-label="E-Carpet · retour à l'accueil">
            <img src="/images/new/logo-grey.webp" alt="E-Carpet" className="h-7 w-auto sm:h-8" />
          </a>
          <button
            onClick={() => navigate("/influenceurs")}
            className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:text-white cursor-pointer"
          >
            <span className="rotate-180"><ArrowIcon className="h-4 w-4" /></span>
            Retour
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-32 pb-20">
        <h1 className="font-display text-3xl font-bold text-white">Devenir partenaire</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Parlez-nous un peu de vous, on revient vers vous par email.
        </p>

        {state === "envoye" ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="font-display text-lg font-bold text-white">Inscription envoyée.</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Nous l'étudions et revenons vers vous par email sous peu. Pas besoin de relancer, on vous
              tient au courant.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Nom</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-acid"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Email</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-acid"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Réseaux sociaux (au moins un)</label>
              <div className="flex flex-wrap gap-2">
                {RESEAUX.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => basculerReseau(r)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      reseaux[r] ? "border-acid bg-acid/10 text-acid" : "border-white/15 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {Object.keys(reseaux).length > 0 && (
                <div className="mt-3 flex flex-col gap-3">
                  {RESEAUX.filter((r) => reseaux[r]).map((r) => (
                    <div key={r} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 text-xs font-semibold text-white">{r}</div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          required
                          type="url"
                          value={reseaux[r].link}
                          onChange={(e) => majReseau(r, "link", e.target.value)}
                          placeholder="Lien de votre profil"
                          className="flex-1 rounded-xl border border-white/15 bg-transparent px-4 py-2.5 text-sm text-white outline-none focus:border-acid"
                        />
                        <input
                          required
                          type="number"
                          min="0"
                          value={reseaux[r].followers}
                          onChange={(e) => majReseau(r, "followers", e.target.value)}
                          placeholder="Nombre d'abonnés"
                          className="w-full rounded-xl border border-white/15 bg-transparent px-4 py-2.5 text-sm text-white outline-none focus:border-acid sm:w-40"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Code promo souhaité (4 à 20 lettres/chiffres)</label>
              <input
                required
                value={form.promoCode}
                onChange={(e) => setForm((f) => ({ ...f, promoCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) }))}
                placeholder="VOTRECODE"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 uppercase tracking-wide text-white outline-none focus:border-acid"
              />
              <p className="mt-1 text-xs text-zinc-500">
                C'est ce code que vos abonnés utiliseront à la commande — choisissez-le facile à retenir.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Un mot sur votre contenu (facultatif)</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-acid"
              />
            </div>

            {erreur && <p className="text-sm text-red-400">{erreur}</p>}

            <button
              type="submit"
              disabled={state === "envoi"}
              className="mt-2 rounded-full bg-acid px-6 py-3 font-display text-sm font-bold text-white disabled:opacity-60"
            >
              {state === "envoi" ? "Envoi…" : "Envoyer mon inscription"}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
