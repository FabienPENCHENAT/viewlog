// Parseur de logs CSV. Un log CSV a des colonnes régulières ; on mappe
// horodatage / niveau / message vers le même modèle d'entrée que le parseur
// texte. La détection se fait sur le contenu (pas l'extension), pour couvrir
// aussi le collage direct.
//
// MÉMOIRE : LE TOKENIZER NE CONSTRUIT PAS DE CELLULES. Il rend des BORNES, et
// les chaînes sont découpées à la demande. La version précédente construisait
// chaque champ caractère par caractère (`field += ch`), gardait tous les
// enregistrements dans un tableau de tableaux, `trim()`ait chaque cellule pour
// écarter les lignes vides, puis recomposait `raw` par un `join`. Mesuré sur un
// vrai CSV de 201 Mo couvrant 24 h : **1 503 octets par entrée**, contre 181 pour
// le parseur texte, soit un fichier de 100 Mo qui retenait 1,4 Go et faisait
// tuer l'onglet par le navigateur.
//
// Trois conséquences de ce choix :
//   - les cellules sont des tranches de la chaîne source (V8 ne recopie pas) ;
//   - rien n'est matérialisé pour les enregistrements vides, qu'on écarte en
//     lisant les codes de caractères, sans allouer ;
//   - `raw` est la LIGNE SOURCE et non plus un `join(" ")` des champs, donc
//     copier une ligne rend la vraie ligne du fichier, guillemets et délimiteurs
//     compris.
import { MAX_LINES, detectTimestamp, normalizeLevel } from "./shared.js";

const CSV_DELIMS = [",", ";", "\t", "|"];

const HEADER_TS = /^(@?timestamp|time|datetime|date|ts|eventtime|logtime|when)$/i;
const HEADER_LEVEL = /^(level|lvl|severity|sev|loglevel|priority)$/i;
const HEADER_MSG = /^(message|msg|text|body|log|description|detail|event)$/i;

/**
 * Balayage RFC 4180 (guillemets, `""` échappés, retours à la ligne dans un
 * champ), sans allouer une seule cellule.
 *
 * `onRecord(rec)` est appelé pour chaque enregistrement. `rec` est RÉUTILISÉ
 * d'un appel à l'autre : le lire, ne pas le garder. C'est ce qui permet de
 * parcourir un fichier de 200 Mo sans mémoire proportionnelle.
 *
 * @param {string} content
 * @param {string} delim
 * @param {number} maxRecords
 * @param {(rec: {start:number, end:number, count:number, starts:number[], ends:number[], quoted:boolean[]}) => void} onRecord
 * @returns {{records: number, truncated: boolean}}
 */
export function scanRecords(content, delim, maxRecords, onRecord) {
  const len = content.length;
  const rec = { start: 0, end: 0, count: 0, starts: [], ends: [], quoted: [] };

  // Bornes d'un champ. Les guillemets encadrants sont exclus, et on retient
  // qu'il faudra dédoubler les `""` à la matérialisation, ce qui n'arrive que
  // sur les champs qui en contiennent vraiment.
  const pushField = (start, end, quoted, hasEscape) => {
    let s = start;
    let e = end;
    if (quoted && content[s] === '"') s++;
    if (quoted && e > s && content[e - 1] === '"') e--;
    rec.starts[rec.count] = s;
    rec.ends[rec.count] = e;
    rec.quoted[rec.count] = quoted && hasEscape;
    rec.count++;
  };

  let records = 0;
  let truncated = false;
  let i = 0;

  while (i <= len) {
    if (records >= maxRecords) {
      truncated = true;
      break;
    }
    if (i === len) break;

    rec.start = i;
    rec.count = 0;

    let fieldStart = i;
    let inStr = false;
    let quoted = false;
    let hasEscape = false;
    let recordEnd = -1;

    for (; i <= len; i++) {
      if (i === len) {
        // Dernier enregistrement, sans saut de ligne final.
        pushField(fieldStart, len, quoted, hasEscape);
        recordEnd = len;
        break;
      }
      const ch = content[i];

      if (inStr) {
        if (ch !== '"') continue;
        if (content[i + 1] === '"') {
          hasEscape = true;
          i++;
          continue;
        }
        inStr = false;
        continue;
      }

      if (ch === '"') {
        inStr = true;
        // Un champ dont le premier caractère est un guillemet est un champ
        // quoté : ses bornes excluront les guillemets encadrants.
        if (i === fieldStart) quoted = true;
        continue;
      }
      if (ch === delim) {
        pushField(fieldStart, i, quoted, hasEscape);
        fieldStart = i + 1;
        quoted = false;
        hasEscape = false;
        continue;
      }
      if (ch === "\n") {
        pushField(fieldStart, i, quoted, hasEscape);
        recordEnd = i;
        i++;
        break;
      }
    }

    rec.end = recordEnd === -1 ? len : recordEnd;
    records++;
    onRecord(rec);
  }

  return { records, truncated };
}

