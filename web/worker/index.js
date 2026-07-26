// Worker ViewLog.
// - Sert le front statique (assets) avec fallback SPA.
// - Expose /api/track : enregistre un event ANONYME et AGRÉGÉ dans Analytics
//   Engine (dataset viewlog_events). Jamais le contenu, le nom de fichier, la
//   taille exacte ni l'adresse IP.
// - Expose /api/stats : dashboard privé (verrouillé par un token) qui agrège
//   les 90 derniers jours via l'API SQL d'Analytics Engine.
//
// Schéma des data points (slots FIXES, ne jamais recycler) :
//   index1 = event
//   blob1 = event (page_view | import | open | feature)
//   blob2 = pays (request.cf.country, jamais l'IP)
//   blob3 = outcome (success | fail)          [import, open]
//   blob4 = source (drop/picker/paste | recent/direct)  [import, open]
//   blob5 = tranche de taille (s | m | l | xl)          [import]
//   blob6 = troncature (1 | 0)                           [import]
//   blob7 = page (home | faq | changelog | legal)        [page_view]
//   blob8 = feature (search | regex | filter_level | time_range | view_patterns | pattern_click | export)  [feature]
//   blob9 = extension (log | txt | csv | json | ...)     [import]
//   double1 = 1

const EVENTS = new Set(["page_view", "import", "open", "feature"]);
const OUTCOMES = new Set(["success", "fail"]);
const SOURCES = new Set(["drop", "picker", "paste", "recent", "direct"]);
const SIZES = new Set(["s", "m", "l", "xl"]);
const PAGES = new Set(["home", "faq", "changelog", "legal"]);
const FEATURES = new Set([
  "search",
  "regex",
  "filter_level",
  "time_range",
  "view_patterns",
  "pattern_click",
  "export",
]);

// N'accepte qu'une valeur figurant dans l'allowlist, sinon chaîne vide.
function pick(value, allowed) {
  return typeof value === "string" && allowed.has(value) ? value : "";
}

function cleanExt(value) {
  if (typeof value !== "string") return "";
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
}

async function handleTrack(request, env) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let data = {};
  try {
    data = await request.json();
  } catch {
    /* corps invalide : ignoré silencieusement */
  }

  const event = pick(data.event, EVENTS);
  if (!event) return new Response(null, { status: 204 }); // event inconnu : on ignore

  const country = (request.cf && request.cf.country) || "unknown";
  const outcome = pick(data.outcome, OUTCOMES);
  const source = pick(data.method, SOURCES);
  const size = pick(data.size, SIZES);
  const truncated = data.truncated === 1 || data.truncated === true ? "1" : "0";
  const page = pick(data.page, PAGES);
  const feature = pick(data.feature, FEATURES);
  const ext = cleanExt(data.ext);

  if (env.ANALYTICS) {
    env.ANALYTICS.writeDataPoint({
      indexes: [event],
      blobs: [event, country, outcome, source, size, truncated, page, feature, ext],
      doubles: [1],
    });
  }

  return new Response(null, { status: 204 });
}

// --- Dashboard privé -------------------------------------------------------

const WINDOW = "NOW() - INTERVAL '90' DAY";
const DS = "viewlog_events";

