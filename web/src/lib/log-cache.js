// Cache des logs déjà analysés, et surtout : la mémoire que l'onglet accepte de
// garder.
//
// Sans lui, changer d'onglet repasse par le worker pour un parsing complet du
// contenu stocké : sur un gros fichier, chaque clic coûte un écran de chargement
// et la barre d'onglets perd exactement ce qu'elle apportait.
//
// LE BUDGET EST EN OCTETS. Il l'a été en nombre de logs, puis en nombre
// d'entrées, et les deux étaient faux pour la même raison : ils ne mesuraient pas
// ce qui pèse. Compter les logs traitait un fichier de 2 000 lignes comme un
// fichier de deux millions. Compter les entrées est devenu faux avec le modèle
// colonnaire, où le poids est celui des OCTETS du fichier : 89 000 entrées peuvent
// peser 350 Mo, et deux millions d'entrées 40 Mo. Un budget d'un million deux cent
// mille entrées autorisait donc treize fichiers de 350 Mo, soit plus de quatre
// giga-octets.
//
// Chaque store sait ce qu'il coûte (`store.weight`, voir parser/columnar.js) :
// ses octets plus ses colonnes. C'est cette valeur qui décide.
//
// Ce que le budget produit, et c'est le comportement voulu : plusieurs petits logs
// tiennent ensemble et le passage d'un onglet à l'autre reste instantané ; un gros
// fichier chasse ce qu'il faut pour tenir, donc l'onglet ne monte pas en flèche à
// force d'en ouvrir. Le plus récent est TOUJOURS gardé, même s'il dépasse à lui
// seul le budget : le jeter juste après l'avoir mis reviendrait à ne pas avoir de
// cache.

// 256 Mio. Assez pour garder les logs de travail courants côte à côte, trop peu
// pour empiler deux fichiers de plusieurs centaines de Mo, ce qui est exactement
// la limite qu'on veut : un seul très gros fichier en mémoire à la fois.
const MAX_WEIGHT = 256 * 1024 * 1024;

// Map = ordre d'insertion garanti, donc la première clé est la moins récemment
// utilisée.
const cache = new Map();

function weigh(value) {
  return value?.store?.weight || 0;
}

function total() {
  let sum = 0;
  for (const value of cache.values()) sum += weigh(value);
  return sum;
}

// Évince du plus ancien au plus récent jusqu'à tenir dans `budget`. `keepLast`
// protège la dernière entrée, celle qu'on vient de mettre.
function trim(budget, keepLast) {
  let sum = total();
  for (const key of [...cache.keys()]) {
    if (sum <= budget) break;
    if (keepLast && cache.size <= 1) break;
    sum -= weigh(cache.get(key));
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
  trim(MAX_WEIGHT, true);
}

export function cacheDrop(id) {
  cache.delete(id);
}

/**
 * Fait de la place AVANT d'allouer, pour un fichier de `size` octets.
 *
 * Sans ça, ouvrir un second gros fichier fait cohabiter l'ancien et le nouveau le
 * temps du parsing : le pic double, et c'est précisément l'instant où l'onglet est
 * le plus près de tomber. Ici on libère d'abord, on alloue ensuite.
 *
 * Rien n'est protégé : si le fichier qui arrive ne laisse pas de place, le cache
 * se vide entièrement, ce qui est le bon arbitrage. Un onglet vivant qui reparse
 * en une seconde vaut mieux qu'un onglet tué.
 */
export function cacheReserve(size) {
  trim(Math.max(0, MAX_WEIGHT - (size || 0)), false);
}