// Un champ, matérialisé. Les `\r` sont retirés comme le faisait le tokenizer
// précédent, qui les ignorait à la lecture, y compris dans un champ quoté.
function cellOf(content, rec, k) {
  if (k >= rec.count) return "";
  const raw = content.slice(rec.starts[k], rec.ends[k]);
  const noCr = raw.includes("\r") ? raw.replace(/\r/g, "") : raw;
  return rec.quoted[k] ? noCr.replace(/""/g, '"') : noCr;
}

// Un enregistrement a-t-il au moins un caractère significatif ? Lu sur les codes,
// donc sans allouer : c'est le test qui écartait les lignes vides en `trim()`ant
// chaque cellule du fichier.
function hasContent(content, rec) {
  for (let k = 0; k < rec.count; k++) {
    for (let p = rec.starts[k]; p < rec.ends[k]; p++) {
      const c = content.charCodeAt(p);
      if (c > 32) return true;
    }
  }
  return false;
}

// Les `n` premiers enregistrements non vides, matérialisés. Sert à la détection
// (délimiteur, en-tête, colonnes) : quelques dizaines de lignes, jamais plus.
function collectRows(content, delim, n) {
  const rows = [];
  scanRecords(content, delim, n, (rec) => {
    const row = new Array(rec.count);
    for (let k = 0; k < rec.count; k++) row[k] = cellOf(content, rec, k);
    rows.push(row);
  });
  return rows;
}

// Détecte un format CSV : pour chaque délimiteur candidat, on lit un échantillon
// (ce qui gère les champs quotés multi-lignes) et on vérifie que le nombre de
// colonnes est régulier. Le texte libre (colonnes irrégulières) échoue et
// retombe sur le parseur texte.
export function detectCsv(content) {
  for (const delimiter of CSV_DELIMS) {
    const records = collectRows(content, delimiter, 40);
    const rows = records.filter((r) => r.some((c) => c && c.trim() !== ""));
    if (rows.length < 2) continue;
    const cols = rows[0].length;
    if (cols < 2) continue;
    const consistent = rows.filter((r) => r.length === cols).length / rows.length;
    if (consistent >= 0.8) return { delimiter, columns: cols };
  }
  return null;
}

function looksLikeHeader(row0, row1) {
  if (!row0) return false;
  const named = row0.some(
    (h) => HEADER_TS.test(h.trim()) || HEADER_LEVEL.test(h.trim()) || HEADER_MSG.test(h.trim())
  );
  if (named) return true;
  // Sinon : row0 est un en-tête s'il n'a pas d'horodatage mais row1 en a un.
  const row0HasTs = row0.some((c) => detectTimestamp(c));
  const row1HasTs = row1 && row1.some((c) => detectTimestamp(c));
  return !row0HasTs && !!row1HasTs;
}

