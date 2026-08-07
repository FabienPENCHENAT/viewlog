// Index colonnaire du CSV. Pendant de `parser/columnar.js`, qui fait le texte.
//
// POURQUOI LE CSV Y A DROIT. Il en était sorti du périmètre par erreur, sur
// l'idée qu'un message CSV n'est pas une tranche du fichier mais une colonne
// reconstruite. C'est vrai de la colonne, faux de l'enregistrement : un
// enregistrement CSV est une **plage d'octets contiguë**, retours à la ligne
// quotés compris, et il suffit de le re-balayer seul pour retrouver ses colonnes.
// Or les fichiers qui posent le problème de mémoire sont précisément des CSV.
//
// CE QUE ÇA CHANGE PAR RAPPORT AU CHEMIN ACTUEL. `parser/csv.js` travaille sur
// une chaîne JS, donc il faut d'abord amener tout le fichier en mémoire sous
// forme de texte. Ici on balaie les OCTETS : le délimiteur, le guillemet et le
// saut de ligne sont tous en ASCII, et aucun caractère UTF-8 multi-octet ne
// contient un octet ASCII, donc la machine à états est exacte sur les octets. Le
// décodage ne porte que sur **deux cellules par enregistrement**, celle de
// l'horodatage et celle du niveau, jamais sur le message, qui est le gros.
//
// Quatre colonnes suffisent, soit 17 octets par entrée : la plage de l'octet de
// début et sa longueur, le niveau, l'horodatage. Pas besoin des positions
// d'horodatage du modèle texte, puisque le message est une colonne et non « la
// ligne moins son horodatage ».
//
// La machine à états est écrite deux fois, ici sur les octets et dans
// `parser/csv.js` sur une chaîne. C'est assumé le temps de la migration, comme
// pour le texte : les deux modèles doivent pouvoir coexister sans que l'un
// dépende des internes de l'autre. Celle de `csv.js` disparaîtra avec lui.

import { MAX_LINES, LEVELS, detectTimestamp, normalizeLevel } from "./shared.js";
import { detectCsv, analyzeCsv } from "./csv.js";
import { makeStore } from "./columnar.js";

const LF = 10;
const CR = 13;
const QUOTE = 34;

const LEVEL_ID = new Map(LEVELS.map((name, i) => [name, i]));
const OTHER = LEVEL_ID.get("OTHER");

// Échantillon décodé pour la détection : délimiteur, en-tête, colonnes. Il doit
// contenir quelques dizaines d'enregistrements, or un enregistrement peut peser
// plusieurs kilo-octets (une stack trace dans une cellule). On monte donc jusqu'à
// 4 Mo, ce qui couvre des lignes de 100 Ko.
const SAMPLE_MAX = 4 * 1024 * 1024;
// `detectCsv` regarde jusqu'à 40 enregistrements : viser ce nombre rend la
// détection sur échantillon équivalente à la détection sur tout le fichier, au
// lieu de la faire décider sur trois lignes.
const SAMPLE_MIN_RECORDS = 41;

function sampleText(bytes) {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let size = Math.min(bytes.length, 256 * 1024);
  for (;;) {
    const text = decoder.decode(bytes.subarray(0, size));
    // Assez d'enregistrements pour décider, ou plus rien à lire.
    const lines = text.split("\n").length;
    if (lines > SAMPLE_MIN_RECORDS || size >= bytes.length || size >= SAMPLE_MAX) return text;
    size = Math.min(bytes.length, Math.min(SAMPLE_MAX, size * 4));
  }
}

function grow(array, size) {
  const next = new array.constructor(size);
  next.set(array);
  return next;
}

/**
 * Balaie les octets et construit l'index.
 *
 * @param {Uint8Array} bytes
 * @param {{delimiter:string}} detected
 * @param {{ts:number, level:number}} idx colonnes reconnues
 * @param {{hasHeader:boolean, maxRecords?:number}} opts
 */
