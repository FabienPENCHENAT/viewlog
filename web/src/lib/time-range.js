// Fenêtre temporelle partagée par le graphe de volume et le journal.
// Les bornes viennent des entrées (min/max des horodatages) ; la fenêtre
// sélectionnée est toujours exprimée en millisecondes { from, to }.

export function timeBounds(entries) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const e of entries) {
    if (!e.ts) continue;
    const ms = new Date(e.ts).getTime();
    if (ms < lo) lo = ms;
    if (ms > hi) hi = ms;
  }
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
