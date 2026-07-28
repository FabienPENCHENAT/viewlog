// Enregistrement du service worker : c'est lui qui met le build en cache et
// rend l'app utilisable sans réseau.
//
// Mises à jour : appliquées dès qu'il y a du réseau, sans rien demander.
//  - au chargement, le navigateur vérifie tout seul s'il existe un nouveau build ;
//  - au retour de connexion, on redemande une vérification pour qu'un onglet
//    resté ouvert ne reste pas sur une vieille version ;
//  - en mode hors ligne forcé, aucune vérification n'est déclenchée.
import { registerSW } from "virtual:pwa-register";
import { networkAllowed, subscribeOffline } from "./offline.js";

// Un nouveau build activé pendant que l'utilisateur travaille ne doit pas
// recharger la page sous ses doigts (recherche en cours, filtres posés). On ne
// recharge que si l'activation arrive dans les premières secondes de la visite ;
// sinon la nouvelle version est en cache et prendra la main à la navigation
// suivante.
const BOOT_GRACE_MS = 10000;

export function setupPWA() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const bootedAt = Date.now();
  let registration = null;

  try {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, reg) {
        registration = reg || null;
      },
      onNeedReload() {
        if (Date.now() - bootedAt < BOOT_GRACE_MS) window.location.reload();
      },
    });
  } catch {
    // Service worker indisponible (navigateur ancien, contexte non sécurisé) :
    // l'app reste parfaitement fonctionnelle, simplement sans mode hors ligne.
    return;
  }

  subscribeOffline(() => {
    if (networkAllowed()) registration?.update().catch(() => {});
  });
}
