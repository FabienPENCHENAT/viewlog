// Point de passage unique de TOUTE requête sortante de l'app.
//
// La promesse affichée à l'utilisateur (« aucune requête ne sort de votre
// navigateur » en mode hors ligne) n'est tenable que si rien ne contourne ce
// module : hors ligne, la requête n'est pas émise du tout, elle échoue tout de
// suite. Toute nouvelle requête réseau doit passer par ici.
//
// Exception assumée : lib/track.js n'utilise pas netFetch car il envoie un
// `sendBeacon` et doit rester totalement silencieux ; il consulte donc
// networkAllowed() directement.
import { networkAllowed } from "./offline.js";

// Message d'erreur reconnaissable par les appelants (page /stats, admin).
export const OFFLINE_ERROR = "offline";

export function netFetch(url, init) {
  if (!networkAllowed()) return Promise.reject(new Error(OFFLINE_ERROR));
  return fetch(url, init);
}
