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
      { type: "p", text: "Les produits proposés par E-Carpet sont des tapis en silicone conçus spécifiquement pour les trottinettes électriques. Les ventes sont réalisées via la place de marché Amazon, sur laquelle s'appliquent également les conditions propres à Amazon." },
      { type: "h2", text: "2. Commande" },
      { type: "p", text: "Toute commande passée sur Amazon fait l'objet d'une confirmation par e-mail. Un numéro de suivi est communiqué dès l'expédition du colis." },
      { type: "h2", text: "3. Prix" },
      { type: "p", text: "Les prix des produits sont indiqués en euros, toutes taxes comprises (TTC). Les tarifs peuvent être modifiés à tout moment, mais les produits sont facturés sur la base du tarif en vigueur au moment de la validation de la commande." },
      { type: "h2", text: "4. Paiement" },
      { type: "p", text: "Le paiement s'effectue via la plateforme Amazon, selon les moyens de paiement qu'elle propose (carte bancaire, etc.). Les transactions sont sécurisées par Amazon." },
      { type: "h2", text: "5. Livraison" },
      { type: "p", text: "Les produits sont expédiés depuis la France. Les délais de livraison indicatifs sont de 2 à 5 jours ouvrés en France métropolitaine et de 5 à 10 jours dans le reste de l'Europe, sous réserve des délais propres à Amazon." },
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
      { type: "p", text: "Lorsque vous nous contactez ou passez commande, nous pouvons collecter votre nom, votre adresse, votre adresse e-mail et votre numéro de téléphone. Les achats étant réalisés via Amazon, les données de paiement sont traitées par Amazon et ne nous sont pas communiquées." },
      { type: "h2", text: "3. Utilisation des données" },
      { type: "p", text: "Vos données servent à traiter et suivre vos demandes, à communiquer avec vous au sujet de votre commande, et à améliorer nos produits et services." },
      { type: "h2", text: "4. Partage des données" },
      { type: "p", text: "Nous ne vendons ni ne louons vos données personnelles à des tiers. Elles peuvent être partagées avec nos partenaires de livraison et de paiement uniquement dans le cadre du traitement de votre commande." },
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
