// Interrupteur "mode hors ligne" de la barre du haut.
//
// Trois états visuels :
//  - réseau autorisé            : bouton neutre, cliquer coupe le réseau ;
//  - hors ligne choisi (--on)   : plus aucune requête sortante ;
//  - sans connexion (--auto)    : le navigateur est hors ligne, on l'indique.
import { useSyncExternalStore } from "react";
import { useI18n } from "../i18n/index.jsx";
import {
  isBrowserOnline,
  isForcedOffline,
  setForcedOffline,
  subscribeOffline,
} from "../lib/offline.js";
import { trackFeature } from "../lib/track.js";

// Adoption de la fonctionnalité : on ne compte que l'activation, et l'event est
// envoyé AVANT de couper, sinon le garde-fou de track.js l'abandonne. La
// désactivation n'est pas comptée : ce qu'on veut savoir, c'est si des gens
// coupent le réseau, pas combien de fois ils basculent.
function toggle(forced) {
  if (!forced) trackFeature("offline_on");
  setForcedOffline(!forced);
}

function PlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
      <path d="M21 15.5v-2l-8-4.5V4a1.5 1.5 0 0 0-3 0v5L2 13.5v2l8-2.5v3.6l-2.6 1.8V20L12 18.8 16.6 20v-1.1L14 17.1v-3.6z" />
    </svg>
  );
}

export default function OfflineSwitch() {
  const { t } = useI18n();
  const forced = useSyncExternalStore(subscribeOffline, isForcedOffline);
  const browserOnline = useSyncExternalStore(subscribeOffline, isBrowserOnline);

  // Sans connexion, l'état hors ligne est un constat, pas un choix.
  const auto = !forced && !browserOnline;
  const hint = forced ? t("offline.hint_on") : auto ? t("offline.hint_auto") : t("offline.hint_off");

  return (
    <button
      type="button"
      className={`offline-btn ${forced ? "offline-btn--on" : ""} ${auto ? "offline-btn--auto" : ""}`}
      aria-pressed={forced}
      title={hint}
      aria-label={hint}
      onClick={() => toggle(forced)}
    >
      <PlaneIcon />
      <span className="offline-btn-label">{t("offline.label")}</span>
    </button>
  );
}
