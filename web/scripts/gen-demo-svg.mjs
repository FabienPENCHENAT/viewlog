// Génère les démonstrations animées de la page « cas d'usage », en FR et en EN.
//
// Pourquoi un SVG et pas un GIF ou un MP4 :
//  - un enregistrement d'écran montrerait de VRAIS logs, ce qui est intenable
//    sur un produit dont l'argument est que rien ne sort du navigateur ;
//  - les libellés d'un GIF sont cuits dans l'image, donc pas bilingues, alors
//    qu'ici les deux versions sortent du même code ;
//  - quelques kilo-octets contre plusieurs mégaoctets, et net à toutes les
//    tailles.
//
// Contraintes d'un SVG embarqué en <img> : aucun script, aucune police externe,
// pas de foreignObject. Tout est donc du texte placé à la main et des @keyframes
// CSS, avec un cycle unique partagé par tous les éléments pour rester synchrone.
//
// Deux scénarios partagent le même châssis (cartes, barre d'outils, période,
// liste) et ne diffèrent que par les courbes, la zone, le déroulé et le contenu.
//
// Régénérer :  node scripts/gen-demo-svg.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets");

/* ================= Palette (theme.css) et polices ================= */
const K = {
  page: "#0f1116", surface: "#171a21", ink: "#e7e7e4", ink2: "#a8aab2",
  muted: "#71747d", grid: "#20242d", line: "#333947", accent: "#f5a623",
  error: "#f2585d", blue: "#5a9bea",
  debug: "#3987e5", info: "#1baf7a", warn: "#fab219", err: "#d03b3b", fatal: "#4a3aa7",
  // Surlignage du résultat. Volontairement PAS l'ambre : sur un écran déjà ambré
  // (accent, période, bandeau), un surlignage ambre se fond dans le décor. Ce
  // violet est le rendu sRGB de oklch(0.76 0.13 292), soit --tab-hue-3 de
  // theme.css : il reste dans le système et n'empiète ni sur l'accent ni sur le
  // rouge d'erreur.
  hl: "#b3a1fd",
};
const SANS = "system-ui,-apple-system,'Segoe UI',sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

/* ================= Le cycle ================= */
// Propre à chaque scénario : le second a une étape de plus, donc il lui faut plus
// de temps sans accélérer les gestes.
const pct = (t, cycle) => +((t / cycle) * 100).toFixed(2);
const EASE = "cubic-bezier(.4,0,.2,1)";

/* ================= Géométrie ================= */
const W = 960;
const CH = { x: 0, y: 0, w: W, h: 300 };
const JO = { x: 0, y: 316, w: W, h: 432 };
const H = JO.y + JO.h + 2;
const PLOT = { x: 18, y: CH.y + 42, w: 924, h: 216 };
const LIST = { x: 18, y: JO.y + 236, w: 924, h: 180 };

const cursorY = PLOT.y + PLOT.h * 0.52;
const zoneX = (f) => PLOT.x + f * PLOT.w;

/* ================= Helpers ================= */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Largeur approchée d'une chaîne : suffit à placer un cadre ou un soulignement,
// et évite des positions en dur qui ne tiendraient pas d'une langue à l'autre
// (le français est plus long).
const est = (s, size, mono = false) => s.length * size * (mono ? 0.6 : 0.53);
// Les noms de niveau sont en capitales, donc nettement plus larges que la moyenne
// d'une chaîne courante : avec le facteur générique, le compte de DEBUG, WARN ou
// ERROR venait se coller au libellé.
const estCaps = (s, size) => s.length * size * 0.7;
const rect = (x, y, w, h, fill, o = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"` +
  `${o.rx ? ` rx="${o.rx}"` : ""}${o.stroke ? ` stroke="${o.stroke}"` : ""}` +
  `${o.sw ? ` stroke-width="${o.sw}"` : ""}${o.cls ? ` class="${o.cls}"` : ""}` +
  `${o.opacity != null ? ` opacity="${o.opacity}"` : ""}/>`;
const text = (x, y, s, o = {}) =>
  `<text x="${+(+x).toFixed(1)}" y="${y}" fill="${o.fill || K.ink}" font-size="${o.size || 13}"` +
  ` font-family="${o.mono ? MONO : SANS}"${o.weight ? ` font-weight="${o.weight}"` : ""}` +
  `${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.cls ? ` class="${o.cls}"` : ""}` +
  `${o.ls ? ` letter-spacing="${o.ls}"` : ""}>${esc(s)}</text>`;

const LVC = { DEBUG: K.debug, INFO: K.info, WARN: K.warn, ERROR: K.err, FATAL: K.fatal };

/* ================= Courbes =================
   Fond ondulant plus cloches gaussiennes, échantillonné finement : les courbes
   sont lisses par construction, sans spline qui déborderait sous la ligne de
   base. */
const bell = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s));
const NS = 150;
const xs = Array.from({ length: NS }, (_, i) => (i / (NS - 1)) * 48);

