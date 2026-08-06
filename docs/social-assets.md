# Régénérer les vidéos de démonstration pour les réseaux sociaux

Mode d'emploi de `web/scripts/gen-demo-video.mjs`, qui transforme les
démonstrations animées de la page « cas d'usage » en MP4 publiables. À relire
avant de refaire la manip : les trois pièges de la fin coûtent une heure chacun
si on les redécouvre.

Ce que ça produit (`docs/social/`, **anglais seulement**) :

| Fichier | Format |
|---|---|
| `demo-spike.en.1080x1350.mp4` | 1080×1350, 60 i/s, 8 s, H.264 yuv420p, 294 Ko |
| `demo-isolated.en.1080x1350.mp4` | 1080×1350, 60 i/s, 8 s, H.264 yuv420p, 286 Ko |

## Prérequis

- **Google Chrome** installé dans `/Applications`. Il sert de moteur de rendu, et
  rien d'autre ne peut le remplacer (voir « pourquoi un navigateur » plus bas).
  Mesuré avec Chrome 143.
- **ffmpeg** : `brew install ffmpeg`. Mesuré avec ffmpeg 8.1.

Ni Playwright ni Puppeteer, et il ne faut pas les ajouter : Chrome est piloté en
ligne de commande, une invocation `--headless --screenshot` par image.

## Les commandes

```sh
cd web

# Tout, dans le format publié. Compter dix minutes.
node scripts/gen-demo-video.mjs

# Un seul scénario (spike | isolated)
node scripts/gen-demo-video.mjs --only isolated

# UNE image fixe, gardée sur le disque : à faire AVANT un rendu complet, pour
# vérifier le cadrage et la taille du texte en deux secondes au lieu de dix
# minutes. `--at` est l'instant du cycle, en secondes.
node scripts/gen-demo-video.mjs --only spike --at 8
```

Réglages, et c'est là qu'est l'essentiel :

| Option | Défaut | Ce que ça change |
|---|---|---|
| `--fps` | 60 | **La fluidité, et elle seule.** 60 est ce que lisent X et LinkedIn. |
| `--duration` | 8 | **La vitesse.** Le cycle entier est rejoué en ce temps-là. |
| `--only` | les deux | Le scénario. |
| `--at` | (absent) | Une seule image à cet instant, au lieu d'une vidéo. |

**Fluidité et vitesse sont deux réglages séparés, et il faut le comprendre pour
ne pas se tromper.** Le cycle des démos fait 15 s et 18 s, ce qui est long pour
un fil. On échantillonne le cycle ENTIER, donc rien n'est coupé, et on le rejoue
en `duration` secondes : le déroulé est simplement accéléré (×1,9 et ×2,3). Comme
on échantillonne à la cadence de sortie, l'accélération ne coûte aucune image.

Une première tentative avait rendu 15 images pour 15 secondes, faute d'avoir
séparé les deux : c'était un diaporama. Le nombre d'images vient de la VIDÉO
(`fps × duration`), jamais du cycle.

## Ce que ça coûte, pour ne pas s'inquiéter

Le rendu lance **huit Chrome en parallèle**, soit une centaine de processus, et
**la machine ventile fort pendant une dizaine de minutes**. C'est normal. En
série ce serait silencieux, mais 960 images à 1,4 s font vingt-deux minutes.

Le script nettoie ses images intermédiaires (`.social-frames/`) en sortant. Si
on l'interrompt, ce dossier reste et se supprime à la main. Vérifier au besoin
qu'aucun Chrome headless ne traîne, **sans toucher au navigateur ouvert** :

```sh
pgrep -f 'Google Chrome.*--headless' | wc -l
pkill -f 'Google Chrome.*--headless'
```

## Les sorties ne sont pas suivies par git

`docs/social/` est dans le `.gitignore`, comme l'avatar et la bannière : le
script est sous suivi, pas ses binaires. On régénère, on publie, on ne committe
pas.

## Pourquoi un navigateur, et pas un rasteriseur

