// Legal pages content (French — legal docs are jurisdiction-specific).
// Footer links map by index to these slugs (see Footer.jsx).

export const COMPANY = {
  name: "E-Carpet",
  address: "5 Cour Moderne, 59000 Lille, France",
  siren: "935 170 654",
  vat: "FR83935170654",
  email: "service-client@e-carpet.shop",
  host: "Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis",
};

export const LEGAL = {
  "mentions-legales": {
    title: "Mentions légales",
    updated: "2026",
    blocks: [
      { type: "h2", text: "Éditeur du site" },
      { type: "p", text: `Le site e-carpet.shop est édité par ${COMPANY.name}, dont le siège social est situé ${COMPANY.address}.` },
      { type: "p", text: `SIREN : ${COMPANY.siren} · Numéro de TVA intracommunautaire : ${COMPANY.vat}.` },
      { type: "p", text: `Contact : ${COMPANY.email}.` },
      { type: "h2", text: "Directeur de la publication" },
      { type: "p", text: `Le représentant légal d'${COMPANY.name}.` },
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

  "cgv": {
    title: "Conditions générales de vente",
    updated: "2026",
    blocks: [
      { type: "h2", text: "1. Produits" },
      { type: "p", text: "Les produits proposés par E-Carpet sont des tapis en silicone conçus spécifiquement pour les trottinettes électriques. Les ventes sont réalisées directement sur le site e-carpet.shop. Les produits E-Carpet sont également disponibles sur la place de marché Amazon, sur laquelle s'appliquent alors les conditions propres à Amazon." },
      { type: "h2", text: "2. Commande" },
      { type: "p", text: "Toute commande passée sur e-carpet.shop ou sur Amazon fait l'objet d'une confirmation par e-mail. Un numéro de suivi est communiqué dès l'expédition du colis." },
      { type: "h2", text: "3. Prix" },
      { type: "p", text: "Les prix des produits sont indiqués en euros, toutes taxes comprises (TTC). Les tarifs peuvent être modifiés à tout moment, mais les produits sont facturés sur la base du tarif en vigueur au moment de la validation de la commande." },
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
export const LEGAL_SLUGS = ["mentions-legales", "cgv", "confidentialite", "cookies"];
