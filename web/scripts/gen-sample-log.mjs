// Génère un fichier de logs réaliste : un distributeur de boissons sur une
// semaine, avec deux incidents le week-end.
//
// À quoi ça sert : les seuils d'analyse (détection de pic, facteur de
// sur-représentation, marge autour d'une zone) ne se règlent pas au
// raisonnement, ils se mesurent sur un vrai fichier. Un fichier synthétique
// mais COHÉRENT, dont on connaît la vérité terrain, permet de vérifier qu'un
// réglage trouve bien ce qu'on y a mis, et surtout qu'il ne trouve pas ce
// qu'on n'y a pas mis.
//
// Usage :
//   node scripts/gen-sample-log.mjs [--out chemin] [--seed 42]
//
// Déterministe : même graine, même octet. Aucun Math.random().

import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------- paramètres

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const OUT = arg("out", join(homedir(), "Downloads", "vending-machine-week.log"));
const SEED = Number(arg("seed", 20260801));

// Lundi 00:00 -> dimanche 23:59, sept jours pleins. Les deux incidents tombent
// le week-end, quand le bâtiment est calme : c'est le cas le plus dur pour la
// comparaison de zone, donc le plus utile à tester.
const WEEK_START = "2026-07-27"; // un lundi

const MACHINE = "VM-042";

// Boissons servies, avec leur emplacement et leur prix.
const DRINKS = [
  ["espresso", 2, "1.20"],
  ["lungo", 3, "1.20"],
  ["americano", 4, "1.40"],
  ["cappuccino", 5, "1.80"],
  ["latte_macchiato", 6, "1.80"],
  ["hot_chocolate", 7, "1.50"],
  ["green_tea", 8, "1.00"],
  ["tomato_soup", 1, "1.60"],
];

const METHODS = ["card", "coin", "badge", "app"];

// Profil horaire du bâtiment. Deux pauses café (matin, après-déjeuner) et un
// creux total la nuit : c'est ce rythme qui donne au graphe sa forme lisible.
const WEEKDAY_SHAPE = [
  0, 0, 0, 0, 0, 0.02, 0.18, 0.75, 1.0, 0.9, 0.55, 0.45,
  0.9, 1.0, 0.6, 0.5, 0.5, 0.3, 0.12, 0.05, 0.02, 0.02, 0.01, 0.01,
];
// Le week-end, seuls quelques gardiens et une équipe d'astreinte passent.
const WEEKEND_SHAPE = [
  0, 0, 0, 0, 0, 0, 0.04, 0.08, 0.12, 0.14, 0.16, 0.14,
  0.12, 0.1, 0.12, 0.14, 0.12, 0.08, 0.05, 0.03, 0.02, 0.02, 0.01, 0.01,
];

const ORDERS_WEEKDAY = 600;
const ORDERS_WEEKEND = 70;

// Les deux incidents. Chacun a une cause qui n'existe QUE là (elle doit sortir
// en « seulement ici »), et ils partagent deux motifs de saturation présents
// aussi en temps normal, en bien plus rare (ils doivent sortir en
// « sur-représenté », pas en exclusif).
const INCIDENTS = [
  {
    id: "pump",
    day: 5, // samedi
    from: [14, 5],
    to: [15, 20],
    attemptsPerMin: 6,
  },
  {
    id: "gateway",
    day: 6, // dimanche
    from: [9, 25],
    to: [10, 45],
    attemptsPerMin: 5,
  },
];

// ------------------------------------------------------------------- aléatoire

// mulberry32 : court, correct, et surtout reproductible.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const chance = (p) => rnd() < p;
const dec = (lo, hi, digits = 1) => (lo + rnd() * (hi - lo)).toFixed(digits);

// --------------------------------------------------------------- construction

const DAY_MS = 86400000;
const weekStartMs = new Date(`${WEEK_START}T00:00:00`).getTime();
const dayMs = (day) => weekStartMs + day * DAY_MS;
const at = (day, h, m, s = 0, ms = 0) => dayMs(day) + ((h * 60 + m) * 60 + s) * 1000 + ms;

