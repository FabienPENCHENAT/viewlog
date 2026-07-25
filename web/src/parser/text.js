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

export function parseLog(content) {
  const rawLines = content.split(/\r?\n/);
  // Retire une éventuelle dernière ligne vide.
  if (rawLines.length && rawLines[rawLines.length - 1] === "") rawLines.pop();

  const truncated = rawLines.length > MAX_LINES;
  const lines = truncated ? rawLines.slice(0, MAX_LINES) : rawLines;

  const entries = [];
  for (const raw of lines) {
    if (raw.trim() === "" && entries.length) {
      // ligne vide au milieu d'une trace : rattache
      entries[entries.length - 1].raw += "\n";
      continue;
    }

    const ts = detectTimestamp(raw);
    const isContinuation = !ts && entries.length && looksLikeContinuation(raw);

    if (isContinuation) {
      const prev = entries[entries.length - 1];
      prev.raw += "\n" + raw;
      prev.message += "\n" + raw;
      continue;
    }

    const level = detectLevel(raw) || "OTHER";
    let message = raw;
    if (ts) message = message.replace(ts.raw, "").trim();

    entries.push({
      i: entries.length,
      ts: ts ? ts.date.toISOString() : null,
      level,
      message,
      raw,
    });
  }

  return { entries, truncated, totalLines: rawLines.length };
}
