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
filtré dessus. Un nombre collé à son unité est masqué comme les autres
(`30000ms`, `512kB`), sinon le même message se scinderait en autant de motifs
qu'il a de valeurs.

### Comparer une zone au reste du fichier

Trié par fréquence, un pic ne révèle rien : il multiplie tout par le même
facteur, donc le **bruit déjà présent reste en tête** et la cause, souvent peu
fréquente, reste invisible. D'où la comparaison, qui raisonne en **part des
lignes et non en nombre d'occurrences** : un motif à 5 % des lignes dedans et
5 % dehors est du bruit même s'il passe de 12 à 3 400 occurrences.

La conséquence tient en une phrase : **un motif qui grossit au même rythme que
le reste de la zone ne remonte jamais**, quels que soient les chiffres. C'est le
pic d'utilisation, et il est écarté par construction. Ne remonte que ce qui
grossit plus vite que le reste, donc ce qui a changé le mélange.

Dès qu'une période est sélectionnée, la vue Motifs propose de **comparer la zone
au reste du fichier**. Le résultat est classé en trois groupes :

- **Seulement ici** : absents du reste du fichier, triés par nombre. C'est le
  cœur, et il n'y a pas de plancher : une seule occurrence propre à la zone peut
  être la cause.
- **Sur-représentés ici** : présents des deux côtés, mais occupant **3 fois
  plus de lignes en proportion** dans la zone que sur une zone équivalente
  ailleurs, et au moins 3 occurrences. Le plancher de 3 évite qu'un rapport
  calculé sur deux lignes remonte en tête. Le facteur, lui, est volontairement
  bas : un motif déjà fréquent partout ne peut pas atteindre un gros rapport,
  alors que sa hausse est souvent la plus parlante. Monter la barre écarte donc
  les incidents les plus francs avant les dérives molles.
- **Absents ici** : attendus dans la zone au rythme habituel, jamais vus. Le
  battement de cœur qui s'arrête, qu'aucun défilement ne montre. La ligne
  annonce le nombre qu'on attendait (« attendu ~232 ici, vu 0 »), parce que
  c'est ça qui répond à « et alors ? ».

#### La référence est un rythme, pas un total

Le taux « ailleurs » n'est pas le total du reste du fichier divisé par ses
lignes : c'est la **moyenne des taux mesurés sur des fenêtres de la même durée
que la zone**. La question posée est donc « combien de place ce motif prend-il
d'habitude sur une zone équivalente », et pas « quelle part occupe-t-il dans le
fichier entier ». Trois conséquences, mesurées sur une semaine de logs
contenant deux incidents connus :

- **Un second pic ailleurs ne pollue plus la comparaison.** Il ne pèse plus que
  deux fenêtres sur cent trente-cinq au lieu de ses milliers de lignes. Un
  incident du samedi remontait à ×9 quand un autre incident traînait le
  dimanche ; il remonte à ×39. Et ça ne demande aucune détection préalable : un
  pic qu'on n'a pas repéré est amorti de la même façon.
- **Le rythme du fichier ne fabrique plus de faux positifs.** Une nuit ne
  contient presque que de la télémétrie ; comparée au fichier entier, cette
  télémétrie sortait « sur-représentée » alors que c'est le comportement normal
  d'une nuit. Comparée aux autres nuits, elle ne sort plus.
- **Une sélection trop serrée reste lisible** : au sommet seul d'un pic, les
  motifs de l'incident passent de ×20 à ×295, donc ils restent en tête même
  avec les épaules de l'incident dans la référence.

Le plancher du groupe « absents » porte sur le **nombre attendu dans la zone**,
jamais sur le nombre d'occurrences ailleurs. Trois mille occurrences réparties
sur une semaine n'annoncent rien pour vingt minutes de nuit : avec un plancher
par nombre, une nuit parfaitement normale remontait trente-huit faux absents.

Un seul groupe est déplié, les autres tiennent sur une ligne : la comparaison
doit se lire plus vite que la liste complète, pas plus lentement. Un clic sur un
motif ramène au journal filtré dessus, comme ailleurs.

Deux réponses valent un résultat et s'affichent comme telles, pas comme une
liste vide : **« même mélange, en plus dense »** quand aucun motif n'est propre à
la zone, ce qui désigne une surcharge et non un nouveau comportement, et **« le
reste du fichier est trop mince »** quand la sélection couvre presque tout le
fichier et qu'il ne reste rien à quoi la comparer.

