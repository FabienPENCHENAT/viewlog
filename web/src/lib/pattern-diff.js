// Comparaison des motifs d'une zone avec ceux du reste du fichier.
//
// La vue Motifs seule ne répond pas à « qu'est-ce qui se passe ICI ? » : elle
// trie par nombre d'occurrences, donc un pic multiplie tout par le même facteur
// et l'ordre ne bouge pas. Le bruit déjà présent reste en tête, et la cause,
// souvent peu fréquente mais absente partout ailleurs, reste invisible.
//
// D'où le principe : on compare des TAUX, pas des comptes. Un motif à 5 % des
// lignes dedans et 5 % dehors est du bruit même s'il passe de 12 à 3 400
// occurrences ; un motif à 3 % dedans et 0 % dehors est le signal.

import { groupPatterns } from "./patterns.js";

// Occurrences minimales dans la zone pour qu'un motif présent des deux côtés
// soit déclaré sur-représenté. Sans ce plancher, la longue traîne de lignes
// uniques d'un gros fichier monte en tête avec un rapport énorme calculé sur
// deux ou trois lignes, et le haut de la liste devient une poubelle.
export const MIN_COUNT = 3;

// En dessous, « plus dense ici » ne se distingue pas du hasard.
export const MIN_RATIO = 2;

// Le complément doit peser assez pour servir de référence. Si la sélection
// couvre presque tout le fichier, « le reste » ne dit plus rien : mieux vaut
// l'annoncer que sortir une liste que rien ne soutient.
const MIN_OUTSIDE = 50;

function index(entries) {
  const map = new Map();
  for (const g of groupPatterns(entries)) map.set(g.key, g);
  return map;
}

/**
 * @param {Array} inside  entrées de la zone (déjà filtrées : niveaux, recherche)
 * @param {Array} outside entrées du reste du fichier (mêmes filtres, période inversée)
 * @returns {{
 *   degenerate: boolean, insideTotal: number, outsideTotal: number,
 *   onlyHere: Array, over: Array, absent: Array
 * }}
 */
export function comparePatterns(inside, outside) {
  const insideTotal = inside.length;
  const outsideTotal = outside.length;

  if (outsideTotal < MIN_OUTSIDE) {
    return { degenerate: true, insideTotal, outsideTotal, onlyHere: [], over: [], absent: [] };
  }

  const here = index(inside);
  const there = index(outside);

  const onlyHere = [];
  const over = [];

  for (const g of here.values()) {
    const other = there.get(g.key);

    // Absent du reste du fichier : c'est le cœur de la comparaison. Pas de
    // plancher ici, une seule occurrence propre à la zone peut être la cause,
    // et c'est justement ce qu'aucune autre vue ne sait remonter.
    if (!other) {
      onlyHere.push({ ...g, rateHere: g.count / insideTotal, rateThere: 0 });
      continue;
    }

    if (g.count < MIN_COUNT) continue;

    const rateHere = g.count / insideTotal;
    const rateThere = other.count / outsideTotal;
    const ratio = rateHere / rateThere;
    if (ratio < MIN_RATIO) continue; // même densité des deux côtés : du bruit

    over.push({ ...g, countThere: other.count, rateHere, rateThere, ratio });
  }

  // Le motif qui s'arrête : un manque ne se voit pas en défilant, par
  // construction. Le plancher porte sur le côté où il est présent.
  const absent = [];
  for (const g of there.values()) {
    if (here.has(g.key) || g.count < MIN_COUNT) continue;
    absent.push({ ...g, count: 0, countThere: g.count, rateHere: 0, rateThere: g.count / outsideTotal });
  }

  // « Seulement ici » se trie par nombre et non par taux : à l'intérieur d'un
  // même groupe, tous ont un taux extérieur nul, donc le rapport ne classe
  // rien. Les rares descendent en bas de leur groupe sans disparaître.
  onlyHere.sort((a, b) => b.count - a.count);
  over.sort((a, b) => b.ratio - a.ratio);
  absent.sort((a, b) => b.countThere - a.countThere);

  return { degenerate: false, insideTotal, outsideTotal, onlyHere, over, absent };
}

// Un rapport s'affiche court : deux chiffres significatifs suffisent à décider,
// et « ×12,7 » n'aide pas plus que « ×13 ».
export function formatRatio(ratio) {
  return ratio >= 10 ? String(Math.round(ratio)) : ratio.toFixed(1).replace(/\.0$/, "");
}

// Taux affiché en pourcentage, avec assez de décimales pour que les petits
// taux ne s'écrasent pas tous à « 0 % ».
export function formatRate(rate, locale) {
  const pct = rate * 100;
  const digits = pct >= 10 ? 0 : pct >= 1 ? 1 : 2;
  return `${pct.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`;
}
