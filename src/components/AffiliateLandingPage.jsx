import { useState } from "react";
import { navigate } from "../navigation";
import { ArrowIcon } from "./ui";
import { INFLUENCERS } from "../data/influencers";

// Hypothèses du simulateur de gains. Volontairement centralisées et commentées :
// ce sont des promesses faites à des partenaires, elles doivent rester
// vérifiables et faciles à corriger si le prix ou le taux changent.
//
// PANIER : le tapis est à 37,99 €. Le code partenaire donne 10% de remise à
// l'acheteur (voir createAffiliatePromoCode dans netlify/functions/affiliates.mjs,
// qui crée un promo_code de type 'percent' à la valeur de commission_percent).
// La commission est calculée sur order.total_cents, donc sur le montant
// réellement payé (voir lib/_orderPaid.mjs) — d'où le panier après remise.
const TAUX = 10;
const PANIER_APRES_REMISE = 34.19;
const GAIN_PAR_VENTE = (PANIER_APRES_REMISE * TAUX) / 100; // ≈ 3,42 €
const SEUIL_VIREMENT = 20;

const euros = (n) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const eurosPrecis = (n) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const AVANTAGES = [
  {
    titre: "Vous gagnez, votre communauté aussi",
    texte:
      "Votre code donne 10% de remise à vos abonnés et vous rapporte 10% sur chaque commande. Vous ne leur vendez rien : vous leur faites une faveur.",
  },
  {
    titre: "Payé quand vous le décidez",
    texte:
      "Dès 20 € de solde, vous déclenchez votre virement vous-même depuis votre espace. Pas de validation à attendre, pas de relance à faire.",
  },
  {
    titre: "Aucune exclusivité",
    texte:
      "Vous restez libre de vos partenariats et de votre ligne éditoriale. Pas de contrat, pas de quota de publications, pas d'engagement de durée.",
  },
  {
    titre: "Pas de minimum d'audience",
    texte:
      "Micro-créateur ou grande communauté : chaque candidature est lue à la main. Ce qui compte, c'est que votre audience roule.",
  },
];

const ETAPES = [
  {
    titre: "Vous postulez",
    texte: "Deux minutes : vos réseaux, votre audience, et le code promo que vous voulez porter.",
  },
  {
    titre: "On lit votre profil",
    texte: "Chaque candidature est examinée à la main, jamais par un filtre automatique. Réponse par email.",
  },
  {
    titre: "Vous partagez, vous gagnez",
    texte:
      "Votre code est actif immédiatement après validation. Chaque commande apparaît dans votre espace, commission comprise.",
  },
];

const FAQ = [
  {
    q: "Combien ça me coûte ?",
    r: "Rien. Pas de frais d'entrée, pas d'achat de produit obligatoire, pas d'abonnement. Vous ne payez jamais E-Carpet — c'est nous qui vous payons.",
  },
  {
    q: "Quand suis-je payé, et comment ?",
    r: "Chaque commande payée crée une commission dans votre espace. Dès que votre solde atteint 20 €, vous demandez le virement vous-même, sur l'IBAN que vous renseignez. Une commande remboursée annule la commission correspondante.",
  },
  {
    q: "Dois-je m'engager sur un nombre de publications ?",
    r: "Non. Vous publiez quand vous le voulez, sur les réseaux que vous voulez, avec vos mots. Aucun quota, aucune exclusivité, aucune durée minimum.",
  },
  {
    q: "Comment je suis les résultats ?",
    r: "Votre espace partenaire affiche vos clics, vos commandes et votre commission en temps réel, avec le détail commande par commande. Connexion sans mot de passe : un lien magique envoyé par email.",
  },
  {
    q: "Et côté déclaration ?",
    r: "Les commissions sont un revenu : il vous appartient de les déclarer selon votre situation (micro-entreprise ou autre). Nous ne pouvons pas vous conseiller sur ce point — renseignez-vous auprès de votre interlocuteur habituel.",
  },
];

function Simulateur() {
  const [ventes, setVentes] = useState(10);
  const parMois = ventes * GAIN_PAR_VENTE;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-deep p-6 sm:p-8">
      <label htmlFor="ventes" className="block font-display text-lg font-bold text-white">
        Combien ça peut vous rapporter ?
      </label>
      <p className="mt-1.5 text-sm text-zinc-400">
        Déplacez le curseur sur le nombre de tapis que votre audience pourrait commander chaque mois.
      </p>

      <input
        id="ventes"
        type="range"
        min="1"
        max="60"
        value={ventes}
        onChange={(e) => setVentes(Number(e.target.value))}
        className="mt-6 w-full cursor-pointer accent-acid"
        aria-describedby="resultat-simulateur"
      />
      <div className="mt-2 flex justify-between text-xs text-zinc-500">
        <span>1 vente</span>
        <span className="font-semibold text-white">
          {ventes} vente{ventes > 1 ? "s" : ""} / mois
        </span>
        <span>60 ventes</span>
      </div>

      <div id="resultat-simulateur" aria-live="polite" className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-acid/30 bg-acid/10 p-5">
          <div className="font-display text-3xl font-bold text-white">{euros(parMois)}</div>
          <div className="mt-1 text-sm text-zinc-300">par mois</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-ink p-5">
          <div className="font-display text-3xl font-bold text-white">{euros(parMois * 12)}</div>
          <div className="mt-1 text-sm text-zinc-400">sur un an</div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-zinc-500">
        Estimation : {eurosPrecis(GAIN_PAR_VENTE)} de commission par tapis, soit {TAUX}% d'un panier de{" "}
        {eurosPrecis(PANIER_APRES_REMISE)} (prix remisé avec votre code). Vos gains réels dépendent de vos
        ventes — nous ne garantissons aucun revenu.
      </p>
    </div>
  );
}

