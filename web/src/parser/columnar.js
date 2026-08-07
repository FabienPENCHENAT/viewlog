// Index colonnaire : le même log, sans un objet par ligne.
//
// POURQUOI. Mesuré sur un fichier de 200 Mo couvrant 24 h (1 975 356 lignes),
// le modèle actuel coûte 181 octets de mémoire par entrée, et la copie des
// entrées du worker vers l'UI coûte à elle seule 372 Mo, plus que les 170 Mo
// d'origine : pendant le parsing, V8 garde des tranches de la grande chaîne, et
// le passage du pont les transforme en chaînes autonomes. Résultat, environ
// 946 Mo pour un seul onglet ouvert, et le navigateur tue l'onglet.
//
// LE PRINCIPE. Les octets du fichier restent des octets. L'index tient dans six
// tableaux typés, soit 20 octets par entrée, et les chaînes ne sont fabriquées
// que pour les lignes réellement affichées. Deux conséquences :
//   - un fichier entier tient en mémoire (240 Mo mesurés pour les 1,97 M de
//     lignes, contre 946 Mo pour la moitié d'entre elles) ;
//   - les tableaux typés se TRANSFÈRENT entre threads sans copie, donc les
//     372 Mo de l'étape de transfert disparaissent.
//
// UNE ENTRÉE EST UNE PLAGE D'OCTETS CONTIGUË. C'est le point qui rend la chose
// possible sans changer la sémantique : les lignes de continuation (stack
// traces, messages multi-lignes) ne sont pas des entrées à part, elles étendent
// la plage de l'entrée en cours. Un index par ligne physique aurait cassé le
// rattachement, qui est justement ce que `parser/text.js` sait faire.
//
// CE FICHIER NE DOIT RIEN CHANGER AU COMPORTEMENT. Il reproduit `parseLog` à
// l'identique, y compris ses cas tordus (horodatage au milieu de la ligne,
// budget d'indentation, ligne vide au milieu d'une trace). L'équivalence est
// vérifiée hors navigateur par un script de comparaison qui diffe les
// compteurs, la plage temporelle et les motifs sur de vrais fichiers.
//
// Périmètre : le texte (.log / .txt). Le CSV garde le modèle actuel, parce que
// son tokenizer RECONSTRUIT le message à partir de colonnes : ce n'est pas une
// tranche du fichier, donc la plage d'octets ne suffit pas à le retrouver.

import { MAX_LINES, LEVELS, detectTimestamp, detectLevel } from "./shared.js";

const LF = 10;
const CR = 13;

const LEVEL_ID = new Map(LEVELS.map((name, i) => [name, i]));
const OTHER = LEVEL_ID.get("OTHER");

// Sentinelle « pas d'horodatage repéré » pour `tsStart`. Un horodatage assez
// loin dans une ligne pour dépasser un Uint16 n'existe pas en pratique, mais on
// ne veut pas d'un index faux : dans ce cas on retombe sur la détection à la
// volée, au moment d'afficher la ligne.
const NO_TS = 0xffff;

// Estimation de départ : une ligne de log fait rarement moins de 40 octets. On
// n'alloue pas au plus juste, on grandit par paliers.
const BYTES_PER_LINE_GUESS = 40;

function grow(array, size) {
  const next = new array.constructor(size);
  next.set(array);
  return next;
}

/**
 * Construit l'index d'un contenu texte.
 *
 * @param {Uint8Array} bytes octets du fichier, tels quels
 * @param {{maxLines?: number}} [opts]
 * @returns {{
 *   count: number, totalLines: number, truncated: boolean,
 *   offset: Uint32Array, length: Uint32Array,
 *   tsStart: Uint16Array, tsLen: Uint8Array,
 *   level: Uint8Array, time: Float64Array
 * }}
 */
