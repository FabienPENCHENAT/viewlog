// Cache des logs déjà analysés.
//
// Sans lui, changer d'onglet repasse par le worker pour un parsing complet du
// contenu stocké : sur un fichier de plusieurs Mo, chaque clic coûte un écran de
// chargement et la barre perd exactement ce qu'elle apportait.
//
// LE BUDGET EST EN ENTRÉES, PAS EN NOMBRE DE LOGS. Compter les logs traitait un
// fichier de 2 000 lignes comme un fichier de deux millions : garder trois gros
// logs analysés multipliait par trois le poste le plus lourd de l'application et
// suffisait à faire tuer l'onglet par le navigateur. Mesuré sur un vrai CSV de
// 201 Mo, un seul log analysé retient 170 Mo d'entrées, auxquels s'ajoute la
// copie côté UI.
//
// Le budget est donc une réserve d'entrées, partagée : trois logs de 200 000
// entrées tiennent ensemble, un log d'un million en chasse tous les autres. Le
// plus récent est TOUJOURS gardé, même s'il dépasse à lui seul le budget : le
// jeter juste après l'avoir mis reviendrait à ne pas avoir de cache.

const MAX_ENTRIES = 1_200_000;

// Map = ordre d'insertion garanti, donc la première clé est la moins récemment
// utilisée.
const cache = new Map();

function weigh(value) {
  return value?.entries?.length || 0;
}

function evict() {
  let total = 0;
  for (const value of cache.values()) total += weigh(value);

  // Le dernier inséré est le plus récent : on remonte du plus ancien tant que le
  // budget est dépassé, en s'arrêtant avant de toucher au dernier.
  for (const key of [...cache.keys()]) {
    if (total <= MAX_ENTRIES || cache.size <= 1) break;
    total -= weigh(cache.get(key));
    cache.delete(key);
  }
}

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
  evict();
}

export function cacheDrop(id) {
  cache.delete(id);
}
