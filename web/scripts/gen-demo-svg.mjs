// Génère la démonstration animée de la page « cas d'usage », en FR et en EN.
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
const CYCLE = 15; // secondes
const P = (t) => +((t / CYCLE) * 100).toFixed(2);
const T = {
  cursorIn: 0.6, brush: 1.3, brushEnd: 2.1, toPatterns: 2.8, clickPatterns: 3.4,
  cmpShows: 4.8, toCmp: 5.5, clickCmp: 6.1, highlight: 6.7, scroll: 8.8,
  foldHl: 9.5, out: 13.2,
};
const EASE = "cubic-bezier(.4,0,.2,1)";

/* ================= Géométrie ================= */
const W = 960;
const CH = { x: 0, y: 0, w: W, h: 300 };
const JO = { x: 0, y: 316, w: W, h: 432 };
const H = JO.y + JO.h + 2;
const PLOT = { x: 18, y: CH.y + 42, w: 924, h: 216 };
const LIST = { x: 18, y: JO.y + 236, w: 924, h: 180 };

const fa = 28.6 / 48, fb = 38.4 / 48;
const selX = PLOT.x + fa * PLOT.w;
const selW = (fb - fa) * PLOT.w;
const cursorY = PLOT.y + PLOT.h * 0.52;

/* ================= Les courbes =================
   Fond ondulant plus cloches gaussiennes, échantillonné finement : les courbes
   sont lisses par construction, sans spline qui déborderait sous la ligne de
   base. Le pic est très haut sur le total, l'erreur culmine au même endroit et
   nettement plus bas. */
const bell = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s));
const totalAt = (x) =>
  52 + 16 * Math.sin(x * 0.62) + 9 * Math.sin(x * 1.31 + 1.2) +
  300 * bell(x, 7.5, 0.9) + 420 * bell(x, 21, 1) + 3320 * bell(x, 33.5, 2.5) +
  260 * bell(x, 44.5, 1.1);
const errAt = (x) =>
  13 + 6 * Math.sin(x * 0.71 + 0.4) + 120 * bell(x, 7.5, 0.85) +
  150 * bell(x, 21, 0.95) + 1880 * bell(x, 34.1, 2.2) + 90 * bell(x, 44.5, 1.05);

