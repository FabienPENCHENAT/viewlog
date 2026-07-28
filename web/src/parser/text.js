// Parseur de logs texte générique (.txt / .log).
// Auto-détecte, ligne par ligne : un horodatage, un niveau et le message.
// Les lignes de continuation (stack traces, etc.) sont rattachées à l'entrée
// précédente.
import { MAX_LINES, detectTimestamp, detectLevel } from "./shared.js";

// Une ligne est une "continuation" si elle n'a pas d'horodatage propre
// et ressemble à une suite (indentation, stack trace java/node, etc.).
function looksLikeContinuation(line) {
  return /^\s/.test(line) || /^(at |Caused by:|\.\.\.|Traceback|File ")/.test(line);
}

// Sur une ligne indentée, un horodatage n'ouvre une entrée que s'il arrive
// presque tout de suite : de quoi laisser passer un niveau ou un crochet
// (" WARN 2024-...", "  [2024-...") mais pas un horodatage noyé dans du
// contenu (payload JSON, dump SQL, etc.).
const INDENTED_TS_BUDGET = 12;

// Une ligne ouvre une nouvelle entrée si elle ressemble à un en-tête, donc si
// son horodatage est bien en tête. Sans indentation on reste permissif : des
// formats comme Apache placent l'horodatage après plusieurs champs.
function isHeaderLine(line, ts) {
  if (!ts) return false;
  const indent = line.length - line.trimStart().length;
  if (indent === 0) return true;
  return ts.index - indent <= INDENTED_TS_BUDGET;
}

export function parseLog(content) {
  const rawLines = content.split(/\r?\n/);
  // Retire une éventuelle dernière ligne vide.
  if (rawLines.length && rawLines[rawLines.length - 1] === "") rawLines.pop();

  const truncated = rawLines.length > MAX_LINES;
  const lines = truncated ? rawLines.slice(0, MAX_LINES) : rawLines;

  const entries = [];
  // Dès qu'un en-tête horodaté est vu, on sait que le format est horodaté :
  // les lignes suivantes sans en-tête sont alors des continuations, même sans
  // indentation (message multi-ligne, tableau, dump...).
  let seenHeader = false;

  for (const raw of lines) {
    if (raw.trim() === "" && entries.length) {
      // ligne vide au milieu d'une trace : rattache
      entries[entries.length - 1].raw += "\n";
      continue;
    }

    const ts = detectTimestamp(raw);
    const isHeader = isHeaderLine(raw, ts);
    const isContinuation =
      !isHeader && entries.length && (seenHeader || looksLikeContinuation(raw));

    if (isContinuation) {
      const prev = entries[entries.length - 1];
      prev.raw += "\n" + raw;
      prev.message += "\n" + raw;
      continue;
    }

    const level = detectLevel(raw) || "OTHER";
    let message = raw;
    if (isHeader) {
      message = message.replace(ts.raw, "").trim();
      seenHeader = true;
    }

    entries.push({
      i: entries.length,
      ts: isHeader ? ts.date.toISOString() : null,
      level,
      message,
      raw,
    });
  }

  return { entries, truncated, totalLines: rawLines.length };
}
