// Détection des zones à surveiller dans un fichier de logs. EXPÉRIMENTAL.
//
// Le mot compte : ce module propose des candidates, il ne rend pas un verdict.
// Il n'est réglé que sur un fichier fabriqué dont on connaît la vérité terrain
// (`scripts/gen-sample-log.mjs`), et son fond d'erreurs y est très pauvre. Il
// est donc exposé derrière un geste explicite, et l'écran le dit.
//
// ------------------------------------------------------------------------
// DEUX SIGNAUX, PAS UN : le taux d'erreur, et le volume confirmé par le contenu
//
// 1. LE TAUX D'ERREUR. Chercher « une augmentation du nombre de messages » est
//    le premier réflexe et c'est le mauvais : dans un fichier de bureau, le
//    volume monte cinq fois par semaine à la pause café. Un pic de volume, c'est
//    du trafic. On raisonne donc sur la PART des lignes qui sont des erreurs.
//    Mesuré : les cinq pauses café du fichier type ne déclenchent jamais.
//
// 2. LE VOLUME, MAIS JAMAIS SEUL. Le point aveugle du signal précédent : une
//    application qui range ses incidents en WARN (ou en INFO) produit un pic
//    ÉNORME dont le taux d'erreur ne bouge pas, voire BAISSE, parce que le pic
//    dilue le fond d'erreurs habituel. Vu sur un fichier réel : un pic à environ
//    2 900 lignes par tranche contre une cinquantaine d'habitude, dont 27 %
//    d'erreurs seulement, quand le reste du fichier en compte une part bien plus
//    forte. Aucun seuil sur le taux ne rattrape ça, et c'est précisément le
//    moment où l'utilisateur a besoin d'aide.
//
//    Ce qui distingue ce pic d'une pause café n'est pas sa taille, c'est son
//    CONTENU : la pause café dit les mêmes choses en plus grand nombre, un
//    incident dit des choses qu'on ne lit nulle part ailleurs. Une zone de
//    volume n'est donc proposée que si elle contient des motifs ABSENTS du reste
//    du fichier, en quantité. Le volume énumère les candidates, le contenu
//    tranche. Mesuré sur le fichier type : les pauses café restent muettes.
//
// ------------------------------------------------------------------------
// DEUX APPROCHES QUI NE MARCHENT PAS, et pourquoi (elles ont été codées)
//
//  1. Découper le temps en tranches et garder celles qui dépassent
//     médiane + k·MAD. Ça s'effondre parce que les erreurs sont RARES : sur
//     1 440 tranches du fichier type, 66 seulement contiennent une erreur. La
//     médiane d'une série presque nulle vaut zéro, le MAD aussi, et le seuil
//     devient « plus de zéro erreur ». Mesuré identique à 48, 336 et 1 440
//     tranches : aucune largeur ne sauve la méthode.
//
//  2. Mesurer la densité locale entre erreurs voisines (k plus proches), sans
//     aucune tranche. Échoue pour la raison inverse : 97 % des erreurs du
//     fichier sont dans les deux incidents, donc la densité MÉDIANE est celle
//     d'un incident. Chaque incident devient sa propre norme et se masque
//     lui-même. Mesuré : zéro zone trouvée à k=20 et k=50.
//
// ------------------------------------------------------------------------
// CE QUI MARCHE : le scan statistic de Kulldorff
//
// Méthode publiée, utilisée en épidémiologie pour repérer un foyer épidémique.
// Le problème est le même : trouver une région où un événement rare est
// anormalement concentré, sans savoir à l'avance ni où elle est ni quelle
// taille elle a.
//
// Pour une fenêtre, on compare DEUX explications du fichier : soit le taux
// d'erreur est le même partout, soit cette fenêtre a son propre taux. Le score
// est l'écart de vraisemblance entre les deux, donc grand quand la fenêtre est
// difficile à expliquer autrement que par un incident.
//
// Le quadrillage ne sert QU'À ÉNUMÉRER des candidates et à les additionner vite
// par sommes cumulées. Aucun seuil ne s'appuie sur lui, donc la rareté des
// erreurs ne le fait plus dégénérer, et le résultat est identique de 256 à
// 8 192 tranches (mesuré).
//
// La même méthode sert aux deux signaux, seule la population change : pour le
// taux d'erreur, on compare des erreurs à des LIGNES (loi de Bernoulli) ; pour
// le volume, on compare des lignes à du TEMPS (loi de Poisson). Le second n'a
// pas de seuil de score utile, et c'est assumé : un pic de trafic banal marque
// des milliers de nats, parce que des lignes il y en a beaucoup. Le score y sert
// à CLASSER les candidates, la confirmation par le contenu à les écarter.

