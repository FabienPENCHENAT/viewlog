// Agrégats calculés à partir des entrées parsées : totaux par niveau, plage
// temporelle, et série temporelle (buckets) pour le graphe.
import { LEVELS } from "./shared.js";

export function buildStats(entries) {
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  const timestamps = [];

  for (const e of entries) {
    byLevel[e.level] = (byLevel[e.level] || 0) + 1;
    if (e.ts) timestamps.push(new Date(e.ts).getTime());
  }

  let timeSpan = null;
  let timeline = [];

  if (timestamps.length) {
    timestamps.sort((a, b) => a - b);
    const start = timestamps[0];
    const end = timestamps[timestamps.length - 1];
    timeSpan = { start: new Date(start).toISOString(), end: new Date(end).toISOString() };

    const BUCKETS = 48;
    const span = Math.max(end - start, 1000);
    const bucketMs = Math.max(1000, Math.ceil(span / BUCKETS));
    const map = new Map();

    for (const e of entries) {
      if (!e.ts) continue;
      const t = new Date(e.ts).getTime();
      const bucket = Math.floor((t - start) / bucketMs) * bucketMs + start;
      if (!map.has(bucket)) {
        map.set(bucket, { t: new Date(bucket).toISOString(), total: 0, ERROR: 0, WARN: 0 });
      }
      const b = map.get(bucket);
      b.total += 1;
      if (e.level === "ERROR" || e.level === "FATAL") b.ERROR += 1;
      if (e.level === "WARN") b.WARN += 1;
    }
    timeline = [...map.values()].sort((a, b) => new Date(a.t) - new Date(b.t));
  }

  return {
    total: entries.length,
    byLevel,
    errorCount: byLevel.ERROR + byLevel.FATAL,
    warnCount: byLevel.WARN,
    timeSpan,
    timeline,
  };
}
