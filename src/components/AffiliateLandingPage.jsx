import { useEffect, useRef, useState } from "react";
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

// Chaque avantage porte un chiffre : c'est lui qui ouvre la carte, pas le
// titre. Quatre paragraphes gris de même poids ne se lisent pas — un chiffre
// se saisit d'un coup d'œil, et le texte ne sert plus qu'à le justifier.
//
// Les deux premiers disent ce que le partenaire gagne, les deux suivants ce
// qu'on ne lui demande pas. D'où les deux zéros, qui donnent au bloc son
// rythme au lieu de paraître pauvres.
const AVANTAGES = [
  {
    // Le seul avantage à deux versants : au lieu de l'écrire, on le montre.
    // Deux colonnes identiques, deux fois le même chiffre — la réciprocité se
    // voit avant d'être lue, et c'est elle qui lève l'objection « je ne veux
    // pas vendre à ma communauté ».
    id: "partage",
    duo: [
      { chiffre: "10 %", label: "Pour vous" },
      { chiffre: "10 %", label: "Pour votre communauté" },
    ],
    titre: "Vous gagnez, votre communauté aussi",
    // Les codes affiliés sont créés sans date d'expiration ni plafond
    // d'utilisation (createAffiliatePromoCode dans affiliates.mjs) : une
    // vidéo publiée il y a six mois rapporte encore. C'est la seule chose
    // que les deux colonnes ne peuvent pas montrer, d'où cette unique ligne.
    texte: "Votre code n'expire pas, il continue de vous rapporter sur vos vidéos déjà en ligne.",
  },
  {
    id: "virement",
    chiffre: "Dès 20 €",
    titre: "Payé quand vous le décidez",
    // La mention de Stripe n'est pas décorative : les virements passent par des
    // comptes Stripe Connect Express (voir affiliate-stripe.mjs), et les
    // coordonnées bancaires sont saisies sur la page d'inscription hébergée par
    // Stripe. La table affiliates ne contient aucune colonne IBAN — vérifié
    // avant d'écrire cette phrase, qui engage sur un point sensible.
    // « Sécurisé par Stripe » et non « partenaire de Stripe » : E-Carpet est
    // client de Stripe Connect, pas membre de son programme de partenariat.
    // La nuance paraît mince, mais c'est une allégation vérifiable sur une
    // page qui engage vis-à-vis de partenaires.
    texte:
      "Vous déclenchez votre virement vous-même depuis votre espace. Sécurisé par Stripe : vos coordonnées bancaires ne nous sont jamais transmises.",
  },
  {
    id: "montant",
    // Le montant en euros plutôt qu'un pourcentage de plus : la première
    // carte dit déjà le partage 10/10, celle-ci dit ce que ça vaut. Dérivé de
    // GAIN_PAR_VENTE, comme le sous-titre du hero, pour qu'aucune des deux
    // valeurs ne puisse dériver de l'autre.
    montant: { valeur: eurosPrecis(GAIN_PAR_VENTE), unite: "par tapis vendu" },
    accroche: "Plus vous publiez, plus vous gagnez.",
    // Le « Et » enchaînait cette phrase sur l'accroche et faisait dire à la
    // carte une chose puis son contraire : publiez plus, mais ce n'est pas
    // grave si vous ne publiez pas. La liberté n'est pas un contrepoint à
    // l'accroche, c'est une condition de l'offre — d'où une phrase autonome
    // et brève, qui rassure sans se retourner contre ce qui précède.
    texte: "Sans quota imposé : vous publiez à votre rythme.",
  },
  {
    id: "tableau-de-bord",
    // Les quatre indicateurs cités sont ceux réellement affichés par
    // AffiliateSpacePage : clics, commandes générées, chiffre d'affaires
    // généré, commission due. Les nommer vaut mieux que promettre un
    // « tableau de bord complet » que le partenaire ne peut pas vérifier
    // avant de s'inscrire.
    chiffre: "En direct",
    titre: "Votre tableau de bord",
    texte:
      "Clics, commandes générées, chiffre d'affaires et commission due : vous suivez tout depuis votre espace, commande par commande.",
  },
];


const ETAPES = [
  {
    titre: "Vous vous inscrivez",
    texte: "Deux minutes : vos réseaux, votre audience, et le code promo que vous voulez porter.",
  },
  {
    titre: "On lit votre profil",
    texte: "Chaque inscription est lue à la main, jamais filtrée automatiquement. Réponse par email.",
  },
  {
    titre: "Vous partagez, vous gagnez",
    texte:
      "Votre code est actif immédiatement après validation. Chaque commande apparaît dans votre espace, commission comprise.",
  },
];

