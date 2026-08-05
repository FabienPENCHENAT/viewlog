// Assertions sur `lib/pattern-diff.js`, qui est pur et donc vérifiable hors
// navigateur. Deux étages :
//
//  1. Des cas minuscules construits à la main, pour la logique (planchers,
//     groupes, cas dégénérés, format de clé).
//  2. La vérité terrain du fichier d'exemple, quand il est présent : on sait
//     exactement quels incidents y ont été mis, donc on peut exiger que la
//     comparaison les trouve, et surtout qu'elle ne trouve RIEN sur une zone
//     normale. Crier au loup coûte plus cher que rater un pic.
//
// Usage :
//   node scripts/check-pattern-diff.mjs
//   node scripts/gen-sample-log.mjs && node scripts/check-pattern-diff.mjs

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { comparePatterns, MIN_EXPECTED, MIN_RATIO } from "../src/lib/pattern-diff.js";
import { groupPatterns } from "../src/lib/patterns.js";
import { parse } from "../src/parser/index.js";

let pass = 0;
const fails = [];
function ok(label, cond) {
  if (cond) pass += 1;
  else fails.push(label);
}
function eq(label, got, want) {
  ok(`${label} (attendu ${want}, obtenu ${got})`, got === want);
}

const SEC = 1000;
const mk = (level, message, ms) => ({
  level, message, raw: `${level} ${message}`, ts: new Date(ms).toISOString(),
});
const many = (n, level, message, from, step = 10) =>
  Array.from({ length: n }, (_, i) => mk(level, message, from + i * step));

const ZONE = { from: 0, to: 60 * SEC };
const has = (arr, needle) => arr.some((g) => g.template.includes(needle));

// ------------------------------------------------------- 1. logique de groupes

{
  // Un motif propre à la zone sort en « seulement ici », sans plancher.
  const inside = [...many(40, "INFO", "steady heartbeat", 0), mk("ERROR", "boom once", 5 * SEC)];
  const outside = many(400, "INFO", "steady heartbeat", 120 * SEC, 3 * SEC);
  const d = comparePatterns(inside, outside, ZONE);
  ok("un motif exclusif remonte même à 1 occurrence", has(d.onlyHere, "boom once"));
  eq("le bruit identique des deux côtés ne remonte pas", d.over.length, 0);
}

{
  // Même densité des deux côtés : du bruit, quels que soient les nombres.
  const inside = [...many(900, "INFO", "noise", 0), ...many(100, "WARN", "blip", 0, 11)];
  const outside = [...many(9000, "INFO", "noise", 120 * SEC, SEC), ...many(1000, "WARN", "blip", 121 * SEC, SEC)];
  const d = comparePatterns(inside, outside, ZONE);
  eq("un pic de volume pur ne remonte rien", d.over.length + d.onlyHere.length, 0);
}

{
  // Plancher d'occurrences : 2 lignes ne suffisent pas à conclure.
  const inside = [...many(200, "INFO", "noise", 0), ...many(2, "WARN", "rare thing", 0, 7)];
  const outside = [...many(20000, "INFO", "noise", 120 * SEC, SEC), ...many(2, "WARN", "rare thing", 500 * SEC, SEC)];
  const d = comparePatterns(inside, outside, ZONE);
  ok("2 occurrences ne suffisent pas pour « sur-représenté »", !has(d.over, "rare thing"));
}

{
  // Le complément trop mince est annoncé, pas deviné.
  const d = comparePatterns(many(10, "INFO", "a", 0), many(20, "INFO", "b", 120 * SEC), ZONE);
  ok("un complément de moins de 50 lignes est dégénéré", d.degenerate === true);
}

// -------------------------------------------- 2. la référence est un RYTHME

{
  // Le cas qui motive tout : un SECOND pic ailleurs dans le fichier. Avec un
  // taux global il écrase la comparaison, avec des fenêtres il ne pèse plus
  // qu'une fenêtre sur vingt.
  const inside = [...many(100, "ERROR", "boom", 0), ...many(100, "INFO", "noise", 0, 5)];
  const outside = [];
  for (let w = 1; w <= 20; w++) outside.push(...many(50, "INFO", "noise", (w + 1) * 60 * SEC, 1000));
  outside.push(...many(100, "ERROR", "boom", 11 * 60 * SEC, 200)); // le second pic
  const windowed = comparePatterns(inside, outside, ZONE);
  const pooled = comparePatterns(inside, outside); // sans zone : taux global
  const rw = windowed.over.find((g) => g.template.includes("boom"));
  const rp = pooled.over.find((g) => g.template.includes("boom"));
  ok("un second pic ailleurs reste détecté dans les deux modes", !!rw && !!rp);
  ok(
    `le rythme sépare mieux que le total (${rp?.ratio.toFixed(1)} -> ${rw?.ratio.toFixed(1)})`,
    !!rw && !!rp && rw.ratio > rp.ratio * 2
  );
  ok("le mode fenêtré est bien actif", windowed.pooled === false && windowed.windows >= 20);
}

{
  // Une sélection qui couvre presque tout le fichier ne laisse pas assez de
  // fenêtres : on retombe sur le taux global au lieu de moyenner deux valeurs.
  const inside = many(200, "INFO", "noise", 0);
  const outside = many(200, "INFO", "noise", 61 * SEC, 100);
  const d = comparePatterns(inside, outside, ZONE);
  ok("trop peu de fenêtres : repli sur le taux global", d.pooled === true);
}

// --------------------------------------------------- 3. le groupe « absent »