Reste un conseil, moins impérieux depuis que la référence est un rythme :
**mieux vaut brosser l'incident en entier que son seul sommet**. Une zone
réduite à la tranche la plus haute laisse les épaules de l'incident dans la
référence, donc ses motifs cessent d'être « seulement ici » et basculent en
« sur-représentés ». Ils y arrivent très haut (×295 sur le fichier de mesure),
donc rien n'est perdu, mais le groupe le plus direct se vide.

Les filtres de niveau et la recherche restent appliqués **des deux côtés** ;
seule la période est inversée. Sans cela, avec un filtre ERROR actif, le reste
du fichier ramènerait tous les INFO et noierait la comparaison. Les lignes sans
horodatage ne participent à aucun des deux côtés.

### Les zones à surveiller (expérimental)

Sous « Volume dans le temps », une ligne discrète annonce les zones que ViewLog
juge dignes d'un coup d'œil. Un clic les dessine **en pointillés** sur le graphe
et les décrit ; un clic sur l'une d'elles ouvre la période, la vue Motifs et la
comparaison, d'un seul geste.

**Rien ne s'affiche avant ce clic**, et sans zone détectée la ligne n'apparaît pas
du tout. C'est volontaire : une heuristique qui peut se tromper n'a pas sa place
en évidence sur le tableau de bord, parce que ce qu'on voit sans l'avoir demandé,
on le prend pour un fait. Le statut expérimental est donc écrit sur le bouton
d'accès et rappelé sous la liste.

Ce qui est détecté est le **taux d'erreur**, jamais le volume : un pic de volume,
c'est du trafic. Cinq pauses café d'une semaine de bureau ne déclenchent rien.

Une zone n'est pas annoncée parce qu'elle est haute, mais **parce que la
comparaison y a trouvé quelque chose** : un pic se voit déjà sur le graphe, ce qui
ne se voit pas, c'est s'il contient quelque chose d'atypique. Chaque zone est donc
comparée au rythme habituel avant d'être décrite, et la ligne annonce la
trouvaille. Une zone où rien ne ressort le dit aussi (« même mélange, en plus
dense »), ce qui est un diagnostic de surcharge et pas un échec.

Trois zones au maximum, classées, jamais une liste qui défile.

Détails de la méthode et de ses limites connues dans `lib/peaks.js` : ce qui a été
essayé et écarté y est gardé, parce que les deux approches évidentes (découper en
tranches, mesurer la densité entre erreurs voisines) échouent chacune pour une
raison qu'il serait coûteux de redécouvrir.

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

## Page « cas d'usage »

`/cas-usage` pose quatre situations concrètes, formulées comme l'utilisateur se
les pose, et donne le geste qui y répond. La valeur de ViewLog est en effet
**invisible sur une capture d'écran** : elle est dans le geste, pas dans un
tableau de logs que tout le monde a déjà vu.

Chaque cas se déplie sur un exposé du problème, ce que l'outil apporte, et **les
fonctionnalités accessoires qu'on croise au passage**, ce qui donne à la page son
second rôle : servir de mode d'emploi, là où la FAQ n'explique que la
confidentialité.

Chaque cas est illustré par une **démonstration animée**. Ce n'est pas un
enregistrement d'écran mais une reconstruction en SVG, pour trois raisons : un
enregistrement montrerait de vrais logs, ce qui est intenable ici ; les libellés
d'un GIF ne sont pas traduisibles, alors que toutes les versions sortent du même
générateur (`web/scripts/gen-demo-svg.mjs`) ; et le fichier pèse 6 Ko compressé au
lieu de plusieurs Mo, en restant net à toutes les tailles. Le mouvement respecte
`prefers-reduced-motion` en se figeant sur l'image du résultat.

**Deux cas, et deux gestes distincts**, pour ne pas raconter deux fois la même
chose :

- **Le pic** vend la comparaison d'une zone au reste du fichier.
- **L'échec signalé par un utilisateur** vend le resserrage de la fenêtre, puis le
  passage du motif à ses occurrences. Il n'y a pas de pic : la cause tient en trois
  lignes au milieu de milliers, et le graphique ne montre qu'un frémissement. La
  démonstration resserre la période à quelques minutes, ce qui rend la liste des
  motifs assez courte pour qu'un motif à trois occurrences s'y voie, puis clique ce
  motif pour ouvrir ses trois lignes, où le paramètre du gabarit laisse place à sa
  vraie valeur.

Le nombre de démonstrations reste volontairement petit : une reconstruction peut
vieillir en silence quand l'interface bouge, et une démonstration fausse est pire
que pas de démonstration.

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
