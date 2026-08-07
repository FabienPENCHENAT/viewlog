// Comparaison des motifs d'une zone avec le reste du fichier.
//
// La vue Motifs seule ne répond pas à « qu'est-ce qui se passe ICI ? » : elle
// trie par nombre d'occurrences, donc un pic multiplie tout par le même facteur
// et l'ordre ne bouge pas. Le bruit déjà présent reste en tête, et la cause,
// souvent peu fréquente mais absente partout ailleurs, reste invisible.
//
// D'où le principe : on compare des TAUX, pas des comptes. Un motif à 5 % des
// lignes dedans et 5 % dehors est du bruit même s'il passe de 12 à 3 400
// occurrences ; un motif à 3 % dedans et 0 % dehors est le signal.
//
// LA RÉFÉRENCE EST UN RYTHME, PAS UN TOTAL. C'est le point le plus important du
// fichier. Le taux « ailleurs » n'est pas le total du reste divisé par ses
// lignes : c'est la MOYENNE des taux mesurés sur des fenêtres de la même durée
// que la zone. Autrement dit, « combien de place ce motif prend-il d'habitude
// sur une zone équivalente ». Trois conséquences, toutes mesurées sur un vrai
// fichier de sept jours contenant deux incidents connus :
//
//  1. Un SECOND pic ailleurs cesse de polluer la référence. Il ne pèse plus que
//     deux fenêtres sur cent trente-cinq au lieu de ses milliers de lignes. Sur
//     le fichier de mesure, l'incident remontait à ×9,2 avec un taux global, et
//     à ×39 avec le rythme. Aucun détecteur n'est nécessaire pour ça : un pic
//     qu'on n'a pas su repérer est amorti quand même.
//  2. Le rythme du fichier cesse de créer de faux positifs. Une nuit ne contient
//     que de la télémétrie ; comparée au total du fichier, cette télémétrie
//     sortait « sur-représentée » (×9,4) alors que c'est le comportement normal
//     d'une nuit. Comparée aux autres fenêtres, elle ne sort plus.
//  3. Une sélection réduite au sommet d'un pic reste lisible : les motifs de
//     l'incident passent de ×20 à ×295, donc ils restent en tête même quand les
//     épaules du pic sont dans la référence.
//
// La MOYENNE, et pas la médiane. Contre-intuitif, et vérifié : avec des fenêtres
// de la durée de la zone, la fenêtre médiane d'un fichier de sept jours est une
// fenêtre de nuit où presque tout est à zéro. La médiane des taux vaut donc zéro
// pour presque tous les motifs, et presque tout devient « seulement ici ». Sur
// le fichier de mesure : dix faux exclusifs, jusqu'à `Selection: hot_chocolate`.
// Une moyenne rognée (écarter le décile haut de chaque motif) est pire encore.

import { firstLine, patternize, keyOf, groupPatterns } from "./patterns.js";

// Occurrences minimales dans la zone pour qu'un motif présent des deux côtés
// soit déclaré sur-représenté. Sans ce plancher, la longue traîne de lignes
// uniques d'un gros fichier monte en tête avec un rapport énorme calculé sur
// deux ou trois lignes, et le haut de la liste devient une poubelle.
export const MIN_COUNT = 3;

// Un motif présent des deux côtés fait partie du comportement normal : il faut
// des preuves avant de déranger avec lui. Le rapport porte sur la PART des
// lignes et pas sur le nombre, donc un motif qui grossit au même rythme que le
// reste de la zone garde sa part et ne remonte jamais, quels que soient les
// chiffres. C'est le pic d'utilisation, écarté par construction.
//
// Réglé sur un vrai fichier (pic de 90 min dans 73 h de logs), et non au doigt
// mouillé. Le facteur 5 essayé d'abord était trop haut : il gardait un warning
// vu 14 fois (×5,4) et écartait un `Function exited with runtime exit error`
// vu 267 fois (×2,9), qui était l'incident. Un motif déjà fréquent partout ne
// PEUT PAS atteindre un gros rapport, alors que sa hausse est la plus parlante.
export const MIN_RATIO = 3;

