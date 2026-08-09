# Liens tagués E-Carpet

> 💡 Le plus simple est de gérer ces liens directement depuis le site :
> **`e-carpet.shop/dashboard` → onglet « Liens »**. On peut y créer un lien
> (avec aperçu en direct), le copier, voir son nombre de visites et le supprimer.
> Ce document sert de référence et de rappel de la convention.

Ces liens permettent de savoir **d'où viennent les visiteurs** dans le dashboard
(`e-carpet.shop/dashboard` → onglet « Analyse » → carte « Liens tagués »).

Ils sont indispensables pour les réseaux sociaux : TikTok et Instagram ouvrent les
liens dans un navigateur intégré qui **ne transmet aucun référent**. Sans tag, ces
visites apparaissent en « Direct ».

Le site nettoie automatiquement l'adresse après l'arrivée du visiteur : il voit
simplement `e-carpet.shop`, jamais les paramètres.

## Convention

```
https://e-carpet.shop/?utm_source=RESEAU&utm_campaign=EMPLACEMENT
```

- `utm_source` = la plateforme (tiktok, instagram, youtube, email, qrcode…)
- `utm_campaign` = l'emplacement précis (bio, video, story, ou le nom d'un influenceur)

Format court équivalent, plus joli dans une bio : `https://e-carpet.shop/?ref=tiktok`

## Bios de profil

| Emplacement | Lien |
|---|---|
| Bio TikTok (@e_carpet) | `https://e-carpet.shop/?utm_source=tiktok&utm_campaign=bio` |
| Bio Instagram (@e_carpet_shop) | `https://e-carpet.shop/?utm_source=instagram&utm_campaign=bio` |

## Publications

| Emplacement | Lien |
|---|---|
| Vidéo TikTok | `https://e-carpet.shop/?utm_source=tiktok&utm_campaign=video` |
| Story Instagram | `https://e-carpet.shop/?utm_source=instagram&utm_campaign=story` |
| Reel Instagram | `https://e-carpet.shop/?utm_source=instagram&utm_campaign=reel` |

## Influenceurs (un lien par personne)

À transmettre à chaque créateur pour mesurer précisément qui apporte du trafic.

| Influenceur | Lien |
|---|---|
| ThomasoBad | `https://e-carpet.shop/?utm_source=tiktok&utm_campaign=thomasobad` |
| doudzi83 | `https://e-carpet.shop/?utm_source=instagram&utm_campaign=doudzi83` |
| hktrott | `https://e-carpet.shop/?utm_source=tiktok&utm_campaign=hktrott` |
| sfrider | `https://e-carpet.shop/?utm_source=tiktok&utm_campaign=sfrider` |
| Simon Smith | `https://e-carpet.shop/?utm_source=tiktok&utm_campaign=simonsmith` |

## Hors ligne et autres

| Emplacement | Lien |
|---|---|
| QR code sur flyer | `https://e-carpet.shop/?utm_source=qrcode&utm_campaign=flyer` |
| Carte dans le colis | `https://e-carpet.shop/?utm_source=colis&utm_campaign=carte` |
| Signature e-mail | `https://e-carpet.shop/?utm_source=email&utm_campaign=signature` |

## Créer un nouveau lien

Remplacez simplement les deux valeurs. Règles à respecter :

- tout en **minuscules**, **sans espace** ni accent (utilisez un tiret : `black-friday`)
- gardez les mêmes noms de source dans le temps (`tiktok`, pas `TikTok` puis `tik-tok`),
  sinon le dashboard les comptera séparément
- le `?` sépare l'adresse des paramètres, le `&` sépare les paramètres entre eux