// Pour un créateur déjà démarché, l'étape « on étudie votre profil » est un
// contresens : il a reçu le produit, il a publié, il a fait ses preuves. Lui
// resservir le parcours d'un inconnu le renverrait au point de départ.
const ETAPES_CONNU = [
  {
    titre: "Vous choisissez votre code",
    texte: "Votre formulaire est déjà rempli. Il ne reste que votre email et le code que vous voulez porter.",
  },
  {
    titre: "On l'active",
    texte: "Vous avez déjà collaboré avec nous : votre code est activé sans nouvel examen, et vous recevez le lien de votre espace.",
  },
  {
    titre: "Vous partagez, vous gagnez",
    texte:
      "Chaque commande passée avec votre code vous rapporte 10%, suivie en direct dans votre espace. Vos abonnés, eux, paient 10% moins cher.",
  },
];

const FAQ = [
  {
    q: "Combien ça me coûte ?",
    r: "Rien. Pas de frais d'entrée, pas d'achat de produit obligatoire, pas d'abonnement. Vous ne payez jamais E-Carpet : c'est nous qui vous payons.",
  },
  {
    q: "Quand suis-je payé, et comment ?",
    r: "Chaque commande payée crée une commission dans votre espace. Dès que votre solde atteint 20 €, vous demandez le virement vous-même. Le paiement passe par Stripe, chez qui vous renseignez vos coordonnées bancaires une seule fois : elles ne nous sont jamais transmises. Une commande remboursée annule la commission correspondante.",
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
    r: "Les commissions sont un revenu : il vous appartient de les déclarer selon votre situation (micro-entreprise ou autre). Nous ne pouvons pas vous conseiller sur ce point, renseignez-vous auprès de votre interlocuteur habituel.",
  },
];

/**
 * Borne haute du curseur.
 *
 * Sans audience connue, on garde une échelle générique. Quand le lien porte le
 * nombre d'abonnés, le plafond suit : montrer 60 ventes maximum à quelqu'un
 * qui touche 343 000 personnes dévalorise l'offre autant qu'un plafond
 * démesuré la rendrait irréelle pour un compte de 600 abonnés.
 *
 * 2 % de l'audience comme borne haute n'est PAS une prévision de conversion :
 * c'est une échelle de curseur. Le pourcentage affiché sous le résultat laisse
 * chacun juger du réalisme de sa propre hypothèse.
 */
function bornes(audience) {
  if (!audience) return { max: 60, defaut: 10 };
  const max = Math.min(600, Math.max(30, Math.round((audience * 0.02) / 10) * 10));
  return { max, defaut: Math.max(1, Math.round(max / 5)) };
}

function Simulateur({ audience }) {
  const { max, defaut } = bornes(audience);
  const [ventes, setVentes] = useState(defaut);
  const parMois = ventes * GAIN_PAR_VENTE;
  const partAudience = audience ? (ventes / audience) * 100 : null;

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
        max={max}
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
        <span>{max} ventes</span>
      </div>

      {partAudience != null && (
        <p className="mt-3 text-center text-xs text-zinc-500">
          soit{" "}
          <span className="chiffre">
            {partAudience.toLocaleString("fr-FR", {
              minimumFractionDigits: partAudience < 0.1 ? 2 : 1,
              maximumFractionDigits: partAudience < 0.1 ? 2 : 1,
            })}
            {" %"}
          </span>{" "}
          de
          vos <span className="chiffre">{audience.toLocaleString("fr-FR")}</span> abonnés
        </p>
      )}

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
        ventes. Nous ne garantissons aucun revenu.
      </p>
    </div>
  );
}

// Le lien envoyé à un créateur déjà démarché porte son nom et ses réseaux
// (voir AffiliateApplyPage). Deux conséquences ici :
//
//  1. Ces paramètres doivent SURVIVRE au clic vers le formulaire. Sans ça, le
//     pré-remplissage serait perdu entre la page vitrine et l'inscription, et
//     le créateur devrait tout retaper — exactement ce qu'on voulait éviter.
//  2. Quelqu'un qui a déjà reçu le tapis et publié n'a pas à lire un
//     argumentaire de prospection. La page le reconnaît et le dit.
//
// Le nom vient de l'URL, donc de nous : il n'est qu'affiché, jamais utilisé
// pour décider de quoi que ce soit. Un lien bricolé ne donne accès à rien.
function contexteDuLien() {
  if (typeof window === "undefined") return { nom: null, requete: "" };
  const p = new URLSearchParams(window.location.search);
  return {
    nom: (p.get("nom") || "").slice(0, 80) || null,
    // Nombre d'abonnés transmis par le lien : sert uniquement à donner au
    // simulateur une échelle qui a du sens pour cette personne.
    audience: Math.max(0, parseInt(p.get("abonnes") || "", 10) || 0) || null,
    requete: p.toString() ? `?${p.toString()}` : "",
  };
}

