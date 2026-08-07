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
import { parseColumnar, createStore } from "./columnar.js";
import { parseCsvColumnar, createCsvStore } from "./columnar-csv.js";

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

/**
 * Reconstruit un store à partir de ce qui a traversé le pont.
 *
 * L'index et les octets sont TRANSFÉRÉS par le worker, donc ni l'un ni l'autre
 * n'est recopié : c'est tout l'intérêt du modèle. Il ne reste qu'à rebrancher les
 * matérialisateurs du bon format, qui sont des fonctions et ne traversent pas.
 *
 * @param {{bytes: ArrayBuffer, index: object, format: "csv"|"text", csv?: object}} payload
 */
export function storeFrom({ bytes, index, format, csv }) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return format === "csv"
    ? createCsvStore(u8, index, csv.detected, csv.idx)
    : createStore(u8, index);
}
