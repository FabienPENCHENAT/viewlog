# CLAUDE.md — règles de développement ViewLog

Instructions pour toute contribution au code (assistée ou non). Objectif :
garder le projet **simple, modulaire et privacy-first**. Docs détaillées :
[docs/features.md](docs/features.md) · [docs/architecture.md](docs/architecture.md)
· [docs/deployment.md](docs/deployment.md).

## Invariants (non négociables)

- **Rien ne quitte le navigateur.** Le contenu des logs est parsé et stocké en
  local (IndexedDB). Aucun envoi réseau du contenu, du nom de fichier ou de l'IP.
  Seul `/api/track` émet un signal **anonyme et agrégé** (issue, extension, pays).
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
| `web/src/components/` | Composants réutilisables |
| `web/src/pages/` | Pages routées |

Règles :
- Nouveau parsing → dans `parser/`, exposé derrière `parse()` de `parser/index.js`.
- Logique métier / données → `lib/`, jamais dans un composant.
- Un composant = une responsabilité. Si un fichier grossit ou mélange les
  responsabilités, on le **découpe**.
- Réutiliser l'existant avant d'ajouter (helpers, tokens, composants).

## Workflow d'une feature

1. Coder dans le bon module (voir tableau).
2. Ajouter les clés i18n **FR + EN**.
3. Vérifier le build : `cd web && npm run build`.
4. **Mettre à jour `CHANGELOG.md`** (obligatoire, voir plus bas).
5. Committer (voir conventions).
6. **Ne pas pousser** sans demande explicite.

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

Source unique : [`CHANGELOG.md`](CHANGELOG.md). La page `/changelog` de l'app
l'affiche telle quelle (import Vite `?raw`).

**Modèle par date** (déploiement continu : chaque push est en prod, donc pas de
`[Unreleased]`). À chaque changement **visible par l'utilisateur** (feature ou
fix) :

- Sous la section datée du jour `## AAAA-MM-JJ` (la créer en haut si absente,
  les plus récentes d'abord), ajouter **une ligne** dans la bonne catégorie
  (`Added`, `Changed`, `Fixed`, `Removed`).
- Court, orienté utilisateur ; on n'y liste pas les refactors ou changements
  purement dev.
- Rédigé en **anglais** (cohérent avec les commits et le rendu in-app).
