// État réseau de l'app : source unique de vérité avant toute requête sortante
// (aujourd'hui les events d'usage anonymes de lib/track.js).
//
// Deux causes possibles d'un état hors ligne :
//  - le navigateur n'a pas de connexion (navigator.onLine) ;
//  - l'utilisateur a coupé le réseau volontairement via l'interrupteur, même
//    connecté : ViewLog tourne alors strictement en local.
//
// Le choix de l'utilisateur est persisté ; l'état du navigateur, non.

const STORAGE_KEY = "viewlog:offline";

const listeners = new Set();

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // localStorage indisponible
  }
}

let forced = read();

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* un abonné qui casse ne doit pas bloquer les autres */
    }
  }
}

// Mode hors ligne demandé explicitement par l'utilisateur.
export function isForcedOffline() {
  return forced;
}

export function setForcedOffline(value) {
  const next = !!value;
  if (next === forced) return;
  forced = next;
  try {
    if (forced) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore : la préférence ne survivra pas au rechargement */
  }
  emit();
}

// Connexion telle que la voit le navigateur, indépendamment du choix utilisateur.
export function isBrowserOnline() {
  try {
    return navigator.onLine !== false;
  } catch {
    return true;
  }
}

// Seul prédicat à consulter avant de toucher au réseau.
export function networkAllowed() {
  return !forced && isBrowserOnline();
}

// S'abonne aux changements : choix utilisateur et événements du navigateur.
export function subscribeOffline(fn) {
  listeners.add(fn);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("online", emit);
    window.addEventListener("offline", emit);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("online", emit);
      window.removeEventListener("offline", emit);
    }
  };
}