{
  // On en attendait beaucoup ici, on n'en a vu aucun : c'est un vrai manque.
  const inside = many(500, "ERROR", "everything is on fire", 0);
  const outside = [];
  for (let w = 1; w <= 20; w++) outside.push(...many(50, "INFO", "cup dispensed", (w + 1) * 60 * SEC, 1000));
  const d = comparePatterns(inside, outside, ZONE);
  const g = d.absent.find((x) => x.template.includes("cup dispensed"));
  ok("un motif attendu et jamais vu remonte en « absent »", !!g);
  ok(`le nombre attendu est calculé (${g?.expected?.toFixed(0)})`, !!g && g.expected >= MIN_EXPECTED);
}

{
  // Le cas qui remontait à tort avant le plancher sur le nombre attendu : un
  // motif vu plusieurs fois ailleurs (donc au-dessus de l'ancien plancher par
  // nombre), mais si rare DANS chaque fenêtre qu'on n'en attendait aucun ici.
  // Une nuit remontait ainsi trente-huit « absents » parfaitement normaux.
  const inside = many(20, "DEBUG", "idle", 0);
  const outside = [];
  for (let w = 1; w <= 300; w++) {
    outside.push(...many(50, "INFO", "steady traffic", (w + 1) * 60 * SEC, 900));
    // Un digest par jour seulement, noyé dans le trafic de sa fenêtre.
    if (w % 40 === 0) outside.push(mk("INFO", "daily digest", (w + 1) * 60 * SEC + 30 * SEC));
  }
  const d = comparePatterns(inside, outside, ZONE);
  const digest = d.absent.find((x) => x.template.includes("daily digest"));
  const traffic = d.absent.find((x) => x.template.includes("steady traffic"));
  ok("un motif dilué sur tout le fichier ne remonte pas en « absent »", !digest);
  ok("mais le trafic habituel manquant, lui, remonte bien", !!traffic);
}

// ----------------------------------- 4. le format de clé, partagé avec la vue

{
  // Garde-fou : si la comparaison reconstruisait la clé autrement que
  // `groupPatterns` (une espace au lieu du NUL), tout sortirait « exclusif ».
  const inside = many(60, "WARN", "shared shape 42", 0);
  const outside = [];
  for (let w = 1; w <= 20; w++) outside.push(...many(50, "WARN", `shared shape ${w}`, (w + 1) * 60 * SEC, 1000));
  const d = comparePatterns(inside, outside, ZONE);
  const key = groupPatterns(inside)[0].key;
  eq("le même motif des deux côtés n'est pas déclaré exclusif", d.onlyHere.length, 0);
  ok("la clé contient bien le séparateur attendu", key.includes("\0"));
}

// ------------------------------------------- 5. vérité terrain du fichier type

const SAMPLE = join(homedir(), "Downloads", "vending-machine-week.log");
if (!existsSync(SAMPLE)) {
  console.log(`(fichier type absent, étage 2 ignoré : node scripts/gen-sample-log.mjs)`);
} else {
  const { entries } = parse(readFileSync(SAMPLE, "utf8"));
  const ev = entries.filter((e) => e.ts).map((e) => ({ ...e, ms: new Date(e.ts).getTime() }));
  const T = (s) => new Date(s).getTime();
  const split = (from, to) => [
    ev.filter((e) => e.ms >= from && e.ms <= to),
    ev.filter((e) => e.ms < from || e.ms > to),
  ];
  const check = (label, from, to, fn) => {
    const [inside, outside] = split(from, to);
    fn(label, comparePatterns(inside, outside, { from, to }));
  };

  check("pic pompe", T("2026-08-01T14:05:00"), T("2026-08-01T15:20:00"), (label, d) => {
    eq(`${label} : 3 motifs exclusifs`, d.onlyHere.length, 3);
    ok(`${label} : la cause est exclusive`, has(d.onlyHere, "Pump pressure out of range"));
    ok(`${label} : la saturation est sur-représentée`, has(d.over, "Order queue depth"));
    ok(`${label} : le service rendu a cessé`, has(d.absent, "Cup dispensed"));
  });

  check("pic paiement", T("2026-08-02T09:25:00"), T("2026-08-02T10:45:00"), (label, d) => {
    eq(`${label} : 3 motifs exclusifs`, d.onlyHere.length, 3);
    ok(`${label} : la cause est exclusive`, has(d.onlyHere, "Payment gateway unreachable"));
    ok(`${label} : la panne de pompe ne fuit pas ici`, !has(d.onlyHere, "Pump pressure"));
  });

  // Les deux tests qui comptent le plus : le silence sur une zone normale.
  check("pause café normale", T("2026-07-28T08:00:00"), T("2026-07-28T09:15:00"), (label, d) => {
    eq(`${label} : aucun exclusif`, d.onlyHere.length, 0);
    eq(`${label} : aucun sur-représenté`, d.over.length, 0);
    eq(`${label} : aucun absent`, d.absent.length, 0);
  });

  check("nuit normale", T("2026-07-30T02:00:00"), T("2026-07-30T03:15:00"), (label, d) => {
    eq(`${label} : aucun sur-représenté`, d.over.length, 0);
    eq(`${label} : aucun absent`, d.absent.length, 0);
  });
}

// ----------------------------------------------------------------- conclusion

console.log(`\nMIN_RATIO=${MIN_RATIO}  MIN_EXPECTED=${MIN_EXPECTED}`);
if (fails.length) {
  console.log(`\n${pass} assertions passées, ${fails.length} ÉCHECS :`);
  for (const f of fails) console.log(`   ✗ ${f}`);
  process.exit(1);
}
console.log(`${pass} assertions passées.`);