Les démonstrations sont animées en **`@keyframes` CSS**. Aucun rasteriseur SVG
(resvg, librsvg, ImageMagick, Inkscape) n'exécute le CSS : ils sortent tous
l'état initial de l'animation, donc la même image 480 fois. Il faut un moteur de
rendu.

Pour choisir l'instant, on réutilise le mécanisme que la maquette a déjà pour
`prefers-reduced-motion` : un **retard négatif** combiné à une **animation en
pause** affiche l'instant `t`. La règle est injectée dans la maquette avec
`!important`, ce qui passe devant sa propre règle d'animation et devant sa
requête `prefers-reduced-motion`, qu'on ne veut surtout pas voir s'appliquer, car
elle figerait toutes les images sur la même.

Le script **ne redessine rien** : il importe `build()` de `gen-demo-svg.mjs`. La
vidéo montre donc exactement la démo de la page « cas d'usage », et les titres
viennent du dictionnaire `src/i18n/en.js`. Une seconde maquette à maintenir en
parallèle divergerait au premier changement.

## Les trois pièges, tous mesurés

### 1. `--window-size` n'est pas la taille de rendu

À `--window-size=1080,1350`, le document ne dispose que de **1267 px de haut** :
Chrome compte 83 px de décoration, et la capture complète les 83 px manquants en
**blanc**. Tout ce qui est en bas de l'image est donc tronqué, silencieusement.

C'est ce qui a coupé le pied de page dans trois mises en page successives, et on
ne le voit pas en lisant le code. On demande donc une fenêtre **plus haute** que
l'image et on recadre à la vraie taille au moment de l'encodage (`crop=1080:1350:0:0`),
plutôt que de soustraire une constante magique qui changera avec Chrome.

Pour le remesurer un jour : rendre un SVG avec des barres de couleur à des `y`
connus, puis lire les pixels.

```sh
ffmpeg -v error -i capture.png -vf "crop=1:1:60:1305" -pix_fmt rgb24 -f rawvideo - | od -An -tu1
```

### 2. Le `<style>` d'un SVG posé dans un document hôte n'est pas isolé

Un SVG inline dans du HTML applique ses règles **à tout le document**. Les règles
de la maquette débordaient donc sur la composition, jusqu'à réduire le pied de
page à une bande de quatre pixels qui rognait son texte.

D'où la forme actuelle : **chaque image est un SVG entier**, pas du HTML. Le titre
et la mention sont des `<text>` placés à la main, et la maquette est scellée dans
un `<image>` par une URL de données, donc elle redevient un document à part. C'est
d'ailleurs déjà comme ça que la page « cas d'usage » l'affiche, en `<img>`.

Conséquence pratique : le titre est coupé en lignes par une **largeur estimée**
(`est()`), faute de pouvoir mesurer du texte sans navigateur. Si on change la
taille du titre ou la police, vérifier la coupe avec `--at`.

### 3. ffmpeg refuse d'écrire sur son entrée

Un recadrage sur place échoue avec `Output ... same as Input`. Passer par un
fichier intermédiaire, ce que fait déjà le mode `--at`.

## Changer de format

Le ratio est dans deux constantes, `W` et `H`. Le 4:5 (1080×1350) a été retenu
parce que c'est le format qui prend le plus de hauteur autorisée dans un fil, donc
celui où la maquette reste lisible sur un téléphone. Pour un 16:9 ou un carré,
changer `W` et `H` suffit côté canevas, **mais il faut revoir la composition** :
`SVG_H` est calculé sur le ratio de la maquette (960×750), et `HEAD_H` suppose un
titre sur deux lignes au plus.

Point de vigilance connu, à trancher si on repart sur un autre ratio : la maquette
montre un tableau de bord entier, donc son texte interne tombe autour de 14 px
sur un canevas de 1080 de large. C'est confortable sur ordinateur et juste sur un
téléphone. Un format plus étroit demanderait de recadrer sur la partie utile
plutôt que de tout montrer plus petit.
