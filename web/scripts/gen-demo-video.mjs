// Génère les démonstrations en MP4 vertical (1080×1350, 4:5) pour les réseaux
// sociaux, en anglais seulement.
//
// POURQUOI UN SECOND FORMAT, alors que le SVG animé existe déjà : aucun réseau
// social n'accepte le SVG. Ni X, ni LinkedIn, ni Instagram. Il faut donc une
// vidéo, et le 4:5 est le ratio qui prend le plus de hauteur autorisée dans un
// fil, donc celui où la maquette reste lisible sur un téléphone.
//
// CE SCRIPT NE REDESSINE RIEN. Il importe `build()` de `gen-demo-svg.mjs` : la
// vidéo montre exactement la démo de la page « cas d'usage ». Une seconde
// maquette à maintenir en parallèle divergerait au premier changement.
//
// COMMENT ON FIGE UNE IMAGE : l'animation est en @keyframes CSS, donc aucun
// rasteriseur (resvg, librsvg, ImageMagick) ne sait la rendre, ils sortent tous
// l'état initial. Il faut un moteur qui exécute le CSS. On réutilise donc le
// mécanisme que la maquette a déjà pour `prefers-reduced-motion` : un retard
// négatif combiné à une animation en pause affiche l'instant t. Une règle `*` en
// `!important` suffit, tous les éléments partageant le même cycle.
//
// CHAQUE IMAGE EST UN SVG ENTIER, pas du HTML : titre et mention sont des `<text>`
// placés à la main, la maquette est scellée dans un `<image>`. Trois mises en page
// HTML ont été essayées et jetées, la feuille de style de la maquette débordant
// à chaque fois sur la composition (voir `frozen`).
//
// Chrome est piloté en ligne de commande, sans Playwright ni Puppeteer : une
// invocation `--headless --screenshot` par image, 1,4 s chacune, d'où le pool
// parallèle. En série, les 960 images demanderaient vingt-deux minutes.
//
// Prérequis :  Google Chrome, et ffmpeg (brew install ffmpeg)
// Générer :    node scripts/gen-demo-video.mjs [--fps 60] [--duration 8]
//              node scripts/gen-demo-video.mjs --only spike --at 8   (une image)

import { execFile } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { cpus } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build, SCENARIOS } from "./gen-demo-svg.mjs";
import EN from "../src/i18n/en.js";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "docs", "social");
const TMP = join(HERE, "..", "..", ".social-frames");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";


const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
// FLUIDITÉ ET VITESSE SONT DEUX RÉGLAGES SÉPARÉS, et c'est tout l'intérêt.
//
// `fps` est la cadence de la vidéo : c'est elle, et elle seule, qui fait qu'un
// mouvement est lisse ou saccadé. 60 i/s est ce que lisent X et LinkedIn.
//
// `duration` est le temps que met le déroulé à se jouer. Le cycle des démos fait
// 15 s et 18 s, ce qui est long pour un fil : on échantillonne le cycle ENTIER,
// donc rien n'est coupé, et on le rejoue en `duration` secondes. Le déroulé est
// simplement accéléré (×1,9 et ×2,3), et comme on échantillonne à la cadence de
// sortie, l'accélération ne coûte aucune image.
const FPS = Number(arg("fps", 60));
const DURATION = Number(arg("duration", 8));
const ONLY = arg("only", null);

// 4:5, la limite haute de LinkedIn et d'Instagram. 1080 de large est la largeur
// de référence des deux, et 1350 = 1080 × 5/4.
const W = 1080;
const H = 1350;

// Le parallélisme est borné par les cœurs ET par la mémoire : chaque Chrome
// ouvre son propre rendu, huit suffisent à tenir le processeur occupé.
const POOL = Math.max(2, Math.min(8, cpus().length - 2));

// Chrome rend un SVG autonome à sa taille intrinsèque, donc la fenêtre suffit à
// cadrer l'image : aucun HTML n'est nécessaire autour. Le fond est posé par un
// rectangle dans le SVG, et redit ici pour les bords en cas d'arrondi.
//
// LA FENÊTRE EST PLUS HAUTE QUE L'IMAGE, ET C'EST INDISPENSABLE. `--window-size`
// décrit la fenêtre, pas la zone de rendu : à 1080×1350 le document ne dispose
// que de 1267 px de haut, Chrome comptant 83 px de décoration, et la capture
// complète les 83 px manquants en BLANC. Mesuré au pixel, et c'est ce qui
// tronquait le pied de page dans trois mises en page successives. On demande donc
// une fenêtre large et on recadre à la vraie taille au moment de l'encodage,
// plutôt que de soustraire une constante magique qui changerait avec Chrome.
const SHOT_H = H + 150;
const SHOT = [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--default-background-color=0f1116ff",
  `--window-size=${W},${SHOT_H}`,
];
const CROP = `crop=${W}:${H}:0:0`;

