# Architecture

Comment ViewLog est construit. Pour *ce qu'il fait*, voir
[features.md](features.md) ; pour la mise en production, voir
[deployment.md](deployment.md).

## Modèle : tout côté client

ViewLog est une **application web statique**. Le parsing et le stockage se font
**entièrement dans le navigateur** ; il n'y a **pas de backend applicatif**. Le
dossier `server/` (Express) et le `Dockerfile` ne servent qu'à héberger le front
statique (self-hosting) ; en production, Cloudflare sert directement le build.

## Stack

- **React 18** + **React Router** (SPA, routes `/`, `/dashboard/:id`, `/faq`, `/changelog`, `/mentions-legales`)
- **Vite** (build et dev server)
- **Recharts** (graphes) · **@tanstack/react-virtual** (virtualisation du journal)
- Parsing exécuté dans un **Web Worker** (UI jamais bloquée)
- **IndexedDB** pour le stockage local
- i18n maison (FR / EN), aucun framework

## Arborescence (`web/src`)

```
App.jsx            Layout (barre du haut, footer, <Outlet/>)
main.jsx           Routeur + LangProvider
index.css          Styles ; theme.css = tokens de couleur
levels.js          Couleurs par niveau (concern UI)
parser.worker.js   Point d'entrée du Web Worker

parser/            Parsing (voir plus bas)
  shared.js          niveaux, alias, détection horodatage/niveau, MAX_LINES, MAX_BYTES
  columnar.js        buildIndex + createStore + makeStore (modèle texte)
  columnar-csv.js    buildCsvIndex + createCsvStore (balayage sur les octets)
  text.js            parseLog — parseur texte générique (.log / .txt)
  csv.js             detectCsv + parseCsv (tokenizer RFC 4180, mapping colonnes)
  stats.js           buildStats — agrégats (par niveau, plage, série temporelle)
  index.js           parse(content) : dispatch CSV vs texte + ré-exports

i18n/              fr.js · en.js (dictionnaires plats) + index.jsx (provider/hook)
lib/               api.js · db.js · track.js · duration.js · patterns.js · parse-async.js
                   offline.js (état réseau) · net.js (fetch gardé) · pwa.js (service worker)
                   import-log.js (import partagé Home / barre d'onglets)
                   log-cache.js (LRU des logs analysés) · tab-label.js (étiquettes)
                   tab-state.js (filtres par onglet) · time-range.js · clipboard.js
components/        rangés par page : le chemin dit quelle page est concernée
  dashboard/       LogTable · MessageCell · PatternDiff · PatternRow · Timeline
                   FileIdentity · Peaks · TabBar
  stats/           StatsCharts · CountryBubbles
  home/            DropZone
  shared/          ImportManager · FilePicker (Home et Dashboard)
                   OfflineSwitch (coquille de l'app)
pages/             Home · Dashboard · Faq · Legal · Changelog · Stats · UseCases · NotFound
assets/            privacy-shield.svg
```

## Flux de données

```
Home (dépôt / collage)
   │  api.uploadLog(file)                       (lib/api.js)
   ▼
file.arrayBuffer() ══► parseAsync(bytes) ══► Web Worker (parser.worker.js)
   (════ = transféré,                            │  parseToStore(bytes)   (parser/index.js)
    jamais recopié)                              │    CSV ? index CSV : index texte
                                                 │    + buildStatsFromStore
                                                 │    + findPeaksFromStore
                                                 ▼
                                   { stats, peaks, truncated }
   │  dbPut({ …, content: file })  ── rotation sur 5 fichiers ──►  IndexedDB
   ▼                                   (un Blob, pas une chaîne)      (lib/db.js)
navigate(/dashboard/:id)
   │  getLog(id) ─► dbGet ─► content.arrayBuffer() ══► worker ══► { bytes, index }
   │                                                       │
   │                                          storeFrom(payload) : le store
   ▼
Dashboard ─► FileIdentity · Timeline (+ Peaks) · LogTable
             (tous lisent `stats` ou le store, jamais un tableau d'entrées)
```

- **`lib/api.js`** est la façade locale : `uploadLog` (parse + stocke), `listLogs`,
  `getLog` (re-parse le contenu stocké), `renameLog`, `reorderLogs`, `deleteLog`.
  Aucune requête réseau.
