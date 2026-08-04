// Collecte des fichiers à importer, depuis un dépôt ou un sélecteur.
//
// Deux chemins d'entrée, un seul résultat : une liste plate de `File`, déjà
// débarrassée de ce qui n'est manifestement pas un log.

// Un dossier peut contenir des sous-dossiers ; on ne descend PAS dedans. Un
// export de logs met ses fichiers à plat dans le dossier, et descendre
// récursivement ramènerait des centaines d'entrées sans rapport.
const MAX_DIR_ENTRIES = 500; // garde-fou : un dossier système ne fait pas tout sauter

// Fichiers à écarter d'office : métadonnées d'OS, fichiers cachés, fichiers vides.
function keepable(file) {
  const name = file.name || "";
  if (!name || name.startsWith(".")) return false;
  if (name === "__MACOSX") return false;
  if (file.size === 0) return false;
  return true;
}

function dedupe(files) {
  const seen = new Set();
  return files.filter((f) => {
    const key = `${f.name}:${f.size}:${f.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Lit les enfants DIRECTS d'un dossier déposé. `readEntries` ne renvoie qu'un
// lot à la fois : il faut rappeler jusqu'au lot vide.
function readDirectory(entry) {
  return new Promise((resolve) => {
    const reader = entry.createReader();
    const out = [];

    const step = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length || out.length >= MAX_DIR_ENTRIES) return resolve(out);
          // Seuls les fichiers : on ignore les sous-dossiers sans y descendre.
          for (const e of batch) if (e.isFile) out.push(e);
          step();
        },
        () => resolve(out)
      );
    };

    step();
  });
}

function toFile(entry) {
  return new Promise((resolve) => {
    entry.file(resolve, () => resolve(null));
  });
}

// Depuis un événement de dépôt. Gère un mélange de fichiers et de dossiers.
//
// ⚠️ Tout ce qui touche au `DataTransfer` est lu de façon SYNCHRONE, avant le
// premier `await` : l'objet est vidé dès que le gestionnaire d'événement rend la
// main, et la lecture d'un dossier est asynchrone.
export async function filesFromDrop(dataTransfer) {
  const items = Array.from(dataTransfer.items || []);

  // `webkitGetAsEntry` est le seul moyen de savoir qu'un élément déposé est un
  // dossier : `dataTransfer.files` le présente comme un fichier de taille nulle.
  const entries = items
    .filter((i) => i.kind === "file")
    .map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));

  if (!entries.some(Boolean)) {
    // Navigateur sans l'API des entrées : on se rabat sur la liste simple.
    return { files: dedupe(Array.from(dataTransfer.files || []).filter(keepable)), fromFolder: false };
  }

  const out = [];
  let fromFolder = false;

  for (const entry of entries) {
    if (!entry) continue;
    if (entry.isFile) {
      const f = await toFile(entry);
      if (f && keepable(f)) out.push(f);
    } else if (entry.isDirectory) {
      fromFolder = true;
      const children = await readDirectory(entry);
      for (const child of children) {
        const f = await toFile(child);
        if (f && keepable(f)) out.push(f);
      }
    }
  }

  return { files: dedupe(out), fromFolder };
}

// Depuis un `<input webkitdirectory>`. Le navigateur renvoie TOUTE
// l'arborescence à plat ; `webkitRelativePath` vaut `dossier/fichier.log` pour un
// enfant direct, et compte un segment de plus par niveau supplémentaire.
export function filesFromDirectoryInput(fileList) {
  const all = Array.from(fileList || []);
  const direct = all.filter((f) => {
    const path = f.webkitRelativePath || "";
    // Pas de chemin : on ne peut rien déduire, on garde.
    if (!path) return true;
    return path.split("/").length === 2;
  });
  return { files: dedupe(direct.filter(keepable)), fromFolder: true };
}

// Élide le préfixe commun des chemins, sur frontières de segments. Dans un
// dossier extrait d'une archive, toutes les entrées partagent le même début et la
// liste devient illisible : ce qui est commun ne distingue rien.
export function shortPaths(files) {
  const paths = files.map((f) => f.webkitRelativePath || f.name);
  const parts = paths.map((p) => p.split("/"));

  let common = 0;
  if (parts.length > 1) {
    const min = Math.min(...parts.map((p) => p.length));
    while (common < min - 1) {
      const seg = parts[0][common];
      if (!parts.every((p) => p[common] === seg)) break;
      common++;
    }
  }

  return parts.map((p) => p.slice(common).join("/"));
}