/** @type {{ms:number, level:string, comp:string, msg:string, extra?:string[]}[]} */
const events = [];
let orderSeq = 10000;

function push(ms, level, comp, msg, extra) {
  events.push({ ms, level, comp, msg, extra });
}

// Une commande servie normalement : le chemin heureux, six lignes.
function successfulOrder(ms) {
  const [drink, slot, price] = pick(DRINKS);
  const order = ++orderSeq;
  const method = pick(METHODS);
  push(ms, "INFO", "ui", `Selection: ${drink} (slot ${slot})`);
  push(ms + int(400, 1200), "INFO", "pay", `Payment accepted: ${method}, ${price} EUR`);
  push(ms + int(1500, 2200), "INFO", "brew", `Brewing started: ${drink}, order ${order}`);
  push(ms + int(2400, 3000), "DEBUG", "brew", `Boiler temperature ${dec(90.5, 93.5)}C, target 92.0C`);
  // Le succès, et c'est important : pendant un incident cette ligne DISPARAÎT,
  // ce qui doit remonter en « absent ici ». Un manque ne se voit pas en
  // défilant, c'est tout l'intérêt du groupe.
  push(ms + int(21000, 32000), "INFO", "brew", `Cup dispensed, order ${order} complete`);
  push(ms + int(32500, 33500), "DEBUG", "telemetry", `Event queued: order_complete, order ${order}`);

  // Menus aléas du quotidien, présents partout : c'est le bruit de fond que la
  // comparaison doit apprendre à ignorer.
  if (chance(0.03)) push(ms + int(3000, 8000), "WARN", "brew", `Cup sensor retry ${int(1, 2)}/3`);
  if (chance(0.012)) push(ms + int(4000, 9000), "WARN", "brew", `Order queue depth ${int(4, 9)}, workers saturated`);
  if (chance(0.008)) push(ms + int(5000, 9000), "ERROR", "brew", `Brew aborted: order ${order} refunded`);
  if (chance(0.006)) push(ms + int(1000, 2000), "ERROR", "pay", `Payment declined: card reader timeout after ${int(6000, 9000)}ms`);
}

// Une commande pendant l'incident de pompe : plus de café, et la cause propre
// à cet incident.
function pumpFailure(ms) {
  const [drink, slot] = pick(DRINKS);
  const order = ++orderSeq;
  push(ms, "INFO", "ui", `Selection: ${drink} (slot ${slot})`);
  push(ms + int(400, 900), "INFO", "pay", `Payment accepted: card, 1.20 EUR`);
  push(ms + int(1400, 2000), "INFO", "brew", `Brewing started: ${drink}, order ${order}`);
  push(ms + int(2600, 4000), "WARN", "pump", `Pressure retry ${int(1, 3)}/3`);
  push(ms + int(4200, 6000), "ERROR", "pump", `Pump pressure out of range: ${dec(2.1, 4.8)} bar, expected 9.0`);
  push(ms + int(6200, 7000), "ERROR", "brew", `Brew aborted: order ${order} refunded`);
  push(ms + int(7200, 8000), "WARN", "brew", `Order queue depth ${int(12, 58)}, workers saturated`);
  if (chance(0.05)) {
    push(ms + int(8200, 9000), "ERROR", "pump", `Unhandled fault while priming circuit`, [
      "    at PumpController.prime (pump.js:118)",
      "    at BrewJob.start (brew.js:64)",
      "    at OrderQueue.drain (queue.js:203)",
      `    Caused by: PressureTimeout: no pressure after ${int(4000, 7000)}ms`,
    ]);
  }
}

