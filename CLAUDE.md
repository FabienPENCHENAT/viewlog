# CLAUDE.md — règles de développement ViewLog

Instructions pour toute contribution au code (assistée ou non). Objectif :
garder le projet **simple, modulaire et privacy-first**. Docs détaillées :
[docs/features.md](docs/features.md) · [docs/architecture.md](docs/architecture.md)
· [docs/deployment.md](docs/deployment.md)
· [docs/social-assets.md](docs/social-assets.md).

## Invariants (non négociables)

- **Rien ne quitte le navigateur.** Le contenu des logs est parsé et stocké en
  local (IndexedDB). Aucun envoi réseau du contenu, du nom de fichier ou de l'IP.
  Seul `/api/track` émet des events **anonymes et agrégés** (page vue, résultat
  et méthode d'import, extension, tranche de taille, troncature, fonctionnalité
  utilisée, pays), sans cookie ni identifiant de suivi, et **en respectant le
  Do Not Track / GPC**. Toute évolution du tracking doit rester dans ce cadre et
  être reflétée dans la mention légale (`legal.data_body` FR + EN).
  Toute nouvelle valeur trackée (feature, page, méthode) doit être ajoutée à
  l'allowlist correspondante de `web/worker/index.js` **et** au libellé de la
  page `/stats` : hors allowlist, l'event est enregistré sans sa valeur.
- **Bilingue FR + EN.** Tout texte visible passe par l'i18n : la clé est ajoutée
  dans `web/src/i18n/fr.js` **et** `web/src/i18n/en.js`. Jamais de texte en dur.
- **Pas de tiret cadratin `—`** dans les textes affichés (préférence produit) ;
  utiliser une virgule, un deux-points ou un point.
- **Couleurs via les tokens** de `web/src/theme.css`, jamais en dur.

## Architecture : où va quoi

Une feature = du code rangé dans le bon module, **jamais à plat**.

| Dossier | Rôle |
|---|---|
| `web/src/parser/` | Parsing : `shared`, `text`, `csv`, `stats`, `index` (dispatch) |
| `web/src/lib/` | Logique non-UI : `api`, `db`, `track`, `duration`, `patterns`, `parse-async` |
| `web/src/i18n/` | Dictionnaires `fr.js` / `en.js` + provider |
| `web/src/components/` | Composants, **rangés par page** (voir ci-dessous) |
| `web/src/pages/` | Pages routées |

Règles :
- Nouveau parsing → dans `parser/`, exposé derrière `parse()` de `parser/index.js`.
- Logique métier / données → `lib/`, jamais dans un composant.
- Un composant = une responsabilité. Si un fichier grossit ou mélange les
  responsabilités, on le **découpe**.
- Réutiliser l'existant avant d'ajouter (helpers, tokens, composants).

### Un composant se range par page

Un composant utilisé par **une seule page** vit dans le dossier de cette page ;
tout le reste va dans `shared/`. La question « ce composant concerne quelle
page ? » doit se répondre en lisant le chemin, pas en cherchant qui l'importe.

