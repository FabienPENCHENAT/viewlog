// Assertions sur `lib/peaks.js`, pur et donc vérifiable hors navigateur.
//
// Deux étages, comme pour `check-pattern-diff.mjs` : des cas construits à la
// main pour la logique, puis la vérité terrain du fichier d'essai. Les tests qui
// comptent le plus sont ceux du SILENCE : sur un produit dont l'argument est la
// confiance, crier au loup coûte plus cher que rater un pic.
//
// Usage :
//   node scripts/gen-sample-log.mjs && node scripts/check-peaks.mjs

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  findPeaks, MIN_ERRORS, MIN_SCORE, MIN_LIFT, MAX_ZONES,
  VOLUME_MIN_LIFT, VOLUME_MIN_EXCLUSIVE_SHARE,
} from "../src/lib/peaks.js";
import { parse } from "../src/parser/index.js";

let pass = 0;
const fails = [];
const ok = (label, cond) => (cond ? pass++ : fails.push(label));
const eq = (label, got, want) => ok(`${label} (attendu ${want}, obtenu ${got})`, got === want);

const T = (s) => new Date(s).getTime();
const at = (ms, level, message = "line") => ({
  ts: new Date(ms).toISOString(), level, message, raw: message,
});
// Trafic régulier : une ligne toutes les 10 s, avec un taux d'erreur de fond.
function traffic(fromMs, minutes, errEvery = 0) {
  const out = [];
  const n = minutes * 6;
  for (let i = 0; i < n; i++) {
    const bad = errEvery > 0 && i % errEvery === 0;
    out.push(at(fromMs + i * 10000, bad ? "ERROR" : "INFO", bad ? "background fault" : "ok"));
  }
  return out;
}
function burst(fromMs, minutes, perMinute) {
  const out = [];
  for (let m = 0; m < minutes; m++) {
    for (let k = 0; k < perMinute; k++) {
      out.push(at(fromMs + m * 60000 + k * (60000 / perMinute), "ERROR", "incident fault"));
    }
  }
  return out;
}
const MIN = 60000;
const BASE = T("2026-03-02T00:00:00");

// ------------------------------------------------------------- 1. le silence

{
  const quiet = traffic(BASE, 600, 60); // 10 h, ~1 erreur sur 60 lignes
  eq("un trafic régulier ne propose rien", findPeaks(quiet).length, 0);
}

{
  // Un pic de VOLUME sans hausse du taux d'erreur : c'est du trafic, pas un
  // incident. Le cas qui interdit de détecter sur le nombre de messages.
  const day = [
    ...traffic(BASE, 240, 60),
    ...traffic(BASE + 240 * MIN, 60, 60).flatMap((e, i) => [e, at(e.ts ? new Date(e.ts).getTime() + 3000 : 0, i % 60 === 0 ? "ERROR" : "INFO", "rush")]),
    ...traffic(BASE + 300 * MIN, 240, 60),
  ];
  eq("un pic de volume à taux d'erreur constant ne propose rien", findPeaks(day).length, 0);
}

{
  const few = [...traffic(BASE, 300, 0), ...burst(BASE + 100 * MIN, 1, MIN_ERRORS - 4)];
  eq(`moins de ${MIN_ERRORS} erreurs ne propose rien`, findPeaks(few).length, 0);
}

{
  eq("un fichier sans erreur ne propose rien", findPeaks(traffic(BASE, 300, 0)).length, 0);
  eq("un fichier vide ne casse pas", findPeaks([]).length, 0);
  eq("des entrées sans horodatage ne cassent pas",
    findPeaks([{ level: "ERROR", message: "x", raw: "x" }]).length, 0);
}

// -------------------------------------------------- 2. ce qu'il doit trouver

{
  const evs = [
    ...traffic(BASE, 300, 120),
    ...burst(BASE + 150 * MIN, 20, 30),
    ...traffic(BASE + 300 * MIN, 300, 120),
  ];
  const z = findPeaks(evs);
  eq("un incident isolé est trouvé", z.length, 1);
  if (z[0]) {
    const from = (z[0].from - BASE) / MIN;
    ok(`la borne basse tombe sur l'incident (${from.toFixed(0)} min, attendu ~150)`,
      Math.abs(from - 150) <= 2);
    ok(`le taux est élevé (×${z[0].lift.toFixed(1)})`, z[0].lift >= MIN_LIFT);
    ok(`le score dépasse le seuil (${z[0].score.toFixed(0)})`, z[0].score >= MIN_SCORE);
  }
}

{
  // Deux incidents séparés : ils ne doivent PAS fusionner en une seule zone
  // couvrant le calme entre eux.
  const evs = [
    ...traffic(BASE, 600, 120),
    ...burst(BASE + 100 * MIN, 20, 30),
    ...burst(BASE + 400 * MIN, 20, 30),
  ];
  const z = findPeaks(evs);
  eq("deux incidents restent deux zones", z.length, 2);
  if (z.length === 2) {
    const gap = (z[1].from - z[0].to) / MIN;
    ok(`les deux zones sont bien séparées (${gap.toFixed(0)} min d'écart)`, gap > 200);
  }
}

