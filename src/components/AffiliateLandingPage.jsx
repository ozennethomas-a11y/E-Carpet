import { navigate } from "../navigation";
import { ArrowIcon } from "./ui";
import { INFLUENCERS } from "../data/influencers";

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

      <main className="pb-20">
        <div className="relative overflow-hidden pt-32">
          <img
            src="/images/Photo_trottinette_sur_tapis_.webp"
            alt="Trottinette électrique posée sur un tapis E-Carpet"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/90 to-ink" />
          <div className="relative mx-auto max-w-3xl px-4 pb-16 text-center">
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

        <div className="mx-auto mt-20 max-w-4xl px-4">
          <h2 className="text-center font-display text-2xl font-bold text-white">Ils roulent déjà avec nous</h2>
          <p className="mx-auto mt-2 max-w-lg text-balance text-center text-sm text-zinc-400">
            Des créateurs mobilité qui font déjà partie du programme.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {INFLUENCERS.map((inf) => (
              <a
                key={inf.handle}
                href={inf.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 cursor-pointer"
              >
                <img
                  src={inf.image}
                  alt={`${inf.name} avec son tapis E-Carpet`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <div className="truncate text-xs font-semibold text-white">{inf.name}</div>
                  <div className="truncate text-[11px] text-zinc-400">{inf.handle}</div>
                </div>
              </a>
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