- **Le contenu est stocké en Blob**, pas en chaîne. IndexedDB le range hors de la
  valeur, donc lister les fichiers ou relire un enregistrement ne fait plus monter
  des centaines de Mo en mémoire : on demande ses octets au moment de parser, et
  seulement à ce moment. Les enregistrements d'avant ce changement portent une
  chaîne et sont réencodés à la lecture, sans réécriture : réécrire 200 Mo pour
  avoir simplement ouvert un fichier serait une surprise désagréable.
- **`lib/log-cache.js`** mémorise les logs analysés, avec un budget en ENTRÉES et
  non un nombre de fichiers : un gros fichier chasse les autres au lieu de
  s'ajouter à eux.
- **`lib/parse-async.js`** lance le Web Worker et renvoie une promesse. ⚠️ L'
  `ArrayBuffer` qu'on lui passe est **détaché** : il traverse le pont par transfert,
  donc l'appelant ne doit plus s'en servir. C'est le prix, assumé, de ne jamais
  dupliquer un fichier de 500 Mo.
- **`parser/index.js`** porte les deux dispatchs : `parse(content)` pour le modèle
  objet (chaîne en entrée), `parseToStore(bytes)` pour le modèle colonnaire, plus
  `storeFrom(payload)` qui rebranche les matérialisateurs du bon format à l'arrivée.

## Le modèle colonnaire

Le modèle actuel fabrique **un objet par entrée**, ce qui ne passe pas l'échelle.
Mesuré sur un vrai fichier de 200 Mo couvrant 24 h (1 975 356 lignes) :

| Étape | Coût | Cumul |
|---|---|---|
| `file.text()` | 200 Mo | 204 Mo |
| copie vers le worker | 200 Mo | 404 Mo |
| `parse()` → `entries[]` | 170 Mo | 574 Mo |
| **copie des entrées vers l'UI** | **372 Mo** | **946 Mo** |

La dernière ligne est la clé : pendant le parsing, V8 garde des **tranches** de la
grande chaîne, et le passage du pont les transforme en chaînes autonomes, donc la
copie coûte plus que l'original. À cela s'ajoutait que `MAX_LINES` coupait à la
moitié du fichier : chercher un motif présent l'après-midi renvoyait **zéro
résultat**, ce qui est pire qu'un plantage.

`parser/columnar.js` répond aux deux : les octets restent des octets, l'index
tient dans **six tableaux typés** (`offset`, `length`, `tsStart`, `tsLen`,
`level`, `time`), soit **19 octets par entrée** contre 181, et les chaînes ne sont
fabriquées que pour ce qui est affiché. Une entrée est une **plage d'octets
contiguë** : les lignes de continuation étendent la plage au lieu de créer une
entrée, ce qui préserve le rattachement des stack traces.

Mesuré sur le même fichier, **sans plafond de lignes** : 200 Mo d'octets + 37 Mo
d'index = **241 Mo pour les 1 940 784 entrées**, indexation en 0,70 s (contre
0,77 s pour la moitié du fichier dans l'ancien modèle), compteurs par niveau en
5 ms, recherche plein texte sur tout le fichier en 223 ms. Et les tableaux typés
se **transfèrent** entre threads sans copie, donc les 372 Mo disparaissent.

**Deux accès, et la distinction fait tenir la mémoire.** `level(i)` et `time(i)`
ne fabriquent rien et suffisent aux statistiques, au graphe et aux zones ;
`raw(i)`, `message(i)` et `at(i)` fabriquent des chaînes et ne doivent servir
qu'à l'affichage, à l'export et à la recherche. Personne au-dessus du store ne
touche aux tableaux typés, sinon le modèle cesserait d'être remplaçable.

État : **branché de bout en bout.** Le worker construit l'index, le transfère
avec les octets, et l'interface reconstruit le store sans qu'un seul octet soit
recopié. La vue filtrée est une liste d'INDEX (`Uint32Array`), soit quatre octets
par ligne retenue, et une entrée n'est fabriquée que pour être affichée. Deux
endroits matérialisent encore toute la sélection, parce que leur algorithme a
besoin du texte de chaque ligne : le regroupement par motif et la comparaison de
zone. C'est le même coût qu'avant, et il ne se paye plus dans le journal.

