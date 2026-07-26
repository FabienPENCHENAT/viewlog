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

Le front envoie des events via `sendBeacon` vers `/api/track`. Le Worker écrit un
data point dans **Workers Analytics Engine** (dataset `viewlog_events`). **Aucun
contenu de log, nom de fichier, taille exacte ou IP n'est transmis.** Le tracking
est cookieless, sans identifiant de suivi, et **respecte Do Not Track / GPC**
(voir `web/src/lib/track.js`).

### Events

- `page_view` : pages de contenu (`home`/`faq`/`changelog`/`legal`), câblé dans `App.jsx`.
- `import` : nouveau fichier traité, câblé dans `Home.jsx` (résultat, méthode,
  extension, tranche de taille, troncature).
- `open` : réouverture d'un log déjà stocké, câblé dans `Dashboard.jsx` (source
  `recent`/`direct`). Un import ne déclenche pas d'`open` (dédup).
- `feature` : usage d'une fonctionnalité, câblé dans `LogTable.jsx`, **une fois
  par fichier ouvert** (mesure l'adoption). Valeurs : `search`, `regex`,
  `filter_level`, `time_range`, `view_patterns`, `pattern_click`, `export`.

### Schéma des slots (FIXE, ne jamais recycler)

| slot | sens | events |
|---|---|---|
| `index1` / `blob1` | event | tous |
| `blob2` | pays (`request.cf.country`) | tous |
| `blob3` | outcome (`success`/`fail`) | import, open |
| `blob4` | source (`drop`/`picker`/`paste` ou `recent`/`direct`) | import, open |
| `blob5` | tranche de taille (`s`/`m`/`l`/`xl`) | import |
| `blob6` | troncature (`1`/`0`) | import |
| `blob7` | page (`home`/`faq`/`changelog`/`legal`) | page_view |
| `blob8` | feature | feature |
| `blob9` | extension | import |
| `double1` | `1` | tous |

> En dev local (`wrangler dev`), `request.cf` est absent : le pays vaut `unknown`.

### Dashboard privé `/api/stats` + page privée

Analytics Engine n'a pas de dashboard natif. Le Worker expose `/api/stats`
(verrouillé par token) qui agrège les 90 derniers jours via l'API SQL, et une page
React non liée dans la nav l'affiche. Chemin actuel : **`/vl-backstage-6f3a`**
(défini dans `web/src/main.jsx` ; peu devinable, mais la vraie protection reste le
token). Secrets à définir :

```bash
cd web
wrangler secret put CF_ACCOUNT_ID        # ID du compte Cloudflare
wrangler secret put CF_ANALYTICS_TOKEN   # API token avec "Account Analytics: Read"
wrangler secret put STATS_TOKEN          # mot de passe de la page privée
```

Sécurité de `/api/stats` : token lu **uniquement** dans l'en-tête
`Authorization: Bearer ...` (jamais en query), comparé à **temps constant**, et
**rate limité** à 10 requêtes / 60 s par IP (binding `STATS_LIMITER`).

Accès : ouvrir la page privée, saisir le `STATS_TOKEN` (mémorisé en local). Sans
token valide, `/api/stats` renvoie 401 ; en cas d'abus, 429.

### Requêtes SQL (fenêtre glissante 90 j)

Toujours compter avec `SUM(_sample_interval)` (AE échantillonne). Helper :

```bash
q() { curl -s "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/analytics_engine/sql" \
        -H "Authorization: Bearer $CF_API_TOKEN" --data "$1"; }
```

```sql
-- Taux d'activation (imports + réouvertures) / visites
SELECT
  SUM(if(blob1='page_view', _sample_interval, 0)) AS visits,
  SUM(if(blob1 IN ('import','open') AND blob3='success', _sample_interval, 0)) AS active_uses,
  SUM(if(blob1 IN ('import','open') AND blob3='success', _sample_interval, 0))
    / SUM(if(blob1='page_view', _sample_interval, 0)) AS activation_rate
FROM viewlog_events WHERE timestamp > NOW() - INTERVAL '90' DAY;

-- Visites par jour
SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, SUM(_sample_interval) AS n
FROM viewlog_events WHERE blob1='page_view' AND timestamp > NOW() - INTERVAL '90' DAY
GROUP BY day ORDER BY day;

-- Import vs réouverture (proxy de fidélité)
SELECT blob1 AS event, SUM(_sample_interval) AS n
FROM viewlog_events WHERE blob1 IN ('import','open') AND blob3='success'
  AND timestamp > NOW() - INTERVAL '90' DAY GROUP BY event;

-- Méthode d'import / Succès-échec / Extensions / Tailles / Troncature
SELECT blob4 AS method, SUM(_sample_interval) AS n FROM viewlog_events
WHERE blob1='import' AND timestamp > NOW() - INTERVAL '90' DAY GROUP BY method ORDER BY n DESC;
SELECT blob3 AS outcome, SUM(_sample_interval) AS n FROM viewlog_events
WHERE blob1='import' AND timestamp > NOW() - INTERVAL '90' DAY GROUP BY outcome;
SELECT blob9 AS ext, SUM(_sample_interval) AS n FROM viewlog_events
WHERE blob1='import' AND timestamp > NOW() - INTERVAL '90' DAY GROUP BY ext ORDER BY n DESC;
SELECT blob5 AS size_bucket, SUM(_sample_interval) AS n FROM viewlog_events
WHERE blob1='import' AND timestamp > NOW() - INTERVAL '90' DAY GROUP BY size_bucket ORDER BY n DESC;
SELECT blob6 AS truncated, SUM(_sample_interval) AS n FROM viewlog_events
WHERE blob1='import' AND timestamp > NOW() - INTERVAL '90' DAY GROUP BY truncated;

-- Classement des features (boussole backlog)
SELECT blob8 AS feature, SUM(_sample_interval) AS n FROM viewlog_events
WHERE blob1='feature' AND timestamp > NOW() - INTERVAL '90' DAY GROUP BY feature ORDER BY n DESC;

-- Pages vues / Pays
SELECT blob7 AS page, SUM(_sample_interval) AS n FROM viewlog_events
WHERE blob1='page_view' AND timestamp > NOW() - INTERVAL '90' DAY GROUP BY page ORDER BY n DESC;
SELECT blob2 AS country, SUM(_sample_interval) AS n FROM viewlog_events
WHERE blob1 IN ('page_view','import','open','feature') AND timestamp > NOW() - INTERVAL '90' DAY
GROUP BY country ORDER BY n DESC LIMIT 20;
```

> Data points conservés ~90 jours. Pour un suivi visuel externe, Grafana peut se
> brancher sur cette même API SQL.

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
