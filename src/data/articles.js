// Blog articles. Each article has a `date` (ISO publish date).
// Articles dated in the future stay hidden until that date arrives —
// this lets you queue articles ahead and have them "drip out" weekly,
// with no rebuild needed (the date is checked in the browser at view time).
//
// content blocks: { type: "p" | "h2" | "quote", text }

export const ARTICLES = [
  {
    slug: "proteger-son-sol-des-trottinettes-electriques",
    title: "Comment protéger votre sol des trottinettes électriques",
    excerpt:
      "Pneus humides, poussière de frein, gravillons… votre trottinette ramène la rue chez vous. Voici comment garder un intérieur impeccable.",
    date: "2026-06-10",
    readMinutes: 4,
    cover: "/images/new/dirty-scooter.webp",
    content: [
      { type: "p", text: "On adore sa trottinette électrique pour sa liberté et sa rapidité. Mais une fois rentré chez soi, c'est une autre histoire : les pneus encore humides, la poussière de frein et les petits gravillons coincés dans la gomme finissent invariablement sur le parquet, le carrelage ou la moquette de l'entrée." },
      { type: "h2", text: "Pourquoi votre sol souffre" },
      { type: "p", text: "Une roue de trottinette parcourt des kilomètres de bitume, de flaques et de trottoirs sales. À l'arrêt, l'eau qui s'en écoule s'infiltre dans les joints du carrelage et marque durablement le bois. Les traces de pneus, elles, sont parmi les plus difficiles à nettoyer car la gomme laisse un dépôt gras." },
      { type: "p", text: "Ajoutez à cela la béquille qui raye le sol à chaque stationnement, et vous obtenez un coin de la maison qui se dégrade sans qu'on s'en rende compte." },
      { type: "h2", text: "Les mauvaises solutions" },
      { type: "p", text: "Le carton ou le vieux tapis de bain font illusion quelques jours, mais ils absorbent l'eau, gondolent et finissent par sentir mauvais. Les bâches plastiques, elles, glissent sous les roues et ne retiennent rien : l'eau déborde sur les côtés." },
      { type: "h2", text: "La solution : un tapis dédié" },
      { type: "p", text: "Un tapis en silicone avec bordure surélevée change tout. Il retient l'eau, la boue et les gravillons à l'intérieur de sa bordure, ne bouge pas grâce à son dessous antidérapant, et se nettoie d'un coup d'éponge ou au jet en quelques secondes." },
      { type: "p", text: "C'est exactement le principe de l'E-Carpet : 130 × 40 cm de silicone dense, imperméable et résistant à la chaleur, pensé pour accueillir n'importe quelle trottinette électrique sans abîmer le sol en dessous." },
      { type: "quote", text: "Déroulez-le une fois, garez votre trottinette dessus, et votre sol reste impeccable. C'est tout." },
    ],
  },
  {
    slug: "nettoyer-entretenir-sa-trottinette-electrique",
    title: "Nettoyer et entretenir sa trottinette sans abîmer son intérieur",
    excerpt:
      "Un entretien régulier prolonge la vie de votre trottinette… à condition de ne pas transformer votre salon en garage. Notre méthode propre.",
    date: "2026-06-23",
    readMinutes: 5,
    cover: "/images/new/wall-3.webp",
    content: [
      { type: "p", text: "Une trottinette bien entretenue dure plus longtemps, freine mieux et se revend plus cher. Mais le nettoyage se fait souvent à l'intérieur, faute de garage ou de jardin, et c'est là que les ennuis commencent pour votre sol." },
      { type: "h2", text: "Le bon rythme d'entretien" },
      { type: "p", text: "Un essuyage rapide après chaque sortie pluvieuse, un nettoyage complet une fois par mois, et une vérification des serrages tous les quinze jours suffisent pour la plupart des usages quotidiens." },
      { type: "h2", text: "Nettoyer sans inonder le salon" },
      { type: "p", text: "Évitez le jet d'eau directe sur l'électronique. Préférez un chiffon microfibre légèrement humide pour le pont et le guidon, une brosse douce pour les jantes, et un dégraissant doux pour les traces tenaces. Posez toujours la trottinette sur une surface qui retient l'eau pendant l'opération." },
      { type: "p", text: "Un tapis à bordure surélevée est idéal : il recueille l'eau de rinçage et la poussière, que vous évacuez ensuite d'un seul geste, au lieu d'éponger le carrelage à quatre pattes." },
      { type: "h2", text: "Les points à ne pas oublier" },
      { type: "p", text: "Gonflez les pneus à la bonne pression, contrôlez l'usure des plaquettes, resserrez la potence et gardez les contacts de la batterie au sec. Un coup d'œil régulier évite les pannes coûteuses." },
      { type: "quote", text: "Un entretien propre, c'est aussi un intérieur qui le reste. Le bon tapis fait la moitié du travail." },
    ],
  },
  {
    slug: "petit-appartement-trottinette-gagner-de-la-place",
    title: "Petit appartement et trottinette : 6 astuces pour gagner de la place",
    excerpt:
      "Ranger une trottinette électrique dans 30 m² sans sacrifier le style ni la propreté, c'est possible. Nos idées concrètes.",
    date: "2026-06-30",
    readMinutes: 4,
    cover: "/images/new/wall-1.webp",
    content: [
      { type: "p", text: "En ville, la trottinette électrique est reine. Mais une fois la porte fermée, l'engin encombrant doit trouver sa place dans un espace souvent réduit. Voici six astuces pour la ranger proprement et avec style." },
      { type: "h2", text: "1. Lui dédier un coin" },
      { type: "p", text: "Plutôt que de la laisser traîner au milieu du passage, attribuez-lui un emplacement fixe près de l'entrée. Un coin défini, c'est un appartement qui paraît instantanément plus rangé." },
      { type: "h2", text: "2. La poser sur un tapis dédié" },
      { type: "p", text: "Un tapis en silicone protège le sol, délimite visuellement la zone et donne un côté soigné, presque showroom, à votre coin trottinette." },
      { type: "h2", text: "3. Exploiter la verticalité" },
      { type: "p", text: "Certains modèles se plient et se rangent à la verticale contre un mur. Un crochet mural robuste libère une surface précieuse au sol." },
      { type: "h2", text: "4. Profiter du pliage" },
      { type: "p", text: "Pliée, une trottinette se glisse derrière une porte, sous une console ou dans un placard d'entrée. Prenez l'habitude de la replier dès le retour." },
      { type: "h2", text: "5. Garder le sol protégé" },
      { type: "p", text: "Même pliée et appuyée, elle goutte et salit. Le tapis reste la meilleure assurance contre les traces et l'humidité." },
      { type: "h2", text: "6. Soigner l'esthétique" },
      { type: "p", text: "Un coin trottinette bien pensé, avec un tapis élégant et un rangement discret, devient un détail déco plutôt qu'une contrainte." },
      { type: "quote", text: "Bien rangée, bien posée : votre trottinette a enfin sa place, et votre intérieur respire." },
    ],
  },
  {
    slug: "pluie-et-trottinette-limiter-les-degats",
    title: "Pluie et trottinette électrique : comment limiter les dégâts",
    excerpt:
      "Rouler sous la pluie, c'est ramener l'eau partout chez soi. Voici les bons réflexes pour protéger votre matériel et votre sol.",
    date: "2026-07-07",
    readMinutes: 4,
    cover: "/images/new/wall-2.webp",
    content: [
      { type: "p", text: "La pluie est l'ennemie numéro un du rider urbain. Au-delà du confort, elle fragilise la trottinette et transforme votre entrée en patinoire boueuse dès le retour." },
      { type: "h2", text: "Avant de partir" },
      { type: "p", text: "Vérifiez l'indice d'étanchéité de votre modèle, protégez les connectiques si besoin et réduisez votre vitesse : sur sol mouillé, les distances de freinage s'allongent nettement." },
      { type: "h2", text: "Au retour à la maison" },
      { type: "p", text: "Essuyez rapidement le pont, la potence et les freins. L'eau stagnante favorise la corrosion et abîme l'électronique à long terme. Surtout, ne posez pas la trottinette ruisselante directement sur le parquet." },
      { type: "h2", text: "Protéger le sol" },
      { type: "p", text: "Un tapis en silicone à bordure surélevée recueille l'eau qui s'écoule des pneus et de la béquille, et l'empêche de se répandre. Vous évitez les traces, les auréoles et les joints noircis." },
      { type: "quote", text: "On ne contrôle pas la météo, mais on peut contrôler ce qu'elle laisse derrière elle." },
    ],
  },
  {
    slug: "choisir-le-bon-tapis-pour-sa-trottinette",
    title: "Choisir le bon tapis pour sa trottinette : le guide",
    excerpt:
      "Taille, matériau, bordure, antidérapance : tous les critères pour ne pas se tromper et protéger durablement son sol.",
    date: "2026-07-14",
    readMinutes: 5,
    cover: "/images/2.webp",
    content: [
      { type: "p", text: "Tous les tapis ne se valent pas. Pour protéger efficacement votre sol sans mauvaise surprise, voici les critères qui comptent vraiment." },
      { type: "h2", text: "La taille" },
      { type: "p", text: "Un format de 130 × 40 cm couvre la quasi-totalité des trottinettes du marché, des modèles compacts aux plus longs. Trop petit, le tapis laisse dépasser une roue ; trop grand, il encombre inutilement." },
      { type: "h2", text: "Le matériau" },
      { type: "p", text: "Le silicone dense est idéal : imperméable, inodore, résistant à la chaleur et au froid, il ne se déforme pas et se nettoie en quelques secondes. Méfiez-vous des mousses et plastiques fins qui absorbent l'eau et gondolent." },
      { type: "h2", text: "La bordure" },
      { type: "p", text: "C'est le détail qui change tout : une bordure surélevée retient l'eau et la saleté à l'intérieur du tapis. Sans elle, tout déborde sur les côtés." },
      { type: "h2", text: "L'antidérapance" },
      { type: "p", text: "Un bon tapis adhère au sol par en dessous et retient les roues par-dessus. La trottinette reste stable, même béquille chargée." },
      { type: "quote", text: "Le bon tapis se choisit une fois, et se fait oublier pendant des années." },
    ],
  },
  {
    slug: "trottinette-en-hiver-proteger-son-materiel",
    title: "Trottinette en hiver : protéger son matériel et son sol",
    excerpt:
      "Froid, sel de déneigement, humidité : l'hiver met le matériel à rude épreuve. Nos conseils pour passer la saison sans dégâts.",
    date: "2026-07-21",
    readMinutes: 4,
    cover: "/images/new/wall-4.webp",
    content: [
      { type: "p", text: "L'hiver est exigeant pour une trottinette électrique. Entre le froid qui réduit l'autonomie et le sel de déneigement qui attaque les pièces, quelques précautions s'imposent." },
      { type: "h2", text: "La batterie" },
      { type: "p", text: "Le froid diminue temporairement l'autonomie. Stockez la trottinette à l'intérieur, à température ambiante, et évitez de la charger juste après une sortie glaciale : laissez-la revenir à température." },
      { type: "h2", text: "Le sel et l'humidité" },
      { type: "p", text: "Le sel de déneigement est corrosif. Rincez et essuyez votre trottinette après les sorties hivernales, en insistant sur les parties métalliques et les fixations." },
      { type: "h2", text: "Le sol de la maison" },
      { type: "p", text: "En hiver, la trottinette rentre trempée, salée et boueuse. Un tapis en silicone protège votre parquet du sel et de l'eau, et se nettoie d'un simple coup d'éponge." },
      { type: "quote", text: "Bien protégée l'hiver, votre trottinette repart comme neuve au printemps." },
    ],
  },
  {
    slug: "rentree-remettre-sa-trottinette-en-route",
    title: "Rentrée : remettre sa trottinette électrique en route après l'été",
    excerpt:
      "Après des semaines de repos ou d'usage intensif en vacances, votre trottinette mérite une vérification avant de reprendre le rythme quotidien.",
    date: "2026-09-01",
    readMinutes: 4,
    cover: "/images/new/lille.webp",
    content: [
      { type: "p", text: "Septembre marque le retour au bureau, à l'école, aux trajets réguliers. Pour beaucoup, c'est aussi le retour de la trottinette électrique après des semaines de vacances ou, au contraire, après un été d'usage intensif. Dans les deux cas, un contrôle rapide évite les mauvaises surprises." },
      { type: "h2", text: "Si elle est restée au repos" },
      { type: "p", text: "Une batterie stockée à plat perd en capacité, parfois durablement. Vérifiez le niveau de charge avant la première sortie et rechargez-la à environ 50 % si elle est trop basse. Contrôlez aussi la pression des pneus, qui baisse naturellement avec le temps." },
      { type: "h2", text: "Si elle a beaucoup servi" },
      { type: "p", text: "Après un été de sorties fréquentes, souvent sur des sols chauds, sablonneux ou salés en bord de mer, les freins et les fixations méritent un contrôle. Un serrage qui a bougé se sent dans la direction avant de se voir." },
      { type: "h2", text: "Le nettoyage de rentrée" },
      { type: "p", text: "Sable, sel, poussière : l'été laisse des traces. Un nettoyage complet du pont, des roues et du guidon élimine ces résidus avant qu'ils ne s'incrustent dans les mécanismes." },
      { type: "h2", text: "Reprendre de bonnes habitudes" },
      { type: "p", text: "C'est aussi le bon moment pour reprendre un emplacement fixe à la maison, avec un tapis qui protège le sol dès la première sortie de septembre. Les rentrées pluvieuses arrivent vite, autant être prêt." },
      { type: "quote", text: "Une rentrée réussie commence par un matériel vérifié et un coin bien organisé pour l'accueillir." },
    ],
  },
  {
    slug: "livraison-a-trottinette-proteger-son-materiel",
    title: "Livraison à trottinette électrique : protéger son matériel au quotidien",
    excerpt:
      "Pour les livreurs urbains, la trottinette roule tous les jours, par tous les temps. Voici comment limiter l'usure et garder un intérieur propre malgré un usage intensif.",
    date: "2026-09-08",
    readMinutes: 5,
    cover: "/images/new/livreur.webp",
    content: [
      { type: "p", text: "Pour un livreur, la trottinette électrique n'est pas un loisir mais un outil de travail. Elle roule plusieurs heures par jour, par tous les temps, et encaisse une usure que peu d'usages du quotidien connaissent." },
      { type: "h2", text: "Un usage qui use plus vite" },
      { type: "p", text: "Freinages fréquents, arrêts et départs répétés, trajets sous la pluie ou la chaleur : les pièces d'usure (plaquettes, pneus, roulements) se dégradent plus vite qu'un usage occasionnel. Un contrôle hebdomadaire, plutôt que mensuel, devient nécessaire." },
      { type: "h2", text: "Le retour à la maison, chaque jour" },
      { type: "p", text: "Contrairement à un usage ponctuel, la trottinette d'un livreur rentre sale et humide presque tous les soirs. Sans protection, c'est le sol de l'entrée qui encaisse cette usure jour après jour, avec des traces qui finissent par s'incruster." },
      { type: "h2", text: "Un poste fixe, simple et efficace" },
      { type: "p", text: "La solution la plus pratique reste un emplacement dédié, avec un tapis en silicone qui absorbe l'eau et la saleté sans exiger d'entretien particulier. Il suffit de le rincer une fois par semaine, même après un usage quotidien intensif." },
      { type: "h2", text: "Anticiper plutôt que réparer" },
      { type: "p", text: "Un matériel qui travaille tous les jours ne pardonne pas la négligence. Un contrôle régulier et un espace de stationnement bien pensé coûtent moins cher qu'une réparation en urgence un jour de forte activité." },
      { type: "quote", text: "Quand la trottinette est un outil de travail, chaque détail de son entretien compte double." },
    ],
  },
  {
    slug: "equipement-essentiel-trottinette-electrique-urbaine",
    title: "Casque, antivol, gants : l'équipement essentiel du trottinettiste urbain",
    excerpt:
      "Au-delà de la trottinette elle-même, quelques accessoires font une vraie différence en ville, pour la sécurité comme pour la tranquillité d'esprit.",
    date: "2026-09-15",
    readMinutes: 4,
    cover: "/images/tapis-dessus-detoure.webp",
    content: [
      { type: "p", text: "La trottinette électrique s'est imposée dans le quotidien urbain, mais rouler en ville demande un minimum d'équipement. Voici les accessoires qui font réellement une différence, sans transformer chaque sortie en expédition." },
      { type: "h2", text: "Le casque, non négociable" },
      { type: "p", text: "En cas de chute, c'est souvent la tête qui encaisse le choc en premier. Un casque léger et bien ajusté, spécifique à la trottinette ou au vélo urbain, reste la protection la plus efficace pour un coût raisonnable." },
      { type: "h2", text: "L'antivol, contre le vol d'opportunité" },
      { type: "p", text: "Une trottinette électrique se revend facilement, ce qui en fait une cible. Un antivol en U ou une chaîne robuste, même pour un arrêt de quelques minutes, dissuade la plupart des vols opportunistes." },
      { type: "h2", text: "Les gants et vêtements réfléchissants" },
      { type: "p", text: "Des gants protègent les mains lors d'une chute et améliorent la prise en main par temps froid. Un brassard ou un gilet réfléchissant, lui, augmente la visibilité la nuit, particulièrement utile en hiver quand les jours raccourcissent." },
      { type: "h2", text: "Et à l'arrivée, à la maison" },
      { type: "p", text: "L'équipement ne s'arrête pas à la rue. Un tapis dédié à l'entrée complète la panoplie du trottinettiste sérieux : il protège le sol de tout ce que la ville a laissé sur les roues." },
      { type: "quote", text: "Bien équipé dehors, bien organisé dedans : deux réflexes qui vont de pair." },
    ],
  },
  {
    slug: "demenager-avec-sa-trottinette-electrique",
    title: "Déménager avec sa trottinette électrique : ce qu'il faut prévoir",
    excerpt:
      "Transport, batterie, nouvel emplacement à la maison : quelques précautions simples évitent les mauvaises surprises lors d'un déménagement.",
    date: "2026-09-22",
    readMinutes: 4,
    cover: "/images/new/boxes-scooter.webp",
    content: [
      { type: "p", text: "Un déménagement s'accompagne toujours de son lot d'imprévus. La trottinette électrique, souvent oubliée dans la liste des choses à préparer, mérite pourtant un peu d'attention avant le grand jour." },
      { type: "h2", text: "Le transport de la batterie" },
      { type: "p", text: "Les batteries lithium sont sensibles aux chocs et aux températures extrêmes. Si le déménagement passe par un camion sans climatisation en été ou par un long trajet, mieux vaut transporter la trottinette vous-même plutôt que de la confier au reste du mobilier." },
      { type: "h2", text: "Protéger la trottinette pendant le transport" },
      { type: "p", text: "Repliez-la si le modèle le permet, protégez l'écran et les commandes avec un tissu, et évitez de l'empiler sous des cartons lourds. Une chute pendant le transport peut fausser la direction ou fissurer un composant." },
      { type: "h2", text: "S'installer dans le nouveau logement" },
      { type: "p", text: "Une fois arrivé, c'est l'occasion de repartir sur de bonnes bases : choisir un emplacement définitif près de l'entrée, loin des passages fréquents, et prévoir dès le départ un tapis pour protéger un sol neuf ou fraîchement rénové." },
      { type: "h2", text: "Éviter les mauvaises habitudes du départ" },
      { type: "p", text: "Dans le désordre d'un emménagement, on pose souvent les objets n'importe où, en se disant qu'on rangera plus tard. Un coin trottinette bien pensé dès les premiers jours évite que cette habitude ne s'installe durablement." },
      { type: "quote", text: "Un nouveau logement mérite un sol préservé dès le premier jour, pas après les premières traces." },
    ],
  },
  {
    slug: "prolonger-duree-de-vie-batterie-trottinette",
    title: "Prolonger la durée de vie de la batterie de sa trottinette électrique",
    excerpt:
      "La batterie est la pièce la plus coûteuse à remplacer. Quelques habitudes simples suffisent pourtant à en préserver la capacité pendant des années.",
    date: "2026-09-29",
    readMinutes: 4,
    cover: "/images/Enroule__sans_fond.webp",
    content: [
      { type: "p", text: "Une batterie de trottinette électrique se remplace rarement à petit prix. Sa durée de vie dépend surtout des habitudes de charge et de stockage, bien plus que du nombre de kilomètres parcourus." },
      { type: "h2", text: "Le bon niveau de charge" },
      { type: "p", text: "Une batterie lithium vieillit plus vite si elle reste en permanence à 100 % ou si elle descend souvent à 0 %. Pour un usage quotidien, viser une charge entre 20 et 80 % préserve mieux les cellules sur le long terme. Réservez la charge complète aux jours où l'autonomie maximale est nécessaire." },
      { type: "h2", text: "Charger au bon moment" },
      { type: "p", text: "Évitez de brancher la trottinette juste après une sortie, quand la batterie est encore chaude, ou juste après une exposition au froid. Laissez-la revenir à température ambiante une vingtaine de minutes avant de lancer la charge." },
      { type: "h2", text: "Le stockage prolongé" },
      { type: "p", text: "Si la trottinette reste immobile plusieurs semaines, ne la laissez ni totalement vide ni totalement pleine. Une charge autour de 50 % limite la dégradation pendant l'inactivité. Pensez à vérifier le niveau une fois par mois." },
      { type: "h2", text: "L'environnement de stockage" },
      { type: "p", text: "La chaleur excessive et l'humidité accélèrent l'usure des cellules. Un coin sec, à température stable, protège autant la batterie que le reste de la mécanique. Un tapis dédié à cet emplacement évite aussi que l'humidité ramenée de la rue ne stagne sous l'appareil." },
      { type: "quote", text: "Une batterie bien traitée se remarque à l'usage : elle tient ses promesses d'autonomie année après année." },
    ],
  },
  {
    slug: "trottinette-electrique-occasion-points-a-verifier",
    title: "Trottinette électrique d'occasion : les points à vérifier avant d'acheter",
    excerpt:
      "Un modèle d'occasion peut être une bonne affaire, à condition de vérifier quelques éléments clés avant de conclure la vente.",
    date: "2026-10-06",
    readMinutes: 5,
    cover: "/images/Photo_trottinette_sur_tapis_.webp",
    content: [
      { type: "p", text: "Acheter une trottinette électrique d'occasion permet de réduire le budget de moitié, parfois plus. Encore faut-il vérifier certains points avant de signer, car les pièces défaillantes se cachent souvent bien." },
      { type: "h2", text: "L'état réel de la batterie" },
      { type: "p", text: "C'est le point le plus important et le plus difficile à évaluer. Demandez l'âge de la batterie, le nombre de cycles si l'application du fabricant l'indique, et testez l'autonomie sur un trajet réel plutôt que de vous fier à l'affichage à l'arrêt." },
      { type: "h2", text: "Les pneus et les roulements" },
      { type: "p", text: "Examinez l'usure de la bande de roulement et écoutez les roues en les faisant tourner à la main : un bruit sec ou un jeu anormal trahit des roulements fatigués, coûteux à remplacer selon les modèles." },
      { type: "h2", text: "Les freins et la direction" },
      { type: "p", text: "Testez le freinage à faible vitesse dans un endroit sûr. Une potence qui vibre ou un jeu dans le guidon signalent souvent des chutes antérieures mal réparées." },
      { type: "h2", text: "Les traces d'un usage négligé" },
      { type: "p", text: "Corrosion sur les vis, connectique oxydée, autocollants d'origine arrachés : ces détails en disent long sur la façon dont l'engin a été entretenu et stocké par son précédent propriétaire." },
      { type: "h2", text: "Une fois l'achat conclu" },
      { type: "p", text: "Dès la première utilisation, prenez de bonnes habitudes que le précédent propriétaire n'a peut-être pas eues : un emplacement fixe à la maison, sur un tapis qui protège le sol et facilite un entretien régulier." },
      { type: "quote", text: "Une trottinette d'occasion bien vérifiée aujourd'hui vous évite des mauvaises surprises demain." },
    ],
  },
  {
    slug: "trottinette-electrique-en-copropriete-ou-la-ranger",
    title: "Trottinette électrique en copropriété : où et comment la ranger",
    excerpt:
      "Entre cave humide, hall commun interdit et appartement exigu, trouver une place pour sa trottinette en copropriété demande un peu d'organisation.",
    date: "2026-10-13",
    readMinutes: 4,
    cover: "/images/trottinette-detouree.webp",
    content: [
      { type: "p", text: "En copropriété, ranger une trottinette électrique pose des questions que les propriétaires de maison individuelle ne se posent pas. Halls communs souvent interdits, caves humides, règlement intérieur strict : il faut composer avec les contraintes du bâtiment." },
      { type: "h2", text: "Ce que dit généralement le règlement" },
      { type: "p", text: "Beaucoup de règlements de copropriété interdisent d'entreposer des objets dans les parties communes, halls et paliers inclus, pour des raisons de sécurité incendie et de dégagement des issues. Mieux vaut vérifier le règlement de votre immeuble avant de prendre une habitude qui pourrait être contestée." },
      { type: "h2", text: "La cave, une fausse bonne idée" },
      { type: "p", text: "Une cave semble pratique, mais l'humidité y est souvent élevée et constante, ce qui n'est pas idéal pour l'électronique et la batterie. Si c'est la seule option, privilégiez un rangement surélevé et une charge faite à l'intérieur du logement plutôt qu'en cave." },
      { type: "h2", text: "Ramener la trottinette dans l'appartement" },
      { type: "p", text: "C'est souvent la solution la plus simple et la plus sûre pour le matériel. Elle implique en revanche de gérer l'eau et la saleté ramenées de la rue, directement dans l'entrée." },
      { type: "h2", text: "Un emplacement dédié, même petit" },
      { type: "p", text: "Un coin d'entrée avec un tapis en silicone à bordure surélevée règle l'essentiel du problème : le sol reste protégé, l'humidité ne s'infiltre pas dans le parquet ou la moquette, et la trottinette a une place fixe qui ne dérange personne." },
      { type: "quote", text: "Faute de local dédié, un simple coin bien pensé suffit à cohabiter sereinement avec sa trottinette." },
    ],
  },
];

// Articles whose publish date has arrived, newest first.
export function getPublishedArticles(now = new Date()) {
  return ARTICLES
    .filter((a) => new Date(a.date) <= now)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getArticle(slug, now = new Date()) {
  const a = ARTICLES.find((x) => x.slug === slug);
  if (!a) return null;
  if (new Date(a.date) > now) return null; // not published yet
  return a;
}

export function formatDate(iso, locale = "fr-FR") {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}