// La palette est celle de `theme.css`, comme dans le générateur de SVG.
const K = { page: "#0f1116", ink: "#e7e7e4", muted: "#71747d", accent: "#f5a623" };
const SANS = "system-ui,-apple-system,'Segoe UI',sans-serif";

// Les titres viennent du dictionnaire de l'app, pas d'une copie : la vidéo dit
// la même chose que la page qu'elle illustre. Le pied de page compose deux clés
// de la page d'accueil, sans tiret cadratin.
const TITLES = { spike: EN["uc.spike_title"], isolated: EN["uc.isolated_title"] };
const FOOT = `${EN["home.lead_local"]}. Parsed in your browser, never sent to a server.`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Géométrie de la composition, calculée et non laissée à un flex : sur un
// canevas de taille fixe, `justify-content:space-between` plaçait le pied de
// page hors de l'image, y compris sans le SVG. Des `top` explicites se
// vérifient à l'addition.
const PAD = 64; // marges haute et basse
const SVG_H = Math.round((W * 750) / 960); // maquette en pleine largeur : 844
const HEAD_H = 172; // marque + titre sur deux lignes au plus
const FOOT_H = 30;
const GAP = Math.round((H - PAD * 2 - HEAD_H - SVG_H - FOOT_H) / 2);
const SVG_Y = PAD + HEAD_H + GAP;
const FOOT_Y = SVG_Y + SVG_H + GAP;

/**
 * La maquette figée à l'instant t, scellée dans une donnée d'image.
 *
 * ELLE EST SCELLÉE ET PAS RECOPIÉE TELLE QUELLE, et ce n'est pas un détail de
 * goût : le `<style>` d'un SVG posé dans un autre document n'est PAS isolé, il
 * s'applique à tout le document hôte. Les règles de la démo débordaient donc sur
 * la composition, jusqu'à réduire le pied de page à une bande de quatre pixels
 * qui rognait son texte. Référencée par une URL de données, la maquette est un
 * document à part et l'hôte ne partage plus rien avec elle. C'est d'ailleurs déjà
 * comme ça que la page « cas d'usage » l'affiche, en `<img>`.
 *
 * La règle de gel va donc DANS la maquette, avant la fin de son propre `<style>`.
 * Le `!important` passe devant la règle d'animation et devant la requête
 * `prefers-reduced-motion`, qu'on ne veut surtout pas voir s'appliquer : elle
 * figerait toutes les images sur la même.
 */
function frozen(svg, t) {
  const rule =
    `\n  *{animation-delay:-${t.toFixed(3)}s !important;` +
    `animation-play-state:paused !important}\n`;
  const i = svg.indexOf("</style>");
  const out = svg.slice(0, i) + rule + svg.slice(i);
  return `data:image/svg+xml;base64,${Buffer.from(out, "utf8").toString("base64")}`;
}

// Largeur approchée d'un texte, faute de pouvoir mesurer sans navigateur. Le
// facteur vaut pour du system-ui gras en casse mixte, et il n'a qu'un seul
// travail : décider où couper le titre. Une erreur de quelques pour cent y est
// sans conséquence, la ligne suivante étant simplement un peu plus courte.
const est = (s, size) => s.length * size * 0.53;

/** Coupe un titre en lignes qui tiennent dans `max`, gloutonnement. */
function wrap(title, size, max) {
  const lines = [];
  let line = "";
  for (const word of title.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && est(next, size) > max) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * L'image entière, en UN SEUL SVG.
 *
 * Pas de HTML : la maquette est un document SVG dont le `<style>` n'est pas
 * isolé quand on l'inline, et qui débordait sur la composition au point de
 * réduire le pied de page à une bande de quatre pixels. Deux mises en page
 * successives (flex, puis positions absolues) sont tombées dans le même piège.
 *
 * Ici la maquette est scellée dans un `<image>`, exactement comme la page « cas
 * d'usage » l'affiche en `<img>`, et le titre comme la mention sont des `<text>`
 * placés à la main. C'est déjà la façon de faire du générateur de la maquette :
 * des coordonnées qui se vérifient à l'addition, et aucune cascade à interroger.
 */
function page(svg, title, t) {
  const titleSize = 46;
  const lines = wrap(title, titleSize, W - 96);
  const brandY = PAD + 19;
  const titleY = brandY + 46;
  const foot = FOOT.slice(EN["home.lead_local"].length);

  const text = (x, y, s, o = {}) =>
    `<text x="${x}" y="${y}" font-family="${SANS}" font-size="${o.size || 21}"` +
    ` font-weight="${o.weight || 400}" fill="${o.fill || K.ink}"` +
    (o.spacing ? ` letter-spacing="${o.spacing}"` : "") +
    `>${esc(s)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
 width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${K.page}"/>
${text(48, brandY, "VIEWLOG", { size: 19, weight: 700, fill: K.accent, spacing: 3 })}
${lines
  .map((l, i) => text(48, titleY + i * 53, l, { size: titleSize, weight: 700 }))
  .join("\n")}
<image x="0" y="${SVG_Y}" width="${W}" height="${SVG_H}" xlink:href="${frozen(svg, t)}"/>
<text x="48" y="${FOOT_Y + 21}" font-family="${SANS}" font-size="21"><tspan
 font-weight="600" fill="${K.ink}">${esc(EN["home.lead_local"])}</tspan><tspan
 fill="${K.muted}">${esc(foot)}</tspan></text>
</svg>`;
}

/** Un pool borné : `limit` tâches en vol, pas une de plus. */
async function pool(items, limit, worker) {
  let next = 0;
  let done = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) {
      await worker(items[i], i);
      done += 1;
      if (done % 24 === 0 || done === items.length) {
        process.stdout.write(`\r      ${done}/${items.length} images`);
      }
    }
  });
  await Promise.all(runners);
  process.stdout.write("\n");
}