import { patternKey, keyOf, patternize, firstLine } from "./patterns.js";

// Nombre d'erreurs minimal dans une zone. Silence par défaut : en dessous, on
// ne dérange pas, quelle que soit la statistique.
export const MIN_ERRORS = 12;

// Score minimal, en nats. Sur le fichier type la séparation est énorme (844 et
// 989 contre rien du tout sur les jours normaux), donc le résultat est le même
// de 10 à 160. Ce seuil n'est donc PAS éprouvé : c'est lui qu'il faudra régler
// sur un vrai fichier au fond d'erreurs bavard.
export const MIN_SCORE = 20;

// Le taux d'erreur de la zone doit au moins tripler celui du reste. Garde-fou
// grossier mais utile : il écarte d'emblée les fenêtres dont la statistique
// serait significative par le seul volume.
export const MIN_LIFT = 3;

// Trois zones au maximum. Douze zones proposées recréeraient le bruit qu'on
// cherche à supprimer.
export const MAX_ZONES = 3;

// Largeur maximale d'une candidate, en fraction de la durée du fichier. Sans ce
// plafond, une fenêtre qui avale DEUX incidents plus le calme entre eux marque
// plus de points que chacun d'eux, parce que le score grandit avec la quantité
// de preuves. Mesuré : une seule zone de 1 239 min au lieu de deux. Rogner
// après coup ne rattrape rien, puisque rogner fait BAISSER le score.
//
// L'exprimer en fraction et non en nombre de tranches est ce qui rend le
// résultat indépendant de la finesse du quadrillage.
//
// Conséquence assumée : un extrait de six heures autour d'un incident de
// soixante-quinze minutes n'est pas détecté. Défendable, un incident qui pèse
// un huitième du fichier se voit sur le graphe sans aide.
const MAX_SPAN_FRACTION = 1 / 8;

// ----------------------------------------------------- seuils du signal volume

// Le débit de la zone doit au moins quadrupler celui du reste. Plus haut que le
// garde-fou du taux d'erreur, et volontairement : un pic de trafic ordinaire
// triple sans rien avoir à dire (mesuré, les dix pauses café du fichier type
// sont à ×3,2 du reste de leur journée), alors qu'un incident qui inonde le
// fichier se compte en dizaines.
//
// Ce garde-fou ne fait qu'écrémer, il ne tranche pas, et il ne faut pas lui
// demander plus : mesurée contre sa nuit, une journée de bureau ordinaire est à
// ×11, très au-dessus de ce seuil. Ce qui la fait taire, c'est le contenu.
export const VOLUME_MIN_LIFT = 4;

// Lignes minimales dans la zone. Un « pic » de quarante lignes ne mérite pas
// qu'on dérange, même s'il multiplie par vingt le débit d'un fichier calme.
export const VOLUME_MIN_LINES = 200;

