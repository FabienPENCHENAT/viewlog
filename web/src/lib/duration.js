// Formate une durée (en ms) dans l'unité la plus lisible, avec l'unité
// secondaire si pertinent : "1 mois 14 j", "5 h 20 min", "45 s"…
// Les mois/années sont approximatifs (30 j / 365 j) — suffisant pour une
// "durée couverte".
const UNITS = [
  ["dur.y", 365 * 24 * 3600],
  ["dur.mo", 30 * 24 * 3600],
  ["dur.d", 24 * 3600],
  ["dur.h", 3600],
  ["dur.min", 60],
  ["dur.s", 1],
];

export function formatDuration(ms, t, locale) {
  const s = Math.round(ms / 1000);
  if (s <= 0) return t("stats.instant");

  const i = UNITS.findIndex(([, sec]) => s >= sec);
  const [key1, sec1] = UNITS[i];
  const v1 = Math.floor(s / sec1);
  let out = `${v1.toLocaleString(locale)} ${t(key1)}`;

  const next = UNITS[i + 1];
  if (next) {
    const v2 = Math.floor((s - v1 * sec1) / next[1]);
    if (v2 > 0) out += ` ${v2.toLocaleString(locale)} ${t(next[0])}`;
  }
  return out;
}