| Dossier | Contenu |
|---|---|
| `components/dashboard/` | `LogTable`, `MessageCell`, `PatternDiff`, `PatternRow`, `Timeline`, `StatCards`, `LevelChart`, `TabBar` |
| `components/stats/` | `StatsCharts`, `CountryBubbles` |
| `components/home/` | `DropZone` |
| `components/shared/` | `ImportManager` et `FilePicker` (Home **et** Dashboard), `OfflineSwitch` (coquille de l'app) |

Un composant qui n'est utilisé que par un autre composant se range **avec lui** :
`MessageCell` et `PatternRow` ne servent qu'au dashboard, ils y restent. Le jour
où une seconde page en a besoin, il déménage dans `shared/`, et c'est le seul
moment où on y touche.

## Workflow d'une feature

1. Coder dans le bon module (voir tableau).
2. Ajouter les clés i18n **FR + EN**.
3. Vérifier le build : `cd web && npm run build`.
4. **Mettre à jour `docs/CHANGELOG.md`** (obligatoire, voir plus bas).
5. Committer **sur `main`** (voir conventions et ci-dessous).
6. **Ne pas pousser** sans demande explicite.
7. **Rendre la main pour les tests** (voir ci-dessous).

### On travaille directement sur `main`

**Pas de branche de feature, pas de PR** sauf demande explicite. Un seul mainteneur, du
déploiement continu : une branche n'apporte rien et ajoute une étape de merge à chaque
fois. On committe sur `main`, et on pousse quand on le demande.

⚠️ Pousser sur `main` **déploie en production** (voir
[docs/deployment.md](docs/deployment.md)) : d'où le point 6, on ne pousse jamais de sa
propre initiative.

### Pas de tests fonctionnels, pas de E2E

**Les tests fonctionnels sont faits à la main par le mainteneur.** Ne pas écrire, ne
pas lancer, ne pas outiller de tests d'intégration ou E2E : pas de Playwright, pas de
Puppeteer, pas de pilotage de navigateur headless, pas de script de « drive ».

*Pourquoi :* l'UI de ViewLog se vérifie en trente secondes à l'écran, alors qu'écrire
puis déboguer un pilote coûte beaucoup de temps, de tokens et d'énergie pour la même
information. Le mainteneur va plus vite à la main.

La livraison est prête à tester dès que **ces quatre conditions** sont réunies :

- le plan annoncé a été suivi ;
- la feature est développée **en entier** ;
- `cd web && npm run build` passe ;
- rien ne contredit visiblement le besoin exprimé.

Alors on rend la main, en disant **quoi regarder** (les cas limites, ce qui n'a pas été
vérifié). Si une partie est restée bloquée ou hors périmètre, le dire explicitement
plutôt que de laisser le mainteneur le découvrir.

Une seule commande à lui donner, depuis la racine : `npm run dev` (installe si besoin,
lance Vite, ouvre le navigateur sur <http://localhost:5173>).

Restent utiles et bienvenues, les vérifications **hors navigateur** : le build, et un
script Node ponctuel sur une fonction pure (par exemple le format des étiquettes
d'onglets de `lib/tab-label.js`).

> Une infra de tests E2E est prévue comme une feature à part entière, plus tard. D'ici
> là, cette règle tient.

## Commits — Conventional Commits

Format : `type(scope): sujet` en **anglais**, à l'impératif, minuscule, sans point final.

- **Types** : `feat`, `fix`, `refactor`, `docs`, `chore`, `style`, `perf`, `test`.
- **1 commit = 1 changement logique.**
- `scope` optionnel (ex. `parser`, `i18n`, `dashboard`, `logtable`).
- Corps optionnel pour expliquer le *pourquoi*.

Exemples :
- `feat: add CSV log support`
- `fix: don't crash search on an invalid regex`
- `refactor: split parser into modules`

## Changelog (obligatoire)

Source unique : [`docs/CHANGELOG.md`](docs/CHANGELOG.md). La page `/changelog`
de l'app l'affiche telle quelle (import Vite `?raw`).

**Modèle par date** (déploiement continu : chaque push est en prod, donc pas de
`[Unreleased]`). À chaque changement **visible par l'utilisateur** (feature ou
fix) :

- Sous la section datée du jour `## AAAA-MM-JJ` (la créer en haut si absente,
  les plus récentes d'abord), ajouter **une ligne** dans la bonne catégorie
  (`Added`, `Changed`, `Fixed`, `Removed`).
- Court, orienté utilisateur ; on n'y liste pas les refactors ou changements
  purement dev.
- Rédigé en **anglais** (cohérent avec les commits et le rendu in-app).

### Une ligne = ce qu'on peut faire, rien de plus

**On annonce la fonctionnalité, pas le raisonnement.** Le *pourquoi*, les cas
limites, les compromis et les détails d'implémentation vont dans le corps du commit
et dans les docs, jamais ici : le lecteur du changelog veut savoir ce qu'il peut
faire de nouveau.

Concrètement, une entrée tient en **une phrase**, deux au maximum, et ne contient :

- ni justification (« parce que », « sinon », « ce qui est le cas de… ») ;
- ni cas limite ni comportement de repli ;
- ni nom de fichier, de fonction ou de token.

```
✅  Drop a folder, or pick one, to import the logs it contains. Only the files
    directly inside are taken, not those in sub-folders.

❌  … not those in sub-folders, which is what you get from a freshly extracted
    archive, and one unreadable file no longer cancels the others
```

**Une feature jamais partie en prod n'a pas d'historique.** Tout ce qu'elle apporte
va dans `Added`, y compris ce qui ressemble à un changement ou à un correctif : il
n'existe aucun comportement antérieur à modifier du point de vue du lecteur. Une
correction sur une branche non poussée ne se raconte pas.