// La confirmation par le contenu, le seuil qui compte vraiment.
//
// Un motif est dit exclusif quand il n'apparaît NULLE PART ailleurs dans le
// fichier. On en exige plusieurs, et surtout qu'ils pèsent : une poignée de
// lignes uniques se trouve dans n'importe quelle tranche d'un gros fichier
// (identifiants non masqués, traces tronquées), donc compter les motifs ne
// suffit pas, il faut la PART des lignes de la zone qu'ils occupent.
//
// Mesuré sur le fichier type : les deux incidents connus couvrent 28,6 % et
// 40,1 % de leurs lignes avec 3 motifs exclusifs chacun, quand les cinq pauses
// café, les cinq creux d'après-midi et les cinq nuits sont TOUS à 0,00 % et zéro
// motif. La séparation est totale, donc n'importe quel seuil entre les deux
// donne le même résultat : celui-ci n'est pas éprouvé par le bas, il est posé
// bas exprès. Un fichier synthétique a des fenêtres normales parfaitement
// propres, un vrai fichier non, et c'est là qu'il faudra le remesurer.
export const VOLUME_MIN_EXCLUSIVE_SHARE = 0.05;

// Un motif exclusif isolé ne fait pas une zone : il faut qu'il se répète, sinon
// c'est une ligne unique et pas un comportement.
export const VOLUME_MIN_EXCLUSIVE_COUNT = 5;

const TARGET_BINS = 2048;
const MIN_BIN_MS = 1000;
const MIN_LINES_IN = 20;
const MIN_LINES_OUT = 20;

function isError(level) {
  return level === "ERROR" || level === "FATAL";
}

/**
 * Détection à partir d'ACCESSEURS et non d'un tableau d'entrées, pour que le
 * modèle objet et le modèle colonnaire partagent la même détection. Le calcul ne
 * fabrique aucune chaîne : `keyAt` n'est appelé que pour confirmer une zone de
 * volume, donc jamais dans le cas courant où il n'y a aucune candidate.
 *
 * @param {object} src
 * @param {number} src.count nombre d'entrées
 * @param {(i:number) => number} src.timeAt horodatage en ms, `NaN` si absent
 * @param {(i:number) => string} src.levelAt niveau canonique
 * @param {(i:number) => string} src.keyAt clé de motif, appelée à la demande
 * @returns {{kind:"rate"|"volume",from:number,to:number,errors:number,lines:number,
 *   rate:number,rateOutside:number,lift:number,perMin:number,perMinOutside:number,
 *   volumeLift:number,exclusive:number,score:number}[]}
 *   zones classées du plus tôt au plus tard, au maximum MAX_ZONES
 */