export function buildIndex(bytes, { maxLines = MAX_LINES } = {}) {
  const total = bytes.length;
  let cap = Math.max(1024, Math.min(maxLines, Math.ceil(total / BYTES_PER_LINE_GUESS)));

  let offset = new Uint32Array(cap);
  let length = new Uint32Array(cap);
  let tsStart = new Uint16Array(cap);
  let tsLen = new Uint8Array(cap);
  let level = new Uint8Array(cap);
  let time = new Float64Array(cap);

  // Un seul décodeur, réutilisé : en créer un par ligne coûterait plus que le
  // décodage lui-même.
  const decoder = new TextDecoder("utf-8", { fatal: false });

  let count = 0;
  let totalLines = 0;
  let truncated = false;
  let seenHeader = false;
  let pos = 0;

  while (pos <= total) {
    if (totalLines >= maxLines) {
      truncated = true;
      // On continue de COMPTER les lignes sans les indexer. L'ancien parseur
      // découpait tout le fichier avant de tronquer, donc il connaissait le
      // nombre réel de lignes et l'affichait ; le perdre ferait dire « 1 000 000
      // lignes » d'un fichier qui en a 1 975 356. Compter des sauts de ligne
      // dans des octets coûte moins de 100 ms sur 200 Mo.
      while (pos < total) {
        const nl = bytes.indexOf(LF, pos);
        if (nl === -1) {
          totalLines++;
          break;
        }
        totalLines++;
        pos = nl + 1;
      }
      break;
    }
    // Dernière ligne sans saut final : on la traite, puis on sort.
    if (pos === total) {
      if (total === 0) break;
      if (bytes[total - 1] === LF) break;
    }

    let nl = bytes.indexOf(LF, pos);
    if (nl === -1) nl = total;
    let stop = nl;
    if (stop > pos && bytes[stop - 1] === CR) stop--; // \r\n

    totalLines++;
    const line = decoder.decode(bytes.subarray(pos, stop));

    // Ligne vide au milieu d'une trace : elle appartient à l'entrée en cours.
    // `parseLog` n'ajoute qu'un saut de ligne au `raw` et laisse tomber les
    // espaces d'une ligne blanche ; ici la plage d'octets les garde, ce qui rend
    // le `raw` plus fidèle au fichier. C'est la seule différence assumée avec
    // l'ancien modèle, et le script de comparaison la met en évidence.
    if (line.trim() === "" && count > 0) {
      length[count - 1] = stop - offset[count - 1];
      pos = nl + 1;
      continue;
    }

    const ts = detectTimestamp(line);
    const isHeader = headerLine(line, ts);
    const isContinuation = !isHeader && count > 0 && (seenHeader || continuation(line));

    if (isContinuation) {
      length[count - 1] = stop - offset[count - 1];
      pos = nl + 1;
      continue;
    }

    if (count === cap) {
      cap = Math.min(maxLines, Math.ceil(cap * 1.6));
      offset = grow(offset, cap);
      length = grow(length, cap);
      tsStart = grow(tsStart, cap);
      tsLen = grow(tsLen, cap);
      level = grow(level, cap);
      time = grow(time, cap);
    }

    offset[count] = pos;
    length[count] = stop - pos;
    level[count] = LEVEL_ID.get(detectLevel(line) || "OTHER") ?? OTHER;

    if (isHeader) {
      seenHeader = true;
      time[count] = ts.date.getTime();
      // Positions en CARACTÈRES dans la première ligne de l'entrée, pas en
      // octets : le message est reconstruit après décodage, donc les deux
      // doivent parler la même unité.
      const raw = ts.raw;
      const start = line.indexOf(raw);
      tsStart[count] = start >= 0 && start < NO_TS && raw.length <= 0xff ? start : NO_TS;
      tsLen[count] = start >= 0 && raw.length <= 0xff ? raw.length : 0;
    } else {
      time[count] = NaN;
      tsStart[count] = NO_TS;
      tsLen[count] = 0;
    }

    count++;
    pos = nl + 1;
  }

  // La capacité est estimée d'avance, donc généreuse : sur un log de 100 octets
  // par ligne, elle vise 2,5 fois trop haut, ce qui laissait 95 Mo alloués pour
  // 37 Mo utiles. On rend l'excédent une fois le compte connu. Le `slice` coûte
  // une copie de l'index le temps de l'échange, jamais du texte.
  if (count < cap) {
    offset = offset.slice(0, count);
    length = length.slice(0, count);
    tsStart = tsStart.slice(0, count);
    tsLen = tsLen.slice(0, count);
    level = level.slice(0, count);
    time = time.slice(0, count);
  }

  return { count, totalLines, truncated, offset, length, tsStart, tsLen, level, time };
}

