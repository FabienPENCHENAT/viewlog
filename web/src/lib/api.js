// API locale : le parsing et le stockage se font entièrement dans le navigateur.
// Aucune requête réseau, aucune donnée ne quitte la machine du client.
// Les erreurs sont levées sous forme de CLÉS i18n ; l'UI les traduit à l'affichage.
import { parseAsync } from "./parse-async.js";
import { dbGetAll, dbGet, dbPut, dbDelete } from "./db.js";

// On ne conserve que les 5 fichiers les plus récents (rotation).
const MAX_FILES = 5;

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function byRecent(a, b) {
  return new Date(b.importedAt) - new Date(a.importedAt);
}

// Métadonnées seules (pour la liste des fichiers récents).
export async function listLogs() {
  try {
    const all = await dbGetAll();
    return all.sort(byRecent).map(({ id, name, size, importedAt, meta }) => ({
      id,
      name,
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

// Parse le fichier localement, le stocke, applique la rotation à MAX_FILES.
export async function uploadLog(file) {
  try {
    const content = await file.text();
    // Métadonnées seulement : pas besoin de rapatrier les entrées ici.
    const { truncated, totalLines, stats } = await parseAsync(content, false);

    const record = {
      id: genId(),
      name: file.name || "log.txt",
      size: file.size,
      importedAt: new Date().toISOString(),
      meta: {
        lines: totalLines,
        errorCount: stats.errorCount,
        warnCount: stats.warnCount,
        truncated,
      },
      content,
    };

    await dbPut(record);

    // Rotation : supprime tout ce qui dépasse les MAX_FILES plus récents.
    const all = (await dbGetAll()).sort(byRecent);
    for (const old of all.slice(MAX_FILES)) {
      await dbDelete(old.id);
    }

    return { id: record.id, truncated };
  } catch {
    throw new Error("errors.upload");
  }
}

// Détail d'un fichier : re-parse le contenu stocké pour reconstruire stats + entrées.
export async function getLog(id) {
  const record = await dbGet(id);
  if (!record) throw new Error("errors.not_found");

  const { entries, truncated, totalLines, stats, levels } = await parseAsync(
    record.content,
    true
  );

  return {
    meta: { ...record.meta, name: record.name, truncated, lines: totalLines },
    levels,
    stats,
    entries,
  };
}

export async function deleteLog(id) {
  try {
    await dbDelete(id);
    return { ok: true };
  } catch {
    throw new Error("errors.delete");
  }
}