export default function AffiliateLandingPage() {
  const [lien] = useState(contexteDuLien);
  // La barre collante ne doit apparaître que lorsque le bouton du hero est
  // sorti de l'écran. Sans ça, les deux se chevauchent au premier coup d'œil
  // sur mobile — deux fois le même appel à l'action à deux centimètres l'un
  // de l'autre, ce qui ressemble à un défaut d'affichage.
  //
  // L'état initial est « bouton du hero absent », donc barre VISIBLE, et
  // l'observateur la masque dès qu'il constate le contraire. Le sens du repli
  // est délibéré : si l'observateur ne s'exécutait jamais, on retrouverait le
  // comportement d'avant — barre toujours visible, un peu redondante — plutôt
  // qu'une page sans aucun appel à l'action sur mobile.
  const boutonHero = useRef(null);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const cible = boutonHero.current;
    if (!cible || typeof IntersectionObserver === "undefined") return;
    const observateur = new IntersectionObserver(
      ([entree]) => setHeroVisible(entree.isIntersecting),
      { rootMargin: "-8px" },
    );
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, []);

  const versInscription = () => navigate(`/influenceurs/inscription${lien.requete}`);

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
          <div className="relative mx-auto max-w-3xl px-4 pb-16 text-center">
            {/* Bloc « badge + titre ». L'image de fond est enfermée ICI et
                nulle part ailleurs : elle épouse donc exactement la hauteur de
                ce bloc, deux lignes de titre en bureau comme quatre sur un
                téléphone. Un cadrage figé aurait dérivé d'un format à l'autre.

                Le sous-titre, le bouton et la réassurance restent hors de ce
                conteneur, sur fond uni — c'est ce qui donne au titre son
                relief au lieu de noyer tout le hero dans la photo. */}
            <div className="relative">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 -top-32 h-[calc(100%+10rem)] w-screen -translate-x-1/2 overflow-hidden"
              >
                <img
                  src="/images/new/boxes-scooter.webp"
                  alt=""
                  className="h-full w-full object-cover object-center"
                  fetchPriority="high"
                />
                {/* Voile uniforme, volontairement plus léger que sur la page
                    d'accueil (45 % contre 70 %) : là-bas l'image est une
                    ambiance derrière un bouton d'achat, ici elle est
                    l'argument, elle doit se voir. */}
                <div className="absolute inset-0 bg-ink/45" />
                {/* Fond le haut sous la barre de navigation et le bas dans la
                    page : sans ce dégradé, une ligne de coupe nette apparaît
                    juste sous le titre. */}
                <div className="absolute inset-0 bg-gradient-to-b from-ink/85 via-transparent to-ink" />
                {/* N'assombrit que la colonne de texte, pour garder l'image
                    vivante sur les côtés. */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_45%,rgba(10,10,11,0.55),transparent_82%)]" />
              </div>

              <span className="relative inline-flex items-center gap-2 rounded-full border border-acid/40 bg-acid/10 px-4 py-1.5 text-xs font-semibold text-acid">
                Programme partenaire E-Carpet
              </span>

              <h1 className="relative mt-5 text-balance font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
                Votre communauté économise 10%. Vous en gagnez 10%.
              </h1>
            </div>

            <p className="relative mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-zinc-200">
              {/* Ne répète PAS les deux 10% du titre : le sous-titre sert à
                  ajouter ce que le titre ne dit pas — le montant réel par
                  vente. Le chiffre est dérivé de la même constante que le
                  simulateur, pour qu'ils ne puissent jamais diverger. */}
              Un code promo à votre nom, et {eurosPrecis(GAIN_PAR_VENTE)} pour chaque tapis vendu par
              votre communauté.
            </p>

            {/* Placé APRÈS le titre, et volontairement court : au-dessus, il
                repoussait l'argument principal hors du premier écran sur
                mobile — soit exactement là où arrivent les créateurs qui
                ouvrent le lien depuis un message privé. */}
            {lien.nom && (
              <p className="relative mx-auto mt-4 max-w-md text-balance text-sm text-zinc-300">
                Bonjour <strong className="text-white">{lien.nom}</strong>, votre formulaire est déjà
                rempli, il ne manque que votre email.
              </p>
            )}
            <button
              ref={boutonHero}
              onClick={versInscription}
              className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-acid px-8 py-4 font-display text-base font-bold text-white transition-transform hover:scale-[1.03] cursor-pointer"
            >
              {lien.nom ? "Activer mon code" : "Devenir partenaire"}
              <ArrowIcon className="h-4 w-4" />
            </button>
            <p className="relative mt-4 text-xs text-zinc-400">
              {lien.nom
                ? "Gratuit · Sans exclusivité · Il ne reste que 2 champs à remplir"
                : "Gratuit · Sans exclusivité · Inscription en 2 minutes"}
            </p>
          </div>
        </div>

        <section className="mx-auto mt-4 max-w-4xl px-4" aria-labelledby="avantages-titre">
          {/* Titre retiré de l'affichage mais conservé pour les lecteurs
              d'écran : les quatre cartes se suffisent visuellement, alors
              qu'une section sans intitulé perdrait son repère à la navigation
              par titres. Même procédé que la section du simulateur. */}
          <h2 id="avantages-titre" className="sr-only">
            Pourquoi c'est simple à porter
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {AVANTAGES.map((a) => (
              <div
                key={a.id}
                className={`flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-acid/30 hover:bg-white/[0.07] ${
                  a.montant ? "justify-center" : ""
                }`}
              >
                {a.duo ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      {a.duo.map((d, i) => (
                        <div key={d.label}>
                          <div className="chiffre font-display text-3xl font-bold leading-none text-acid">
                            {d.chiffre}
                          </div>
                          <h3 className="mt-2 font-display text-sm font-bold text-white">{d.label}</h3>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-center text-sm leading-relaxed text-zinc-400">{a.texte}</p>
                  </>
                ) : a.montant ? (
                  <>
                    {/* Le montant et son accroche côte à côte : le chiffre
                        donne la valeur d'une vente, la phrase dit ce qui se
                        passe quand il y en a plusieurs. L'un sans l'autre ne
                        dit que la moitié de l'argument. */}
                    <div className="flex items-center gap-5">
                      <div>
                        <div className="chiffre whitespace-nowrap font-display text-3xl font-bold leading-none text-acid">
                          {a.montant.valeur}
                        </div>
                        <div className="mt-1.5 text-xs text-zinc-500">{a.montant.unite}</div>
                      </div>
                      <h3 className="font-display text-base font-bold leading-snug text-white">{a.accroche}</h3>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-zinc-400">{a.texte}</p>
                  </>
                ) : (
                  <>
                    <div className="chiffre font-display text-3xl font-bold leading-none text-acid">{a.chiffre}</div>
                    <h3 className="mt-3 font-display text-base font-bold text-white">{a.titre}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{a.texte}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl px-4" aria-labelledby="simulateur-titre">
          <h2 id="simulateur-titre" className="sr-only">
            Simulateur de gains
          </h2>
          <Simulateur audience={lien.audience} />
        </section>

        <section className="mx-auto mt-16 max-w-3xl px-4" aria-labelledby="etapes-titre">
          <h2 id="etapes-titre" className="text-center font-display text-2xl font-bold text-white">
            {lien.nom ? "Ce qu'il vous reste à faire" : "Comment ça marche"}
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {(lien.nom ? ETAPES_CONNU : ETAPES).map((e, i) => (
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
            Plus de 500 000 abonnés cumulés parlent déjà d'E-Carpet. Cliquez sur un créateur pour voir
            sa vidéo.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="truncate text-sm font-semibold text-white">{inf.name}</div>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="chiffre text-xs font-bold text-acid">{inf.followers}</span>
                    <span className="truncate text-[11px] text-zinc-400">{inf.handle}</span>
                  </div>
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
                  <span aria-hidden="true" className="chevron-faq shrink-0 text-acid">
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
              {lien.nom ? "Activer mon code" : "Devenir partenaire"}
              <ArrowIcon className="h-4 w-4" />
            </button>
            <p className="relative mt-4 text-xs text-zinc-400">
              Gratuit · Sans exclusivité · Premier virement dès {SEUIL_VIREMENT} €
            </p>
          </div>
        </section>
      </main>

      {/* Sur mobile, le CTA du hero disparaît dès les premiers scrolls : cette
          barre garde l'action à portée de pouce tout au long de la page. */}
      <div
        aria-hidden={heroVisible}
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/90 p-3 backdrop-blur-xl transition-all duration-200 sm:hidden ${
          heroVisible ? "pointer-events-none translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <button
          onClick={versInscription}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-acid px-6 py-3.5 font-display text-sm font-bold text-white cursor-pointer"
        >
          {lien.nom ? "Activer mon code" : "Devenir partenaire"}
          <ArrowIcon className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
