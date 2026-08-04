import { useEffect, useMemo, useRef, useState } from "react";

import { shortPaths } from "../lib/files.js";
import { useI18n } from "../i18n/index.jsx";

function formatSize(bytes, t) {
  if (bytes < 1024) return `${bytes} ${t("unit.b")}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${t("unit.kb")}`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${t("unit.mb")}`;
}

// Choisir quels fichiers importer quand le lot dépasse la capacité de l'app.
//
// On ne tronque pas en silence : l'utilisateur a désigné ces fichiers, c'est à lui
// de dire lesquels garder. `<dialog>` natif pour le piège à focus et Échap.
export default function FilePicker({ files, max, fromFolder, onConfirm, onCancel }) {
  const { t, locale } = useI18n();
  const ref = useRef(null);

  // Les premiers de la sélection, dans l'ordre donné par l'utilisateur : c'est le
  // seul ordre qui ait un sens pour lui. Trier par taille serait arbitraire.
  const [picked, setPicked] = useState(() => new Set(files.slice(0, max).map((_, i) => i)));

  // Le nom brut est souvent identique d'un fichier à l'autre dans un dossier
  // extrait d'une archive : on montre le chemin, élidé de ce qui est commun.
  const labels = useMemo(() => shortPaths(files), [files]);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (!dlg.open) dlg.showModal();
    const onClose = () => onCancel();
    dlg.addEventListener("cancel", onClose);
    return () => dlg.removeEventListener("cancel", onClose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(i) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else if (next.size < max) next.add(i);
      return next;
    });
  }

  const full = picked.size >= max;

  function confirm() {
    // On respecte l'ordre de la liste, pas l'ordre de cochage.
    onConfirm(files.filter((_, i) => picked.has(i)));
  }

  return (
    <dialog className="picker" ref={ref} aria-labelledby="picker-title">
      <h2 className="picker-title" id="picker-title">
        {fromFolder
          ? t("picker.title_folder", { count: files.length })
          : t("picker.title_files", { count: files.length })}
      </h2>
      <p className="picker-lead">{t("picker.lead", { max })}</p>

      <ul className="picker-list">
        {files.map((file, i) => {
          const on = picked.has(i);
          return (
            <li key={`${file.name}-${i}`}>
              <label className="picker-item">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && full}
                  onChange={() => toggle(i)}
                />
                <span className="picker-name">{labels[i]}</span>
                <span className="picker-size muted">{formatSize(file.size, t)}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="picker-foot">
        <span className="picker-count" aria-live="polite">
          {t("picker.count", { n: picked.size.toLocaleString(locale), max })}
        </span>
        <button type="button" className="picker-cancel" onClick={onCancel}>
          {t("picker.cancel")}
        </button>
        <button
          type="button"
          className="picker-go"
          disabled={picked.size === 0}
          onClick={confirm}
        >
          {t("picker.confirm", { n: picked.size })}
        </button>
      </div>
    </dialog>
  );
}
