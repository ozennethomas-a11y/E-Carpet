import { useState } from "react";
import { navigate } from "../navigation";
import { ArrowIcon } from "./ui";

const EMPTY = { name: "", email: "", social: "", audience: "", message: "" };

export default function AffiliateApplyPage() {
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState("idle"); // idle | envoi | envoye | erreur
  const [erreur, setErreur] = useState("");

  async function submit(e) {
    e.preventDefault();
    setState("envoi");
    setErreur("");
    try {
      const res = await fetch("/api/affiliate-auth?action=apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
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
            <p className="font-display text-lg font-bold text-white">Candidature envoyée.</p>
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
              <label className="mb-1 block text-xs text-zinc-500">Réseau (Instagram, TikTok, YouTube…)</label>
              <input
                value={form.social}
                onChange={(e) => setForm((f) => ({ ...f, social: e.target.value }))}
                placeholder="@votre_pseudo"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-acid"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Audience (nombre d'abonnés, portée...)</label>
              <input
                value={form.audience}
                onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-acid"
              />
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
              {state === "envoi" ? "Envoi…" : "Envoyer ma candidature"}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
