# CLAUDE.md — règles de développement ViewLog

Instructions pour toute contribution au code (assistée ou non). Objectif :
garder le projet **simple, modulaire et privacy-first**. Docs détaillées :
[docs/features.md](docs/features.md) · [docs/architecture.md](docs/architecture.md)
· [docs/deployment.md](docs/deployment.md).

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
4. **Mettre à jour `docs/CHANGELOG.md`** (obligatoire, voir plus bas).
5. Committer (voir conventions).
6. **Ne pas pousser** sans demande explicite.
7. **Rendre la main pour les tests** (voir ci-dessous).

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
