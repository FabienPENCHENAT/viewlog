// Import d'un log : parsing, stockage et event d'usage anonyme.
//
// Partagé par la page d'accueil et par le « + » de la barre d'onglets, pour que
// les deux chemins comptent leurs imports de la même façon.
import { uploadLog } from "./api.js";
import { trackImport, sizeBucket } from "./track.js";
import { MAX_BYTES } from "../parser/shared.js";

// Extension seule (jamais le nom complet) pour les stats d'usage anonymes.
export function fileExt(name) {
  const m = /\.([a-z0-9]{1,10})$/i.exec(name || "");
  return m ? m[1].toLowerCase() : "none";
}

// method : "drop" | "picker" | "paste" | "tab_add" | "folder".
// Renvoie { id, truncated }, ou relance l'erreur (clé i18n) après l'avoir
// comptée comme un échec.
export async function importLog(file, method) {
  const ext = fileExt(file?.name);
  const size = sizeBucket(file?.size || 0);

  // Le refus se décide AVANT de lire le fichier : lire 800 Mo pour conclure
  // qu'ils ne passent pas, c'est déjà avoir fait tomber l'onglet. Le refus est
  // compté comme un échec d'import, avec sa tranche de taille : c'est ce qui
  // dira s'il faut relever le plafond.
  if ((file?.size || 0) > MAX_BYTES) {
    trackImport("fail", { method, ext, size });
    throw new Error("errors.too_big");
  }

  try {
    const { id, truncated } = await uploadLog(file);
    trackImport("success", { method, ext, size, truncated });
    return { id, truncated };
  } catch (e) {
    trackImport("fail", { method, ext, size });
    throw e;
  }
}

// Import d'un lot, séquentiellement.
//
// Deux partis pris :
//  - **En ordre inverse.** Chaque import entre à gauche, donc importer a, b, c
//    afficherait c, b, a. On remonte la liste pour que l'ordre des onglets
//    corresponde à l'ordre de sélection.
//  - **Un échec n'arrête pas le lot.** Perdre les quatre fichiers déjà traités
//    parce que le cinquième est illisible serait le pire des comportements.
//
// `onProgress(done, total, name)` est appelé avant chaque fichier.
// Renvoie { ids, failed } : `ids` dans l'ordre de sélection, `failed` la liste
// des noms en échec avec leur clé d'erreur.
export async function importMany(files, method, onProgress) {
  const ids = [];
  const failed = [];
  const total = files.length;

  for (let i = total - 1; i >= 0; i--) {
    const file = files[i];
    if (onProgress) onProgress(total - i - 1, total, file.name);
    try {
      const { id } = await importLog(file, method);
      ids.unshift(id);
    } catch (e) {
      failed.push({ name: file.name, error: e.message });
    }
  }

  if (onProgress) onProgress(total, total, null);
  return { ids, failed };
}