L'équivalence est vérifiée hors navigateur à chaque étage : un script parse le
même fichier des deux façons et diffe `ts`, `level`, `message` et `raw` entrée par
entrée, plus les agrégats ; un autre rejoue sept combinaisons de filtres
(niveaux, recherche, période, drill-down, et tout combiné) sur six fichiers et
compare les numéros de ligne retenus, du fichier de onze lignes au million. Sur les 982 324 entrées du fichier de 200 Mo, et sur
un jeu de cas tordus (horodatage Apache au milieu de la ligne, syslog, UTF-8
multi-octets avant l'horodatage, indentation, CRLF sans saut final, ligne de
5 000 caractères), **une seule différence assumée** : une ligne blanche contenant
des espaces au milieu d'une stack trace garde ses espaces, là où l'ancien parseur
les laissait tomber. Le nouveau comportement est le plus fidèle au fichier.

### Le fichier de référence, et pourquoi sa forme compte

Les mesures ci-dessus valent sur des logs à **lignes courtes**, où le nombre
d'entrées domine. Le fichier réel qui a motivé le chantier a la forme inverse :
**222 Mo pour 53 000 lignes**, soit 4,2 Ko par ligne, parce que chaque message
porte une stack trace complète et un payload. Deux conséquences qui renversent
les conclusions :

- **le plafond du million d'entrées n'y change rien** : ce fichier passe en
  entier, ses 24 h comprises. Ce qui coûte, c'est l'octet, pas la ligne ;
- **le poste dominant est la copie vers l'interface**. Mesuré sur cette forme :
  214 Mo pour le fichier en mémoire, 50 Mo pour les entrées, et **607 Mo pour la
  seule copie des entrées du worker vers l'UI**, soit 875 Mo à l'arrivée sur le
  dashboard. Chaque entrée porte `raw` et `message`, tranches du contenu pendant
  le parsing, aplaties en chaînes autonomes en traversant le pont.

Donc : **régler un seuil ou juger un gain demande de mesurer les deux formes**,
lignes courtes et lignes énormes. Une optimisation qui brille sur l'une peut ne
rien changer à l'autre.

### Le CSV coûtait huit fois le texte

Le CSV n'est pas le texte, et ça ne se voyait pas : `tokenizeCsv` construisait
chaque cellule **caractère par caractère** (`field += ch`), donc chaque champ
était une chaîne réellement allouée et non une tranche de la source ; il gardait
ensuite **tous** les enregistrements dans un tableau de tableaux ; le filtre des
lignes vides `trim()`ait chaque cellule du fichier ; et `raw` était recomposé par
un `join(" ")`, une chaîne de plus par ligne.

Mesuré sur un vrai CSV de 201 Mo couvrant 24 h : **1 503 octets par entrée**,
contre 181 pour le parseur texte. Un CSV de 100 Mo retenait 1,4 Go, et un import
de 201 Mo faisait tuer l'onglet, sous le plafond de 250 Mo qui le laissait donc
passer.

Le tokenizer rend désormais des **bornes** et les chaînes sont découpées à la
demande, ce qui donne **178 octets par entrée** (8,5 fois moins) et un parsing
2,7 fois plus rapide. Sur le fichier de 201 Mo, `ts`, `level` et `message` sont
identiques à l'ancien parseur sur le million d'entrées ; seul `raw` change de
définition, et c'est voulu : c'est la **ligne source** au lieu d'une
recomposition, donc copier une ligne rend la vraie ligne du fichier.

Le CSV **est dans le modèle colonnaire** lui aussi : un enregistrement est une
plage d'octets contiguë, retours à la ligne quotés compris, et les colonnes se
retrouvent en re-balayant ce seul enregistrement à l'affichage. Il en avait été
écarté par erreur, alors que les fichiers qui posent le problème sont des CSV.

## Stockage local

`lib/db.js` encapsule **IndexedDB** (base `viewlog`, store `logs`, clé `id`).
IndexedDB plutôt que `localStorage` car un log peut peser plusieurs Mo.