export function buildCsvIndex(bytes, detected, idx, { hasHeader, maxRecords = MAX_LINES + 1 }) {
  const total = bytes.length;
  const delim = detected.delimiter.charCodeAt(0);
  const decoder = new TextDecoder("utf-8", { fatal: false });

  let cap = Math.max(1024, Math.min(maxRecords, Math.ceil(total / 120)));
  let offset = new Uint32Array(cap);
  let length = new Uint32Array(cap);
  let level = new Uint8Array(cap);
  let time = new Float64Array(cap);

  // Bornes des deux seules colonnes qu'on lit. Réutilisées d'un enregistrement à
  // l'autre : rien à allouer par ligne.
  const wanted = [idx.ts, idx.level].filter((c) => c >= 0);
  const cellStart = new Int32Array(wanted.length).fill(-1);
  const cellEnd = new Int32Array(wanted.length).fill(-1);

  let count = 0;
  let records = 0;
  let truncated = false;
  let skipHeader = hasHeader;
  let pos = 0;

  while (pos < total) {
    if (records >= maxRecords) {
      truncated = true;
      break;
    }

    const start = pos;
    let field = 0;
    let fieldStart = pos;
    let quoted = false;
    let inStr = false;
    let end = -1;
    cellStart.fill(-1);
    cellEnd.fill(-1);

    // Un champ se termine sur un délimiteur, un saut de ligne hors guillemets, ou
    // la fin du fichier.
    const closeField = (stop) => {
      let s = fieldStart;
      let e = stop;
      if (quoted && bytes[s] === QUOTE) s++;
      if (quoted && e > s && bytes[e - 1] === QUOTE) e--;
      const slot = wanted.indexOf(field);
      if (slot !== -1) {
        cellStart[slot] = s;
        cellEnd[slot] = e;
      }
      field++;
      quoted = false;
    };

    let i = pos;
    for (; i < total; i++) {
      const b = bytes[i];
      if (inStr) {
        if (b !== QUOTE) continue;
        if (bytes[i + 1] === QUOTE) {
          i++;
          continue;
        }
        inStr = false;
        continue;
      }
      if (b === QUOTE) {
        inStr = true;
        if (i === fieldStart) quoted = true;
        continue;
      }
      if (b === delim) {
        closeField(i);
        fieldStart = i + 1;
        continue;
      }
      if (b === LF) {
        closeField(i);
        end = i;
        break;
      }
    }
    if (end === -1) {
      closeField(total);
      end = total;
      i = total;
    }

    let stop = end;
    if (stop > start && bytes[stop - 1] === CR) stop--;
    pos = i + 1;
    records++;

    // Enregistrement vide : lu sur les octets, sans rien matérialiser.
    let significant = false;
    for (let p = start; p < stop; p++) {
      const b = bytes[p];
      if (b > 32 && b !== delim && b !== QUOTE) {
        significant = true;
        break;
      }
    }
    if (!significant) continue;

    if (skipHeader) {
      skipHeader = false;
      continue;
    }

    if (count === cap) {
      cap = Math.min(maxRecords, Math.ceil(cap * 1.6));
      offset = grow(offset, cap);
      length = grow(length, cap);
      level = grow(level, cap);
      time = grow(time, cap);
    }

    offset[count] = start;
    length[count] = stop - start;

    // Les deux seules cellules décodées, et elles sont courtes.
    const tsSlot = wanted.indexOf(idx.ts);
    const lvlSlot = wanted.indexOf(idx.level);

    let ms = NaN;
    if (tsSlot !== -1 && cellStart[tsSlot] >= 0) {
      const cell = decoder.decode(bytes.subarray(cellStart[tsSlot], cellEnd[tsSlot]));
      const det = cell ? detectTimestamp(cell) : null;
      if (det) ms = det.date.getTime();
    }
    time[count] = ms;

    let lvl = OTHER;
    if (lvlSlot !== -1 && cellStart[lvlSlot] >= 0) {
      const cell = decoder.decode(bytes.subarray(cellStart[lvlSlot], cellEnd[lvlSlot]));
      lvl = LEVEL_ID.get(normalizeLevel(cell) || "OTHER") ?? OTHER;
    }
    level[count] = lvl;

    count++;
  }

  if (count < cap) {
    offset = offset.slice(0, count);
    length = length.slice(0, count);
    level = level.slice(0, count);
    time = time.slice(0, count);
  }

  // `totalLines` compte les enregistrements retenus, comme le fait `parseCsv`, et
  // non les lignes physiques : un enregistrement CSV peut en contenir plusieurs.
  return { count, totalLines: count, truncated, offset, length, level, time };
}

/**
 * Store CSV : `raw` est la ligne source, `message` demande de re-balayer ce seul
 * enregistrement pour en extraire la colonne. Coût payé uniquement sur ce qui est
 * affiché, exporté ou cherché.
 */
export function createCsvStore(bytes, index, detected, idx) {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const { offset, length } = index;
  const delim = detected.delimiter;

  const raw = (i) => {
    const text = decoder.decode(bytes.subarray(offset[i], offset[i] + length[i]));
    return text.includes("\r") ? text.replace(/\r/g, "") : text;
  };

  // Re-balayage d'un seul enregistrement, sur le texte déjà décodé : il fait
  // quelques kilo-octets, donc une machine à états sur chaîne suffit et évite de
  // dupliquer une troisième fois celle des octets.
  const cells = (text) => {
    const out = [];
    let start = 0;
    let inStr = false;
    let quoted = false;
    let escaped = false;
    for (let p = 0; p <= text.length; p++) {
      if (p === text.length) {
        out.push(cut(text, start, p, quoted, escaped));
        break;
      }
      const ch = text[p];
      if (inStr) {
        if (ch !== '"') continue;
        if (text[p + 1] === '"') {
          escaped = true;
          p++;
          continue;
        }
        inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        if (p === start) quoted = true;
        continue;
      }
      if (ch === delim) {
        out.push(cut(text, start, p, quoted, escaped));
        start = p + 1;
        quoted = false;
        escaped = false;
      }
    }
    return out;
  };

  const cut = (text, start, end, quoted, escaped) => {
    let s = start;
    let e = end;
    if (quoted && text[s] === '"') s++;
    if (quoted && e > s && text[e - 1] === '"') e--;
    const value = text.slice(s, e);
    return escaped ? value.replace(/""/g, '"') : value;
  };

  const message = (i) => {
    const row = cells(raw(i));
    if (idx.msg >= 0 && idx.msg < row.length) return row[idx.msg] || "";
    // Repli : toutes les colonnes sauf l'horodatage et le niveau, comme le
    // parseur actuel.
    return row.filter((_, k) => k !== idx.ts && k !== idx.level).join(" · ");
  };

  return makeStore({ bytes, index, raw, message });
}

/**
 * Point d'entrée : des octets vers un store CSV colonnaire.
 *
 * @returns {{store: object, truncated: boolean, totalLines: number} | null} `null`
 *   si le contenu n'est pas reconnu comme du CSV.
 */
export function parseCsvColumnar(bytes, opts = {}) {
  const sample = sampleText(bytes);
  const detected = detectCsv(sample);
  if (!detected) return null;

  const analysis = analyzeCsv(sample, detected);
  if (!analysis) return null;

  const index = buildCsvIndex(bytes, detected, analysis.idx, {
    hasHeader: analysis.hasHeader,
    maxRecords: opts.maxRecords,
  });

  return {
    store: createCsvStore(bytes, index, detected, analysis.idx),
    truncated: index.truncated,
    totalLines: index.totalLines,
  };
}