const NS = 150;
const xs = Array.from({ length: NS }, (_, i) => (i / (NS - 1)) * 48);
const tot = xs.map(totalAt);
const er = xs.map(errAt);
const peak = Math.max(...tot);
const gx = (x) => +(PLOT.x + (x / 48) * PLOT.w).toFixed(1);
const gy = (v) => +(PLOT.y + PLOT.h - (v / peak) * (PLOT.h - 10)).toFixed(1);
const poly = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${gx(xs[i])},${gy(v)}`).join("");
const area = (arr) => `${poly(arr)}L${gx(48)},${PLOT.y + PLOT.h}L${gx(0)},${PLOT.y + PLOT.h}Z`;

/* ================= Helpers ================= */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Largeur approchée d'une chaîne : suffit à placer un cadre ou un soulignement,
// et évite d'avoir des positions en dur qui ne tiendraient pas d'une langue à
// l'autre (le français est plus long).
const est = (s, size, mono = false) => s.length * size * (mono ? 0.6 : 0.53);
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

/* ================= Contenu ================= */
// Un robot barista : une promotion fait déborder la file, le moulin se bloque,
// la chaudière finit en FATAL. Les messages restent en anglais dans les deux
// langues, comme de vrais logs.
const ROWS_ALL = [
  ["DEBUG", "Bean hopper at 82%"],
  ["INFO", "Espresso pulled in 9400ms"],
  ["INFO", "Cup detected on tray 3"],
  ["INFO", "Order 41927 completed"],
  ["INFO", "Idle standby entered"],
];
const ROWS_ZONE = [
  ["INFO", "Order 88214 accepted"],
  ["WARN", "Queue overflow, dropping order 88215"],
  ["ERROR", "Grinder jammed on bean batch 7c1f9a2e"],
  ["WARN", "Retrying order 3/5"],
  ["FATAL", "Boiler pressure critical, halting"],
];
const FLAT = [
  ["INFO", "Espresso pulled in {n}ms", "Espresso pulled in 9400ms"],
  ["INFO", "Cup detected on tray {n}", "Cup detected on tray 3"],
  ["INFO", "Steam wand purge {n}ms", "Steam wand purge 1200ms"],
  ["WARN", "Retrying order {n}/{n}", "Retrying order 3/5"],
];
const ONLY = [
  ["ERROR", "Grinder jammed on bean batch {hex}", "Grinder jammed on bean batch 7c1f9a2e"],
  ["WARN", "Queue overflow, dropping order {n}", "Queue overflow, dropping order 88215"],
  ["FATAL", "Boiler pressure critical, halting", "Boiler pressure critical, halting"],
];
const LVC = { DEBUG: K.debug, INFO: K.info, WARN: K.warn, ERROR: K.err, FATAL: K.fatal };

/* ================= Les deux langues ================= */
const L = {
  fr: {
    aria: "ViewLog : sélectionner un pic et le comparer au reste du fichier",
    volume: "Volume dans le temps", journal: "Journal",
    vJournal: "Journal", vPatterns: "Motifs",
    search: "Rechercher dans les logs…",
    total: "Total", errors: "Erreurs",
    period: "Période", all: "Tout",
    perA: "12/03 08:14 → 14/03 18:02", durA: "· 2 j 9 h",
    perB: "14/03 07:48 → 14/03 09:21", durB: "· 1 h 33 min",
    cntA: "412 908 entrées", cntB: "24 106 entrées",
    cntC: "24 106 entrées → 41 motifs uniques",
    cmp: "· Comparer au reste du fichier",
    cmpLabel: "Comparer au reste du fichier",
    banner: "Zone comparée au reste du fichier",
    colTs: "Horodatage", colLevel: "Niveau", colMsg: "Message",
    patternsHead: "MOTIFS", patternsSub: "41 uniques · les plus fréquents d'abord",
    onlyHead: "SEULEMENT ICI", onlySub: "3 motifs · absents du reste du fichier",
    fold: "3 sur-représentés, 5 absents ici",
    eg: "ex. ",
    chips: [["DEBUG", "41 308"], ["INFO", "327 144"], ["WARN", "32 905"], ["ERROR", "11 468"], ["FATAL", "83"]],
    numAll: ["18 204", "18 205", "18 206", "18 207", "18 208"],
    tsAll: ["13/03 02:11:04", "13/03 02:11:06", "13/03 02:11:09", "13/03 02:11:22", "13/03 02:12:31"],
    numZone: ["204 881", "204 882", "204 883", "204 884", "204 885"],
    tsZone: ["14/03 08:02:11", "14/03 08:02:11", "14/03 08:02:12", "14/03 08:02:12", "14/03 08:02:19"],
    counts: ["9 480×", "6 902×", "3 217×", "1 044×"],
    onlyCounts: ["1 902×", "874×", "1×"],
  },
  en: {
    aria: "ViewLog: brushing a spike and comparing it to the rest of the log file",
    volume: "Volume over time", journal: "Journal",
    vJournal: "Journal", vPatterns: "Patterns",
    search: "Search the logs…",
    total: "Total", errors: "Errors",
    period: "Period", all: "All",
    perA: "03/12, 08:14 AM → 03/14, 06:02 PM", durA: "· 2 d 9 h",
    perB: "03/14, 07:48 AM → 03/14, 09:21 AM", durB: "· 1 h 33 min",
    cntA: "412,908 entries", cntB: "24,106 entries",
    cntC: "24,106 entries → 41 unique patterns",
    cmp: "· Compare to the rest of the file",
    cmpLabel: "Compare to the rest of the file",
    banner: "Zone compared to the rest of the file",
    colTs: "Timestamp", colLevel: "Level", colMsg: "Message",
    patternsHead: "PATTERNS", patternsSub: "41 unique · most frequent first",
    onlyHead: "ONLY HERE", onlySub: "3 patterns · absent from the rest of the file",
    fold: "3 over-represented, 5 absent here",
    eg: "e.g. ",
    chips: [["DEBUG", "41,308"], ["INFO", "327,144"], ["WARN", "32,905"], ["ERROR", "11,468"], ["FATAL", "83"]],
    numAll: ["18,204", "18,205", "18,206", "18,207", "18,208"],
    tsAll: ["03/13, 02:11:04 AM", "03/13, 02:11:06 AM", "03/13, 02:11:09 AM", "03/13, 02:11:22 AM", "03/13, 02:12:31 AM"],
    numZone: ["204,881", "204,882", "204,883", "204,884", "204,885"],
    tsZone: ["03/14, 08:02:11 AM", "03/14, 08:02:11 AM", "03/14, 08:02:12 AM", "03/14, 08:02:12 AM", "03/14, 08:02:19 AM"],
    counts: ["9,480×", "6,902×", "3,217×", "1,044×"],
    onlyCounts: ["1,902×", "874×", "1×"],
  },
};

/* ================= Animations (indépendantes de la langue) ================= */
function kf(name, frames) {
  return `@keyframes ${name}{${frames.map(([p, d]) => `${p}%{${d}}`).join("")}}`;
}
function fade(name, inAt, outAt) {
  const f = [[0, "opacity:0"]];
  if (inAt > 0) f.push([Math.max(0, P(inAt) - 0.8), "opacity:0"]);
  f.push([P(inAt), "opacity:1"]);
  if (outAt != null) {
    f.push([Math.max(P(inAt) + 0.1, P(outAt) - 0.8), "opacity:1"]);
    f.push([P(outAt), "opacity:0"]);
  }
  f.push([100, outAt == null ? "opacity:1" : "opacity:0"]);
  return kf(name, f);
}

const anims = [];
const rules = [];
const A = (sel, name) => rules.push(`${sel}{animation-name:${name}}`);

anims.push(kf("cur", [
  [0, `transform:translate(${selX.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:0`],
  [P(T.cursorIn) - 0.5, `transform:translate(${selX.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:0`],
  [P(T.cursorIn), `transform:translate(${selX.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:1`],
  [P(T.brush), `transform:translate(${selX.toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:1;animation-timing-function:${EASE}`],
  [P(T.brushEnd), `transform:translate(${(selX + selW).toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:1`],
  [P(T.toPatterns), `transform:translate(${(selX + selW).toFixed(1)}px,${cursorY.toFixed(1)}px);opacity:1;animation-timing-function:${EASE}`],
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

// Barre de période : `left` et `width` doivent partager la même courbe, sinon le
// bord gauche saute à la zone pendant que la largeur vaut encore 100 % et la
// barre déborde la piste. Ici un seul transform s'en charge.
const sc = (selW / 924).toFixed(4);
const tx = (selX - 18).toFixed(1);
const txB = (selX + selW - 942).toFixed(1);
for (const [cls, name, to] of [[".tsel", "perBar", `translateX(${tx}px) scaleX(${sc})`],
                               [".thA", "thumbA", `translateX(${tx}px)`],
                               [".thB", "thumbB", `translateX(${txB}px)`]]) {
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
for (const [cls, name, at, from] of [[".hlTxt", "hlTxt", T.highlight, K.muted],
                                     [".hlTxt2", "hlTxt2", T.foldHl, K.ink2]]) {
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

const ANIMATED = [
  ".cursor", ".press", ".chartSel", ".tsel", ".thA", ".thB", ".journalAll", ".journalZone",
  ".flat", ".diff", ".diffBody", ".banner", ".allBtn", ".perA", ".perB", ".cntA", ".cntB",
  ".cntC", ".cmp", ".pillJ", ".pillP", ".labJon", ".labJoff", ".labPon", ".labPoff",
  ".hl1", ".hlTxt", ".hl2", ".hlTxt2",
].join(",");

/* ================= Construction ================= */
function build(l) {
  const tag = (x, y, lvl) =>
    rect(x, y - 11, lvl.length * 7.2 + 12, 17, LVC[lvl], { rx: 5, opacity: 0.16 }) +
    text(x + 6, y + 1, lvl, { size: 11, weight: 700, fill: LVC[lvl] });

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

  const patRow = (y, count, lvl, tpl, ex) =>
    text(LIST.x + 74, y + 16, count, { size: 13, weight: 700, anchor: "end" }) +
    tag(LIST.x + 86, y + 16, lvl) +
    text(LIST.x + 166, y + 14, tpl, { size: 12.5, mono: true }) +
    text(LIST.x + 166, y + 32, l.eg + ex, { size: 12, fill: K.muted }) +
    hline(y + 47);

  // L'en-tête de liste n'est pas décoratif : sans lui, passer du journal aux
  // motifs fait disparaître la ligne de titre puis la fait revenir à la
  // comparaison, et ce clignotement se lit comme un bug.
  const listHead = (label, sub, hl) => {
    const y = LIST.y;
    const w = est(sub, 12) + 16;
    const x = LIST.x + LIST.w - 12 - est(sub, 12) - 8;
    return (
      rect(LIST.x, y, LIST.w, 30, K.page) +
      text(LIST.x + 12, y + 20, label, { size: 11.5, weight: 700, fill: K.ink2, ls: "0.6" }) +
      (hl
        ? rect(x, y + 4, w, 22, K.hl, { rx: 5, opacity: 0.3, cls: "hl1" }) +
          `<rect x="${x.toFixed(1)}" y="${y + 4}" width="${w.toFixed(1)}" height="22" rx="5" fill="none" stroke="${K.hl}" stroke-opacity="0.7" class="hl1"/>`
        : "") +
      text(LIST.x + LIST.w - 12, y + 20, sub, {
        size: 12, fill: K.muted, anchor: "end", cls: hl ? "hlTxt" : undefined,
      }) +
      hline(y + 30)
    );
  };

  const flat =
    FLAT.map(([lvl, tpl, ex], i) => patRow(LIST.y + 30 + i * 47, l.counts[i], lvl, tpl, ex)).join("") +
    listHead(l.patternsHead, l.patternsSub, false);

  const rowsTop = LIST.y + 30;
  let diffBody = ONLY.map(([lvl, tpl, ex], i) =>
    patRow(rowsTop + i * 47, l.onlyCounts[i], lvl, tpl, ex)).join("");
  const fy = rowsTop + ONLY.length * 47;
  diffBody +=
    rect(LIST.x + 6, fy + 4, LIST.w - 12, 30, K.hl, { rx: 5, opacity: 0.26, cls: "hl2" }) +
    `<rect x="${LIST.x + 6}" y="${fy + 4}" width="${LIST.w - 12}" height="30" rx="5" fill="none" stroke="${K.hl}" stroke-opacity="0.65" class="hl2"/>` +
    text(LIST.x + 16, fy + 24, "▸", { size: 12, fill: K.muted, cls: "hlTxt2" }) +
    text(LIST.x + 34, fy + 24, l.fold, { size: 13, fill: K.ink2, cls: "hlTxt2" });

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
  for (const [name, n] of l.chips) {
    const w = est(name, 12) + est(n, 12) + 42;
    toolbar +=
      rect(cx.toFixed(1), cy, w.toFixed(1), 26, K.surface, { rx: 13, stroke: LVC[name], sw: 1 }) +
      `<circle cx="${(cx + 15).toFixed(1)}" cy="${cy + 13}" r="4.5" fill="${LVC[name]}"/>` +
      text(cx + 25, cy + 18, name, { size: 12, weight: 600, fill: K.ink2 }) +
      text(cx + 25 + est(name, 12) + 8, cy + 18, n, { size: 12, fill: K.muted });
    cx += w + 6;
  }

  // Période
  const py = JO.y + 130;
  const period =
    text(18, py, l.period, { size: 13, weight: 600, fill: K.ink2 }) +
    text(74, py, l.perA, { size: 13, cls: "perA" }) +
    text(74, py, l.perB, { size: 13, cls: "perB" }) +
    text(74 + est(l.perA, 13) + 10, py, l.durA, { size: 13, fill: K.muted, cls: "perA" }) +
    text(74 + est(l.perB, 13) + 10, py, l.durB, { size: 13, fill: K.muted, cls: "perB" }) +
    rect(942 - est(l.all, 12) - 20, py - 14, est(l.all, 12) + 20, 22, "none", { rx: 6, stroke: K.accent, sw: 1, cls: "allBtn" }) +
    text(942 - 10, py + 1, l.all, { size: 12, weight: 600, fill: K.accent, anchor: "end", cls: "allBtn" }) +
    rect(18, py + 24, 924, 4, K.line, { rx: 2 }) +
    `<g class="tsel"><rect x="18" y="${py + 24}" width="924" height="4" rx="2" fill="${K.accent}"/></g>` +
    `<circle class="thA" cx="18" cy="${py + 26}" r="7" fill="${K.accent}" stroke="${K.page}" stroke-width="2"/>` +
    `<circle class="thB" cx="942" cy="${py + 26}" r="7" fill="${K.accent}" stroke="${K.page}" stroke-width="2"/>`;

  // Bandeau
  const by = JO.y + 176;
  const banner =
    `<g class="banner">` +
    rect(18, by, 924, 32, K.accent, { rx: 8, opacity: 0.12 }) +
    `<rect x="18" y="${by}" width="924" height="32" rx="8" fill="none" stroke="${K.accent}" stroke-opacity="0.3"/>` +
    text(30, by + 21, l.banner, { size: 13 }) +
    text(926, by + 21, "✕", { size: 14, fill: K.ink2, anchor: "end" }) +
    `</g>`;

  // Ligne de compte, avec l'action au bout : aucun contrôle ajouté à la barre.
  const ny = JO.y + 226;
  const cmpX = 18 + est(l.cntC, 13) + 14;
  const count =
    text(18, ny, l.cntA, { size: 13, fill: K.muted, cls: "cntA" }) +
    text(18, ny, l.cntB, { size: 13, fill: K.muted, cls: "cntB" }) +
    text(18, ny, l.cntC, { size: 13, fill: K.muted, cls: "cntC" }) +
    text(cmpX, ny, l.cmp, { size: 13, weight: 600, fill: K.accent, cls: "cmp" }) +
    `<line class="cmp" x1="${(cmpX + est("· ", 13)).toFixed(1)}" y1="${ny + 4}" x2="${(cmpX + est(l.cmp, 13)).toFixed(1)}" y2="${ny + 4}" stroke="${K.accent}" stroke-opacity="0.5"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(l.aria)}">
<title>${esc(l.aria)}</title>
<style>
  .chartSel,.tsel{transform-box:fill-box;transform-origin:left center}
  ${rules.join("\n  ")}
  ${ANIMATED}{animation-duration:${CYCLE}s;animation-iteration-count:infinite;animation-timing-function:linear;animation-fill-mode:both}
  /* Mouvement réduit : on gèle sur l'image qui porte l'information, grâce à un
     retard négatif combiné à une animation en pause. */
  @media (prefers-reduced-motion:reduce){
    ${ANIMATED}{animation-delay:-${(T.highlight + 0.6).toFixed(1)}s;animation-play-state:paused}
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
<path d="${area(tot)}" fill="url(#gT)"/>
<path d="${area(er)}" fill="url(#gE)"/>
<path d="${poly(tot)}" fill="none" stroke="${K.blue}" stroke-width="2.2" stroke-linejoin="round"/>
<path d="${poly(er)}" fill="none" stroke="${K.error}" stroke-width="2.2" stroke-linejoin="round"/>
<g class="chartSel">
  ${rect(selX.toFixed(1), PLOT.y - 6, selW.toFixed(1), PLOT.h + 6, K.accent, { opacity: 0.13 })}
  <line x1="${selX.toFixed(1)}" y1="${PLOT.y - 6}" x2="${selX.toFixed(1)}" y2="${PLOT.y + PLOT.h}" stroke="${K.accent}"/>
  <line x1="${(selX + selW).toFixed(1)}" y1="${PLOT.y - 6}" x2="${(selX + selW).toFixed(1)}" y2="${PLOT.y + PLOT.h}" stroke="${K.accent}"/>
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
  <g class="journalAll">${journal(ROWS_ALL, l.numAll, l.tsAll)}</g>
  <g class="journalZone">${journal(ROWS_ZONE, l.numZone, l.tsZone)}</g>
  <g class="flat">${flat}</g>
  <g class="diff">
    <g clip-path="url(#clipBody)"><g class="diffBody">${diffBody}</g></g>
    ${listHead(l.onlyHead, l.onlySub, true)}
  </g>
</g>

<g class="cursor">
  <circle class="press" r="15" fill="${K.accent}" fill-opacity="0.22"/>
  <circle r="7.5" fill="${K.ink}"/>
  <circle r="7.5" fill="none" stroke="${K.ink}" stroke-opacity="0.25" stroke-width="3"/>
</g>
</svg>
`;
}

for (const lang of ["fr", "en"]) {
  const svg = build(L[lang]);
  const file = join(OUT, `demo-spike.${lang}.svg`);
  writeFileSync(file, svg);
  console.log(`${file.split("/").slice(-1)[0]} : ${(svg.length / 1024).toFixed(1)} Ko`);
}
