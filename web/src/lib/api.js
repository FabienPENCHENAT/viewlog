// API locale : le parsing et le stockage se font entièrement dans le navigateur.
// Aucune requête réseau, aucune donnée ne quitte la machine du client.
// Les erreurs sont levées sous forme de CLÉS i18n ; l'UI les traduit à l'affichage.
import { parseAsync } from "./parse-async.js";
import { storeFrom } from "../parser/index.js";
import { dbListMeta, dbGet, dbPut, dbPatch, dbDelete } from "./db.js";
import { cacheGet, cachePut, cacheDrop } from "./log-cache.js";
import { MAX_LABEL } from "./tab-label.js";

// On ne conserve que 5 fichiers (rotation). Exporté : la barre d'onglets a
// besoin de savoir quand les places sont toutes prises, donc quel onglet est le
// prochain remplacé.
export const MAX_FILES = 5;

// Autant de teintes que de places (voir --tab-hue-* dans theme.css).
const HUES = MAX_FILES;

// La teinte est ATTRIBUÉE à l'import, parmi celles qu'aucun fichier ouvert
// n'utilise, puis persistée. Deux raisons de ne pas la dériver à la volée :
//  - dérivée de la position, elle changerait à chaque réordonnancement, ce qui
//    détruit l'identité qu'elle sert à créer ;
//  - dérivée d'un hachage de l'identifiant, elle collisionne vite (cinq teintes
//    pour cinq fichiers), et deux onglets de la même couleur ne distinguent rien.
function freeHue(records) {
  const taken = new Set(records.map((r) => r.hue));
  for (let h = 0; h < HUES; h++) if (!taken.has(h)) return h;
  return 0;
}

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function byRecent(a, b) {
  return new Date(b.importedAt) - new Date(a.importedAt);
}

// Les octets d'un contenu stocké. Les enregistrements d'avant le passage au Blob
// portent une CHAÎNE : on les réencode à la lecture plutôt que de les réécrire,
// parce que réécrire un enregistrement de 200 Mo pour l'avoir simplement ouvert
// serait une surprise désagréable. Ils basculeront à leur prochain import.
function bytesOf(content) {
  if (typeof content === "string") return new TextEncoder().encode(content).buffer;
  return content.arrayBuffer();
}

// L'ordre des onglets appartient à l'utilisateur : il est donc PERSISTÉ et ne
// peut plus être déduit de la date d'import. C'est aussi lui qui décide de la
// rotation : le dernier onglet est le prochain remplacé, et glisser un onglet
// vers la gauche le protège.
//
// `order` = 0 pour l'onglet le plus à gauche.
// ⚠️ Les enregistrements rendus ici sont ALLÉGÉS : ils n'ont pas de `content`
// (voir `dbListMeta`). Ne jamais les repasser à `dbPut`, qui remplacerait
// l'enregistrement entier et effacerait le contenu du fichier. Toute
// modification passe par `dbPatch`.
async function ordered() {
  const all = await dbListMeta();

  // Enregistrements d'avant l'introduction de `order` / `hue` : on les numérote
  // du plus récent au plus ancien, ce qui était leur ordre d'affichage
  // historique, et on leur donne une teinte distincte au passage.
  if (all.some((r) => typeof r.order !== "number" || typeof r.hue !== "number")) {
    all.sort(byRecent);
    for (let i = 0; i < all.length; i++) {
      all[i].order = i;
      all[i].hue = i % HUES;
      await dbPatch(all[i].id, { order: all[i].order, hue: all[i].hue });
    }
    return all;
  }

  return all.sort((a, b) => a.order - b.order);
}

// Métadonnées seules (liste des fichiers récents et barre d'onglets), dans
// l'ordre choisi par l'utilisateur.
export async function listLogs() {
  try {
    const all = await ordered();
    return all.map(({ id, name, label, hue, size, importedAt, meta }) => ({
      id,
      name,
      label: label || null,
      hue: hue || 0,
      size,
      importedAt,
      lines: meta.lines,
      errorCount: meta.errorCount,
      warnCount: meta.warnCount,
      truncated: meta.truncated,
    }));
  } catch {
    throw new Error("errors.load_list");
  }
}

