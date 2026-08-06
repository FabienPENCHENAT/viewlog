// Détection des zones à surveiller dans un fichier de logs. EXPÉRIMENTAL.
//
// Le mot compte : ce module propose des candidates, il ne rend pas un verdict.
// Il n'est réglé que sur un fichier fabriqué dont on connaît la vérité terrain
// (`scripts/gen-sample-log.mjs`), et son fond d'erreurs y est très pauvre. Il
// est donc exposé derrière un geste explicite, et l'écran le dit.
//
// ------------------------------------------------------------------------
// CE QU'ON DÉTECTE : le taux d'erreur, jamais le volume
//
// Chercher « une augmentation du nombre de messages » est le premier réflexe et
// c'est le mauvais : dans un fichier de bureau, le volume monte cinq fois par
// semaine à la pause café. Un pic de volume, c'est du trafic. On raisonne donc
// sur la PART des lignes qui sont des erreurs. Mesuré : les cinq pauses café du
// fichier type ne déclenchent jamais.
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

const TARGET_BINS = 2048;
const MIN_BIN_MS = 1000;
const MIN_LINES_IN = 20;
const MIN_LINES_OUT = 20;

function isError(level) {
  return level === "ERROR" || level === "FATAL";
}

/**
 * @param {Array} entries entrées parsées (avec `ts` et `level`)
 * @returns {{from:number,to:number,errors:number,lines:number,lift:number,score:number}[]}
 *   zones classées du plus tôt au plus tard, au maximum MAX_ZONES
 */
export function findPeaks(entries) {
  // Une seule passe : on paye l'analyse des dates une fois, pas deux.
  const times = [];
  const errorTimes = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (const e of entries) {
    if (!e.ts) continue;
    const t = new Date(e.ts).getTime();
    if (Number.isNaN(t)) continue;
    times.push(t);
    if (isError(e.level)) errorTimes.push(t);
    if (t < lo) lo = t;
    if (t > hi) hi = t;
  }
  if (errorTimes.length < MIN_ERRORS || !(hi > lo)) return [];

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
  if (!(rate > 0) || rate >= 1) return [];

  // Un côté de la vraisemblance : « ce côté a son propre taux ».
  const side = (n, len) => {
    if (n <= 0 || len <= 0) return 0;
    const q = n / len;
    let s = n * Math.log(q / rate);
    if (len > n) s += (len - n) * Math.log((1 - q) / (1 - rate));
    return s;
  };

  // Les chiffres d'une fenêtre, sans jugement : sert aussi à réévaluer une zone
  // après fusion, pour que les nombres affichés décrivent la zone finale.
  function measure(a, b) {
    const len = lines[b] - lines[a];
    const n = errors[b] - errors[a];
    const lenOut = totalLines - len;
    const nOut = totalErrors - n;
    const inside = len > 0 ? n / len : 0;
    const outside = lenOut > 0 ? nOut / lenOut : 0;
    return {
      a, b, errors: n, lines: len,
      // Les deux taux bruts, et pas seulement leur rapport : un « ×8,7 » affiché
      // seul ne se devine pas, alors que « 29 % des lignes ici contre 3,3 %
      // ailleurs » se lit sans rien connaître du calcul.
      rate: inside,
      rateOutside: outside,
      lift: outside > 0 ? inside / outside : Infinity,
      score: side(n, len) + side(nOut, lenOut),
      lenOut,
    };
  }

  function evaluate(a, b) {
    const len = lines[b] - lines[a];
    const n = errors[b] - errors[a];
    const lenOut = totalLines - len;
    const nOut = totalErrors - n;
    if (n < MIN_ERRORS || len < MIN_LINES_IN || lenOut < MIN_LINES_OUT) return null;
    const inside = n / len;
    const outside = nOut / lenOut;
    // La référence est le RESTE, jamais le fichier entier. Sinon un incident qui
    // pèse un quart du fichier gonfle sa propre référence et se masque lui-même :
    // mesuré, samedi seul ne détectait rien. Même piège que la médiane, une
    // couche plus haut, et même correctif que pour la comparaison de motifs.
    if (!(inside > outside) || inside < outside * MIN_LIFT) return null;
    const score = side(n, len) + side(nOut, lenOut);
    if (score < MIN_SCORE) return null;
    return { a, b, errors: n, lines: len, lift: inside / outside, score };
  }

  const maxWidth = Math.max(1, Math.floor(bins * MAX_SPAN_FRACTION));
  const found = [];
  for (let width = 1; width <= maxWidth; width *= 2) {
    const step = Math.max(1, width >> 1);
    for (let a = 0; a + width <= bins; a += step) {
      const c = evaluate(a, a + width);
      if (c) found.push(c);
    }
  }
  if (!found.length) return [];

  // Les meilleures qui ne se chevauchent pas. On en prend plus que nécessaire,
  // parce que la fusion qui suit va en recoller certaines.
  found.sort((x, y) => y.score - x.score);
  const picked = [];
  for (const c of found) {
    if (picked.some((k) => c.a < k.b && k.a < c.b)) continue;
    picked.push(c);
    if (picked.length === MAX_ZONES * 3) break;
  }

  // Fusion des zones contiguës, sans quoi UN incident se présente en DEUX : les
  // candidates étant énumérées à des largeurs qui doublent, le reliquat de bord
  // d'un incident forme une fenêtre voisine qui ne chevauche pas la retenue et
  // passe elle aussi le seuil. Mesuré : un incident isolé ressortait en 2 zones,
  // deux incidents en 3.
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

  const kept = merged
    .map((m) => measure(m.a, m.b))
    .sort((x, y) => y.score - x.score)
    .slice(0, MAX_ZONES);

  // Bornes recalées sur les vraies erreurs de la zone : une zone proposée doit
  // commencer et finir sur un événement, pas sur un bord de quadrillage.
  errorTimes.sort((x, y) => x - y);
  return kept
    .map((c) => {
      const rawFrom = lo + c.a * binMs;
      const rawTo = lo + c.b * binMs;
      let from = rawTo;
      let to = rawFrom;
      for (const t of errorTimes) {
        if (t < rawFrom || t > rawTo) continue;
        if (t < from) from = t;
        if (t > to) to = t;
      }
      if (from > to) {
        from = rawFrom;
        to = rawTo;
      }
      // Compromis assumé : les bornes tombent sur la première et la dernière
      // ERREUR, donc elles rognent légèrement les épaules de l'incident. Les
      // avertissements qui l'annoncent arrivent quelques secondes avant, et une
      // seule occurrence laissée dehors suffit à faire perdre à un motif son
      // statut de « seulement ici » : mesuré, 2 motifs exclusifs au lieu de 3
      // sur le fichier type. Rendre une marge a été essayé et écarté, parce que
      // toute valeur défendable sur un fichier l'est mal sur un autre (une marge
      // d'une tranche vaut 5 min sur une semaine et avale trop). Le motif perdu
      // ressort de toute façon en « sur-représenté », avec un rapport énorme.
      return {
        from, to,
        errors: c.errors, lines: c.lines,
        rate: c.rate, rateOutside: c.rateOutside,
        lift: c.lift, score: c.score,
      };
    })
    .sort((x, y) => x.from - y.from);
}
