// Parse les logs dans un thread séparé pour ne jamais figer l'UI, même sur
// des fichiers de plusieurs dizaines de Mo / centaines de milliers de lignes.
import { parse, buildStats, LEVELS } from "./parser/index.js";

self.onmessage = (e) => {
  const { content, withEntries } = e.data;
  const { entries, truncated, totalLines } = parse(content);
  const stats = buildStats(entries);
  // Sur un simple upload on n'a besoin que des métadonnées : on évite de
  // recopier des centaines de milliers d'entrées entre les threads.
  self.postMessage({
    truncated,
    totalLines,
    stats,
    levels: LEVELS,
    entries: withEntries ? entries : undefined,
  });
};
