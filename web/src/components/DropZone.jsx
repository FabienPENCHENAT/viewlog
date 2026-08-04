import { useCallback, useState } from "react";
import { filesFromDrop } from "../lib/files.js";
import { useI18n } from "../i18n/index.jsx";

// Zone de dépôt. Accepte un fichier, plusieurs fichiers, ou un dossier (dont on
// ne lit que les enfants directs). Le tri de ce qui est déposé vit dans
// `lib/files.js` ; ici on ne capte que le geste, et les inputs sont portés par
// ImportManager pour que le « + » de la barre d'onglets se comporte pareil.
export default function DropZone({ onFiles, onPickFiles, onPickFolder, busy }) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      setDragging(false);
      if (busy) return;
      const { files, fromFolder } = await filesFromDrop(e.dataTransfer);
      onFiles(files, fromFolder ? "folder" : "drop");
    },
    [onFiles, busy]
  );

  return (
    <div
      className={`dropzone ${dragging ? "dropzone--active" : ""} ${busy ? "dropzone--busy" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !busy && onPickFiles()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (busy || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        onPickFiles();
      }}
    >
      <div className="dropzone-icon">{busy ? "⏳" : "⬆"}</div>
      <div className="dropzone-title">
        {busy ? t("dropzone.analyzing") : t("dropzone.title")}
      </div>
      <div className="dropzone-sub">
        {busy ? t("dropzone.wait") : t("dropzone.hint")}
      </div>
      {!busy && (
        <button
          type="button"
          className="dropzone-folder"
          onClick={(e) => {
            e.stopPropagation();
            onPickFolder();
          }}
        >
          {t("dropzone.folder")}
        </button>
      )}
    </div>
  );
}
