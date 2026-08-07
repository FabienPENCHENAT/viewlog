// Parse les logs dans un thread séparé pour ne jamais figer l'UI, même sur des
// fichiers de plusieurs centaines de Mo.
//
// CE QUI TRAVERSE LE PONT EST TRANSFÉRÉ, PAS RECOPIÉ. C'est le point de tout ce
// travail. Avant, le worker recevait une copie du texte du fichier et renvoyait
// un tableau d'objets d'entrée : mesuré sur un CSV de 214 Mo aux messages de
// plusieurs kilo-octets, cette seule copie de retour coûtait 607 Mo, plus que
// l'original, parce que V8 garde des tranches de la grande chaîne pendant le
// parsing et que le passage du pont les transforme en chaînes autonomes.
//
// Désormais le worker reçoit les OCTETS du fichier (transférés, donc le thread
// principal les perd le temps de l'analyse) et renvoie les octets et un index de
// tableaux typés (transférés aussi). Aucun octet n'est dupliqué, dans aucun sens.
// Les chaînes sont fabriquées à l'affichage, ligne par ligne.
import { parseToStore, buildStatsFromStore, LEVELS } from "./parser/index.js";
import { findPeaksFromStore } from "./lib/peaks.js";

self.onmessage = (e) => {
  const { bytes, withPeaks } = e.data;
  const { store, truncated, totalLines, format, csv } = parseToStore(new Uint8Array(bytes));

  const stats = buildStatsFromStore(store);
  // Détection des zones : ici et pas sur le thread principal, parce qu'on parcourt
  // déjà l'index. Seulement quand le dashboard les demande, un simple upload n'a
  // rien à en faire.
  const peaks = withPeaks ? findPeaksFromStore(store) : [];

  const index = store.index;
  // Chaque colonne a son propre ArrayBuffer : toutes sont transférées, plus les
  // octets du fichier. Ce qui n'est pas dans cette liste serait recopié.
  const transfer = [bytes];
  for (const column of [index.offset, index.length, index.level, index.time, index.tsStart, index.tsLen]) {
    if (column) transfer.push(column.buffer);
  }

  self.postMessage(
    { bytes, index, format, csv, truncated, totalLines, stats, peaks, levels: LEVELS },
    transfer
  );
};