export function findPeaksFrom({ count, timeAt, levelAt, keyAt }) {
  // Une seule passe : on paye l'analyse des dates une fois, pas deux. On garde
  // l'INDEX des entrées datées à côté de leurs dates, parce que la confirmation
  // par le contenu devra relire ces mêmes lignes sans re-analyser une seule date.
  const times = [];
  const rows = [];
  const errorTimes = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < count; i++) {
    const t = timeAt(i);
    if (Number.isNaN(t)) continue;
    times.push(t);
    rows.push(i);
    if (isError(levelAt(i))) errorTimes.push(t);
    if (t < lo) lo = t;
    if (t > hi) hi = t;
  }
  if (!times.length || !(hi > lo)) return [];

  const binMs = Math.max(MIN_BIN_MS, (hi - lo) / TARGET_BINS);
  const bins = Math.max(8, Math.ceil((hi - lo) / binMs));
  // Sommes cumulées : le compte de n'importe quelle fenêtre devient une
  // soustraction, donc énumérer des milliers de candidates ne coûte rien.
  const lines = new Float64Array(bins + 1);
  const errors = new Float64Array(bins + 1);
  const slot = (t) => Math.min(bins - 1, Math.floor((t - lo) / binMs));
  for (const t of times) lines[slot(t) + 1] += 1;
  for (const t of errorTimes) errors[slot(t) + 1] += 1;
  for (let i = 1; i <= bins; i++) {
    lines[i] += lines[i - 1];
    errors[i] += errors[i - 1];
  }

  const totalLines = lines[bins];
  const totalErrors = errors[bins];
  const rate = totalErrors / totalLines;

  // Un côté de la vraisemblance : « ce côté a son propre taux ».
  const side = (n, len) => {
    if (n <= 0 || len <= 0) return 0;
    const q = n / len;
    let s = n * Math.log(q / rate);
    if (len > n) s += (len - n) * Math.log((1 - q) / (1 - rate));
    return s;
  };

  // Le même écart de vraisemblance, mais où la population est le TEMPS : la
  // référence n'est plus une part de lignes, c'est un débit. Les termes
  // linéaires s'annulent puisque les deux côtés totalisent tout le fichier, il
  // ne reste que ce log de rapport.
  const density = totalLines / bins;
  const densitySide = (n, len) => (n > 0 && len > 0 ? n * Math.log(n / len / density) : 0);

  // Les chiffres d'une fenêtre, sans jugement : sert aussi à réévaluer une zone
  // après fusion, pour que les nombres affichés décrivent la zone finale. Les
  // deux familles de chiffres sont calculées pour toute zone, quel que soit le
  // signal qui l'a trouvée : une zone d'erreurs a un débit, une zone de volume a
  // un taux d'erreur, et les deux méritent d'être lisibles.
  function measure(a, b) {
    const len = lines[b] - lines[a];
    const n = errors[b] - errors[a];
    const lenOut = totalLines - len;
    const nOut = totalErrors - n;
    const inside = len > 0 ? n / len : 0;
    const outside = lenOut > 0 ? nOut / lenOut : 0;
    const spanMin = ((b - a) * binMs) / 60000;
    const spanOutMin = ((bins - (b - a)) * binMs) / 60000;
    const perMin = spanMin > 0 ? len / spanMin : 0;
    const perMinOutside = spanOutMin > 0 ? lenOut / spanOutMin : 0;
    return {
      a, b, errors: n, lines: len,
      // Les deux taux bruts, et pas seulement leur rapport : un « ×8,7 » affiché
      // seul ne se devine pas, alors que « 29 % des lignes ici contre 3,3 %
      // ailleurs » se lit sans rien connaître du calcul.
      rate: inside,
      rateOutside: outside,
      lift: outside > 0 ? inside / outside : Infinity,
      perMin,
      perMinOutside,
      volumeLift: perMinOutside > 0 ? perMin / perMinOutside : Infinity,
      score: side(n, len) + side(nOut, lenOut),
      volumeScore: densitySide(len, b - a) + densitySide(lenOut, bins - (b - a)),
    };
  }

  const maxWidth = Math.max(1, Math.floor(bins * MAX_SPAN_FRACTION));

  // Énumération commune aux deux signaux : toutes les largeurs, les meilleures
  // qui ne se chevauchent pas, puis fusion des voisines. Seul `evaluate` change.
  function collect(evaluate) {
    const found = [];
    for (let width = 1; width <= maxWidth; width *= 2) {
      const step = Math.max(1, width >> 1);
      for (let a = 0; a + width <= bins; a += step) {
        const c = evaluate(a, a + width);
        if (c) found.push(c);
      }
    }
    if (!found.length) return [];

    // On en prend plus que nécessaire, parce que la fusion qui suit va en
    // recoller certaines.
    found.sort((x, y) => y.score - x.score);
    const picked = [];
    for (const c of found) {
      if (picked.some((k) => c.a < k.b && k.a < c.b)) continue;
      picked.push(c);
      if (picked.length === MAX_ZONES * 3) break;
    }

    // Fusion des zones contiguës, sans quoi UN incident se présente en DEUX :
    // les candidates étant énumérées à des largeurs qui doublent, le reliquat de
    // bord d'un incident forme une fenêtre voisine qui ne chevauche pas la
    // retenue et passe elle aussi le seuil. Mesuré : un incident isolé
    // ressortait en 2 zones, deux incidents en 3.
    //
    // La tolérance est relative à la plus petite des deux zones : un reliquat de
    // bord est collé à sa zone, alors que deux vrais incidents sont séparés par
    // des heures de calme.
    picked.sort((x, y) => x.a - y.a);
    const merged = [];
    for (const c of picked) {
      const last = merged[merged.length - 1];
      if (last) {
        const smallest = Math.min(last.b - last.a, c.b - c.a);
        const tolerance = Math.max(2, Math.floor(smallest * 0.25));
        if (c.a - last.b <= tolerance) {
          last.b = Math.max(last.b, c.b);
          continue;
        }
      }
      merged.push({ a: c.a, b: c.b });
    }
    return merged;
  }

  // ------------------------------------------------ signal 1 : le taux d'erreur

  const rateUsable = errorTimes.length >= MIN_ERRORS && rate > 0 && rate < 1;
  const rateZones = !rateUsable
    ? []
    : collect((a, b) => {
        const len = lines[b] - lines[a];
        const n = errors[b] - errors[a];
        const lenOut = totalLines - len;
        const nOut = totalErrors - n;
        if (n < MIN_ERRORS || len < MIN_LINES_IN || lenOut < MIN_LINES_OUT) return null;
        const inside = n / len;
        const outside = nOut / lenOut;
        // La référence est le RESTE, jamais le fichier entier. Sinon un incident
        // qui pèse un quart du fichier gonfle sa propre référence et se masque
        // lui-même : mesuré, samedi seul ne détectait rien. Même piège que la
        // médiane, une couche plus haut, et même correctif que pour la
        // comparaison de motifs.
        if (!(inside > outside) || inside < outside * MIN_LIFT) return null;
        const score = side(n, len) + side(nOut, lenOut);
        if (score < MIN_SCORE) return null;
        return { a, b, score };
      })
      .map((m) => ({ ...measure(m.a, m.b), kind: "rate", exclusive: 0 }));

  // ----------------------------------------------------- signal 2 : le volume

  const volumeCandidates = collect((a, b) => {
    const len = lines[b] - lines[a];
    const lenOut = totalLines - len;
    const span = b - a;
    const spanOut = bins - span;
    if (len < VOLUME_MIN_LINES || lenOut < MIN_LINES_OUT || spanOut <= 0) return null;
    const inside = len / span;
    const outside = lenOut / spanOut;
    if (!(inside > outside) || inside < outside * VOLUME_MIN_LIFT) return null;
    return { a, b, score: densitySide(len, span) + densitySide(lenOut, spanOut) };
  })
    // Une zone de volume qui recouvre déjà une zone d'erreurs n'apprend rien de
    // plus : le taux est le signal le plus spécifique des deux, il garde la main.
    .filter((m) => !rateZones.some((z) => m.a < z.b && z.a < m.b));

  // La confirmation par le contenu, faite ICI et pas à l'affichage : une zone
  // qu'on ne saurait pas expliquer ne doit pas être proposée du tout.
  const volumeZones = confirm(volumeCandidates)
    .map((m) => ({ ...measure(m.a, m.b), kind: "volume", exclusive: m.exclusive }))
    .sort((x, y) => y.volumeScore - x.volumeScore);

  /**
   * Ne garde que les fenêtres dont le contenu sort de l'ordinaire : au moins un
   * motif répété qu'on ne lit nulle part ailleurs dans le fichier, et assez de
   * lignes concernées pour que ça pèse.
   *
   * Un seul parcours du fichier quel que soit le nombre de candidates, et zéro
   * coût quand il n'y en a aucune, ce qui est le cas courant. Mesuré sur
   * 430 000 lignes : 53 ms sans candidate, 229 ms avec. C'est le prix de la
   * normalisation des messages, et il se paye dans le worker au parsing, pas au
   * clic.
   */
  function confirm(ranges) {
    if (!ranges.length) return [];
    const totals = new Map();
    const insides = ranges.map(() => new Map());
    for (let i = 0; i < times.length; i++) {
      const s = slot(times[i]);
      const key = keyAt(rows[i]);
      totals.set(key, (totals.get(key) || 0) + 1);
      for (let r = 0; r < ranges.length; r++) {
        if (s < ranges[r].a || s >= ranges[r].b) continue;
        const m = insides[r];
        m.set(key, (m.get(key) || 0) + 1);
      }
    }
    const out = [];
    for (let r = 0; r < ranges.length; r++) {
      let exclusiveLines = 0;
      let exclusive = 0;
      let total = 0;
      for (const [key, count] of insides[r]) {
        total += count;
        if (count < VOLUME_MIN_EXCLUSIVE_COUNT || totals.get(key) !== count) continue;
        exclusive += 1;
        exclusiveLines += count;
      }
      if (!exclusive || total <= 0) continue;
      if (exclusiveLines / total < VOLUME_MIN_EXCLUSIVE_SHARE) continue;
      out.push({ ...ranges[r], exclusive });
    }
    return out;
  }

  // ---------------------------------------------------------------- assemblage

  // Les zones d'erreurs d'abord : à nombre de places limité, une concentration
  // d'erreurs se défend mieux qu'une hausse de trafic, aussi grosse soit-elle.
  const kept = [
    ...rateZones.sort((x, y) => y.score - x.score),
    ...volumeZones,
  ].slice(0, MAX_ZONES);

  // Bornes recalées sur les vrais événements de la zone : une zone proposée doit
  // commencer et finir sur une ligne, pas sur un bord de quadrillage. Sur quoi
  // on recale dépend du signal : une zone d'erreurs se cale sur ses erreurs,
  // alors qu'une zone de volume se cale sur ses lignes, dont on ne sait
  // justement pas si le niveau veut dire quelque chose.
  errorTimes.sort((x, y) => x - y);
  const sortedTimes = times.slice().sort((x, y) => x - y);
  return kept
    .map((c) => {
      const rawFrom = lo + c.a * binMs;
      const rawTo = lo + c.b * binMs;
      const anchors = c.kind === "rate" ? errorTimes : sortedTimes;
      let from = rawTo;
      let to = rawFrom;
      for (const t of anchors) {
        if (t < rawFrom || t > rawTo) continue;
        if (t < from) from = t;
        if (t > to) to = t;
      }
      if (from > to) {
        from = rawFrom;
        to = rawTo;
      }
      // Compromis assumé : les bornes d'une zone d'erreurs tombent sur la
      // première et la dernière ERREUR, donc elles rognent légèrement les épaules
      // de l'incident. Les avertissements qui l'annoncent arrivent quelques
      // secondes avant, et une seule occurrence laissée dehors suffit à faire
      // perdre à un motif son statut de « seulement ici » : mesuré, 2 motifs
      // exclusifs au lieu de 3 sur le fichier type. Rendre une marge a été essayé
      // et écarté, parce que toute valeur défendable sur un fichier l'est mal sur
      // un autre (une marge d'une tranche vaut 5 min sur une semaine et avale
      // trop). Le motif perdu ressort de toute façon en « sur-représenté », avec
      // un rapport énorme.
      return {
        kind: c.kind,
        from, to,
        errors: c.errors, lines: c.lines,
        rate: c.rate, rateOutside: c.rateOutside, lift: c.lift,
        perMin: c.perMin, perMinOutside: c.perMinOutside, volumeLift: c.volumeLift,
        exclusive: c.exclusive,
        score: c.kind === "rate" ? c.score : c.volumeScore,
      };
    })
    .sort((x, y) => x.from - y.from);
}

// Adaptateur du modèle objet : le parseur texte et le parseur CSV.
export function findPeaks(entries) {
  return findPeaksFrom({
    count: entries.length,
    timeAt: (i) => {
      const ts = entries[i].ts;
      return ts ? new Date(ts).getTime() : NaN;
    },
    levelAt: (i) => entries[i].level,
    keyAt: (i) => patternKey(entries[i]),
  });
}

// Adaptateur du modèle colonnaire : l'horodatage et le niveau sont lus dans des
// tableaux typés, et le message n'est matérialisé que si une zone de volume doit
// être confirmée.
export function findPeaksFromStore(store) {
  return findPeaksFrom({
    count: store.count,
    timeAt: store.time,
    levelAt: store.level,
    keyAt: (i) => keyOf(store.level(i), patternize(firstLine(store.message(i) || ""))),
  });
}
