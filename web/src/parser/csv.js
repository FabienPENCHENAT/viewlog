// Parseur de logs CSV. Un log CSV a des colonnes régulières ; on mappe
// horodatage / niveau / message vers le même modèle d'entrée que le parseur
// texte. La détection se fait sur le contenu (pas l'extension), pour couvrir
// aussi le collage direct.
import { MAX_LINES, detectTimestamp, normalizeLevel } from "./shared.js";

const CSV_DELIMS = [",", ";", "\t", "|"];

const HEADER_TS = /^(@?timestamp|time|datetime|date|ts|eventtime|logtime|when)$/i;
const HEADER_LEVEL = /^(level|lvl|severity|sev|loglevel|priority)$/i;
const HEADER_MSG = /^(message|msg|text|body|log|description|detail|event)$/i;

// Tokenise le CSV (RFC 4180 : guillemets, "" échappés, retours dans les champs).
function tokenizeCsv(text, delim, maxRecords) {
  const records = [];
  let field = "";
  let row = [];
  let inStr = false;
  let truncated = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inStr = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\r") { /* ignoré */ }
    else if (ch === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
      if (records.length >= maxRecords) { truncated = true; break; }
    } else field += ch;
  }
  if (!truncated && (field.length > 0 || row.length > 0)) {
    row.push(field);
    records.push(row);
  }
  return { records, truncated };
}

// Détecte un format CSV : pour chaque délimiteur candidat, on tokenise un
// échantillon (ce qui gère les champs quotés multi-lignes) et on vérifie que le
// nombre de colonnes est régulier. Le texte libre (colonnes irrégulières)
// échoue et retombe sur le parseur texte.
export function detectCsv(content) {
  for (const delimiter of CSV_DELIMS) {
    const { records } = tokenizeCsv(content, delimiter, 40);
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

export function parseCsv(content, detected) {
  const { records, truncated } = tokenizeCsv(content, detected.delimiter, MAX_LINES + 1);

  // Ignore les enregistrements entièrement vides.
  const clean = records.filter((r) => r.some((c) => c && c.trim() !== ""));
  if (clean.length === 0) return { entries: [], truncated: false, totalLines: 0 };

  const header = looksLikeHeader(clean[0], clean[1]) ? clean[0] : null;
  const dataRows = header ? clean.slice(1) : clean;
  const colCount = detected.columns || Math.max(...clean.map((r) => r.length));
  const idx = pickColumns(header, dataRows.slice(0, 30), colCount);

  const entries = dataRows.map((r, i) => {
    const tsRaw = idx.ts >= 0 ? r[idx.ts] : "";
    const det = tsRaw ? detectTimestamp(tsRaw) : null;
    const level = idx.level >= 0 ? normalizeLevel(r[idx.level]) || "OTHER" : "OTHER";
    const message =
      idx.msg >= 0 && r[idx.msg] != null
        ? r[idx.msg]
        : r.filter((_, k) => k !== idx.ts && k !== idx.level).join(" · ");
    return {
      i,
      ts: det ? det.date.toISOString() : null,
      level,
      message: message || "",
      raw: r.join(" "),
    };
  });

  return { entries, truncated, totalLines: entries.length };
}
