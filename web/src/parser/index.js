// API publique du parsing. Deux modèles cohabitent le temps de la migration.
//
// `parse(content)` prend une CHAÎNE et rend des objets d'entrée
// (`{ entries, truncated, totalLines }`). C'est le modèle historique.
//
// `parseToStore(bytes)` prend des OCTETS et rend un store colonnaire. C'est le
// modèle qui passe l'échelle, et ce n'est pas qu'une question de vitesse : une
// chaîne JavaScript ne peut pas dépasser **536 870 888 caractères**, mesuré, et
// un fichier de 500 Mo en occupe déjà 526 653 114, soit 98 % de la limite. Au-delà,
// `file.text()` lève « Invalid string length » avant même qu'on parse. Le chemin
// par octets n'a pas ce mur.
//
// Les deux dispatchs doivent décider PAREIL. `parse` fait tourner `detectCsv` sur
// tout le contenu, `parseToStore` sur un échantillon de son début : comme
// `detectCsv` ne regarde de toute façon que quarante enregistrements, l'échantillon
// est dimensionné pour en contenir autant (voir `columnar-csv.js`).
import { parseLog } from "./text.js";
import { detectCsv, parseCsv } from "./csv.js";
import { parseColumnar } from "./columnar.js";
import { parseCsvColumnar } from "./columnar-csv.js";

export { MAX_LINES, MAX_BYTES, MAX_MB, LEVELS } from "./shared.js";
export { buildStats, buildStatsFromStore } from "./stats.js";
export { parseLog } from "./text.js";
export { detectCsv, parseCsv } from "./csv.js";
export { createStore, makeStore } from "./columnar.js";

export function parse(content) {
  const csv = detectCsv(content);
  return csv ? parseCsv(content, csv) : parseLog(content);
}

/**
 * Des octets vers un store colonnaire, CSV si le contenu a des colonnes
 * régulières, texte générique sinon.
 *
 * @param {Uint8Array} bytes
 * @param {{maxLines?: number, maxRecords?: number}} [opts]
 * @returns {{store: object, truncated: boolean, totalLines: number, format: "csv"|"text"}}
 */
export function parseToStore(bytes, opts) {
  const csv = parseCsvColumnar(bytes, opts);
  if (csv) return { ...csv, format: "csv" };
  return { ...parseColumnar(bytes, opts), format: "text" };
}