function sample(totalAt, errAt) {
  const tot = xs.map(totalAt);
  const er = xs.map(errAt);
  const peak = Math.max(...tot);
  const gx = (x) => +(PLOT.x + (x / 48) * PLOT.w).toFixed(1);
  const gy = (v) => +(PLOT.y + PLOT.h - (v / peak) * (PLOT.h - 10)).toFixed(1);
  const poly = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${gx(xs[i])},${gy(v)}`).join("");
  const area = (arr) => `${poly(arr)}L${gx(48)},${PLOT.y + PLOT.h}L${gx(0)},${PLOT.y + PLOT.h}Z`;
  return { lineT: poly(tot), lineE: poly(er), areaT: area(tot), areaE: area(er) };
}

// Scénario 1 : une ruée. Le total explose, l'erreur culmine au même endroit et
// nettement plus bas.
const SPIKE_CURVES = sample(
  (x) =>
    52 + 16 * Math.sin(x * 0.62) + 9 * Math.sin(x * 1.31 + 1.2) +
    300 * bell(x, 7.5, 0.9) + 420 * bell(x, 21, 1) + 3320 * bell(x, 33.5, 2.5) +
    260 * bell(x, 44.5, 1.1),
  (x) =>
    13 + 6 * Math.sin(x * 0.71 + 0.4) + 120 * bell(x, 7.5, 0.85) +
    150 * bell(x, 21, 0.95) + 1880 * bell(x, 34.1, 2.2) + 90 * bell(x, 44.5, 1.05)
);

// Scénario 2 : une journée calme. Le frémissement à l'endroit de l'erreur est
// volontairement à la limite du perceptible, et c'est tout le sujet : on ne
// trouve pas cette zone en regardant la courbe, on la connaît parce que
// l'utilisateur a donné une heure approximative.
const CALM_CURVES = sample(
  (x) => 62 + 13 * Math.sin(x * 0.55) + 7 * Math.sin(x * 1.19 + 0.7) + 4.5 * bell(x, 26.4, 0.5),
  (x) => 2 + 1.4 * Math.sin(x * 0.83 + 0.3) + 4 * bell(x, 26.4, 0.45)
);

/* ================= Contenu, par scénario ================= */
// Un robot barista. Les messages restent en anglais dans les deux langues,
// comme de vrais logs.
const SPIKE = {
  rowsAll: [
    ["DEBUG", "Bean hopper at 82%"],
    ["INFO", "Espresso pulled in 9400ms"],
    ["INFO", "Cup detected on tray 3"],
    ["INFO", "Order 41927 completed"],
    ["INFO", "Idle standby entered"],
  ],
  rowsZone: [
    ["INFO", "Order 88214 accepted"],
    ["WARN", "Queue overflow, dropping order 88215"],
    ["WARN", "Queue overflow, dropping order 88216"],
    ["ERROR", "Order timed out after 30000ms"],
    ["FATAL", "Scheduler saturated, halting intake"],
  ],
  flat: [
    ["INFO", "Espresso pulled in {n}ms", "Espresso pulled in 9400ms"],
    ["INFO", "Cup detected on tray {n}", "Cup detected on tray 3"],
    ["INFO", "Steam wand purge {n}ms", "Steam wand purge 1200ms"],
    ["WARN", "Retrying order {n}/{n}", "Retrying order 3/5"],
  ],
  // La trouvaille en premier, puis l'aggravation : la file débordait, les
  // commandes ont fini par expirer, et l'ordonnanceur a coupé les entrées. C'est
  // ce que « avant que la situation ne s'aggrave » veut dire.
  only: [
    ["WARN", "Queue overflow, dropping order {n}", "Queue overflow, dropping order 88215"],
    ["ERROR", "Order timed out after {n}ms", "Order timed out after 30000ms"],
    ["FATAL", "Scheduler saturated, halting intake", "Scheduler saturated, halting intake"],
  ],
};

// Un utilisateur n'a pas pu commander son Caramel Latte en fin de matinée.
// L'application lui a seulement dit que la préparation avait échoué. Pendant ce
// temps, des centaines d'autres boissons sont sorties normalement : l'erreur est
// noyée, et le graphique ne montre rien. Elle devient évidente dès que la fenêtre
// se resserre sur quelques minutes.
const ISOLATED = {
  rowsAll: [
    ["INFO", "Drink ready in 8900ms"],
    ["INFO", "Order 7690 accepted: Flat White"],
    ["DEBUG", "Milk level at 62%"],
    ["INFO", "Drink ready in 9100ms"],
    ["INFO", "Idle standby entered"],
  ],
  rowsZone: [
    ["INFO", "Order 7734 accepted: Caramel Latte"],
    ["ERROR", "Ingredient unavailable: caramel_syrup (order 7734)"],
    ["WARN", "Preparation failed for order 7734"],
    ["INFO", "Order 7735 accepted: Flat White"],
    ["INFO", "Drink ready in 8700ms"],
  ],
  // Trié par fréquence : l'erreur cherchée arrive en troisième position, donc
  // visible sans défiler, et les tentatives de Caramel Latte juste en dessous.
  // C'est le resserrage de la fenêtre qui rend la liste assez courte pour qu'un
  // motif vu trois fois s'y remarque.
  flat: [
    ["INFO", "Drink ready in {n}ms", "Drink ready in 8900ms"],
    ["INFO", "Order {n} accepted: Flat White", "Order 7735 accepted: Flat White"],
    ["ERROR", "Ingredient unavailable: caramel_syrup (order {n})", "Ingredient unavailable: caramel_syrup (order 7734)"],
    ["INFO", "Order {n} accepted: Caramel Latte", "Order 7734 accepted: Caramel Latte"],
  ],
  // Ce que le clic sur le motif ouvre : les trois occurrences, avec le vrai numéro
  // de commande là où le gabarit affichait un paramètre. Trois commandes
  // différentes, parce que l'utilisateur a repassé commande à chaque échec.
  rowsHits: [
    ["ERROR", "Ingredient unavailable: caramel_syrup (order 7734)"],
    ["ERROR", "Ingredient unavailable: caramel_syrup (order 7739)"],
    ["ERROR", "Ingredient unavailable: caramel_syrup (order 7742)"],
  ],
  hlRow: 2, // la ligne mise en évidence dans la liste des motifs
};

/* ================= Libellés partagés ================= */
const L = {
  fr: {
    volume: "Volume dans le temps", journal: "Journal",
    vJournal: "Journal", vPatterns: "Motifs",
    search: "Rechercher dans les logs…",
    total: "Total", errors: "Erreurs",
    period: "Période", all: "Tout",
    colTs: "Horodatage", colLevel: "Niveau", colMsg: "Message",
    patternsHead: "MOTIFS",
    eg: "ex. ",
    chips: [["DEBUG", "41 308"], ["INFO", "327 144"], ["WARN", "32 905"], ["ERROR", "11 468"], ["FATAL", "83"]],
  },
  en: {
    volume: "Volume over time", journal: "Journal",
    vJournal: "Journal", vPatterns: "Patterns",
    search: "Search the logs…",
    total: "Total", errors: "Errors",
    period: "Period", all: "All",
    colTs: "Timestamp", colLevel: "Level", colMsg: "Message",
    patternsHead: "PATTERNS",
    eg: "e.g. ",
    chips: [["DEBUG", "41,308"], ["INFO", "327,144"], ["WARN", "32,905"], ["ERROR", "11,468"], ["FATAL", "83"]],
  },
};

/* ================= Textes par scénario et par langue ================= */
const TXT = {
  spike: {
    fr: {
      aria: "ViewLog : sélectionner un pic et le comparer au reste du fichier",
      periods: [
        ["12/03 08:14 → 14/03 18:02", "· 2 j 9 h"],
        ["14/03 07:48 → 14/03 09:21", "· 1 h 33 min"],
      ],
      counts: ["412 908 entrées", "24 106 entrées", "24 106 entrées → 41 motifs uniques"],
      cmp: "· Comparer au reste du fichier",
      banner: "Zone comparée au reste du fichier",
      patternsSub: "41 uniques · les plus fréquents d'abord",
      onlyHead: "SEULEMENT ICI", onlySub: "3 motifs · absents du reste du fichier",
      fold: "3 sur-représentés, 5 absents ici",
      numAll: ["18 204", "18 205", "18 206", "18 207", "18 208"],
      tsAll: ["13/03 02:11:04", "13/03 02:11:06", "13/03 02:11:09", "13/03 02:11:22", "13/03 02:12:31"],
      numZone: ["204 881", "204 882", "204 883", "204 884", "204 885"],
      tsZone: ["14/03 08:02:11", "14/03 08:02:11", "14/03 08:02:12", "14/03 08:02:12", "14/03 08:02:19"],
      flatCounts: ["9 480×", "6 902×", "3 217×", "1 044×"],
      onlyCounts: ["2 418×", "312×", "1×"],
    },
    en: {
      aria: "ViewLog: brushing a spike and comparing it to the rest of the log file",
      periods: [
        ["03/12, 08:14 AM → 03/14, 06:02 PM", "· 2 d 9 h"],
        ["03/14, 07:48 AM → 03/14, 09:21 AM", "· 1 h 33 min"],
      ],
      counts: ["412,908 entries", "24,106 entries", "24,106 entries → 41 unique patterns"],
      cmp: "· Compare to the rest of the file",
      banner: "Zone compared to the rest of the file",
      patternsSub: "41 unique · most frequent first",
      onlyHead: "ONLY HERE", onlySub: "3 patterns · absent from the rest of the file",
      fold: "3 over-represented, 5 absent here",
      numAll: ["18,204", "18,205", "18,206", "18,207", "18,208"],
      tsAll: ["03/13, 02:11:04 AM", "03/13, 02:11:06 AM", "03/13, 02:11:09 AM", "03/13, 02:11:22 AM", "03/13, 02:12:31 AM"],
      numZone: ["204,881", "204,882", "204,883", "204,884", "204,885"],
      tsZone: ["03/14, 08:02:11 AM", "03/14, 08:02:11 AM", "03/14, 08:02:12 AM", "03/14, 08:02:12 AM", "03/14, 08:02:19 AM"],
      flatCounts: ["9,480×", "6,902×", "3,217×", "1,044×"],
      onlyCounts: ["2,418×", "312×", "1×"],
    },
  },
  isolated: {
    fr: {
      aria: "ViewLog : resserrer la fenêtre sur la plage horaire indiquée par un utilisateur, puis repérer dans les motifs l'ingrédient manquant qui a fait échouer la préparation",
      periods: [
        ["12/03 08:14 → 14/03 18:02", "· 2 j 9 h"],
        ["13/03 11:10 → 13/03 11:50", "· 40 min"],
        ["13/03 11:28 → 13/03 11:34", "· 6 min"],
      ],
      counts: ["412 908 entrées", "17 240 entrées", "2 568 entrées", "2 568 entrées → 8 motifs uniques", "3 entrées"],
      patternsSub: "8 uniques · les plus fréquents d'abord",
      patternLabel: "Motif :",
      numHits: ["61 449", "61 468", "61 474"],
      tsHits: ["13/03 11:31:08", "13/03 11:32:44", "13/03 11:33:19"],
      numAll: ["9 118", "9 119", "9 120", "9 121", "9 122"],
      tsAll: ["13/03 09:41:02", "13/03 09:41:04", "13/03 09:41:20", "13/03 09:41:31", "13/03 09:41:48"],
      numZone: ["61 447", "61 448", "61 449", "61 452", "61 453"],
      tsZone: ["13/03 11:31:07", "13/03 11:31:07", "13/03 11:31:08", "13/03 11:31:22", "13/03 11:31:31"],
      flatCounts: ["1 345×", "1 208×", "3×", "3×"],
    },
    en: {
      aria: "ViewLog: narrowing the window down to the time a user reported, then spotting in the patterns the missing ingredient that made the drink fail",
      periods: [
        ["03/12, 08:14 AM → 03/14, 06:02 PM", "· 2 d 9 h"],
        ["03/13, 11:10 AM → 03/13, 11:50 AM", "· 40 min"],
        ["03/13, 11:28 AM → 03/13, 11:34 AM", "· 6 min"],
      ],
      counts: ["412,908 entries", "17,240 entries", "2,568 entries", "2,568 entries → 8 unique patterns", "3 entries"],
      patternsSub: "8 unique · most frequent first",
      patternLabel: "Pattern:",
      numHits: ["61,449", "61,468", "61,474"],
      tsHits: ["03/13, 11:31:08 AM", "03/13, 11:32:44 AM", "03/13, 11:33:19 AM"],
      numAll: ["9,118", "9,119", "9,120", "9,121", "9,122"],
      tsAll: ["03/13, 09:41:02 AM", "03/13, 09:41:04 AM", "03/13, 09:41:20 AM", "03/13, 09:41:31 AM", "03/13, 09:41:48 AM"],
      numZone: ["61,447", "61,448", "61,449", "61,452", "61,453"],
      tsZone: ["03/13, 11:31:07 AM", "03/13, 11:31:07 AM", "03/13, 11:31:08 AM", "03/13, 11:31:22 AM", "03/13, 11:31:31 AM"],
      flatCounts: ["1,345×", "1,208×", "3×", "3×"],
    },
  },
};

/* ================= Animations ================= */
function kf(name, frames) {
  return `@keyframes ${name}{${frames.map(([p, d]) => `${p}%{${d}}`).join("")}}`;
}
function makeFade(P) {
  return (name, inAt, outAt) => {
    const f = [[0, "opacity:0"]];
    if (inAt > 0) f.push([Math.max(0, P(inAt) - 0.8), "opacity:0"]);
    f.push([P(inAt), "opacity:1"]);
    if (outAt != null) {
      f.push([Math.max(P(inAt) + 0.1, P(outAt) - 0.8), "opacity:1"]);
      f.push([P(outAt), "opacity:0"]);
    }
    f.push([100, outAt == null ? "opacity:1" : "opacity:0"]);
    return kf(name, f);
  };
}

// Plusieurs fenêtres de visibilité pour un même élément : la bascule de vue
// revient sur Journal à la fin du second scénario, donc son libellé actif est
// visible, caché, puis visible à nouveau.
function makeVisible(P) {
  return (name, wins) => {
    const f = [[0, `opacity:${wins.some(([a]) => a <= 0) ? 1 : 0}`]];
    for (const [a, b] of wins) {
      if (a > 0) {
        f.push([Math.max(0.1, P(a) - 0.8), "opacity:0"]);
        f.push([P(a), "opacity:1"]);
      }
      if (b != null) {
        f.push([Math.max(P(a) + 0.1, P(b) - 0.8), "opacity:1"]);
        f.push([P(b), "opacity:0"]);
      }
    }
    f.push([100, `opacity:${wins.some(([, b]) => b == null) ? 1 : 0}`]);
    return kf(name, f);
  };
}

// Barre de période : `left` et `width` doivent bouger ensemble, sinon le bord
// gauche saute à la zone pendant que la largeur vaut encore 100 % et la barre
// déborde la piste. Un seul transform s'en charge.
const barTo = (x, w) => `translateX(${(x - 18).toFixed(1)}px) scaleX(${(w / 924).toFixed(4)})`;
const thumbTo = (x, from) => `translateX(${(x - from).toFixed(1)}px)`;

/* --- Scénario 1 : brosser le pic, puis comparer au reste du fichier --- */
function compareScript(z, cycle) {
  const P = (t) => pct(t, cycle);
  const fade = makeFade(P);
  const T = {
    cursorIn: 0.6, brush: 1.3, brushEnd: 2.1, toPatterns: 2.8, clickPatterns: 3.4,
    cmpShows: 4.8, toCmp: 5.5, clickCmp: 6.1, highlight: 6.7, scroll: 8.8,
    foldHl: 9.5, out: 13.2,
  };
  const anims = [];
  const rules = [];
  const A = (sel, name) => rules.push(`${sel}{animation-name:${name}}`);
  const { a, b } = z;

  anims.push(kf("cur", [
    [0, `transform:translate(${a.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:0`],
    [P(T.cursorIn) - 0.5, `transform:translate(${a.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:0`],
    [P(T.cursorIn), `transform:translate(${a.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:1`],
    [P(T.brush), `transform:translate(${a.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:1;animation-timing-function:${EASE}`],
    [P(T.brushEnd), `transform:translate(${b.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:1`],
    [P(T.toPatterns), `transform:translate(${b.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:1;animation-timing-function:${EASE}`],
    [P(T.clickPatterns) - 1.2, `transform:translate(120px,${(JO.y + 65).toFixed(1)}px);opacity:1`],
    [P(T.toCmp), `transform:translate(120px,${(JO.y + 65).toFixed(1)}px);opacity:1;animation-timing-function:${EASE}`],
    [P(T.clickCmp) - 1.2, `transform:translate(360px,${(JO.y + 222).toFixed(1)}px);opacity:1`],
    [P(T.clickCmp), `transform:translate(360px,${(JO.y + 222).toFixed(1)}px);opacity:1`],
    [P(T.clickCmp) + 1, `transform:translate(360px,${(JO.y + 222).toFixed(1)}px);opacity:0`],
    [100, `transform:translate(360px,${(JO.y + 222).toFixed(1)}px);opacity:0`],
  ]));
  A(".cursor", "cur");

  anims.push(kf("press", [
    [0, "opacity:0"],
    [P(T.brush) - 0.2, "opacity:0"], [P(T.brush), "opacity:1"],
    [P(T.brushEnd), "opacity:1"], [P(T.brushEnd) + 0.3, "opacity:0"],
    [P(T.clickPatterns) - 0.2, "opacity:0"], [P(T.clickPatterns), "opacity:1"],
    [P(T.clickPatterns) + 0.9, "opacity:1"], [P(T.clickPatterns) + 1.2, "opacity:0"],
    [P(T.clickCmp) - 0.2, "opacity:0"], [P(T.clickCmp), "opacity:1"],
    [P(T.clickCmp) + 0.9, "opacity:1"], [P(T.clickCmp) + 1.2, "opacity:0"],
    [100, "opacity:0"],
  ]));
  A(".press", "press");

  anims.push(kf("selGrow", [
    [0, "transform:scaleX(0);opacity:0"],
    [P(T.brush) - 0.2, "transform:scaleX(0);opacity:0"],
    [P(T.brush), `transform:scaleX(0);opacity:1;animation-timing-function:${EASE}`],
    [P(T.brushEnd), "transform:scaleX(1);opacity:1"],
    [P(T.out), "transform:scaleX(1);opacity:1"],
    [P(T.out) + 1.5, "transform:scaleX(1);opacity:0"],
    [100, "transform:scaleX(0);opacity:0"],
  ]));
  A(".chartSel", "selGrow");

  for (const [cls, name, to] of [
    [".tsel", "perBar", barTo(a, b - a)],
    [".thA", "thumbA", thumbTo(a, 18)],
    [".thB", "thumbB", thumbTo(b, 942)],
  ]) {
    const from = cls === ".tsel" ? "translateX(0) scaleX(1)" : "translateX(0)";
    anims.push(kf(name, [
      [0, `transform:${from}`],
      [P(T.brush), `transform:${from};animation-timing-function:${EASE}`],
      [P(T.brushEnd), `transform:${to}`],
      [P(T.out), `transform:${to}`],
      [100, `transform:${from}`],
    ]));
    A(cls, name);
  }

  anims.push(fade("fJA", 0, T.brushEnd)); A(".journalAll", "fJA");
  anims.push(fade("fJZ", T.brushEnd, T.clickPatterns)); A(".journalZone", "fJZ");
  anims.push(fade("fFL", T.clickPatterns, T.clickCmp)); A(".flat", "fFL");
  anims.push(fade("fDF", T.clickCmp, T.out + 1.5)); A(".diff", "fDF");
  anims.push(fade("fBan", T.clickCmp, T.out + 1.5)); A(".banner", "fBan");
  anims.push(fade("fAll", T.brushEnd, T.out + 1.5)); A(".allBtn", "fAll");
  anims.push(fade("fPerA", 0, T.brushEnd)); A(".perA", "fPerA");
  anims.push(fade("fPerB", T.brushEnd, T.out + 1.5)); A(".perB", "fPerB");
  anims.push(fade("fCntA", 0, T.brushEnd)); A(".cntA", "fCntA");
  anims.push(fade("fCntB", T.brushEnd, T.clickPatterns)); A(".cntB", "fCntB");
  anims.push(fade("fCntC", T.clickPatterns, T.out + 1.5)); A(".cntC", "fCntC");
  anims.push(fade("fCmp", T.cmpShows, T.clickCmp)); A(".cmp", "fCmp");
  anims.push(fade("fPillJ", 0, T.clickPatterns)); A(".pillJ", "fPillJ");
  anims.push(fade("fLabJon", 0, T.clickPatterns)); A(".labJon", "fLabJon");
  anims.push(fade("fPillP", T.clickPatterns, T.out + 1.5)); A(".pillP", "fPillP");
  anims.push(fade("fLabPon", T.clickPatterns, T.out + 1.5)); A(".labPon", "fLabPon");
  anims.push(fade("fLabJoff", T.clickPatterns, T.out + 1.5)); A(".labJoff", "fLabJoff");
  anims.push(fade("fLabPoff", 0, T.clickPatterns)); A(".labPoff", "fLabPoff");
  anims.push(fade("fHl1", T.highlight, T.out + 1.5)); A(".hl1", "fHl1");
  anims.push(fade("fHl2", T.foldHl, T.out + 1.5)); A(".hl2", "fHl2");

  // Le fond ET le texte du surlignage changent ensemble : un cadre qui se voit
  // autour d'une phrase restée grise ne désigne rien.
  for (const [cls, name, at, from] of [
    [".hlTxt", "hlTxt", T.highlight, K.muted],
    [".hlTxt2", "hlTxt2", T.foldHl, K.ink2],
  ]) {
    anims.push(kf(name, [
      [0, `fill:${from};font-weight:400`],
      [P(at) - 0.5, `fill:${from};font-weight:400`],
      [P(at), "fill:#fff;font-weight:600"],
      [P(T.out), "fill:#fff;font-weight:600"],
      [100, `fill:${from};font-weight:400`],
    ]));
    A(cls, name);
  }

  anims.push(kf("scrollUp", [
    [0, "transform:translateY(0)"],
    [P(T.scroll), `transform:translateY(0);animation-timing-function:${EASE}`],
    [P(T.scroll) + 3, "transform:translateY(-34px)"],
    [P(T.out), "transform:translateY(-34px)"],
    [100, "transform:translateY(0)"],
  ]));
  A(".diffBody", "scrollUp");

  const animated = [
    ".cursor", ".press", ".chartSel", ".tsel", ".thA", ".thB", ".journalAll", ".journalZone",
    ".flat", ".diff", ".diffBody", ".banner", ".allBtn", ".perA", ".perB", ".cntA", ".cntB",
    ".cntC", ".cmp", ".pillJ", ".pillP", ".labJon", ".labJoff", ".labPon", ".labPoff",
    ".hl1", ".hlTxt", ".hl2", ".hlTxt2",
  ].join(",");

  return { anims, rules, animated, freeze: T.highlight + 0.6 };
}

/* --- Scénario 2 : brosser large, resserrer au curseur, lire les motifs, puis
       ouvrir toutes les occurrences de celui qui explique l'échec --- */
function narrowScript(z, cycle) {
  const P = (t) => pct(t, cycle);
  const fade = makeFade(P);
  const visible = makeVisible(P);
  const T = {
    cursorIn: 0.6, brush: 1.3, brushEnd: 2.2, toThumb: 3.1, drag: 4.0,
    dragEnd: 5.0, toPatterns: 5.9, clickPatterns: 6.6, highlight: 7.6,
    toRow: 9.2, clickRow: 10.0, hits: 10.3, out: 15.8,
  };
  const anims = [];
  const rules = [];
  const A = (sel, name) => rules.push(`${sel}{animation-name:${name}}`);
  const { a, b, a2 } = z;
  const thumbY = JO.y + 156;      // la poignée gauche de la barre temporelle
  const rowY = LIST.y + 30 + 2 * 47 + 22; // la ligne de motif surlignée

  anims.push(kf("cur", [
    [0, `transform:translate(${a.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:0`],
    [P(T.cursorIn) - 0.5, `transform:translate(${a.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:0`],
    [P(T.cursorIn), `transform:translate(${a.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:1`],
    [P(T.brush), `transform:translate(${a.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:1;animation-timing-function:${EASE}`],
    [P(T.brushEnd), `transform:translate(${b.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:1`],
    // Le curseur descend sur la poignée gauche : c'est le geste de resserrage.
    [P(T.toThumb) - 0.6, `transform:translate(${b.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:1;animation-timing-function:${EASE}`],
    [P(T.drag), `transform:translate(${a.toFixed(1)}px,${thumbY}px);opacity:1;animation-timing-function:${EASE}`],
    [P(T.dragEnd), `transform:translate(${a2.toFixed(1)}px,${thumbY}px);opacity:1`],
    [P(T.toPatterns), `transform:translate(${a2.toFixed(1)}px,${thumbY}px);opacity:1;animation-timing-function:${EASE}`],
    [P(T.clickPatterns) - 1, `transform:translate(120px,${(JO.y + 65).toFixed(1)}px);opacity:1`],
    // Puis sur la ligne de motif, pour en ouvrir toutes les occurrences.
    [P(T.highlight), `transform:translate(120px,${(JO.y + 65).toFixed(1)}px);opacity:1;animation-timing-function:${EASE}`],
    [P(T.toRow), `transform:translate(400px,${rowY}px);opacity:1`],
    [P(T.clickRow) + 0.4, `transform:translate(400px,${rowY}px);opacity:1`],
    [P(T.clickRow) + 1, `transform:translate(400px,${rowY}px);opacity:0`],
    [100, `transform:translate(400px,${rowY}px);opacity:0`],
  ]));
  A(".cursor", "cur");

  anims.push(kf("press", [
    [0, "opacity:0"],
    [P(T.brush) - 0.2, "opacity:0"], [P(T.brush), "opacity:1"],
    [P(T.brushEnd), "opacity:1"], [P(T.brushEnd) + 0.3, "opacity:0"],
    [P(T.drag) - 0.2, "opacity:0"], [P(T.drag), "opacity:1"],
    [P(T.dragEnd), "opacity:1"], [P(T.dragEnd) + 0.3, "opacity:0"],
    [P(T.clickPatterns) - 0.2, "opacity:0"], [P(T.clickPatterns), "opacity:1"],
    [P(T.clickPatterns) + 0.7, "opacity:1"], [P(T.clickPatterns) + 1, "opacity:0"],
    [P(T.clickRow) - 0.2, "opacity:0"], [P(T.clickRow), "opacity:1"],
    [P(T.clickRow) + 0.7, "opacity:1"], [P(T.clickRow) + 1, "opacity:0"],
    [100, "opacity:0"],
  ]));
  A(".press", "press");

  // La sélection du graphe croît d'abord vers la zone large, puis son bord gauche
  // avance : c'est la même forme qui se resserre, pas une nouvelle sélection.
  const narrowed = `translateX(${(a2 - a).toFixed(1)}px) scaleX(${((b - a2) / (b - a)).toFixed(4)})`;
  anims.push(kf("selGrow", [
    [0, "transform:scaleX(0);opacity:0"],
    [P(T.brush) - 0.2, "transform:scaleX(0);opacity:0"],
    [P(T.brush), `transform:scaleX(0);opacity:1;animation-timing-function:${EASE}`],
    [P(T.brushEnd), "transform:scaleX(1);opacity:1"],
    [P(T.drag), `transform:scaleX(1);opacity:1;animation-timing-function:${EASE}`],
    [P(T.dragEnd), `transform:${narrowed};opacity:1`],
    [P(T.out), `transform:${narrowed};opacity:1`],
    [P(T.out) + 1.5, `transform:${narrowed};opacity:0`],
    [100, "transform:scaleX(0);opacity:0"],
  ]));
  A(".chartSel", "selGrow");

  for (const [cls, name, mid, to] of [
    [".tsel", "perBar", barTo(a, b - a), barTo(a2, b - a2)],
    [".thA", "thumbA", thumbTo(a, 18), thumbTo(a2, 18)],
    [".thB", "thumbB", thumbTo(b, 942), thumbTo(b, 942)],
  ]) {
    const from = cls === ".tsel" ? "translateX(0) scaleX(1)" : "translateX(0)";
    anims.push(kf(name, [
      [0, `transform:${from}`],
      [P(T.brush), `transform:${from};animation-timing-function:${EASE}`],
      [P(T.brushEnd), `transform:${mid}`],
      [P(T.drag), `transform:${mid};animation-timing-function:${EASE}`],
      [P(T.dragEnd), `transform:${to}`],
      [P(T.out), `transform:${to}`],
      [100, `transform:${from}`],
    ]));
    A(cls, name);
  }

  anims.push(fade("fJA", 0, T.brushEnd)); A(".journalAll", "fJA");
  anims.push(fade("fJZ", T.brushEnd, T.clickPatterns)); A(".journalZone", "fJZ");
  anims.push(fade("fFL", T.clickPatterns, T.hits)); A(".flat", "fFL");
  // Le journal filtré sur le motif : les trois occurrences, avec leurs vraies
  // valeurs là où le gabarit affichait un paramètre.
  anims.push(fade("fHits", T.hits, T.out + 1.5)); A(".journalHits", "fHits");
  anims.push(fade("fBan", T.hits, T.out + 1.5)); A(".banner", "fBan");
  anims.push(fade("fAll", T.brushEnd, T.out + 1.5)); A(".allBtn", "fAll");
  anims.push(fade("fPerA", 0, T.brushEnd)); A(".perA", "fPerA");
  anims.push(fade("fPerB", T.brushEnd, T.dragEnd)); A(".perB", "fPerB");
  anims.push(fade("fPerC", T.dragEnd, T.out + 1.5)); A(".perC", "fPerC");
  anims.push(fade("fCntA", 0, T.brushEnd)); A(".cntA", "fCntA");
  anims.push(fade("fCntB", T.brushEnd, T.dragEnd)); A(".cntB", "fCntB");
  anims.push(fade("fCntC", T.dragEnd, T.clickPatterns)); A(".cntC", "fCntC");
  anims.push(fade("fCntD", T.clickPatterns, T.hits)); A(".cntD", "fCntD");
  anims.push(fade("fCntE", T.hits, T.out + 1.5)); A(".cntE", "fCntE");

  // La bascule de vue revient sur Journal quand le motif est ouvert.
  anims.push(visible("vPillJ", [[0, T.clickPatterns], [T.hits, null]])); A(".pillJ", "vPillJ");
  anims.push(visible("vLabJon", [[0, T.clickPatterns], [T.hits, null]])); A(".labJon", "vLabJon");
  anims.push(visible("vLabPoff", [[0, T.clickPatterns], [T.hits, null]])); A(".labPoff", "vLabPoff");
  anims.push(visible("vPillP", [[T.clickPatterns, T.hits]])); A(".pillP", "vPillP");
  anims.push(visible("vLabPon", [[T.clickPatterns, T.hits]])); A(".labPon", "vLabPon");
  anims.push(visible("vLabJoff", [[T.clickPatterns, T.hits]])); A(".labJoff", "vLabJoff");

  anims.push(fade("fHl2", T.highlight, T.hits)); A(".hl2", "fHl2");
  anims.push(kf("hlTxt2", [
    [0, `fill:${K.ink2};font-weight:400`],
    [P(T.highlight) - 0.5, `fill:${K.ink2};font-weight:400`],
    [P(T.highlight), "fill:#fff;font-weight:600"],
    [P(T.hits) - 0.5, "fill:#fff;font-weight:600"],
    [P(T.hits), `fill:${K.ink2};font-weight:400`],
    [100, `fill:${K.ink2};font-weight:400`],
  ]));
  A(".hlTxt2", "hlTxt2");

  const animated = [
    ".cursor", ".press", ".chartSel", ".tsel", ".thA", ".thB", ".journalAll", ".journalZone",
    ".flat", ".journalHits", ".banner", ".allBtn", ".perA", ".perB", ".perC", ".cntA", ".cntB",
    ".cntC", ".cntD", ".cntE", ".pillJ", ".pillP", ".labJon", ".labJoff", ".labPon", ".labPoff",
    ".hl2", ".hlTxt2",
  ].join(",");

  // On gèle sur le résultat : le journal filtré, qui est la réponse.
  return { anims, rules, animated, freeze: T.hits + 2 };
}

/* ================= Les scénarios ================= */
const SCENARIOS = {
  spike: {
    file: "demo-spike",
    curves: SPIKE_CURVES,
    zone: { a: zoneX(28.6 / 48), b: zoneX(38.4 / 48) },
    content: SPIKE,
    script: compareScript,
    cycle: 15,
    banner: true,
    compare: true,
    diff: true,
  },
  isolated: {
    file: "demo-isolated",
    curves: CALM_CURVES,
    // Large d'abord, parce que le client a dit « vers 14 h » et pas mieux ;
    // resserrée ensuite à la barre temporelle.
    zone: { a: zoneX(24 / 48), b: zoneX(29 / 48), a2: zoneX(26 / 48) },
    content: ISOLATED,
    script: narrowScript,
    // Une étape de plus que le premier : il lui faut plus de temps sans que les
    // gestes s'accélèrent.
    cycle: 18,
    banner: false,
    patternBanner: true,
    compare: false,
    diff: false,
  },
};

/* ================= Construction ================= */
function build(name, lang) {
  const s = SCENARIOS[name];
  const l = L[lang];
  const x = TXT[name][lang];
  const c = s.content;
  const { anims, rules, animated, freeze } = s.script(s.zone, s.cycle);
  const selA = s.zone.a;
  const selW = s.zone.b - s.zone.a;

  const tag = (tx, ty, lvl) =>
    rect(tx, ty - 11, lvl.length * 7.2 + 12, 17, LVC[lvl], { rx: 5, opacity: 0.16 }) +
    text(tx + 6, ty + 1, lvl, { size: 11, weight: 700, fill: LVC[lvl] });

  const hline = (y) =>
    `<line x1="${LIST.x}" y1="${y}" x2="${LIST.x + LIST.w}" y2="${y}" stroke="${K.grid}"/>`;

  // Journal : en-tête de colonnes puis les lignes.
  const journal = (rows, nums, times) => {
    let out =
      text(LIST.x + 12, LIST.y + 18, "#", { size: 11.5, fill: K.muted, weight: 600 }) +
      text(LIST.x + 76, LIST.y + 18, l.colTs, { size: 11.5, fill: K.muted, weight: 600 }) +
      text(LIST.x + 226, LIST.y + 18, l.colLevel, { size: 11.5, fill: K.muted, weight: 600 }) +
      text(LIST.x + 304, LIST.y + 18, l.colMsg, { size: 11.5, fill: K.muted, weight: 600 }) +
      hline(LIST.y + 28);
    rows.forEach(([lvl, msg], i) => {
      const y = LIST.y + 48 + i * 30;
      out += text(LIST.x + 12, y, nums[i], { size: 12.5, fill: K.muted });
      out += text(LIST.x + 76, y, times[i], { size: 12.5, fill: K.ink2 });
      out += tag(LIST.x + 226, y, lvl);
      out += text(LIST.x + 304, y, msg, { size: 12.5, mono: true });
      out += hline(y + 10);
    });
    return out;
  };

  // `hl` met la ligne en évidence : c'est la trouvaille du scénario 2, une erreur
  // vue cinq fois au milieu du trafic normal.
  const patRow = (y, count, lvl, tpl, ex, hl) =>
    (hl
      ? rect(LIST.x + 6, y + 3, LIST.w - 12, 41, K.hl, { rx: 5, opacity: 0.26, cls: "hl2" }) +
        `<rect x="${LIST.x + 6}" y="${y + 3}" width="${LIST.w - 12}" height="41" rx="5" fill="none" stroke="${K.hl}" stroke-opacity="0.65" class="hl2"/>`
      : "") +
    text(LIST.x + 74, y + 16, count, { size: 13, weight: 700, anchor: "end", cls: hl ? "hlTxt2" : undefined }) +
    tag(LIST.x + 86, y + 16, lvl) +
    text(LIST.x + 166, y + 14, tpl, { size: 12.5, mono: true, cls: hl ? "hlTxt2" : undefined }) +
    text(LIST.x + 166, y + 32, l.eg + ex, { size: 12, fill: K.muted }) +
    hline(y + 47);

  // L'en-tête de liste n'est pas décoratif : sans lui, passer du journal aux
  // motifs fait disparaître la ligne de titre puis la fait revenir, et ce
  // clignotement se lit comme un bug.
  const listHead = (label, sub, hl) => {
    const y = LIST.y;
    const w = est(sub, 12) + 16;
    const hx = LIST.x + LIST.w - 12 - est(sub, 12) - 8;
    return (
      rect(LIST.x, y, LIST.w, 30, K.page) +
      text(LIST.x + 12, y + 20, label, { size: 11.5, weight: 700, fill: K.ink2, ls: "0.6" }) +
      (hl
        ? rect(hx, y + 4, w, 22, K.hl, { rx: 5, opacity: 0.3, cls: "hl1" }) +
          `<rect x="${hx.toFixed(1)}" y="${y + 4}" width="${w.toFixed(1)}" height="22" rx="5" fill="none" stroke="${K.hl}" stroke-opacity="0.7" class="hl1"/>`
        : "") +
      text(LIST.x + LIST.w - 12, y + 20, sub, {
        size: 12, fill: K.muted, anchor: "end", cls: hl ? "hlTxt" : undefined,
      }) +
      hline(y + 30)
    );
  };

  const flat =
    c.flat.map(([lvl, tpl, ex], i) =>
      patRow(LIST.y + 30 + i * 47, x.flatCounts[i], lvl, tpl, ex, c.hlRow === i)).join("") +
    listHead(l.patternsHead, x.patternsSub, false);

  let diff = "";
  if (s.diff) {
    const rowsTop = LIST.y + 30;
    let diffBody = c.only.map(([lvl, tpl, ex], i) =>
      patRow(rowsTop + i * 47, x.onlyCounts[i], lvl, tpl, ex)).join("");
    const fy = rowsTop + c.only.length * 47;
    diffBody +=
      rect(LIST.x + 6, fy + 4, LIST.w - 12, 30, K.hl, { rx: 5, opacity: 0.26, cls: "hl2" }) +
      `<rect x="${LIST.x + 6}" y="${fy + 4}" width="${LIST.w - 12}" height="30" rx="5" fill="none" stroke="${K.hl}" stroke-opacity="0.65" class="hl2"/>` +
      text(LIST.x + 16, fy + 24, "▸", { size: 12, fill: K.muted, cls: "hlTxt2" }) +
      text(LIST.x + 34, fy + 24, x.fold, { size: 13, fill: K.ink2, cls: "hlTxt2" });
    diff =
      `  <g class="diff">\n` +
      `    <g clip-path="url(#clipBody)"><g class="diffBody">${diffBody}</g></g>\n` +
      `    ${listHead(x.onlyHead, x.onlySub, true)}\n` +
      `  </g>\n`;
  }

  // Barre d'outils : bascule de vue, recherche, bouton regex, puces de niveau.
  const ty = JO.y + 46;
  let toolbar =
    rect(18, ty, 132, 30, K.page, { rx: 7, stroke: K.line, sw: 1 }) +
    rect(20, ty + 2, 64, 26, K.accent, { rx: 5, cls: "pillJ" }) +
    rect(84, ty + 2, 64, 26, K.accent, { rx: 5, cls: "pillP" }) +
    text(52, ty + 19, l.vJournal, { size: 12, weight: 600, fill: K.page, anchor: "middle", cls: "labJon" }) +
    text(52, ty + 19, l.vJournal, { size: 12, weight: 600, fill: K.ink2, anchor: "middle", cls: "labJoff" }) +
    text(116, ty + 19, l.vPatterns, { size: 12, weight: 600, fill: K.page, anchor: "middle", cls: "labPon" }) +
    text(116, ty + 19, l.vPatterns, { size: 12, weight: 600, fill: K.ink2, anchor: "middle", cls: "labPoff" }) +
    rect(162, ty, 700, 30, K.page, { rx: 8, stroke: K.line, sw: 1 }) +
    text(174, ty + 20, l.search, { size: 14, fill: K.muted }) +
    rect(870, ty, 72, 30, K.page, { rx: 8, stroke: K.line, sw: 1 }) +
    text(906, ty + 20, ".*", { size: 13, weight: 700, fill: K.ink2, anchor: "middle", mono: true });

  let cx = 18;
  const cy = ty + 40;
  for (const [name2, n] of l.chips) {
    const w = estCaps(name2, 12) + est(n, 12) + 44;
    toolbar +=
      rect(cx.toFixed(1), cy, w.toFixed(1), 26, K.surface, { rx: 13, stroke: LVC[name2], sw: 1 }) +
      `<circle cx="${(cx + 15).toFixed(1)}" cy="${cy + 13}" r="4.5" fill="${LVC[name2]}"/>` +
      text(cx + 25, cy + 18, name2, { size: 12, weight: 600, fill: K.ink2 }) +
      text(cx + 25 + estCaps(name2, 12) + 10, cy + 18, n, { size: 12, fill: K.muted });
    cx += w + 6;
  }

  // Période : un état de texte par étape du scénario.
  const py = JO.y + 130;
  const perCls = ["perA", "perB", "perC"];
  const period =
    text(18, py, l.period, { size: 13, weight: 600, fill: K.ink2 }) +
    x.periods.map(([per], i) => text(74, py, per, { size: 13, cls: perCls[i] })).join("") +
    x.periods.map(([per, dur], i) =>
      text(74 + est(per, 13) + 10, py, dur, { size: 13, fill: K.muted, cls: perCls[i] })).join("") +
    rect(942 - est(l.all, 12) - 20, py - 14, est(l.all, 12) + 20, 22, "none", { rx: 6, stroke: K.accent, sw: 1, cls: "allBtn" }) +
    text(942 - 10, py + 1, l.all, { size: 12, weight: 600, fill: K.accent, anchor: "end", cls: "allBtn" }) +
    rect(18, py + 24, 924, 4, K.line, { rx: 2 }) +
    `<g class="tsel"><rect x="18" y="${py + 24}" width="924" height="4" rx="2" fill="${K.accent}"/></g>` +
    `<circle class="thA" cx="18" cy="${py + 26}" r="7" fill="${K.accent}" stroke="${K.page}" stroke-width="2"/>` +
    `<circle class="thB" cx="942" cy="${py + 26}" r="7" fill="${K.accent}" stroke="${K.page}" stroke-width="2"/>`;

  const by = JO.y + 176;
  const patternTpl = c.hlRow != null ? c.flat[c.hlRow][1] : "";
  const banner = s.patternBanner
    ? `<g class="banner">` +
      rect(18, by, 924, 32, K.accent, { rx: 8, opacity: 0.12 }) +
      `<rect x="18" y="${by}" width="924" height="32" rx="8" fill="none" stroke="${K.accent}" stroke-opacity="0.3"/>` +
      text(30, by + 21, x.patternLabel, { size: 13, fill: K.ink2 }) +
      text(30 + est(x.patternLabel, 13) + 10, by + 21, patternTpl, { size: 12.5, mono: true }) +
      text(926, by + 21, "✕", { size: 14, fill: K.ink2, anchor: "end" }) +
      `</g>`
    : s.banner
    ? `<g class="banner">` +
      rect(18, by, 924, 32, K.accent, { rx: 8, opacity: 0.12 }) +
      `<rect x="18" y="${by}" width="924" height="32" rx="8" fill="none" stroke="${K.accent}" stroke-opacity="0.3"/>` +
      text(30, by + 21, x.banner, { size: 13 }) +
      text(926, by + 21, "✕", { size: 14, fill: K.ink2, anchor: "end" }) +
      `</g>`
    : "";

  // Ligne de compte : un état par étape, et l'action au bout quand le scénario
  // l'utilise. Aucun contrôle n'est ajouté à la barre d'outils.
  const ny = JO.y + 226;
  const cntCls = ["cntA", "cntB", "cntC", "cntD", "cntE"];
  let count = x.counts.map((s2, i) => text(18, ny, s2, { size: 13, fill: K.muted, cls: cntCls[i] })).join("");
  if (s.compare) {
    const cmpX = 18 + est(x.counts[x.counts.length - 1], 13) + 14;
    count +=
      text(cmpX, ny, x.cmp, { size: 13, weight: 600, fill: K.accent, cls: "cmp" }) +
      `<line class="cmp" x1="${(cmpX + est("· ", 13)).toFixed(1)}" y1="${ny + 4}" x2="${(cmpX + est(x.cmp, 13)).toFixed(1)}" y2="${ny + 4}" stroke="${K.accent}" stroke-opacity="0.5"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(x.aria)}">
<title>${esc(x.aria)}</title>
<style>
  .chartSel,.tsel{transform-box:fill-box;transform-origin:left center}
  ${rules.join("\n  ")}
  ${animated}{animation-duration:${s.cycle}s;animation-iteration-count:infinite;animation-timing-function:linear;animation-fill-mode:both}
  /* Mouvement réduit : on gèle sur l'image qui porte l'information, grâce à un
     retard négatif combiné à une animation en pause. */
  @media (prefers-reduced-motion:reduce){
    ${animated}{animation-delay:-${freeze.toFixed(1)}s;animation-play-state:paused}
  }
  ${anims.join("\n  ")}
</style>
<defs>
  <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3987e5" stop-opacity=".34"/><stop offset="1" stop-color="#3987e5" stop-opacity="0"/></linearGradient>
  <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${K.error}" stop-opacity=".26"/><stop offset="1" stop-color="${K.error}" stop-opacity="0"/></linearGradient>
  <clipPath id="clipList"><rect x="${LIST.x}" y="${LIST.y}" width="${LIST.w}" height="${LIST.h}" rx="10"/></clipPath>
  <clipPath id="clipBody"><rect x="${LIST.x}" y="${LIST.y + 30}" width="${LIST.w}" height="${LIST.h - 30}"/></clipPath>
</defs>

<rect width="${W}" height="${H}" fill="${K.page}"/>

${rect(CH.x, CH.y, CH.w, CH.h, K.surface, { rx: 12, stroke: "rgba(255,255,255,0.08)", sw: 1 })}
${text(18, CH.y + 26, l.volume, { size: 15, weight: 650 })}
<g stroke="${K.grid}">${[0.2, 0.4, 0.6, 0.8, 1].map((f) => `<line x1="${PLOT.x}" y1="${(PLOT.y + PLOT.h * f).toFixed(1)}" x2="${PLOT.x + PLOT.w}" y2="${(PLOT.y + PLOT.h * f).toFixed(1)}"/>`).join("")}</g>
<path d="${s.curves.areaT}" fill="url(#gT)"/>
<path d="${s.curves.areaE}" fill="url(#gE)"/>
<path d="${s.curves.lineT}" fill="none" stroke="${K.blue}" stroke-width="2.2" stroke-linejoin="round"/>
<path d="${s.curves.lineE}" fill="none" stroke="${K.error}" stroke-width="2.2" stroke-linejoin="round"/>
<g class="chartSel">
  ${rect(selA.toFixed(1), PLOT.y - 6, selW.toFixed(1), PLOT.h + 6, K.accent, { opacity: 0.13 })}
  <line x1="${selA.toFixed(1)}" y1="${PLOT.y - 6}" x2="${selA.toFixed(1)}" y2="${PLOT.y + PLOT.h}" stroke="${K.accent}"/>
  <line x1="${(selA + selW).toFixed(1)}" y1="${PLOT.y - 6}" x2="${(selA + selW).toFixed(1)}" y2="${PLOT.y + PLOT.h}" stroke="${K.accent}"/>
</g>
<line x1="${W / 2 - 96}" y1="${CH.y + CH.h - 18}" x2="${W / 2 - 85}" y2="${CH.y + CH.h - 18}" stroke="${K.blue}" stroke-width="2"/>
${text(W / 2 - 79, CH.y + CH.h - 14, l.total, { size: 11.5, fill: K.muted, mono: true })}
<line x1="${W / 2 + 10}" y1="${CH.y + CH.h - 18}" x2="${W / 2 + 21}" y2="${CH.y + CH.h - 18}" stroke="${K.error}" stroke-width="2"/>
${text(W / 2 + 27, CH.y + CH.h - 14, l.errors, { size: 11.5, fill: K.muted, mono: true })}

${rect(JO.x, JO.y, JO.w, JO.h, K.surface, { rx: 12, stroke: "rgba(255,255,255,0.08)", sw: 1 })}
${text(18, JO.y + 28, l.journal, { size: 15, weight: 650 })}
${toolbar}
${period}
${banner}
${count}

${rect(LIST.x, LIST.y, LIST.w, LIST.h, "none", { rx: 10, stroke: "rgba(255,255,255,0.08)", sw: 1 })}
<g clip-path="url(#clipList)">
  <g class="journalAll">${journal(c.rowsAll, x.numAll, x.tsAll)}</g>
  <g class="journalZone">${journal(c.rowsZone, x.numZone, x.tsZone)}</g>
  <g class="flat">${flat}</g>
${c.rowsHits ? `  <g class="journalHits">${journal(c.rowsHits, x.numHits, x.tsHits)}</g>\n` : ""}${diff}</g>

<g class="cursor">
  <circle class="press" r="15" fill="${K.accent}" fill-opacity="0.22"/>
  <circle r="7.5" fill="${K.ink}"/>
  <circle r="7.5" fill="none" stroke="${K.ink}" stroke-opacity="0.25" stroke-width="3"/>
</g>
</svg>
`;
}

for (const name of Object.keys(SCENARIOS)) {
  for (const lang of ["fr", "en"]) {
    const svg = build(name, lang);
    const file = join(OUT, `${SCENARIOS[name].file}.${lang}.svg`);
    writeFileSync(file, svg);
    console.log(`${SCENARIOS[name].file}.${lang}.svg : ${(svg.length / 1024).toFixed(1)} Ko`);
  }
}