// Parse le fichier localement, le stocke en tête, applique la rotation.
export async function uploadLog(file) {
  try {
    // Les OCTETS, pas le texte. Une chaîne JavaScript ne peut pas dépasser
    // 536 870 888 caractères, et un fichier de 500 Mo en occupe déjà 98 % :
    // `file.text()` lèverait « Invalid string length » avant même le parsing.
    // Le tampon est transféré au worker, donc inutilisable au retour ici, ce qui
    // n'est pas un problème : c'est le FICHIER qu'on stocke, pas son texte.
    const { truncated, totalLines, stats } = await parseAsync(await file.arrayBuffer(), false);

    const existing = await ordered();
    // La place la plus à droite est libérée juste après : sa teinte redevient
    // disponible pour l'arrivant.
    const survivors = existing.slice(0, MAX_FILES - 1);

    const record = {
      id: genId(),
      name: file.name || "log.txt",
      label: null,
      size: file.size,
      importedAt: new Date().toISOString(),
      order: 0,
      hue: freeHue(survivors),
      meta: {
        lines: totalLines,
        errorCount: stats.errorCount,
        warnCount: stats.warnCount,
        truncated,
      },
      // Le fichier lui-même, et non son texte. IndexedDB range un Blob hors de
      // la valeur, donc le relire ne fait plus monter des centaines de Mo de
      // chaîne en mémoire : on demande ses octets au moment de parser, et
      // seulement à ce moment.
      content: file,
    };

    await dbPut(record);

    // Le nouvel import entre à gauche : tout le monde se décale d'un cran, et ce
    // qui dépasse la cinquième place disparaît.
    let next = 1;
    for (const old of existing) {
      if (next >= MAX_FILES) {
        cacheDrop(old.id);
        await dbDelete(old.id);
        continue;
      }
      old.order = next++;
      await dbPatch(old.id, { order: old.order });
    }

    return { id: record.id, truncated };
  } catch {
    throw new Error("errors.upload");
  }
}

// Détail d'un fichier. Le résultat est mis en cache : sans ça, chaque changement
// d'onglet relancerait un parsing complet.
export async function getLog(id) {
  const cached = cacheGet(id);
  if (cached) return cached;

  const record = await dbGet(id);
  if (!record) throw new Error("errors.not_found");

  const payload = await parseAsync(await bytesOf(record.content), true);
  const { truncated, totalLines, stats, levels, peaks } = payload;

  const result = {
    meta: {
      ...record.meta,
      name: record.name,
      label: record.label || null,
      truncated,
      lines: totalLines,
    },
    levels,
    stats,
    peaks: peaks || [],
    // Les octets et l'index sont revenus du worker sans copie ; il ne reste qu'à
    // rebrancher les matérialisateurs du bon format.
    store: storeFrom(payload),
  };

  cachePut(id, result);
  return result;
}

// Étiquette choisie par l'utilisateur. Chaîne vide = retour à l'étiquette
// automatique (l'heure d'import).
export async function renameLog(id, label) {
  try {
    const clean = (label || "").trim().slice(0, MAX_LABEL) || null;
    // Un patch, et pas une relecture suivie d'une écriture : relire
    // l'enregistrement complet ferait monter le contenu du fichier en mémoire
    // pour changer une étiquette de quatorze caractères.
    const found = await dbPatch(id, { label: clean });
    if (!found) throw new Error("errors.not_found");

    // Le cache porte l'étiquette dans ses métadonnées : on l'y répercute plutôt
    // que de jeter un parsing encore valable.
    const cached = cacheGet(id);
    if (cached) cachePut(id, { ...cached, meta: { ...cached.meta, label: clean } });

    return { label: clean };
  } catch (e) {
    if (e.message === "errors.not_found") throw e;
    throw new Error("errors.rename");
  }
}

// Nouvel ordre des onglets, de gauche à droite. Les identifiants absents de la
// liste sont repoussés à la fin.
export async function reorderLogs(ids) {
  try {
    const all = await ordered();
    const rank = new Map(ids.map((id, i) => [id, i]));

    for (const record of all) {
      const next = rank.has(record.id) ? rank.get(record.id) : ids.length;
      if (record.order === next) continue;
      record.order = next;
      await dbPatch(record.id, { order: next });
    }

    return { ok: true };
  } catch {
    throw new Error("errors.reorder");
  }
}

export async function deleteLog(id) {
  try {
    cacheDrop(id);
    await dbDelete(id);
    // La place libérée est reprise : sinon un trou dans `order` décalerait le
    // calcul de l'onglet condamné.
    const all = await ordered();
    for (let i = 0; i < all.length; i++) {
      if (all[i].order === i) continue;
      all[i].order = i;
      await dbPatch(all[i].id, { order: i });
    }
    return { ok: true };
  } catch {
    throw new Error("errors.delete");
  }
}
