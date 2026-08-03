// Filtres en cours, mémorisés par onglet.
//
// C'est ce qui sépare la barre d'onglets du gadget : revenir sur un onglet doit
// rendre le journal tel qu'on l'a laissé, sinon changer d'onglet passe pour une
// perte de travail.
//
// Volontairement EN MÉMOIRE, pas en IndexedDB : un rechargement de page est une
// remise à zéro assumée, et il n'y a donc rien à nettoyer ni à faire vieillir.

const states = new Map();

export function getTabState(id) {
  return (id && states.get(id)) || null;
}

export function setTabState(id, patch) {
  if (!id) return;
  states.set(id, { ...(states.get(id) || {}), ...patch });
}

export function dropTabState(id) {
  states.delete(id);
}
