// Fenêtre temporelle partagée par le graphe de volume et le journal.
// La fenêtre sélectionnée est toujours exprimée en millisecondes { from, to }.

// Les bornes se lisent dans la plage déjà calculée par les agrégats, au lieu de
// reparcourir tout le fichier pour retrouver deux valeurs qu'on connaît. Sur un
// million d'entrées, ça faisait un million de `new Date()` à chaque ouverture.
export function timeBounds(timeSpan) {
  if (!timeSpan) return null;
  const lo = Date.parse(timeSpan.start);
  const hi = Date.parse(timeSpan.end);
  return hi > lo ? { lo, hi } : null;
}

export function fullRange(bounds) {
  return bounds ? { from: bounds.lo, to: bounds.hi } : null;
}

// Pas du curseur : ~500 crans sur la période, au moins une seconde.
export function rangeStep(bounds) {
  return bounds ? Math.max(1000, Math.floor((bounds.hi - bounds.lo) / 500)) : 1000;
}

// Vrai dès que la fenêtre est plus étroite que le fichier entier.
export function isPartialRange(bounds, range) {
  return !!(bounds && range && (range.from > bounds.lo || range.to < bounds.hi));
}

// Ramène une fenêtre dans les bornes ; retombe sur la période complète si
// la sélection est vide ou inversée.
export function clampRange(range, bounds) {
  if (!bounds || !range) return fullRange(bounds);
  const from = Math.max(bounds.lo, Math.min(range.from, range.to));
  const to = Math.min(bounds.hi, Math.max(range.from, range.to));
  return from < to ? { from, to } : fullRange(bounds);
}
