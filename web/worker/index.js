// Worker ViewLog.
// - Sert le front statique (assets) avec fallback SPA.
// - Expose /api/track : enregistre un data point ANONYME dans Analytics Engine
//   à chaque traitement de fichier. On stocke uniquement l'issue
//   ("success" | "fail"), l'extension du fichier (ex. "log", "txt") et le pays
//   de connexion. Jamais le nom, ni le contenu, ni l'adresse IP.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/track") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      let outcome = "unknown";
      let ext = "unknown";
      try {
        const data = await request.json();
        if (data && (data.outcome === "success" || data.outcome === "fail")) {
          outcome = data.outcome;
        }
        if (data && typeof data.ext === "string") {
          // On ne garde qu'un token d'extension propre (alphanumérique, court).
          ext = data.ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "none";
        }
      } catch {
        /* corps invalide : on garde les valeurs par défaut */
      }

      // Pays déduit par Cloudflare (jamais l'IP). Absent en dev local.
      const country = (request.cf && request.cf.country) || "unknown";

      if (env.ANALYTICS) {
        env.ANALYTICS.writeDataPoint({
          indexes: ["analysis"], // clé d'échantillonnage (faible cardinalité)
          blobs: [outcome, ext, country], // blob1=issue, blob2=extension, blob3=pays
          doubles: [1], // double1 = 1 (un traitement)
        });
      }

      return new Response(null, { status: 204 });
    }

    // Toute autre route /api/* n'existe pas.
    if (url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    // Reste : front statique (le binding ASSETS gère le fallback SPA).
    return env.ASSETS.fetch(request);
  },
};