// Mêmes règles que `parser/text.js`, dupliquées ici volontairement : les deux
// modèles doivent pouvoir coexister le temps de la migration sans que l'un
// dépende des internes de l'autre. Elles disparaîtront avec l'ancien parseur.
const INDENTED_TS_BUDGET = 12;

function continuation(line) {
  return /^\s/.test(line) || /^(at |Caused by:|\.\.\.|Traceback|File ")/.test(line);
}

function headerLine(line, ts) {
  if (!ts) return false;
  const indent = line.length - line.trimStart().length;
  if (indent === 0) return true;
  return ts.index - indent <= INDENTED_TS_BUDGET;
}

/**
 * Vue lisible sur l'index. C'est la SEULE porte d'entrée des consommateurs :
 * personne au-dessus ne touche aux tableaux typés, sinon le modèle ne serait
 * plus remplaçable.
 *
 * Deux familles d'accès, et la distinction est ce qui fait tenir la mémoire :
 *   - `level(i)`, `time(i)` ne fabriquent rien, et suffisent aux statistiques,
 *     au graphe de volume et à la détection de zones ;
 *   - `raw(i)`, `message(i)`, `at(i)` fabriquent des chaînes, et ne doivent être
 *     appelés que pour ce qui est affiché, exporté ou cherché.
 */
export function createStore(bytes, index) {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const { count, offset, length, tsStart, tsLen, level, time } = index;

  // Les fins de ligne sont normalisées ICI, et pas à l'indexation, parce que
  // l'index ne porte que des bornes : le `\r` d'un CRLF est à l'intérieur de la
  // plage dès qu'une entrée compte des lignes de continuation. L'ancien parseur
  // découpait sur /\r?\n/ puis recollait avec "\n", donc un `\r` ne survivait
  // jamais à un multi-ligne. On reproduit exactement ça, et seulement sur ce qui
  // est réellement matérialisé.
  const raw = (i) =>
    decoder.decode(bytes.subarray(offset[i], offset[i] + length[i])).replace(/\r\n/g, "\n");

  const ts = (i) => (Number.isNaN(time[i]) ? null : new Date(time[i]).toISOString());

  // Le message est la ligne d'en-tête privée de son horodatage, puis rognée,
  // suivie des lignes de continuation. L'horodatage n'est pas toujours en tête
  // (un log Apache le place au milieu), d'où le découpage en deux morceaux
  // plutôt qu'un `slice` : c'est exactement ce que fait `raw.replace(ts.raw, "")`
  // aujourd'hui.
  const message = (i) => {
    const text = raw(i);
    if (Number.isNaN(time[i])) return text;

    const nl = text.indexOf("\n");
    const head = nl === -1 ? text : text.slice(0, nl);
    const rest = nl === -1 ? "" : text.slice(nl);

    let stripped;
    if (tsStart[i] === NO_TS) {
      // Index inutilisable : on redétecte, ce qui reste juste et ne coûte que
      // sur les lignes concernées.
      const found = detectTimestamp(head);
      stripped = found ? head.replace(found.raw, "") : head;
    } else {
      stripped = head.slice(0, tsStart[i]) + head.slice(tsStart[i] + tsLen[i]);
    }

    return stripped.trim() + rest;
  };

  return {
    count,
    index,
    bytes,
    level: (i) => LEVELS[level[i]],
    time: (i) => time[i],
    ts,
    raw,
    message,
    // Une entrée au format attendu par l'UI, fabriquée à la demande. Même forme
    // que celle du parseur actuel, donc les composants d'affichage n'ont rien à
    // apprendre.
    at: (i) => ({ i, ts: ts(i), level: LEVELS[level[i]], message: message(i), raw: raw(i) }),
  };
}

/**
 * Parse un contenu texte vers le modèle colonnaire.
 *
 * @param {Uint8Array} bytes
 * @returns {{store: object, truncated: boolean, totalLines: number}}
 */
export function parseColumnar(bytes, opts) {
  const index = buildIndex(bytes, opts);
  return {
    store: createStore(bytes, index),
    truncated: index.truncated,
    totalLines: index.totalLines,
  };
}