export default function AffiliateLandingPage() {
  const versInscription = () => navigate("/influenceurs/inscription");

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
              className="hidden items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:text-white cursor-pointer sm:flex"
            >
              <span className="rotate-180"><ArrowIcon className="h-4 w-4" /></span>
              Retour au site
            </a>
          </div>
        </nav>
      </header>

      <main className="pb-28 sm:pb-20">
        <div className="relative overflow-hidden pt-32">
          <img
            src="/images/Photo_trottinette_sur_tapis_.webp"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/85 to-ink" />
          <div className="relative mx-auto max-w-3xl px-4 pb-16 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-acid/40 bg-acid/10 px-4 py-1.5 text-xs font-semibold text-acid">
              Programme partenaire E-Carpet
            </span>
            <h1 className="mt-5 text-balance font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
              Votre communauté économise 10%. Vous en gagnez 10%.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-zinc-300">
              Vous parlez mobilité urbaine à une audience qui roule en trottinette électrique ? Partagez
              votre code E-Carpet : vos abonnés paient le tapis 10% moins cher, et chaque commande vous
              rapporte une commission.
            </p>
            <button
              onClick={versInscription}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-acid px-8 py-4 font-display text-base font-bold text-white transition-transform hover:scale-[1.03] cursor-pointer"
            >
              Devenir partenaire
              <ArrowIcon className="h-4 w-4" />
            </button>
            <p className="mt-4 text-xs text-zinc-400">
              Gratuit · Sans exclusivité · Candidature en 2 minutes
            </p>
          </div>
        </div>

        <section className="mx-auto mt-4 max-w-3xl px-4" aria-labelledby="simulateur-titre">
          <h2 id="simulateur-titre" className="sr-only">
            Simulateur de gains
          </h2>
          <Simulateur />
        </section>

        <section className="mx-auto mt-16 max-w-4xl px-4" aria-labelledby="avantages-titre">
          <h2 id="avantages-titre" className="text-center font-display text-2xl font-bold text-white">
            Pourquoi c'est simple à porter
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {AVANTAGES.map((a) => (
              <div key={a.titre} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="font-display text-lg font-bold text-white">{a.titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{a.texte}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl px-4" aria-labelledby="etapes-titre">
          <h2 id="etapes-titre" className="text-center font-display text-2xl font-bold text-white">
            Comment ça marche
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {ETAPES.map((e, i) => (
              <li key={e.titre}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-acid font-display text-sm font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-3 font-display text-base font-bold text-white">{e.titre}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{e.texte}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto mt-20 max-w-4xl px-4" aria-labelledby="preuve-titre">
          <h2 id="preuve-titre" className="text-center font-display text-2xl font-bold text-white">
            Ils roulent déjà avec nous
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-balance text-center text-sm text-zinc-400">
            Des créateurs mobilité qui portent déjà leur code E-Carpet. Cliquez pour voir leur vidéo.
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
        </section>

        <section className="mx-auto mt-20 max-w-2xl px-4" aria-labelledby="faq-titre">
          <h2 id="faq-titre" className="text-center font-display text-2xl font-bold text-white">
            Les questions qu'on nous pose
          </h2>
          <div className="mt-8 flex flex-col gap-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-white/10 bg-white/5 px-5 py-4 [&[open]]:bg-white/[0.07]"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-base font-bold text-white marker:content-['']">
                  {item.q}
                  <span className="shrink-0 text-acid transition-transform group-open:rotate-90">
                    <ArrowIcon className="h-4 w-4" />
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-3xl px-4">
          <div className="rounded-3xl border border-acid/30 bg-gradient-to-b from-acid/10 to-transparent p-8 text-center sm:p-10">
            <h2 className="text-balance font-display text-2xl font-bold text-white sm:text-3xl">
              Votre prochaine vidéo peut déjà rapporter.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-balance text-sm leading-relaxed text-zinc-300">
              Postulez en deux minutes, choisissez votre code, et partagez-le dès qu'il est validé.
            </p>
            <button
              onClick={versInscription}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-acid px-8 py-4 font-display text-base font-bold text-white transition-transform hover:scale-[1.03] cursor-pointer"
            >
              Devenir partenaire
              <ArrowIcon className="h-4 w-4" />
            </button>
            <p className="mt-4 text-xs text-zinc-400">
              Gratuit · Sans exclusivité · Premier virement dès {SEUIL_VIREMENT} €
            </p>
          </div>
        </section>
      </main>

      {/* Sur mobile, le CTA du hero disparaît dès les premiers scrolls : cette
          barre garde l'action à portée de pouce tout au long de la page. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/90 p-3 backdrop-blur-xl sm:hidden">
        <button
          onClick={versInscription}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-acid px-6 py-3.5 font-display text-sm font-bold text-white cursor-pointer"
        >
          Devenir partenaire
          <ArrowIcon className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