// Requêtes exposées par /api/stats. Fenêtre glissante 90 j, SUM(_sample_interval).
const QUERIES = {
  summary: `SELECT
      SUM(if(blob1='page_view', _sample_interval, 0)) AS visits,
      SUM(if(blob1 IN ('import','open') AND blob3='success', _sample_interval, 0)) AS active_uses,
      SUM(if(blob1='import' AND blob3='success', _sample_interval, 0)) AS imports_ok,
      SUM(if(blob1='import' AND blob3='fail', _sample_interval, 0)) AS imports_fail,
      SUM(if(blob1='feature', _sample_interval, 0)) AS feature_events
    FROM ${DS} WHERE timestamp > ${WINDOW}`,
  visitsByDay: `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day,
      SUM(_sample_interval) AS n
    FROM ${DS} WHERE blob1='page_view' AND timestamp > ${WINDOW}
    GROUP BY day ORDER BY day`,
  pages: `SELECT blob7 AS page, SUM(_sample_interval) AS n
    FROM ${DS} WHERE blob1='page_view' AND timestamp > ${WINDOW}
    GROUP BY page ORDER BY n DESC`,
  countries: `SELECT blob2 AS country, SUM(_sample_interval) AS n
    FROM ${DS}
    WHERE blob1 IN ('page_view','import','open','feature') AND timestamp > ${WINDOW}
    GROUP BY country ORDER BY n DESC LIMIT 20`,
  importVsOpen: `SELECT blob1 AS event, SUM(_sample_interval) AS n
    FROM ${DS} WHERE blob1 IN ('import','open') AND blob3='success' AND timestamp > ${WINDOW}
    GROUP BY event`,
  methods: `SELECT blob4 AS method, SUM(_sample_interval) AS n
    FROM ${DS} WHERE blob1='import' AND timestamp > ${WINDOW}
    GROUP BY method ORDER BY n DESC`,
  outcomes: `SELECT blob3 AS outcome, SUM(_sample_interval) AS n
    FROM ${DS} WHERE blob1='import' AND timestamp > ${WINDOW}
    GROUP BY outcome`,
  extensions: `SELECT blob9 AS ext, SUM(_sample_interval) AS n
    FROM ${DS} WHERE blob1='import' AND timestamp > ${WINDOW}
    GROUP BY ext ORDER BY n DESC`,
  sizes: `SELECT blob5 AS size_bucket, SUM(_sample_interval) AS n
    FROM ${DS} WHERE blob1='import' AND timestamp > ${WINDOW}
    GROUP BY size_bucket ORDER BY n DESC`,
  truncated: `SELECT blob6 AS truncated, SUM(_sample_interval) AS n
    FROM ${DS} WHERE blob1='import' AND timestamp > ${WINDOW}
    GROUP BY truncated`,
  features: `SELECT blob8 AS feature, SUM(_sample_interval) AS n
    FROM ${DS} WHERE blob1='feature' AND timestamp > ${WINDOW}
    GROUP BY feature ORDER BY n DESC`,
  failBySize: `SELECT blob5 AS size_bucket, SUM(_sample_interval) AS n
    FROM ${DS} WHERE blob1='import' AND blob3='fail' AND timestamp > ${WINDOW}
    GROUP BY size_bucket ORDER BY n DESC`,
};

// Comparaison à temps constant (évite une fuite du token par timing).
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Token accepté UNIQUEMENT dans l'en-tête Authorization (jamais en query :
// une URL avec token peut fuiter via historique / logs / referrer).
function bearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

async function runSql(env, query) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}` },
      body: query,
    }
  );
  if (!res.ok) throw new Error(`SQL ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

async function handleStats(request, env) {
  // Rate limiting (anti brute-force du token), par IP. Périodes autorisées : 10 ou 60 s.
  if (env.STATS_LIMITER) {
    const ip = request.headers.get("CF-Connecting-IP") || "anon";
    const { success } = await env.STATS_LIMITER.limit({ key: `stats:${ip}` });
    if (!success) return new Response("Too Many Requests", { status: 429 });
  }
  // Verrou : token secret partagé (env.STATS_TOKEN), jamais exposé au front,
  // comparé à temps constant, et lu uniquement dans l'en-tête Authorization.
  if (!env.STATS_TOKEN || !safeEqual(bearerToken(request), env.STATS_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN) {
    return new Response("Stats not configured", { status: 501 });
  }

  const keys = Object.keys(QUERIES);
  const results = await Promise.all(
    keys.map((k) =>
      runSql(env, QUERIES[k]).catch(() => []) // une requête qui échoue ne casse pas le reste
    )
  );

  const out = {};
  keys.forEach((k, i) => {
    out[k] = k === "summary" ? results[i][0] || {} : results[i];
  });

  return new Response(JSON.stringify(out), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/track") return handleTrack(request, env);
    if (url.pathname === "/api/stats") return handleStats(request, env);

    // Toute autre route /api/* n'existe pas.
    if (url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    // Reste : front statique (le binding ASSETS gère le fallback SPA).
    return env.ASSETS.fetch(request);
  },
};