// Une commande pendant la panne de paiement : la transaction n'aboutit pas, la
// machine elle-même va bien.
function gatewayFailure(ms) {
  const [drink, slot] = pick(DRINKS);
  const order = ++orderSeq;
  push(ms, "INFO", "ui", `Selection: ${drink} (slot ${slot})`);
  push(ms + int(300, 800), "WARN", "pay", `Card reader retry ${int(1, 3)}/3`);
  push(ms + int(1000, 2400), "ERROR", "pay", `Payment gateway unreachable: gw-eu-${int(1, 4)}.pay.local after ${int(8000, 15000)}ms`);
  push(ms + int(2600, 3400), "ERROR", "brew", `Brew aborted: order ${order} refunded`);
  push(ms + int(3600, 4400), "WARN", "brew", `Order queue depth ${int(10, 44)}, workers saturated`);
  if (chance(0.04)) {
    push(ms + int(4600, 5200), "FATAL", "pay", `Payment subsystem disabled, cash only`);
  }
}

function inIncident(ms) {
  for (const inc of INCIDENTS) {
    const from = at(inc.day, inc.from[0], inc.from[1]);
    const to = at(inc.day, inc.to[0], inc.to[1]);
    if (ms >= from && ms < to) return inc;
  }
  return null;
}

// ------------------------------------------------------------------- la semaine

for (let day = 0; day < 7; day++) {
  const weekend = day >= 5;
  const shape = weekend ? WEEKEND_SHAPE : WEEKDAY_SHAPE;
  const total = weekend ? ORDERS_WEEKEND : ORDERS_WEEKDAY;
  const sum = shape.reduce((a, b) => a + b, 0);

  // Fond permanent : la machine parle même quand personne ne consomme. C'est
  // ce plancher qui évite les trous dans la courbe et rend un pic lisible.
  for (let m = 0; m < 24 * 60; m += 5) {
    const ms = at(day, 0, m, int(0, 59));
    if (chance(0.015)) {
      push(ms, "WARN", "net", `Telemetry sync retry 1/3`);
    } else {
      push(ms, "DEBUG", "net", `Telemetry sync ok in ${int(120, 480)}ms`);
    }
  }
  for (let m = 0; m < 24 * 60; m += 15) {
    push(at(day, 0, m, int(0, 59)), "DEBUG", "sys", `Boiler idle at ${dec(88.0, 92.0)}C, pressure ${dec(8.6, 9.4)} bar`);
  }

  // Autotest de nuit : présent chaque jour, jamais pendant un incident. C'est
  // volontairement un faux ami pour le groupe « absent ici ».
  push(at(day, 3, int(0, 12), int(0, 59)), "INFO", "maint", `Nightly self-test passed, 18 checks`);

  // Consommables : ils descendent avec la journée, on recharge le matin.
  if (!weekend) {
    push(at(day, 6, int(20, 50)), "INFO", "maint", `Refill: water tank filled to 100%, beans ${int(80, 100)}%`);
    push(at(day, int(11, 12), int(0, 59)), "WARN", "maint", `Water level low: ${int(14, 22)}%`);
    if (chance(0.6)) push(at(day, int(15, 17), int(0, 59)), "WARN", "maint", `Cup stock low: ${int(8, 25)} remaining`);
    if (chance(0.35)) push(at(day, int(16, 18), int(0, 59)), "ERROR", "maint", `Ingredient unavailable: ${pick(["milk_powder", "chocolate", "sugar"])}`);
  }

  // Passage du technicien, le mercredi matin.
  if (day === 2) {
    const base = at(day, 7, 10);
    push(base, "INFO", "maint", `Maintenance door opened, technician badge 0x${int(40000, 65000).toString(16).toUpperCase()}`);
    push(base + 60000, "INFO", "maint", `Descaling cycle started, estimated 900s`);
    push(base + 240000, "DEBUG", "maint", `Descaling progress 40%`);
    push(base + 900000, "INFO", "maint", `Descaling cycle completed, 1 filter replaced`);
    push(base + 960000, "INFO", "maint", `Maintenance door closed, machine back in service`);
  }

  // Les commandes de la journée, réparties selon le profil horaire.
  for (let h = 0; h < 24; h++) {
    const expected = (total * shape[h]) / sum;
    let n = Math.floor(expected);
    if (chance(expected - n)) n += 1;
    for (let k = 0; k < n; k++) {
      const ms = at(day, h, int(0, 59), int(0, 59), int(0, 999));
      // Pendant un incident, la machine ne sert plus : les commandes normales
      // de ces minutes-là n'existent pas, elles sont remplacées plus bas.
      if (inIncident(ms)) continue;
      successfulOrder(ms);
    }
  }

  push(at(day, 23, 55), "INFO", "report", `Daily report: ${weekend ? int(40, 80) : int(520, 640)} beverages served, ${int(0, 3)} faults, ${int(0, 4)} refunds`);
}

