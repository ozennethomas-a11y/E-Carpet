import { VERSION_CONDITIONS } from "../../netlify/functions/lib/_conditionsPartenaire.mjs";

// Legal pages content (French — legal docs are jurisdiction-specific).
// Footer links map by index to these slugs (see Footer.jsx).

export const COMPANY = {
  name: "E-Carpet",
  legalName: "Thomas Ozenne",
  address: "5 Cour Moderne, 59000 Lille, France",
  siren: "935 170 654",
  email: "service-client@e-carpet.shop",
  host: "Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis",
};

export const LEGAL = {
  "mentions-legales": {
    title: "Mentions légales",
    updated: "2026",
    blocks: [
      { type: "h2", text: "Éditeur du site" },
      { type: "p", text: `Le site e-carpet.shop est édité par ${COMPANY.legalName}, entrepreneur individuel exerçant sous le nom commercial ${COMPANY.name}, domicilié ${COMPANY.address}.` },
      { type: "p", text: `SIREN : ${COMPANY.siren} · TVA non applicable, article 293 B du Code général des impôts.` },
      { type: "p", text: `Contact : ${COMPANY.email}.` },
      { type: "h2", text: "Directeur de la publication" },
      { type: "p", text: `${COMPANY.legalName}.` },
      { type: "h2", text: "Hébergeur" },
      { type: "p", text: `Le site est hébergé par ${COMPANY.host}.` },
      { type: "h2", text: "Propriété intellectuelle" },
      { type: "p", text: "L'ensemble des contenus présents sur ce site (textes, images, logos, vidéos, éléments graphiques) est la propriété exclusive d'E-Carpet. Toute utilisation, reproduction, modification, distribution ou re-publication, totale ou partielle, sans l'autorisation préalable écrite d'E-Carpet, est strictement interdite." },
      { type: "h2", text: "Responsabilité" },
      { type: "p", text: "E-Carpet ne saurait être tenue responsable des dommages directs ou indirects causés au matériel de l'utilisateur lors de l'accès au site. E-Carpet s'efforce d'assurer l'exactitude des informations diffusées mais ne peut en garantir l'exhaustivité." },
      { type: "h2", text: "Liens externes" },
      { type: "p", text: "Le site peut contenir des liens vers des sites tiers (notamment Amazon). E-Carpet n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu." },
    ],
  },

  // Conditions du programme partenaire, acceptées par case à cocher à
  // l'inscription (voir AffiliateApplyPage.jsx et affiliate-auth.mjs).
  //
  // Un contrat signé aurait contredit la promesse « inscription en 2 minutes,
  // sans contrat » de la page influenceurs, pour une commission de quelques
  // euros. Des conditions acceptées d'un clic ont la même valeur d'engagement
  // sans la friction.
  //
  // La version est datée : elle est enregistrée avec chaque acceptation
  // (affiliates.terms_version), sans quoi on ne pourrait pas prouver à quoi un
  // partenaire a consenti le jour où le texte évolue.
  "programme-partenaire": {
    title: "Conditions du programme partenaire",
    updated: VERSION_CONDITIONS,
    version: VERSION_CONDITIONS,
    blocks: [
      { type: "p", text: `Les présentes conditions régissent le programme partenaire d'E-Carpet, entreprise individuelle immatriculée sous le SIREN ${COMPANY.siren}, ${COMPANY.address}. Elles sont acceptées lors de l'inscription et s'appliquent à compter de l'activation du code promo.` },

      { type: "h2", text: "1. Objet et absence de lien de subordination" },
      { type: "p", text: "Le programme permet à un créateur de contenu (« le Partenaire ») de recevoir un code promotionnel personnel. Ce code donne une remise à ses abonnés et lui ouvre droit à une commission sur les commandes passées avec lui." },
      { type: "p", text: "Le Partenaire agit en toute indépendance. Les présentes conditions ne créent ni contrat de travail, ni mandat, ni société, ni exclusivité, ni obligation de publication. Le Partenaire reste libre de son rythme, de sa ligne éditoriale et de ses autres partenariats." },

      { type: "h2", text: "2. Inscription et activation" },
      { type: "p", text: "L'inscription est gratuite et suppose l'acceptation des présentes conditions. Le Partenaire garantit l'exactitude des informations fournies, notamment ses comptes et son audience, et être titulaire des comptes déclarés." },
      { type: "p", text: "E-Carpet examine chaque inscription et peut la refuser sans avoir à motiver sa décision, notamment lorsque les informations paraissent inexactes, lorsque le code demandé est déjà réservé, ou lorsque le contenu du candidat est incompatible avec l'image de la marque." },

      { type: "h2", text: "3. Commission" },
      { type: "p", text: "La commission est de 10 % du montant réellement payé par le client, remise déduite, hors frais de livraison. Elle est due pour toute commande payée mentionnant le code du Partenaire, sans plafond de montant ni limite de durée." },
      { type: "p", text: "La commission naît à l'encaissement du paiement. Elle est annulée si la commande est remboursée, annulée, ou si le paiement échoue après coup. Une commission déjà versée sur une commande ultérieurement remboursée peut être déduite des commissions suivantes." },
      { type: "p", text: "Aucune commission n'est due sur les commandes passées par le Partenaire lui-même, ni sur celles issues d'une utilisation frauduleuse du code, notamment sa diffusion sur des sites de bons de réduction, son achat publicitaire sur la marque E-Carpet, ou toute méthode visant à capter des commandes que le Partenaire n'a pas générées." },

      { type: "h2", text: "4. Versement" },
      { type: "p", text: "Le Partenaire déclenche lui-même son virement depuis son espace, dès que son solde atteint 20 €. Les paiements sont exécutés par Stripe, auprès de qui le Partenaire renseigne directement ses coordonnées bancaires et son identité : E-Carpet n'y a pas accès et ne les conserve pas. L'ouverture du compte Stripe et sa validation conditionnent le versement." },
      { type: "p", text: "Les commissions constituent un revenu. Il appartient au Partenaire de les déclarer et de s'acquitter des obligations fiscales et sociales correspondant à sa situation. E-Carpet ne fournit aucun conseil sur ce point et n'effectue aucune retenue." },

      { type: "h2", text: "5. Engagements du Partenaire" },
      { type: "p", text: "Le Partenaire s'engage à présenter E-Carpet de façon loyale, sans affirmation trompeuse sur le produit, son prix ou ses caractéristiques, et à ne pas se présenter comme salarié, mandataire ou porte-parole d'E-Carpet." },
      { type: "p", text: "Conformément à la réglementation applicable aux influenceurs, le Partenaire indique de manière claire et visible le caractère commercial de ses publications lorsqu'il partage son code." },
      { type: "p", text: "Le Partenaire s'interdit tout contenu illicite, haineux, discriminatoire, diffamatoire, pornographique, ou incitant à des comportements dangereux, notamment routiers. Il s'interdit également d'associer E-Carpet à de tels contenus." },

      { type: "h2", text: "6. Marque et contenus" },
      { type: "p", text: "E-Carpet concède au Partenaire, pour la durée de sa participation, un droit non exclusif et non cessible d'utiliser son nom, son logo et ses visuels aux seules fins de promouvoir le produit. Toute autre utilisation, notamment le dépôt d'un nom de domaine ou d'un compte reprenant la marque, est interdite." },
      { type: "p", text: "Le Partenaire autorise E-Carpet à citer son nom, son pseudonyme, son audience et à reprendre les publications qu'il a consacrées au produit, sur son site et ses réseaux, pendant sa participation. Cette autorisation cesse sur simple demande écrite du Partenaire." },

      { type: "h2", text: "7. Suspension et fin de participation" },
      { type: "p", text: "Le Partenaire peut quitter le programme à tout moment, par simple demande écrite. Son code est alors désactivé. Les commissions déjà acquises lui restent dues et lui sont versées selon les modalités de l'article 4." },
      { type: "p", text: `E-Carpet peut suspendre ou désactiver un code, sans préavis, en cas de manquement aux articles 3, 5 ou 6, de fraude, ou de contenu portant atteinte à la marque. La suspension est notifiée par email à l'adresse déclarée. Les commissions acquises avant la suspension restent dues, à l'exception de celles issues des commandes frauduleuses.` },
      { type: "p", text: "E-Carpet peut mettre fin au programme dans son ensemble, moyennant un préavis de trente jours annoncé par email aux partenaires actifs. Les commissions acquises pendant cette période restent dues et sont versées, y compris si le solde n'atteint pas 20 €." },

      { type: "h2", text: "8. Données personnelles" },
      { type: "p", text: "Les données transmises lors de l'inscription (nom, email, comptes sociaux, audience) sont traitées pour la gestion du programme, sur la base de l'exécution des présentes conditions. Elles sont conservées pendant la participation, puis trois ans, et dix ans pour les pièces comptables. Le Partenaire dispose des droits d'accès, de rectification, d'effacement et d'opposition prévus par le RGPD, exerçables à " + COMPANY.email + "." },

      { type: "h2", text: "9. Responsabilité" },
      { type: "p", text: "E-Carpet met en œuvre les moyens nécessaires au bon fonctionnement du suivi des commandes et des commissions, sans garantir l'absence d'interruption. Aucun revenu n'est garanti : les estimations présentées sur le site sont des exemples de calcul, en aucun cas une promesse de gain." },
      { type: "p", text: "Le Partenaire est seul responsable de ses publications et des conséquences qui en découlent, notamment vis-à-vis de son audience et des plateformes qu'il utilise." },

      { type: "h2", text: "10. Modification des conditions" },
      { type: "p", text: "E-Carpet peut modifier les présentes conditions. Les partenaires actifs en sont informés par email au moins quinze jours avant leur entrée en vigueur. La poursuite de la participation vaut acceptation ; à défaut, le Partenaire peut quitter le programme dans les conditions de l'article 7." },

      { type: "h2", text: "11. Droit applicable" },
      { type: "p", text: "Les présentes conditions sont soumises au droit français. En cas de différend, les parties rechercheront une solution amiable avant toute action contentieuse. À défaut, les tribunaux français seront compétents." },
    ],
  },

  "cgv": {
    title: "Conditions générales de vente",
    updated: "2026",
    blocks: [
      { type: "h2", text: "1. Produits" },
      { type: "p", text: "Les produits proposés par E-Carpet sont des tapis en silicone conçus spécifiquement pour les trottinettes électriques. Les ventes sont réalisées directement sur le site e-carpet.shop. Les produits E-Carpet sont également disponibles sur la place de marché Amazon, sur laquelle s'appliquent alors les conditions propres à Amazon." },
      { type: "h2", text: "2. Commande" },
      { type: "p", text: "Toute commande passée sur e-carpet.shop ou sur Amazon fait l'objet d'une confirmation par e-mail. Un numéro de suivi est communiqué dès l'expédition du colis." },
      { type: "h2", text: "3. Prix" },
      { type: "p", text: "Les prix des produits sont indiqués en euros. TVA non applicable, article 293 B du Code général des impôts. Les tarifs peuvent être modifiés à tout moment, mais les produits sont facturés sur la base du tarif en vigueur au moment de la validation de la commande." },
      { type: "h2", text: "4. Paiement" },
      { type: "p", text: "Pour les commandes passées sur e-carpet.shop, le paiement s'effectue par carte bancaire via Stripe, prestataire de paiement en ligne. Les données de carte bancaire sont saisies et traitées directement par Stripe et ne transitent ni ne sont conservées par E-Carpet. Pour les commandes passées sur Amazon, le paiement s'effectue via les moyens proposés par Amazon et selon ses propres conditions." },
      { type: "h2", text: "5. Livraison" },
      { type: "p", text: "Les produits sont expédiés depuis la France. Pour les commandes passées sur e-carpet.shop, le client choisit entre une livraison à domicile ou une livraison en point relais Mondial Relay (via Packlink Pro), avec sélection du point relais au moment de la commande. Les délais de livraison indicatifs sont de 2 à 5 jours ouvrés en France métropolitaine et de 5 à 10 jours pour les autres pays européens actuellement livrés (Allemagne, Belgique, Espagne, Italie). Pour les commandes passées sur Amazon, les délais et modalités propres à Amazon s'appliquent." },
      { type: "h2", text: "6. Droit de rétractation" },
      { type: "p", text: "Conformément à la législation en vigueur, vous disposez d'un délai de 30 jours à compter de la réception pour retourner un produit non utilisé et dans son emballage d'origine. Les modalités de retour et de remboursement sont précisées dans notre politique de retour." },
      { type: "h2", text: "7. Garanties" },
      { type: "p", text: "Les produits bénéficient des garanties légales de conformité et contre les vices cachés. E-Carpet ne saurait être tenue responsable des dommages résultant d'une utilisation non conforme du produit." },
      { type: "h2", text: "8. Droit applicable" },
      { type: "p", text: "Les présentes conditions générales sont soumises au droit français. En cas de litige, une solution amiable sera recherchée avant toute action judiciaire." },
    ],
  },

  "confidentialite": {
    title: "Politique de confidentialité",
    updated: "2026",
    blocks: [
      { type: "h2", text: "1. Introduction" },
      { type: "p", text: "E-Carpet s'engage à protéger et à respecter la confidentialité de vos données personnelles. La présente politique décrit comment vos données sont collectées, utilisées, conservées et sécurisées." },
      { type: "h2", text: "2. Données collectées" },
      { type: "p", text: "Lorsque vous nous contactez, laissez un avis ou passez commande sur e-carpet.shop, nous pouvons collecter votre nom, prénom, adresse (ou point relais choisi), adresse e-mail et numéro de téléphone. Ces données de commande sont stockées dans notre base de données. Le paiement par carte bancaire est traité directement par Stripe, notre prestataire de paiement : les données de carte bancaire ne nous sont jamais communiquées ni conservées par nos soins. Pour les achats réalisés via Amazon, les données de paiement sont traitées par Amazon et ne nous sont pas communiquées." },
      { type: "h2", text: "3. Utilisation des données" },
      { type: "p", text: "Vos données servent à traiter et suivre vos commandes et demandes, à communiquer avec vous à ce sujet (notamment par e-mail via notre prestataire Brevo pour la confirmation de commande et le suivi d'expédition), et à améliorer nos produits et services." },
      { type: "h2", text: "4. Partage des données" },
      { type: "p", text: "Nous ne vendons ni ne louons vos données personnelles à des tiers. Elles peuvent être partagées avec nos prestataires techniques (paiement, livraison, envoi d'e-mails) uniquement dans le cadre du traitement de votre commande, notamment Stripe (paiement), Packlink Pro et Mondial Relay (livraison en point relais) et Brevo (envoi des e-mails transactionnels)." },
      { type: "h2", text: "5. Sécurité" },
      { type: "p", text: "Nous mettons en œuvre des mesures rigoureuses afin de prévenir tout accès non autorisé, utilisation illégale, perte accidentelle, altération ou destruction de vos données." },
      { type: "h2", text: "6. Vos droits" },
      { type: "p", text: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation et d'opposition au traitement de vos données. Pour exercer ces droits, contactez-nous à l'adresse indiquée ci-dessous." },
      { type: "h2", text: "7. Conservation" },
      { type: "p", text: "Vos données sont conservées aussi longtemps que nécessaire au regard des finalités décrites et de nos obligations légales." },
      { type: "h2", text: "8. Contact" },
      { type: "p", text: `Pour toute question relative à vos données, écrivez-nous à ${COMPANY.email}.` },
    ],
  },

  "cookies": {
    title: "Politique de cookies",
    updated: "2026",
    blocks: [
      { type: "h2", text: "1. Qu'est-ce qu'un cookie ?" },
      { type: "p", text: "Un cookie est un petit fichier texte déposé sur votre appareil par le site que vous visitez. Il permet notamment de mémoriser vos préférences (langue, par exemple) et d'améliorer votre expérience de navigation." },
      { type: "h2", text: "2. Cookies utilisés" },
      { type: "p", text: "Ce site utilise un nombre minimal de cookies : des cookies essentiels au bon fonctionnement du site et, le cas échéant, des cookies de mesure d'audience anonymisés pour en améliorer les performances. Aucune donnée n'est revendue à des tiers." },
      { type: "h2", text: "3. Vos préférences" },
      { type: "p", text: "Vous pouvez accepter ou refuser les cookies à tout moment. La plupart des navigateurs permettent de les contrôler via leurs paramètres. Le refus de certains cookies peut limiter l'accès à certaines fonctionnalités du site." },
      { type: "h2", text: "4. Mises à jour" },
      { type: "p", text: "Cette politique peut être modifiée à tout moment. Toute modification est publiée sur cette page." },
      { type: "h2", text: "5. Contact" },
      { type: "p", text: `Pour toute question, contactez-nous à ${COMPANY.email}.` },
    ],
  },
};

// Order matches Footer links: Mentions légales, CGV, Confidentialité, Cookies
export const LEGAL_SLUGS = ["mentions-legales", "cgv", "confidentialite", "cookies", "programme-partenaire"];