async function render(name) {
  const cycle = SCENARIOS[name].cycle;
  const svg = build(name, "en");
  // Le nombre d'images vient de la VIDÉO, pas du cycle : c'est ce qui découple la
  // fluidité de la vitesse. On répartit ensuite le cycle entier sur ces images.
  const frames = Math.round(DURATION * FPS);
  const dir = join(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  console.log(
    `\n${name} : cycle ${cycle}s rejoué en ${DURATION}s (×${(cycle / DURATION).toFixed(2)}), ` +
      `${frames} images à ${FPS} i/s, ${POOL} en parallèle`
  );

  // La dernière image N'EST PAS l'instant `cycle` : ce serait l'instant 0 à
  // nouveau, donc une image en double au raccord de la boucle.
  const list = Array.from({ length: frames }, (_, i) => i);
  await pool(list, POOL, async (i) => {
    const t = (i * cycle) / frames;
    const src = join(dir, `f${String(i).padStart(4, "0")}.svg`);
    const png = join(dir, `f${String(i).padStart(4, "0")}.png`);
    writeFileSync(src, page(svg, TITLES[name], t));
    await run(CHROME, [...SHOT, `--screenshot=${png}`, `file://${src}`]);
  });

  mkdirSync(OUT, { recursive: true });
  const mp4 = join(OUT, `${SCENARIOS[name].file}.en.1080x1350.mp4`);
  // yuv420p et non yuv444p : c'est le seul format que lisent tous les réseaux.
  // `faststart` déplace l'index en tête, sans quoi certains lecteurs attendent
  // le fichier entier avant d'afficher la première image.
  await run("ffmpeg", [
    "-y", "-framerate", String(FPS),
    "-i", join(dir, "f%04d.png"),
    "-vf", CROP,
    "-c:v", "libx264", "-preset", "slow", "-crf", "20",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    mp4,
  ]);
  return mp4;
}

if (!existsSync(CHROME)) {
  console.error("Google Chrome est introuvable : il sert de moteur de rendu.");
  process.exit(1);
}

// Une seule image, gardée sur le disque : de quoi vérifier le cadrage et la
// taille du texte sans attendre une vidéo entière.
//   node scripts/gen-demo-video.mjs --only spike --at 8
const AT = arg("at", null);
if (AT !== null) {
  const name = ONLY || "spike";
  mkdirSync(OUT, { recursive: true });
  const src = join(OUT, `.frame-${name}.svg`);
  const png = join(OUT, `frame-${name}-at${AT}s.png`);
  writeFileSync(src, page(build(name, "en"), TITLES[name], Number(AT)));
  // ffmpeg refuse d'écrire sur son entrée, d'où le passage par un fichier
  // intermédiaire plutôt qu'un recadrage sur place.
  const raw = join(OUT, `.raw-${name}.png`);
  await run(CHROME, [...SHOT, `--screenshot=${raw}`, `file://${src}`]);
  await run("ffmpeg", ["-y", "-v", "error", "-i", raw, "-vf", CROP, "-update", "1", png]);
  rmSync(src, { force: true });
  rmSync(raw, { force: true });
  console.log(png);
  process.exit(0);
}

const names = ONLY ? [ONLY] : Object.keys(SCENARIOS);
const made = [];
for (const name of names) made.push(await render(name));
rmSync(TMP, { recursive: true, force: true });

console.log("");
for (const f of made) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration,size",
    "-show_entries", "stream=width,height,r_frame_rate",
    "-of", "default=nw=1", f,
  ]);
  console.log(`${f.split("/").pop()}\n${stdout.trim().split("\n").map((l) => `   ${l}`).join("\n")}`);
}