// ------------------------------------------------------------------- incidents

for (const inc of INCIDENTS) {
  const from = at(inc.day, inc.from[0], inc.from[1]);
  const to = at(inc.day, inc.to[0], inc.to[1]);
  const minutes = (to - from) / 60000;

  push(from - 45000, "WARN", inc.id === "pump" ? "pump" : "pay",
    inc.id === "pump"
      ? `Pressure drifting, ${dec(7.1, 8.4)} bar below nominal`
      : `Gateway latency rising, ${int(2200, 4800)}ms`);

  for (let m = 0; m < minutes; m++) {
    // Les clients réessaient, donc la cadence monte au coeur de l'incident.
    const ramp = 0.55 + 0.45 * Math.sin((Math.PI * m) / minutes);
    let n = Math.floor(inc.attemptsPerMin * ramp);
    if (chance(inc.attemptsPerMin * ramp - n)) n += 1;
    for (let k = 0; k < n; k++) {
      const ms = from + m * 60000 + int(0, 59) * 1000 + int(0, 999);
      if (inc.id === "pump") pumpFailure(ms);
      else gatewayFailure(ms);
    }
  }

  push(to + int(30000, 90000), "INFO", inc.id === "pump" ? "pump" : "pay",
    inc.id === "pump"
      ? `Pressure back to nominal, ${dec(8.9, 9.2)} bar`
      : `Payment gateway reachable again, ${int(180, 420)}ms`);
  push(to + int(95000, 140000), "INFO", "brew", `Order queue drained, service nominal`);
}

// ---------------------------------------------------------------------- sortie

events.sort((a, b) => a.ms - b.ms);

const pad = (n, w = 2) => String(n).padStart(w, "0");
function stamp(ms) {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  );
}

const out = [];
for (const e of events) {
  out.push(`${stamp(e.ms)} ${e.level.padEnd(5)} [${MACHINE}] [${e.comp}] ${e.msg}`);
  if (e.extra) for (const line of e.extra) out.push(line);
}
writeFileSync(OUT, out.join("\n") + "\n", "utf8");

// ----------------------------------------------------------------- récapitulatif

const byLevel = {};
const byDay = {};
for (const e of events) {
  byLevel[e.level] = (byLevel[e.level] || 0) + 1;
  const k = new Date(e.ms).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
  byDay[k] = (byDay[k] || 0) + 1;
}

console.log(`Écrit : ${OUT}`);
console.log(`Lignes : ${out.length} (${(Buffer.byteLength(out.join("\n")) / 1048576).toFixed(2)} Mo)`);
console.log(`Du ${stamp(events[0].ms)} au ${stamp(events[events.length - 1].ms)}`);
console.log(`Niveaux :`, byLevel);
console.log(`Par jour :`, byDay);
console.log(`Incidents attendus :`);
for (const inc of INCIDENTS) {
  const d = new Date(at(inc.day, inc.from[0], inc.from[1]));
  console.log(
    `  ${inc.id.padEnd(8)} ${d.toLocaleDateString("fr-FR", { weekday: "long" })} ` +
    `${pad(inc.from[0])}:${pad(inc.from[1])} -> ${pad(inc.to[0])}:${pad(inc.to[1])}`
  );
}
