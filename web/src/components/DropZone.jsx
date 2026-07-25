import { useCallback, useRef, useState } from "react";
import { useI18n } from "../i18n/index.jsx";

export default function DropZone({ onFile, busy }) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
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
      onClick={() => !busy && inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".log,.txt,.csv,text/plain,text/csv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <div className="dropzone-icon">{busy ? "⏳" : "⬆"}</div>
      <div className="dropzone-title">
        {busy ? t("dropzone.analyzing") : t("dropzone.title")}
      </div>
      <div className="dropzone-sub">
        {busy ? t("dropzone.wait") : t("dropzone.hint")}
      </div>
    </div>
  );
}
