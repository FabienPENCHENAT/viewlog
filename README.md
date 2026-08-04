# ViewLog

Lecteur de logs *privacy-first* : déposez un fichier `.log`, `.txt` ou `.csv`
(ou collez directement du texte) et obtenez un tableau de bord lisible.
**Tout est traité dans votre navigateur — aucun fichier n'est envoyé sur un serveur.**

🔗 En ligne : **https://viewlog.io**

## Aperçu

- Parsing automatique de l'horodatage, du niveau et du message (texte **et** CSV)
- Tableau de bord : stats clés, volume dans le temps, répartition par niveau
- Journal virtualisé : recherche texte **ou regex** surlignée, filtres par niveau, curseur de période
- Vue « Motifs » (regroupe les erreurs récurrentes) et pretty-print du JSON inline
- 100 % local (IndexedDB, 5 derniers fichiers), interface FR / EN

→ Le détail des fonctionnalités : **[docs/features.md](docs/features.md)**

## Démarrage rapide

### Développement

Une seule commande, depuis la racine. Elle installe les dépendances si besoin,
lance Vite et ouvre le navigateur :

```bash
npm run dev          # → http://localhost:5173
```

Le front est autonome (parsing et stockage côté navigateur), donc rien d'autre
n'est à lancer pour tester une modification. Seul `/api/track` renvoie 404 en
local : cet endpoint est servi par le Worker Cloudflare en production, et son
absence n'a aucun effet sur l'app.

```bash
npm run dev:web      # idem, sans ouvrir le navigateur
npm run dev:server   # serveur statique Express, utile en self-hosting seulement
```

### Docker (self-hosting)

```bash
npm run build        # = docker compose build
npm run start        # = docker compose up → http://localhost:3001
```

Le serveur est **sans état** : il ne fait que servir le front statique, les logs
ne vivent que dans le navigateur. Aucun volume nécessaire.

## Documentation

| Doc | Contenu |
|-----|---------|
| **[Fonctionnalités](docs/features.md)** | Ce que fait l'app, format par format |
| **[Architecture](docs/architecture.md)** | Stack, arborescence, flux de données |
| **[Déploiement](docs/deployment.md)** | Infra de production (Cloudflare), analytics, domaine |

## Confidentialité

Le contenu des logs est parsé et stocké **uniquement dans votre navigateur**
(IndexedDB). Aucun fichier n'est transmis ni persisté ailleurs. Voir
[Architecture](docs/architecture.md) pour le modèle, et
[Déploiement](docs/deployment.md) pour le seul signal collecté (compteur d'usage
anonyme et agrégé, sans contenu ni IP).
