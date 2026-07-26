// Envoie des events d'usage ANONYMES et AGRÉGÉS au backend (/api/track).
// Jamais le contenu, le nom du fichier, la taille exacte ni l'IP.
// Deux garde-fous : le tracking ne casse JAMAIS l'app, et il respecte le
// signal "Do Not Track" / "Global Privacy Control" du navigateur.

const ENDPOINT = "/api/track";

// Respecte le refus de suivi exprimé par le navigateur.
function trackingDisabled() {
  try {
    if (typeof navigator === "undefined") return true;
    const dnt =
      navigator.doNotTrack ||
      (typeof window !== "undefined" && window.doNotTrack) ||
      navigator.msDoNotTrack;
    if (dnt === "1" || dnt === "yes") return true;
    if (navigator.globalPrivacyControl === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function send(payload) {
  if (trackingDisabled()) return;
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    } else {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* silencieux : jamais bloquant pour l'utilisateur */
  }
}

// Taille de fichier en tranche (jamais la valeur exacte) : s < 1 Mo, m < 10 Mo,
// l < 50 Mo, xl au-delà.
export function sizeBucket(bytes) {
  const MB = 1024 * 1024;
  if (bytes < MB) return "s";
  if (bytes < 10 * MB) return "m";
  if (bytes < 50 * MB) return "l";
  return "xl";
}

export function trackPageView(page) {
  send({ event: "page_view", page });
}

// outcome: "success" | "fail" ; opts: { method, ext, size, truncated }
export function trackImport(outcome, opts = {}) {
  send({
    event: "import",
    outcome,
    method: opts.method,
    ext: opts.ext,
    size: opts.size,
    truncated: opts.truncated ? 1 : 0,
  });
}

// Réouverture d'un log déjà stocké. source: "recent" | "direct".
export function trackOpen(source, outcome) {
  send({ event: "open", outcome, method: source });
}

export function trackFeature(feature) {
  send({ event: "feature", feature });
}
