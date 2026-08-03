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
  shared.js          niveaux, alias, détection horodatage/niveau, MAX_LINES
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
components/        DropZone · StatCards · LevelChart · Timeline · LogTable · MessageCell
                   OfflineSwitch · TabBar
pages/             Home · Dashboard · Faq · Legal · Changelog · Stats · NotFound
assets/            privacy-shield.svg
```

## Flux de données

```
Home (dépôt / collage)
   │  api.uploadLog(file)                       (lib/api.js)
   ▼
file.text() ─► parseAsync(content) ─► Web Worker (parser.worker.js)
                                          │  parse(content)          (parser/index.js)
                                          │    detectCsv ? parseCsv : parseLog
                                          │    + buildStats
                                          ▼
                                   { entries, stats, truncated }
   │  dbPut(record)  ── rotation sur 5 fichiers ──►  IndexedDB      (lib/db.js)
   ▼
navigate(/dashboard/:id)
   │  getLog(id) ─► dbGet ─► re-parse (worker) ─► entries + stats
   ▼
Dashboard ─► StatCards · Timeline · LevelChart · LogTable
```

- **`lib/api.js`** est la façade locale : `uploadLog` (parse + stocke), `listLogs`,
  `getLog` (re-parse le contenu stocké), `renameLog`, `reorderLogs`, `deleteLog`.
  Aucune requête réseau.
- **`lib/log-cache.js`** mémorise les 3 derniers logs analysés. Sans lui, chaque
  changement d'onglet relancerait un parsing complet et la barre d'onglets perdrait
  exactement ce qu'elle apporte. Borné à 3 car les entrées analysées d'un gros
  fichier pèsent lourd.
- **`lib/parse-async.js`** lance le Web Worker et renvoie une promesse. Sur un
  simple upload, seules les métadonnées reviennent (on évite de recopier des
  centaines de milliers d'entrées entre threads).
- **`parser/index.js`** est le seul point de dispatch : détection CSV au contenu,
  sinon parseur texte. Les deux rendent le même modèle d'entrée
  `{ i, ts, level, message, raw }`.

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
`components/OfflineSwitch.jsx`).

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
