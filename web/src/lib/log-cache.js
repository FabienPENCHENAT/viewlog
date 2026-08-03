// Cache des logs déjà analysés.
//
// Sans lui, changer d'onglet repasse par le worker pour un parsing complet du
// contenu stocké : sur un fichier de plusieurs Mo, chaque clic coûte un écran de
// chargement et la barre perd exactement ce qu'elle apportait.
//
// Trois entrées suffisent pour un aller-retour entre deux ou trois logs, et
// bornent la mémoire : les entrées analysées d'un gros fichier pèsent lourd
// (jusqu'à MAX_LINES lignes chacune).

const MAX_CACHED = 3;

// Map = ordre d'insertion garanti, donc la première clé est la moins récemment
// utilisée. Suffisant pour un LRU de trois éléments.
const cache = new Map();

export function cacheGet(id) {
  if (!cache.has(id)) return null;
  const value = cache.get(id);
  // Remonte l'entrée en fin de Map : elle redevient la plus récente.
  cache.delete(id);
  cache.set(id, value);
  return value;
}

export function cachePut(id, value) {
  cache.delete(id);
  cache.set(id, value);
  while (cache.size > MAX_CACHED) {
    cache.delete(cache.keys().next().value);
  }
}

export function cacheDrop(id) {
  cache.delete(id);
}
