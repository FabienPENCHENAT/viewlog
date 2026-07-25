// API publique du parsing. `parse(content)` choisit automatiquement le parseur
// (CSV si le contenu a des colonnes régulières, sinon texte générique) et rend
// toujours le même modèle : { entries, truncated, totalLines }.
import { parseLog } from "./text.js";
import { detectCsv, parseCsv } from "./csv.js";

export { MAX_LINES, LEVELS } from "./shared.js";
export { buildStats } from "./stats.js";
export { parseLog } from "./text.js";
export { detectCsv, parseCsv } from "./csv.js";

export function parse(content) {
  const csv = detectCsv(content);
  return csv ? parseCsv(content, csv) : parseLog(content);
}
