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
components/        DropZone · StatCards · LevelChart · Timeline · LogTable · MessageCell
pages/             Home · Dashboard · Faq · Legal
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
  `getLog` (re-parse le contenu stocké), `deleteLog`. Aucune requête réseau.
- **`lib/parse-async.js`** lance le Web Worker et renvoie une promesse. Sur un
  simple upload, seules les métadonnées reviennent (on évite de recopier des
  centaines de milliers d'entrées entre threads).
- **`parser/index.js`** est le seul point de dispatch : détection CSV au contenu,
  sinon parseur texte. Les deux rendent le même modèle d'entrée
  `{ i, ts, level, message, raw }`.

## Stockage local

`lib/db.js` encapsule **IndexedDB** (base `viewlog`, store `logs`, clé `id`).
IndexedDB plutôt que `localStorage` car un log peut peser plusieurs Mo. Rotation
automatique : seuls les **5 enregistrements les plus récents** sont conservés.

## Compteur d'usage

`lib/track.js` envoie un `sendBeacon` anonyme vers `/api/track` à chaque
traitement (jamais bloquant). L'endpoint est servi par le Worker Cloudflare en
production — détail et garanties de confidentialité dans
[deployment.md](deployment.md).