{
  // Un incident qui pèse lourd dans son propre fichier : la référence doit être
  // le reste, sinon il gonfle sa propre norme et disparaît.
  const evs = [...traffic(BASE, 120, 200), ...burst(BASE + 50 * MIN, 20, 40)];
  const z = findPeaks(evs);
  eq("un incident qui pèse un sixième du fichier est quand même trouvé", z.length, 1);
}

{
  const evs = [
    ...traffic(BASE, 600, 120),
    ...burst(BASE + 100 * MIN, 10, 40),
    ...burst(BASE + 250 * MIN, 10, 40),
    ...burst(BASE + 400 * MIN, 10, 40),
    ...burst(BASE + 550 * MIN, 10, 40),
  ];
  ok(`jamais plus de ${MAX_ZONES} zones proposées`, findPeaks(evs).length <= MAX_ZONES);
}

{
  // Multi-échelle : une rafale courte et un incident long dans le même fichier.
  const evs = [
    ...traffic(BASE, 900, 120),
    ...burst(BASE + 200 * MIN, 2, 40),   // court
    ...burst(BASE + 600 * MIN, 60, 20),  // long
  ];
  const z = findPeaks(evs);
  eq("une rafale courte et un incident long sont trouvés ensemble", z.length, 2);
  if (z.length === 2) {
    const durations = z.map((x) => (x.to - x.from) / MIN).sort((a, b) => a - b);
    ok(`des durées très différentes (${durations.map((d) => d.toFixed(0)).join(" et ")} min)`,
      durations[0] < 10 && durations[1] > 30);
  }
}

// --------------------------------- 2 bis. le volume, et son contre-poison
//
// Le signal volume existe pour UN cas : une application qui range ses incidents
// ailleurs qu'en ERROR. Il ne doit rien détecter d'autre, et les tests qui le
// prouvent sont ceux du silence.

// Un pic qui dit des choses NOUVELLES : c'est l'incident mal classé.
function storm(fromMs, minutes, perMin) {
  const out = [];
  for (let m = 0; m < minutes; m++) {
    for (let k = 0; k < perMin; k++) {
      const t = fromMs + m * MIN + k * (MIN / perMin);
      const bad = k % 4 === 0;
      out.push(at(t, bad ? "ERROR" : "WARN",
        bad ? "circuit breaker open for shard 7" : "retrying upstream call"));
    }
  }
  return out;
}
// Un pic qui dit les MÊMES choses, en plus grand nombre : c'est du trafic.
function rush(fromMs, minutes, errEvery, times) {
  const out = [];
  for (const e of traffic(fromMs, minutes, errEvery)) {
    const t = new Date(e.ts).getTime();
    for (let k = 0; k < times; k++) out.push(at(t + k * 1000, e.level, e.message));
  }
  return out;
}

{
  // Le cas d'origine : le fond du fichier a 33 % d'erreurs, le pic seulement
  // 25 %. Son taux d'erreur BAISSE, donc le premier signal est aveugle.
  const evs = [
    ...traffic(BASE, 300, 3),
    ...storm(BASE + 150 * MIN, 60, 300),
    ...traffic(BASE + 300 * MIN, 300, 3),
  ];
  const z = findPeaks(evs);
  eq("un incident rangé en WARN est trouvé", z.length, 1);
  if (z[0]) {
    eq("il est trouvé sur le volume", z[0].kind, "volume");
    ok(`son taux d'erreur est plus BAS que le reste (${(z[0].rate * 100).toFixed(0)} % contre ${(z[0].rateOutside * 100).toFixed(0)} %)`,
      z[0].rate < z[0].rateOutside);
    ok(`son débit explose (×${z[0].volumeLift.toFixed(0)})`, z[0].volumeLift >= VOLUME_MIN_LIFT);
    ok("il porte des motifs exclusifs", z[0].exclusive > 0);
  }
}

{
  // Le contre-test qui donne sa valeur au précédent : même forme de pic, mêmes
  // proportions, mais rien de neuf dedans.
  const evs = [
    ...traffic(BASE, 300, 3),
    ...rush(BASE + 150 * MIN, 60, 3, 5),
    ...traffic(BASE + 300 * MIN, 300, 3),
  ];
  eq("un pic de trafic pur ne propose rien", findPeaks(evs).length, 0);
}

