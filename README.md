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

```bash
npm run dev:web      # front Vite → http://localhost:5173
```

Le front est autonome (parsing + stockage côté navigateur). Le serveur Express
n'est utile qu'en self-hosting :

```bash
npm run dev:server   # serveur statique Express → http://localhost:3001
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
