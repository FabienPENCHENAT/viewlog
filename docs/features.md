# Fonctionnalités

Vue d'ensemble de ce que ViewLog sait faire. Pour le *comment* (code, flux de
données), voir [architecture.md](architecture.md).

## Import

Trois façons d'ouvrir des logs, toutes traitées **localement** et à l'identique :

- **Glisser-déposer** un fichier sur la zone de dépôt.
- **Cliquer** pour parcourir (`.log`, `.txt`, `.csv`).
- **Coller** du texte directement (« Ou collez vos logs directement »), sans fichier.

Les **5 derniers fichiers ouverts** sont conservés dans le navigateur et
proposés au retour ; ils tournent automatiquement (le plus ancien est remplacé).
Chaque fichier peut être supprimé individuellement, et vider les données du site
efface tout.

## Formats pris en charge

### Texte (`.log`, `.txt`)

Parsing générique, ligne par ligne :

- **Horodatage** : ISO 8601, Apache/CLF (`02/Jan/2024:15:04:05`), syslog
  (`Jan 2 15:04:05`).
- **Niveau** : de `TRACE` à `FATAL` (+ `OTHER`), avec alias courants
  (`WARNING`→`WARN`, `CRIT`→`FATAL`, …).
- **Message** : le reste de la ligne. Les **stack traces multi-lignes** et lignes
  de continuation sont rattachées à leur entrée.

### CSV (`.csv`)

Détecté automatiquement au contenu (colonnes régulières). Tokenizer conforme
RFC 4180 (guillemets, `""` échappés, champs multi-lignes). Les colonnes
**horodatage / niveau / message** sont identifiées par nom d'en-tête
(`timestamp`, `level`, `message`, `time`, `severity`, `msg`, …) ou, à défaut,
par analyse des valeurs — donc **même sans en-tête**.

## Tableau de bord

- **Stats clés** : nombre de lignes, erreurs, warnings, durée couverte.
- **Volume dans le temps** : courbes (48 tranches) du total et des erreurs.
  **Sélection à la souris** : on glisse sur un pic pour borner la période, un
  double-clic revient à la période complète.
- **Répartition par niveau** : proportion de chaque niveau.

## Journal

Table **virtualisée** (seules les lignes visibles sont rendues) : gère des
centaines de milliers de lignes sans ralentir. Colonnes : n° de ligne,
horodatage, niveau, message.

- **Recherche** en temps réel. Deux modes via le bouton `.*` :
  - *contains* (défaut) : texte simple, insensible à la casse ;
  - *regex* : expression régulière.
  Dans les deux cas, les correspondances sont **surlignées** dans les messages.
- **Filtres par niveau** : chaque niveau se (dés)active d'un clic.
- **Filtre par période** : curseur temporel pour borner la fenêtre affichée.
  Il est **synchronisé dans les deux sens** avec la sélection du graphe de
  volume : les deux pilotent la même fenêtre, et donc les lignes affichées.

## Vue « Motifs »

Regroupe des milliers de lignes en quelques **motifs récurrents** : les messages
sont normalisés (nombres, identifiants, dates et adresses masqués) pour agréger
les entrées identiques, triées par fréquence. Cliquer un motif ramène au journal
filtré dessus.

## Confort de lecture

- **Pretty-print du JSON inline** : un payload JSON valide dans un message est
  détecté et affiché indenté dans un encart, sans altérer le reste.
- **Atténuation du bruit** : UUID et longues chaînes hexadécimales (hashes) sont
  grisés pour faire ressortir le message.
- **Repli automatique** des messages très longs (dépliables à la demande).

## Gros fichiers

Fichiers de plusieurs dizaines de Mo / centaines de milliers de lignes pris en
charge. Le traitement porte sur le **premier million de lignes** ; l'affichage
reste fluide grâce à la virtualisation.

## Langues

Interface **français / anglais**, bascule manuelle, préférence mémorisée
localement.

## Mode hors ligne

Après une première visite avec du réseau, les fichiers de l'application sont mis
en cache par le navigateur : ViewLog reste utilisable **sans aucune connexion**
(avion, poste isolé, salle serveur). L'app peut aussi être **installée** depuis
le navigateur et lancée comme une application.

Un interrupteur **« Hors ligne »** dans la barre du haut permet de couper le
réseau à la demande, même connecté : plus aucune requête ne sort du navigateur.
Le choix est mémorisé localement. Sans connexion, l'interrupteur signale
simplement l'état, sans rien exiger de l'utilisateur.

Les mises à jour s'appliquent dès qu'il y a du réseau, sans intervention. Les
mesures d'usage anonymes ne partent que lorsque le réseau est disponible et
autorisé ; hors ligne, elles sont abandonnées, jamais mises en file d'attente.

## Confidentialité

Le contenu des logs ne quitte jamais le navigateur (voir
[architecture.md](architecture.md)). Seul un compteur d'usage anonyme et agrégé
est envoyé (voir [deployment.md](deployment.md)).
