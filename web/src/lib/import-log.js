// Import d'un log : parsing, stockage et event d'usage anonyme.
//
// Partagé par la page d'accueil et par le « + » de la barre d'onglets, pour que
// les deux chemins comptent leurs imports de la même façon.
import { uploadLog } from "./api.js";
import { trackImport, sizeBucket } from "./track.js";

// Extension seule (jamais le nom complet) pour les stats d'usage anonymes.
export function fileExt(name) {
  const m = /\.([a-z0-9]{1,10})$/i.exec(name || "");
  return m ? m[1].toLowerCase() : "none";
}

// method : "drop" | "picker" | "paste" | "tab_add".
// Renvoie { id, truncated }, ou relance l'erreur (clé i18n) après l'avoir
// comptée comme un échec.
export async function importLog(file, method) {
  const ext = fileExt(file?.name);
  const size = sizeBucket(file?.size || 0);
  try {
    const { id, truncated } = await uploadLog(file);
    trackImport("success", { method, ext, size, truncated });
    return { id, truncated };
  } catch (e) {
    trackImport("fail", { method, ext, size });
    throw e;
  }
}