{
  // Une poignée de lignes uniques ne fait pas une zone : sans le plancher de
  // part, le moindre gros fichier en trouverait partout.
  const noise = [];
  for (let i = 0; i < 40; i++) noise.push(at(BASE + 150 * MIN + i * 1000, "INFO", `one-off ${i}`));
  const evs = [
    ...traffic(BASE, 300, 3),
    ...rush(BASE + 150 * MIN, 60, 3, 5),
    ...noise,
    ...traffic(BASE + 300 * MIN, 300, 3),
  ];
  ok(`quelques lignes uniques dans un pic ne suffisent pas (seuil ${VOLUME_MIN_EXCLUSIVE_SHARE * 100} %)`,
    findPeaks(evs).length === 0);
}

{
  // Un pic gros mais court : sous le plancher de lignes, on ne dérange pas.
  const evs = [
    ...traffic(BASE, 300, 3),
    ...storm(BASE + 150 * MIN, 1, 60),
    ...traffic(BASE + 300 * MIN, 300, 3),
  ];
  eq("un pic de moins de 200 lignes ne propose rien", findPeaks(evs).length, 0);
}

{
  // Quand les deux signaux voient la même chose, c'est le taux d'erreur qui
  // parle : il est plus spécifique, et deux zones superposées n'apprendraient
  // rien de plus.
  const evs = [
    ...traffic(BASE, 600, 120),
    ...burst(BASE + 150 * MIN, 20, 60),
  ];
  const z = findPeaks(evs);
  eq("un incident vu par les deux signaux ne sort qu'une fois", z.length, 1);
  if (z[0]) eq("et c'est la zone d'erreurs qui est gardée", z[0].kind, "rate");
}

// ------------------------------------------- 3. vérité terrain du fichier type

const SAMPLE = join(homedir(), "Downloads", "vending-machine-week.log");
if (!existsSync(SAMPLE)) {
  console.log("(fichier type absent, étage 3 ignoré : node scripts/gen-sample-log.mjs)");
} else {
  const { entries } = parse(readFileSync(SAMPLE, "utf8"));
  const ms = (e) => new Date(e.ts).getTime();
  const withTs = entries.filter((e) => e.ts);
  const slice = (from, to) => withTs.filter((e) => ms(e) >= from && e.ts && ms(e) < to);
  const hhmm = (t) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const z = findPeaks(withTs);
  eq("fichier type : deux zones", z.length, 2);
  if (z.length === 2) {
    eq("la première tombe sur l'incident de pompe", hhmm(z[0].from), "14:05");
    eq("la seconde tombe sur l'incident de paiement", hhmm(z[1].from), "09:25");
    const d0 = (z[0].to - z[0].from) / MIN, d1 = (z[1].to - z[1].from) / MIN;
    ok(`durées proches de la vérité terrain (${d0.toFixed(0)} et ${d1.toFixed(0)} min, attendu 75 et 80)`,
      Math.abs(d0 - 75) <= 3 && Math.abs(d1 - 80) <= 3);
  }

  // Les contrôles : aucune portion normale ne doit rien proposer.
  const controls = [
    ["lundi -> vendredi", T("2026-07-27T00:00:00"), T("2026-08-01T00:00:00")],
    ["mardi seul", T("2026-07-28T00:00:00"), T("2026-07-29T00:00:00")],
    ["pause café du mardi", T("2026-07-28T07:00:00"), T("2026-07-28T11:00:00")],
    ["nuit de jeudi", T("2026-07-30T00:00:00"), T("2026-07-30T06:00:00")],
  ];
  for (const [label, from, to] of controls) {
    eq(`silence sur « ${label} »`, findPeaks(slice(from, to)).length, 0);
  }

  // Samedi seul : l'incident pèse un quart du jour et doit rester trouvé.
  const sat = findPeaks(slice(T("2026-08-01T00:00:00"), T("2026-08-02T00:00:00")));
  eq("samedi seul : l'incident est trouvé", sat.length, 1);
  if (sat[0]) eq("samedi seul : bonne borne", hhmm(sat[0].from), "14:05");

  // Indépendance à l'ordre des entrées : le binning se fait par horodatage, donc
  // un fichier dont les lignes ne sont pas strictement chronologiques (cas réel)
  // doit donner exactement le même résultat.
  const shuffled = withTs.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (i * 7919) % (i + 1); // permutation déterministe, sans Math.random
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const zs = findPeaks(shuffled);
  ok("l'ordre des entrées ne change pas le résultat",
    zs.length === z.length && zs.every((x, i) => x.from === z[i].from && x.to === z[i].to));
}

console.log(`\nMIN_ERRORS=${MIN_ERRORS}  MIN_SCORE=${MIN_SCORE}  MIN_LIFT=${MIN_LIFT}  MAX_ZONES=${MAX_ZONES}`);
if (fails.length) {
  console.log(`\n${pass} assertions passées, ${fails.length} ÉCHECS :`);
  for (const f of fails) console.log(`   ✗ ${f}`);
  process.exit(1);
}
console.log(`${pass} assertions passées.`);
