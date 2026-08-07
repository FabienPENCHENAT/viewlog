// Agrégats calculés à partir des entrées parsées : totaux par niveau, plage
// temporelle, et série temporelle (buckets) pour le graphe.
//
// UNE SEULE IMPLÉMENTATION, DEUX ADAPTATEURS. Le calcul ne connaît ni les objets
// d'entrée ni les tableaux typés : il demande un nombre d'entrées et deux
// accesseurs, `timeAt(i)` et `levelAt(i)`. C'est ce qui permet au modèle
// colonnaire (`parser/columnar.js`) et au modèle objet de cohabiter le temps de
// la migration **sans deux calculs qui divergent en silence** : une correction
// ici vaut pour les deux.
//
// Côté colonnaire, `timeAt` lit un Float64Array et `levelAt` un Uint8Array :
// aucune chaîne n'est fabriquée, donc les compteurs d'un fichier de deux
// millions de lignes se calculent en quelques millisecondes.
import { LEVELS } from "./shared.js";

const BUCKETS = 48;

/**
 * @param {object} src
 * @param {number} src.count nombre d'entrées
 * @param {(i:number) => number} src.timeAt horodatage en ms, `NaN` si absent
 * @param {(i:number) => string} src.levelAt niveau canonique
 */
export function buildStatsFrom({ count, timeAt, levelAt }) {
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, 0]));

  // Min et max en un passage. La version précédente empilait TOUS les
  // horodatages dans un tableau puis le triait pour n'en lire que les deux
  // bouts : sur deux millions de lignes, seize mégaoctets et un tri pour deux
  // valeurs.
  let min = Infinity;
  let max = -Infinity;
  let dated = 0;

  for (let i = 0; i < count; i++) {
    const level = levelAt(i);
    byLevel[level] = (byLevel[level] || 0) + 1;
    const t = timeAt(i);
    if (Number.isNaN(t)) continue;
    dated++;
    if (t < min) min = t;
    if (t > max) max = t;
  }

  let timeSpan = null;
  let timeline = [];

  if (dated > 0) {
    timeSpan = { start: new Date(min).toISOString(), end: new Date(max).toISOString() };

    const span = Math.max(max - min, 1000);
    const bucketMs = Math.max(1000, Math.ceil(span / BUCKETS));
    const map = new Map();

    for (let i = 0; i < count; i++) {
      const t = timeAt(i);
      if (Number.isNaN(t)) continue;
      const bucket = Math.floor((t - min) / bucketMs) * bucketMs + min;
      let b = map.get(bucket);
      if (!b) {
        b = { t: new Date(bucket).toISOString(), total: 0, ERROR: 0, WARN: 0 };
        map.set(bucket, b);
      }
      b.total += 1;
      const level = levelAt(i);
      if (level === "ERROR" || level === "FATAL") b.ERROR += 1;
      if (level === "WARN") b.WARN += 1;
    }
    timeline = [...map.values()].sort((a, b) => new Date(a.t) - new Date(b.t));
  }

  return {
    total: count,
    byLevel,
    errorCount: byLevel.ERROR + byLevel.FATAL,
    warnCount: byLevel.WARN,
    timeSpan,
    timeline,
  };
}

// Adaptateur du modèle objet, celui du parseur texte et du parseur CSV.
export function buildStats(entries) {
  return buildStatsFrom({
    count: entries.length,
    timeAt: (i) => (entries[i].ts ? Date.parse(entries[i].ts) : NaN),
    levelAt: (i) => entries[i].level,
  });
}

// Adaptateur du modèle colonnaire : les colonnes sont lues directement, sans
// passer par un objet d'entrée.
export function buildStatsFromStore(store) {
  return buildStatsFrom({
    count: store.count,
    timeAt: store.time,
    levelAt: store.level,
  });
}
