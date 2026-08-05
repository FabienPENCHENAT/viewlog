import { forwardRef, useImperativeHandle, useRef, useState } from "react";

import FilePicker from "./FilePicker.jsx";
import { filesFromDirectoryInput } from "../../lib/files.js";
import { importMany } from "../../lib/import-log.js";
import { trackFeature } from "../../lib/track.js";
import { MAX_FILES } from "../../lib/api.js";
import { useI18n } from "../../i18n/index.jsx";

// Orchestre un import, d'un ou plusieurs fichiers.
//
// Vit ici et pas dans les pages parce que les deux chemins d'entrée (la zone de
// dépôt de l'accueil et le « + » de la barre d'onglets) doivent se comporter
// exactement pareil, y compris pour le choix quand le lot dépasse la capacité.
//
// Exposé par ref : `openFiles()`, `openFolder()`, `intake(files, method)`.
const ImportManager = forwardRef(function ImportManager({ onDone, onError, onBusy }, ref) {
  const { t } = useI18n();
  const filesInput = useRef(null);
  const folderInput = useRef(null);

  const [pending, setPending] = useState(null); // { files, method, fromFolder }
  const [progress, setProgress] = useState(null); // { done, total, name }

  function fail(key) {
    if (onError) onError(key);
  }

  async function run(files, method) {
    if (!files.length) return;
    if (files.length > 1) trackFeature("multi_import");

    if (onBusy) onBusy(true);
    setProgress({ done: 0, total: files.length, name: files[0].name });

    const { ids, failed } = await importMany(files, method, (done, total, name) =>
      setProgress({ done, total, name })
    );

    setProgress(null);
    if (onBusy) onBusy(false);

    // Un échec partiel ne doit pas masquer ce qui a marché : on ouvre quand même
    // ce qui a été importé, et on signale le reste.
    if (failed.length) fail(failed.length === files.length ? failed[0].error : "errors.import_partial");
    if (ids.length && onDone) onDone(ids);
  }

  // Point d'entrée unique. Au-delà de la capacité de l'app, on demande à
  // l'utilisateur lesquels garder plutôt que de tronquer en silence.
  function intake(files, method) {
    if (!files || !files.length) {
      fail("errors.no_file");
      return;
    }
    if (files.length > MAX_FILES) {
      setPending({ files, method, fromFolder: method === "folder" });
      return;
    }
    run(files, method);
  }

  useImperativeHandle(ref, () => ({
    openFiles: () => filesInput.current?.click(),
    openFolder: () => folderInput.current?.click(),
    intake,
  }));

  return (
    <>
      <input
        ref={filesInput}
        type="file"
        accept=".log,.txt,.csv,text/plain,text/csv"
        multiple
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          e.target.value = "";
          intake(list, "picker");
        }}
      />

      {/* Un même input ne peut pas proposer les fichiers ET les dossiers :
          `webkitdirectory` remplace le sélecteur. D'où deux inputs, et l'attribut
          posé à la main plutôt qu'en JSX, où React ne garantit pas de le
          transmettre tel quel. */}
      <input
        ref={(el) => {
          folderInput.current = el;
          if (el) {
            el.setAttribute("webkitdirectory", "");
            el.setAttribute("directory", "");
          }
        }}
        type="file"
        hidden
        onChange={(e) => {
          const { files } = filesFromDirectoryInput(e.target.files);
          e.target.value = "";
          intake(files, "folder");
        }}
      />

      {pending && (
        <FilePicker
          files={pending.files}
          max={MAX_FILES}
          fromFolder={pending.fromFolder}
          onCancel={() => setPending(null)}
          onConfirm={(chosen) => {
            setPending(null);
            run(chosen, pending.method);
          }}
        />
      )}

      {progress && progress.total > 1 && (
        <div className="import-progress" role="status">
          <span className="import-progress-bar" aria-hidden="true">
            <i style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </span>
          <span>
            {t("import.progress", { done: progress.done, total: progress.total })}
            {progress.name ? ` · ${progress.name}` : ""}
          </span>
        </div>
      )}
    </>
  );
});

export default ImportManager;
