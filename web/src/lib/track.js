// Envoie un signal d'usage ANONYME au backend à chaque traitement de fichier :
// l'issue ("success" | "fail") et l'extension du fichier (ex. "log", "txt").
// Jamais le nom, ni le contenu. Le pays est déduit côté serveur, sans IP stockée.
// Le tracking ne doit JAMAIS casser l'app.
export function trackAnalysis(outcome, ext) {
  try {
    const body = JSON.stringify({ outcome, ext });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/track", {
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
