# E-Carpet — site vitrine

Landing page one-page pour un tapis en silicone destiné aux trottinettes
électriques. Le site ne vend pas directement : tous les CTA renvoient vers Amazon.

- **Projet** : `/Users/thomasozenne/Desktop/Site`
- **Dépôt** : https://github.com/ozennethomas-a11y/E-Carpet (branche `main`)
- **En ligne** : https://e-carpet.shop (Netlify, HTTPS actif, `www` redirige vers l'apex)
- **DNS** : chez IONOS (`A @ → 75.2.60.5`, `CNAME www → e-carpet.netlify.app`).
  Ne jamais toucher aux enregistrements MX/TXT/DKIM : ils gèrent l'e-mail du domaine.

## Déploiement

`git push` sur `main` → Netlify build et déploie automatiquement (~1 min).
Les identifiants GitHub sont dans le trousseau macOS : le push fonctionne sans intervention.

```bash
npm run dev     # serveur local
npm run build   # vérifier avant de pousser
```

Variables d'environnement (Netlify → Site configuration → Environment variables) :
`DASHBOARD_PASSWORD` (accès au dashboard) et `ANALYTICS_SALT`.
Toute modification de ces variables exige un **Trigger deploy** pour être prise en compte.

## Stack

React 19 + Vite + Tailwind v4 + Framer Motion. Pas de routeur : un mini-routeur
maison dans `src/App.jsx` + `src/navigation.js` (`navigate()` avec `history.pushState`).
La redirection SPA de `netlify.toml` permet l'accès direct aux URL.

## Pages

| Route | Composant |
|---|---|
| `/` | `Landing` dans `App.jsx` |
| `/blog`, `/blog/<slug>` | `BlogPage`, `ArticlePage` |
| `/avis` | `ReviewPage` (formulaire Netlify Forms, non affiché sur le site) |
| `/legal/<slug>` | `LegalPage` (`mentions-legales`, `cgv`, `confidentialite`, `cookies`) |
| `/admin` | `DashboardPage` — privé, deux onglets : Analyse et Liens |

## Conventions de contenu — IMPORTANT

- **Jamais de tiret cadratin `—` dans les textes visibles.** Le propriétaire y tient.
  Utiliser un point, une virgule, ou le point médian `·` (comme dans « e·carpet »).
- Site en **4 langues** : fr, en, de, pl. Tout texte d'interface passe par
  `src/i18n/translations.js` et doit être traduit dans les 4 langues.
  Exceptions volontaires : les articles de blog et les pages légales sont en français seul.
- Ton : premium, phrases courtes, pas de superlatifs creux.

## Design

- Fond noir (`--color-ink #0a0a0b`), cartes `--color-slate-deep #18181b`.
- Accent **cuivre `#e06a3b`** (token Tailwind `acid`, nom historique conservé).
  Sur fond cuivre, le texte est **blanc**.
- Typo : Space Grotesk (titres) + Inter (texte).
- Les photos produit détourées (fond transparent) **flottent sur le fond sombre**
  avec halo cuivré et ombre portée. Ne pas remettre de cadre blanc : c'est un
  choix esthétique explicite du propriétaire.
- Les sections doivent rester **compactes** : il n'aime pas les grands vides
  verticaux entre les blocs.
- Graphiques : une seule série par graphique, donc **une seule teinte** (le cuivre).
  Marques fines, écarts de 2px, extrémités arrondies 4px, grille discrète, vue tableau
  disponible pour l'accessibilité.

## Ajouter un article de blog

Éditer `src/data/articles.js`. Chaque article porte une `date` de publication :
**un article daté dans le futur reste masqué jusqu'à cette date**, sans redéploiement.
C'est le mécanisme de publication hebdomadaire automatique. Espacer les dates d'une
semaine et vérifier que `slug` et `cover` existent.

## Mesure d'audience (maison)

- `netlify/functions/track.mjs` enregistre les visites, `stats.mjs` les lit,
  `links.mjs` gère les liens tagués. Stockage : Netlify Blobs.
- **Sans cookie ni identifiant persistant** : un visiteur est un hachage anonyme
  qui change chaque jour. C'est ce qui dispense le site de bandeau de consentement,
  donc ne jamais introduire de cookie ou de stockage persistant à des fins de mesure.
- Les liens tagués (`?utm_source=…&utm_campaign=…`) sont indispensables car TikTok
  et Instagram ne transmettent aucun référent. Voir `LIENS-TAGUES.md`.
- Le dashboard n'est jamais compté dans les statistiques.

## Images

Dans `public/images/`. Sources d'origine du propriétaire :
`~/Desktop/IA` et `~/Desktop/dossier sans titre/Photos produit`.
Ne pas réutiliser deux fois la même photo à des endroits différents du site.
