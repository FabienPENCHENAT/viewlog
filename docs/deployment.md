# Déploiement (production)

Mémo de l'infra de production. Tout est reproductible depuis ce dépôt. Pour le
modèle applicatif (client-side, stockage navigateur), voir
[architecture.md](architecture.md).

## Pipeline

ViewLog est déployé comme **site statique sur Cloudflare Workers** : pas de
backend applicatif, et chaque `git push` sur `main` déclenche un build Vite puis
un déploiement automatique.

```
GitHub (FabienPENCHENAT/viewlog, branche main)
        │  push
        ▼
Cloudflare Workers (Builds)  ── npm run build (Vite) ──► web/dist
        │  npx wrangler deploy (static assets)
        ▼
https://viewlog.<...>.workers.dev  →  domaine custom viewlog.io
```

## Dépôt GitHub

- **Remote** : `git@github-perso:FabienPENCHENAT/viewlog.git` (SSH)
- **Compte** : perso `FabienPENCHENAT` (⚠️ pas le compte pro)
- **Identité des commits** (config **locale** au dépôt, pas globale) :
  - `user.name  = Fabien PENCHENAT`
  - `user.email = FabienPENCHENAT@users.noreply.github.com`
- **Clé SSH dédiée perso** : `~/.ssh/id_ed25519_perso`, exposée via un alias
  dans `~/.ssh/config` :
  ```
  Host github-perso
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_perso
    IdentitiesOnly yes
  ```
  > La clé pro (`~/.ssh/id_ed25519`) reste inchangée. GitHub interdit la même
  > clé sur deux comptes, d'où une clé séparée pour le perso.

Pour un nouveau clone perso :
```bash
git clone git@github-perso:FabienPENCHENAT/viewlog.git
cd viewlog
git config user.email FabienPENCHENAT@users.noreply.github.com
```

## Hébergement — Cloudflare Workers (static assets)

Déploiement continu : **chaque `git push` sur `main`** déclenche un build +
déploiement automatique.

### Réglages du projet Cloudflare (Workers & Pages → Create → import du repo)

| Champ | Valeur |
|---|---|
| Project name | `viewlog` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| **Path** (Advanced settings) | **`/web`** |
| Non-production branch deploy command | `npx wrangler versions upload` (défaut) |

> **Le `Path = /web` est indispensable** : l'app vit dans `web/`. Sans lui,
> Cloudflare tournerait à la racine où `npm run build = docker compose build`
> (échec) et ne trouverait pas `web/wrangler.toml`.

### `web/wrangler.toml`

```toml
name = "viewlog"
compatibility_date = "2025-01-01"
main = "worker/index.js"

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = true

[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "viewlog_events"
```

- `[assets].directory = "./dist"` : sert le build Vite comme site statique.
- `not_found_handling = "single-page-application"` : fallback SPA côté Workers,
  indispensable pour que les routes client (`/faq`, `/dashboard/:id`)
  fonctionnent en accès direct et au refresh.
- `main = "worker/index.js"` + `run_worker_first = true` : le Worker s'exécute
  d'abord pour intercepter `/api/*` ; tout le reste est servi via le binding
  `ASSETS` (donc SPA fallback conservé).

## Analytics d'usage anonyme

À chaque traitement de fichier, le front envoie un `sendBeacon` vers `/api/track`
avec `{ "outcome": "success" | "fail", "ext": "log" }`. Le Worker écrit un data
point dans **Workers Analytics Engine** (dataset `viewlog_events`). **Aucun
contenu de log n'est transmis, ni le nom du fichier, ni l'adresse IP.** On ne
garde que des données anonymes et agrégées :

- **issue** du traitement (`success` / `fail`) ;
- **extension** du fichier seule (ex. `log`, `txt`), pour prioriser les formats à
  prendre en charge ;
- **pays** de connexion, déduit par Cloudflare (`request.cf.country`) sans stocker
  l'IP.

Détail :

- Front : `web/src/track.js` (fire-and-forget, jamais bloquant), appelé dans
  `web/src/pages/Home.jsx` ; l'extension est extraite par un regex qui ne capture
  que le suffixe (jamais le nom complet).
- Worker : `web/worker/index.js`, endpoint `/api/track` ; l'extension est
  re-nettoyée côté serveur (alphanumérique, 10 caractères max).
- Schéma du data point : `blob1 = outcome`, `blob2 = extension`, `blob3 = pays`,
  `double1 = 1`.

> En dev local (`wrangler dev`), `request.cf` est absent : le pays vaut alors
> `unknown`. Il ne remonte réellement qu'en prod.

### Lire les stats

Via l'API SQL d'Analytics Engine (remplacer `<ACCOUNT_ID>` et utiliser un token
API avec la permission *Account Analytics: Read*) :

```bash
# Ratio succès / échec
curl "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/analytics_engine/sql" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -d "SELECT blob1 AS outcome, SUM(_sample_interval) AS total
      FROM viewlog_events
      WHERE timestamp > NOW() - INTERVAL '30' DAY
      GROUP BY outcome"

# Extensions déposées
curl "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/analytics_engine/sql" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -d "SELECT blob2 AS extension, SUM(_sample_interval) AS total
      FROM viewlog_events
      WHERE timestamp > NOW() - INTERVAL '30' DAY
      GROUP BY extension ORDER BY total DESC"

# Pays de connexion
curl "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/analytics_engine/sql" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -d "SELECT blob3 AS pays, SUM(_sample_interval) AS total
      FROM viewlog_events
      WHERE timestamp > NOW() - INTERVAL '30' DAY
      GROUP BY pays ORDER BY total DESC"
```

> Le ratio = `success / (success + fail)`. Les data points sont conservés ~90
> jours. Pour un suivi visuel continu, brancher Grafana sur cette même source.

> ⚠️ **Ne pas ajouter de fichier `_redirects`** (ex. `/* /index.html 200`) : sur
> Workers static assets, cette règle est rejetée au déploiement (« infinite loop
> detected »). Le fallback SPA doit passer **uniquement** par
> `not_found_handling`. Le `_redirects` n'est utile que pour un déploiement
> **Cloudflare Pages** classique.

## Domaine custom

Dans le projet Cloudflare → **Custom domains** → ajouter `viewlog.io`
(Cloudflare gère les DNS automatiquement si le domaine est déjà chez eux).
Activer **Always Use HTTPS**.

## Build en local (pour vérifier avant push)

```bash
cd web
npm install
npm run build      # produit web/dist
npm run preview    # sert le build en local
```
