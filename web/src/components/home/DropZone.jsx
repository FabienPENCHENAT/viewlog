import { useCallback, useState } from "react";
import Loader from "../shared/Loader.jsx";
import { filesFromDrop } from "../../lib/files.js";
import { MAX_MB } from "../../parser/index.js";
import { useI18n } from "../../i18n/index.jsx";

// Zone de dépôt. Accepte un fichier, plusieurs fichiers, ou un dossier (dont on
// ne lit que les enfants directs). Le tri de ce qui est déposé vit dans
// `lib/files.js` ; ici on ne capte que le geste, et les inputs sont portés par
// ImportManager pour que le « + » de la barre d'onglets se comporte pareil.
export default function DropZone({ onFiles, onPickFiles, onPickFolder, busy, step }) {
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
      {/* Le sablier ne disait rien : ni si ça travaille, ni où on en est. Le
          loader roule tant que le worker travaille, et le titre nomme l'étape
          en cours plutôt que de répéter « analyse ». */}
      <div className="dropzone-icon">
        {busy ? <Loader size={56} /> : "⬆"}
      </div>
      <div className="dropzone-title">
        {busy ? t(step ? `loader.${step}` : "dropzone.analyzing") : t("dropzone.title")}
      </div>
      <div className="dropzone-sub">
        {/* Le plafond est annoncé AVANT le dépôt : le découvrir par un refus,
            après avoir attendu, est le pire moment pour l'apprendre. */}
        {busy ? t("dropzone.wait") : t("dropzone.hint", { max: MAX_MB })}
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
