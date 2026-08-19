import { navigate } from "../navigation";
import { ArrowIcon } from "./ui";

const AVANTAGES = [
  {
    titre: "10% sur chaque vente",
    texte: "Vous touchez 10% du montant de chaque commande passée avec votre code promo, sans limite.",
  },
  {
    titre: "Paiement quand vous voulez",
    texte: "Dès que votre solde atteint 20 €, vous demandez votre virement vous-même. Pas besoin d'attendre une validation.",
  },
  {
    titre: "Un espace 100% autonome",
    texte: "Connexion sans mot de passe, par lien magique envoyé par email. Suivez vos commandes et votre commission en temps réel.",
  },
  {
    titre: "Pas de minimum d'audience",
    texte: "Micro-créateur ou grande communauté, chaque candidature est étudiée au cas par cas.",
  },
];

const ETAPES = [
  { titre: "Vous postulez", texte: "Remplissez le formulaire de candidature en quelques minutes." },
  { titre: "On étudie votre profil", texte: "Chaque candidature est examinée manuellement. Vous recevez notre réponse par email." },
  {
    titre: "Vous partagez, vous gagnez",
    texte:
      "Une fois approuvé, votre code promo personnel est généré automatiquement. Chaque commande passée avec ce code vous rapporte 10% de commission, suivie en direct dans votre espace partenaire.",
  },
];

export default function AffiliateLandingPage() {
  return (
    <>
      <header className="fixed top-4 left-4 right-4 z-50">
        <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-ink/80 px-5 py-3 backdrop-blur-xl shadow-2xl">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="cursor-pointer" aria-label="E-Carpet · retour à l'accueil">
            <img src="/images/new/logo-grey.webp" alt="E-Carpet" className="h-7 w-auto sm:h-8" />
          </a>
          <div className="flex items-center gap-3">
            <a
              href="/influenceurs/espace"
              onClick={(e) => { e.preventDefault(); navigate("/influenceurs/espace"); }}
              className="text-sm text-zinc-300 transition-colors hover:text-white cursor-pointer"
            >
              Espace partenaire
            </a>
            <a
              href="/"
              onClick={(e) => { e.preventDefault(); navigate("/"); }}
              className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:text-white cursor-pointer"
            >
              <span className="rotate-180"><ArrowIcon className="h-4 w-4" /></span>
              Retour au site
            </a>
          </div>
        </nav>
      </header>

      <main className="pt-32 pb-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h1 className="text-balance font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
            Faites rouler votre communauté avec E-Carpet.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-zinc-400">
            Vous parlez mobilité urbaine à une audience qui roule en trottinette électrique ? Devenez
            partenaire E-Carpet : partagez votre code promo personnel et touchez une commission sur
            chaque commande. Pas de minimum d'audience, pas de contrat compliqué.
          </p>
          <button
            onClick={() => navigate("/influenceurs/inscription")}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-acid px-7 py-3.5 font-display text-sm font-bold text-white cursor-pointer"
          >
            Devenir partenaire
            <ArrowIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-4 px-4 sm:grid-cols-2">
          {AVANTAGES.map((a) => (
            <div key={a.titre} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="font-display text-lg font-bold text-white">{a.titre}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{a.texte}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-3xl px-4">
          <h2 className="text-center font-display text-2xl font-bold text-white">Comment ça marche</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {ETAPES.map((e, i) => (
              <div key={e.titre}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-acid font-display text-sm font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-3 font-display text-base font-bold text-white">{e.titre}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{e.texte}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-3xl px-4 text-center">
          <button
            onClick={() => navigate("/influenceurs/inscription")}
            className="inline-flex items-center gap-2 rounded-full bg-acid px-7 py-3.5 font-display text-sm font-bold text-white cursor-pointer"
          >
            Devenir partenaire
            <ArrowIcon className="h-4 w-4" />
          </button>
        </div>
      </main>
    </>
  );
}
