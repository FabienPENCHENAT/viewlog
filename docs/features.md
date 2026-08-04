# Fonctionnalités

Vue d'ensemble de ce que ViewLog sait faire. Pour le *comment* (code, flux de
données), voir [architecture.md](architecture.md).

## Import

Quatre façons d'ouvrir des logs, toutes traitées **localement** et à l'identique :

- **Glisser-déposer** un ou plusieurs fichiers sur la zone de dépôt.
- **Cliquer** pour parcourir, sélection multiple comprise (`.log`, `.txt`, `.csv`).
- **Déposer un dossier**, ou le choisir via « Ou choisir un dossier » : seuls les
  fichiers **directement dedans** sont pris, sans descendre dans les sous-dossiers.
  C'est le cas d'une archive qu'on vient d'extraire.
- **Coller** du texte directement (« Ou collez vos logs directement »), sans fichier.

Le `+` de la barre d'onglets accepte lui aussi une sélection multiple, et se comporte
exactement comme la zone de dépôt.

**Au-delà de 5 fichiers**, ViewLog ne tronque pas en silence : il affiche la liste et
demande lesquels ouvrir. Les chemins y sont élidés de leur préfixe commun, sans quoi
trente entrées d'un même dossier seraient indiscernables. Les fichiers vides et les
fichiers cachés (`.DS_Store`) sont écartés d'office.

Les onglets apparaissent dans **l'ordre de la sélection**, et un fichier illisible
n'annule pas le lot : les autres sont importés et l'échec est signalé.

**5 fichiers** sont conservés dans le navigateur et proposés au retour. Chaque
fichier peut être supprimé individuellement, et vider les données du site efface
tout. Quel fichier est remplacé au prochain import ne dépend plus de sa date mais
de sa position dans la barre d'onglets, voir ci-dessous.

## Navigation entre les logs ouverts

Une **barre d'onglets** en haut du dashboard met les 5 logs stockés à un clic, sans
repasser par l'accueil ni ré-importer un fichier déjà présent.

- **L'étiquette d'un onglet ne vient jamais du nom du fichier.** Cinq logs peuvent
  venir de cinq produits nommés différemment (un `application.log`, un UUID de 72
  caractères, un blob hexadécimal, un chemin de pod) : aucune règle ne rend ces noms
  comparables, et des cellules de largeurs inégales empêchent la barre de glisser.
  L'onglet porte donc **l'heure d'import**, dans un format choisi pour la barre
  entière, le plus court qui distingue les cinq : `15:16` si tous les imports sont du
  même jour, `03/08 15:16` sinon, les secondes seulement si deux imports tombent dans
  la même minute. Le format suit la langue (`08/03 03:16 PM` en anglais).
- **Renommage au double-clic**, 14 caractères, pour étiqueter ses logs comme on y
  pense (`avant`, `après`, `prod`). C'est l'échappatoire à tout ce qu'aucune
  heuristique ne peut deviner sur un nom de fichier.
- **Une pastille de couleur par fichier**, attribuée à l'import parmi les teintes
  libres : deux onglets ouverts n'ont jamais la même, et un onglet déplacé garde la
  sienne.
- **Chaque onglet garde son contexte** : recherche, mode regex, filtres de niveau,
  période, vue Motifs et saut vers le contexte. Quitter un log au milieu d'une
  investigation et y revenir le rend tel qu'on l'a laissé, bandeau de retour compris.
  Valable pour la durée de la session ; un rechargement de page repart à zéro.
- **Réordonnancement au glisser-déposer** (ou `Alt` + flèches). Ce n'est pas
  cosmétique : les nouveaux imports entrent **à gauche** et c'est le **dernier
  onglet**, estompé quand les 5 places sont prises, qui sera remplacé. Glisser un log
  vers la gauche, c'est donc le protéger de la rotation.
- **Le `+` à gauche** importe un fichier sans repasser par l'accueil, au point même
  où le nouvel onglet apparaîtra.
- **Fermer un onglet demande confirmation**, en affichant la pastille du log
  concerné : la suppression est définitive.

Le nom brut du fichier reste affiché sous la barre et dans l'infobulle de l'onglet ;
il n'a simplement plus le droit de dicter la géométrie.

La barre garde une **largeur fixe**, alignée sur le reste de la page : les onglets se
répartissent la place restante et seuls eux défilent, le `+` restant posé à gauche. Un
dégradé apparaît au bord quand un onglet sort du cadre, ce qui compte : le premier à
sortir est le dernier de la liste, donc celui que le prochain import remplacera.

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
- **Saut vers le contexte** : dès qu'un filtre est actif, chaque ligne propose
  d'être vue à sa place dans le journal complet (clic sur le numéro de ligne ou
  sur l'icône de cible). Tous les filtres sont relâchés d'un bloc et le journal
  se positionne sur la ligne. Elle pulse à l'arrivée, puis **garde un liseré
  discret** : le flash attire l'œil mais s'éteint, le repère permet de la
  retrouver après avoir défilé. Le bandeau propose de la revoir ou de revenir
  aux résultats, en restaurant l'état complet des filtres, vue Motifs comprise.

  Les deux signaux sont indépendants, la pulsation situe l'arrivée dans les deux
  sens, le repère ne sert que dans le journal complet :

  | Action | Défilement | Pulsation | Repère |
  |---|---|---|---|
  | Aller au contexte | oui | oui | oui, persistant |
  | Revoir la ligne | oui | oui | conservé |
  | Retour aux résultats | oui | oui | non |

  Relâcher **tous** les filtres n'est pas un raccourci : si l'un d'eux excluait
  encore la ligne visée, elle ne serait pas rendue et le défilement échouerait
  en silence, précisément dans les cas où l'on en a le plus besoin.

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
(avion, poste isolé). L'app peut aussi être **installée** depuis
le navigateur et lancée comme une application.

Un interrupteur **« Hors ligne »** dans la barre du haut permet de couper le
réseau à la demande, même connecté : plus aucune requête ne sort du navigateur.
Le choix est mémorisé localement. Sans connexion, l'interrupteur signale
simplement l'état, sans rien exiger de l'utilisateur.

Les mises à jour s'appliquent dès qu'il y a du réseau, sans intervention. Les
mesures d'usage anonymes ne partent que lorsque le réseau est disponible et
autorisé ; hors ligne, elles sont abandonnées, jamais mises en file d'attente.

Durée de vie du cache : illimitée en pratique sur Chrome, Edge et Firefox (tant
qu'il reste de l'espace disque), mais **7 jours sans visite sur Safari**
(macOS et iOS) sauf si l'app est installée. Vider les données du site remet à
zéro. Ces cas sont expliqués à l'utilisateur dans la FAQ.

## Confidentialité

Le contenu des logs ne quitte jamais le navigateur (voir
[architecture.md](architecture.md)). Seul un compteur d'usage anonyme et agrégé
est envoyé (voir [deployment.md](deployment.md)).