// Plancher du groupe « absent ici », et il porte sur ce qu'on ATTENDAIT dans la
// zone, jamais sur le nombre d'occurrences ailleurs. La différence n'est pas
// cosmétique : trois mille occurrences réparties sur une semaine n'annoncent
// rien pour vingt minutes de nuit, et le plancher par nombre remontait donc
// trente-huit « absents » sur une nuit parfaitement normale. Avec le nombre
// attendu, une zone normale tombe à zéro absent tout en gardant les douze
// vrais d'un incident, où la machine cesse effectivement de servir.
export const MIN_EXPECTED = 10;

// Le complément doit peser assez pour servir de référence. Si la sélection
// couvre presque tout le fichier, « le reste » ne dit plus rien : mieux vaut
// l'annoncer que sortir une liste que rien ne soutient.
const MIN_OUTSIDE = 50;

// En dessous, une moyenne de taux par fenêtre ne veut rien dire (une sélection
// qui couvre le tiers du fichier ne laisse que deux fenêtres autour). On
// retombe alors sur le taux global, qui reste honnête à cette échelle.
const MIN_WINDOWS = 4;

// Sentinelle pour une entrée sans horodatage : elle n'appartient à aucune
// fenêtre. Un index de fenêtre réel peut être négatif (avant la zone), donc -1
// ne ferait pas l'affaire.
const NO_WINDOW = 2147483647;

function tsMs(entry) {
  return entry.ts ? new Date(entry.ts).getTime() : null;
}

function index(entries, templateAt) {
  const map = new Map();
  for (const g of groupPatterns(entries, templateAt)) map.set(g.key, g);
  return map;
}

/**
 * Le rythme habituel hors de la zone : pour chaque motif, la moyenne de son
 * taux sur des fenêtres de la durée de la zone.
 */
function buildReference(outside, zone, templateAt) {
  const total = outside.length;
  const span = zone && zone.to > zone.from ? zone.to - zone.from : 0;

  // Première passe : le nombre de lignes de chaque fenêtre. On mémorise l'index
  // de fenêtre au passage pour ne pas re-parser les dates ensuite.
  let slot = null;
  let lines = null;
  let windows = 0;
  if (span > 0) {
    slot = new Int32Array(total);
    lines = new Map();
    for (let i = 0; i < total; i++) {
      const ms = tsMs(outside[i]);
      const w = ms === null ? NO_WINDOW : Math.floor((ms - zone.from) / span);
      slot[i] = w;
      if (w !== NO_WINDOW) lines.set(w, (lines.get(w) || 0) + 1);
    }
    windows = lines.size;
  }
  const pooled = windows < MIN_WINDOWS;

  // Seconde passe : les motifs, avec la somme de leurs taux par fenêtre.
  const map = new Map();
  for (let i = 0; i < total; i++) {
    const e = outside[i];
    const example = firstLine(e.message || "");
    const template = templateAt ? templateAt(e, example) : patternize(example);
    const key = keyOf(e.level, template);
    let g = map.get(key);
    if (!g) {
      g = { key, level: e.level, template, example, count: 0, acc: 0 };
      map.set(key, g);
    }
    g.count += 1;
    if (!pooled) {
      const n = lines.get(slot[i]);
      if (n) g.acc += 1 / n;
    }
  }

  // Repli par motif : si toutes ses occurrences sont hors fenêtres (aucun
  // horodatage), on ne le déclare pas exclusif à tort, on le compare au global.
  const rate = pooled
    ? (g) => g.count / total
    : (g) => g.acc / windows || g.count / total;

  return { map, rate, pooled, windows, total };
}