function pickColumns(header, dataSample, colCount) {
  const idx = { ts: -1, level: -1, msg: -1 };

  // 1) via les noms d'en-tête
  if (header) {
    header.forEach((h, i) => {
      const name = h.trim();
      if (idx.ts < 0 && HEADER_TS.test(name)) idx.ts = i;
      if (idx.level < 0 && HEADER_LEVEL.test(name)) idx.level = i;
      if (idx.msg < 0 && HEADER_MSG.test(name)) idx.msg = i;
    });
  }

  // 2) via les valeurs (repli) sur un échantillon
  const frac = (col, pred) => {
    let ok = 0;
    let tot = 0;
    for (const r of dataSample) {
      if (col >= r.length) continue;
      tot++;
      if (pred(r[col])) ok++;
    }
    return tot ? ok / tot : 0;
  };

  if (idx.ts < 0) {
    let best = -1;
    let bestF = 0.5;
    for (let i = 0; i < colCount; i++) {
      const f = frac(i, (v) => !!detectTimestamp(v || ""));
      if (f > bestF) { bestF = f; best = i; }
    }
    idx.ts = best;
  }
  if (idx.level < 0) {
    let best = -1;
    let bestF = 0.5;
    for (let i = 0; i < colCount; i++) {
      if (i === idx.ts) continue;
      const f = frac(i, (v) => !!normalizeLevel(v));
      if (f > bestF) { bestF = f; best = i; }
    }
    idx.level = best;
  }
  if (idx.msg < 0) {
    // Colonne texte la plus longue en moyenne, hors horodatage/niveau.
    let best = -1;
    let bestLen = -1;
    for (let i = 0; i < colCount; i++) {
      if (i === idx.ts || i === idx.level) continue;
      let sum = 0;
      let tot = 0;
      for (const r of dataSample) {
        if (i < r.length) { sum += (r[i] || "").length; tot++; }
      }
      const avg = tot ? sum / tot : 0;
      if (avg > bestLen) { bestLen = avg; best = i; }
    }
    idx.msg = best;
  }
  return idx;
}

/**
 * Reconnaît l'en-tête et les trois colonnes utiles sur un échantillon.
 *
 * Sorti de `parseCsv` pour que l'index colonnaire (`parser/columnar-csv.js`)
 * s'appuie sur la MÊME reconnaissance : deux détections de colonnes qui
 * divergeraient donneraient deux fichiers différents pour le même CSV.
 *
 * @param {string} content tout le contenu, ou un échantillon de son début
 * @param {{delimiter:string, columns:number}} detected
 * @returns {{hasHeader: boolean, colCount: number, idx: {ts:number, level:number, msg:number}} | null}
 */
export function analyzeCsv(content, detected) {
  // 31 enregistrements suffisent : la reconnaissance doit être faite AVANT de
  // construire la première entrée, sinon il faudrait garder tout le fichier pour
  // y revenir.
  const sample = collectRows(content, detected.delimiter, 31);
  const clean = sample.filter((r) => r.some((c) => c && c.trim() !== ""));
  if (clean.length === 0) return null;

  const header = looksLikeHeader(clean[0], clean[1]) ? clean[0] : null;
  const colCount = detected.columns || Math.max(...clean.map((r) => r.length));
  const rows = (header ? clean.slice(1) : clean).slice(0, 30);
  return { hasHeader: !!header, colCount, idx: pickColumns(header, rows, colCount) };
}

export function parseCsv(content, detected) {
  const delim = detected.delimiter;

  const analysis = analyzeCsv(content, detected);
  if (!analysis) return { entries: [], truncated: false, totalLines: 0 };
  const { idx } = analysis;

  const entries = [];
  let skipHeader = analysis.hasHeader;

  const { truncated } = scanRecords(content, delim, MAX_LINES + 1, (rec) => {
    if (!hasContent(content, rec)) return;
    if (skipHeader) {
      skipHeader = false;
      return;
    }

    const tsRaw = idx.ts >= 0 ? cellOf(content, rec, idx.ts) : "";
    const det = tsRaw ? detectTimestamp(tsRaw) : null;
    const level = idx.level >= 0 ? normalizeLevel(cellOf(content, rec, idx.level)) || "OTHER" : "OTHER";

    let message;
    if (idx.msg >= 0 && idx.msg < rec.count) {
      message = cellOf(content, rec, idx.msg);
    } else {
      // Repli : toutes les colonnes sauf l'horodatage et le niveau.
      const parts = [];
      for (let k = 0; k < rec.count; k++) {
        if (k === idx.ts || k === idx.level) continue;
        parts.push(cellOf(content, rec, k));
      }
      message = parts.join(" · ");
    }

    // `raw` est la ligne source, tranche de la chaîne d'origine : aucune copie,
    // et c'est la vraie ligne du fichier plutôt qu'une recomposition.
    const source = content.slice(rec.start, rec.end);

    entries.push({
      i: entries.length,
      ts: det ? det.date.toISOString() : null,
      level,
      message: message || "",
      raw: source.includes("\r") ? source.replace(/\r/g, "") : source,
    });
  });

  return { entries, truncated, totalLines: entries.length };
}