Un enregistrement porte `id`, `name` (nom brut du fichier), `label` (renommage
choisi, ou `null`), `order`, `hue`, `size`, `importedAt`, `meta` et `content`.

**`order` est la clé de la rotation, pas `importedAt`.** L'ordre des onglets
appartenant à l'utilisateur, il est persisté et ne peut plus être déduit de la date
d'import : un nouvel import entre à `order = 0` et ce qui dépasse la cinquième place
est supprimé. Glisser un onglet vers la gauche le protège donc de la rotation.
`ordered()` renumérote les enregistrements antérieurs à l'introduction de ces champs.

**`hue` est attribuée à l'import** parmi les teintes qu'aucun fichier ouvert n'utilise.
Ni la position (elle changerait à chaque réordonnancement, détruisant l'identité
qu'elle sert à créer) ni un hachage de l'identifiant (cinq teintes pour cinq fichiers
collisionnent vite, et deux onglets de la même couleur ne distinguent rien).

**Le cache des logs analysés a un budget en ENTRÉES**, pas en nombre de logs
(`lib/log-cache.js`). Compter les logs traitait un fichier de 2 000 lignes comme
un fichier de deux millions : garder trois gros logs multipliait par trois le
poste le plus lourd de l'application. La réserve est partagée, le plus récent est
toujours gardé même s'il dépasse à lui seul le budget, et un gros fichier chasse
donc les autres au lieu de s'ajouter à eux.

L'état de filtrage par onglet vit dans **`lib/tab-state.js`**, volontairement **en
mémoire** : un rechargement de page est une remise à zéro assumée, donc rien à
nettoyer ni à faire vieillir côté IndexedDB. Voir le ticket backlog *06, sessions
locales* pour le rendre persistant.

## Mode hors ligne

Le build est mis en cache par un **service worker** généré au build par
`vite-plugin-pwa` (mode `generateSW`, voir `vite.config.js`) : l'app se charge
sans réseau, et un `manifest.webmanifest` la rend installable.

- **Precache** : JS, CSS, HTML, icônes. `og.png` est exclu (aperçus sociaux
  uniquement). Les navigations retombent sur `index.html`, sauf `/api/*` qui
  reste du réseau pur.
- **Aucun `runtimeCaching`** : ce qui n'est pas préchargé part au réseau, et rien
  n'est mis en file d'attente pour un rejeu ultérieur (pas de Background Sync sur
  `/api/track` : ce serait stocker des events en attendant la connexion).
- **Mises à jour** (`registerType: "autoUpdate"`) : le nouveau build prend la
  main tout seul. `lib/pwa.js` redemande une vérification au retour du réseau,
  et évite de recharger la page sous les doigts de l'utilisateur passé les
  premières secondes de la visite.

`lib/offline.js` est la source unique de vérité avant toute requête sortante :
`networkAllowed()` combine l'état du navigateur (`navigator.onLine`) et le mode
hors ligne **choisi** par l'utilisateur (persisté dans `localStorage`, exposé par
`components/shared/OfflineSwitch.jsx`).

La promesse affichée (« aucune requête ne sort de votre navigateur ») n'est
tenable que si rien ne contourne ce garde-fou : **toute requête sortante passe
par `netFetch()` de `lib/net.js`**, qui échoue immédiatement hors ligne au lieu
d'émettre. Seule exception assumée, `lib/track.js` consulte `networkAllowed()`
directement, parce qu'il utilise `sendBeacon` et doit rester silencieux.

Ce que ViewLog ne maîtrise pas : au chargement d'une page, le navigateur peut
vérifier de lui-même s'il existe un nouveau `sw.js`. La mention légale et la FAQ
le disent explicitement plutôt que de promettre un silence réseau absolu.

## Compteur d'usage

Rien n'est envoyé si le navigateur signale « Do Not Track » / « Global Privacy
Control », ni lorsque `networkAllowed()` est faux (hors ligne subi ou choisi).

`lib/track.js` envoie un `sendBeacon` anonyme vers `/api/track` à chaque
traitement (jamais bloquant). L'endpoint est servi par le Worker Cloudflare en
production — détail et garanties de confidentialité dans
[deployment.md](deployment.md).