/**
 * @param {Array} inside  entrées de la zone (déjà filtrées : niveaux, recherche)
 * @param {Array} outside entrées du reste du fichier (mêmes filtres, période inversée)
 * @param {{from:number,to:number}} [zone] bornes de la zone, en ms : elles donnent
 *   la durée des fenêtres de référence. Sans elles, on retombe sur le taux global.
 * @param {(entry: object, firstLine: string) => string} [templateAt] gabarit déjà
 *   calculé. À fournir quand plusieurs zones du MÊME fichier sont comparées :
 *   sinon la normalisation des messages est refaite intégralement pour chacune.
 * @returns {{
 *   degenerate: boolean, insideTotal: number, outsideTotal: number,
 *   windows: number, pooled: boolean,
 *   onlyHere: Array, over: Array, absent: Array
 * }}
 */
export function comparePatterns(inside, outside, zone, templateAt) {
  const insideTotal = inside.length;
  const outsideTotal = outside.length;

  if (outsideTotal < MIN_OUTSIDE) {
    return {
      degenerate: true, insideTotal, outsideTotal,
      windows: 0, pooled: true,
      onlyHere: [], over: [], absent: [],
    };
  }

  const here = index(inside, templateAt);
  const ref = buildReference(outside, zone, templateAt);

  const onlyHere = [];
  const over = [];

  for (const g of here.values()) {
    const other = ref.map.get(g.key);

    // Absent du reste du fichier : c'est le cœur de la comparaison. Pas de
    // plancher ici, une seule occurrence propre à la zone peut être la cause,
    // et c'est justement ce qu'aucune autre vue ne sait remonter.
    if (!other) {
      onlyHere.push({ ...g, rateHere: g.count / insideTotal, rateThere: 0 });
      continue;
    }

    if (g.count < MIN_COUNT) continue;

    const rateHere = g.count / insideTotal;
    const rateThere = ref.rate(other);
    const ratio = rateHere / rateThere;
    if (ratio < MIN_RATIO) continue; // même densité des deux côtés : du bruit

    over.push({ ...g, countThere: other.count, rateHere, rateThere, ratio });
  }

  // Le motif qui s'arrête : un manque ne se voit pas en défilant, par
  // construction. On ne le remonte que si on en attendait vraiment ici.
  const absent = [];
  for (const g of ref.map.values()) {
    if (here.has(g.key)) continue;
    const rateThere = ref.rate(g);
    const expected = rateThere * insideTotal;
    if (expected < MIN_EXPECTED) continue;
    absent.push({
      ...g, count: 0, countThere: g.count,
      expected, rateHere: 0, rateThere,
    });
  }

  // « Seulement ici » se trie par nombre et non par taux : à l'intérieur d'un
  // même groupe, tous ont un taux extérieur nul, donc le rapport ne classe
  // rien. Les rares descendent en bas de leur groupe sans disparaître.
  onlyHere.sort((a, b) => b.count - a.count);
  over.sort((a, b) => b.ratio - a.ratio);
  // Les absents se classent par l'ampleur du manque, pas par leur nombre
  // ailleurs : c'est la question à laquelle le groupe répond.
  absent.sort((a, b) => b.expected - a.expected);

  return {
    degenerate: false, insideTotal, outsideTotal,
    windows: ref.windows, pooled: ref.pooled,
    onlyHere, over, absent,
  };
}

// Un rapport s'affiche court : deux chiffres significatifs suffisent à décider,
// et « ×12,7 » n'aide pas plus que « ×13 ».
export function formatRatio(ratio) {
  return ratio >= 10 ? String(Math.round(ratio)) : ratio.toFixed(1).replace(/\.0$/, "");
}

// Taux affiché en pourcentage, avec assez de décimales pour que les petits
// taux ne s'écrasent pas tous à « 0 % ».
//
// Le format vient d'`Intl` et non d'une concaténation : le français veut une
// espace insécable fine avant le signe, l'anglais n'en veut pas du tout, et
// coller « %` à la main donnait « 5.7 % » en anglais.
export function formatRate(rate, locale) {
  const pct = rate * 100;
  const digits = pct >= 10 ? 0 : pct >= 1 ? 1 : 2;
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rate);
}
