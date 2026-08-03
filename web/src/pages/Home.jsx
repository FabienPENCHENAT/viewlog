import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import DropZone from "../components/DropZone.jsx";
import { listLogs, deleteLog } from "../lib/api.js";
import { importLog } from "../lib/import-log.js";
import { useI18n } from "../i18n/index.jsx";
import shieldIcon from "../assets/privacy-shield.svg";

function formatSize(bytes, t) {
  if (bytes < 1024) return `${bytes} ${t("unit.b")}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${t("unit.kb")}`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${t("unit.mb")}`;
}

export default function Home() {
  const { t, locale } = useI18n();
  const [recent, setRecent] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const navigate = useNavigate();

  async function refresh() {
    try {
      setRecent(await listLogs());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleFile(file, method = "drop") {
    setBusy(true);
    setError(null);
    try {
      const { id } = await importLog(file, method);
      navigate(`/dashboard/${id}`, { state: { from: "import" } });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  // Colle du texte : on l'emballe dans un File et on réutilise le même pipeline.
  function handlePaste() {
    const text = pasteText;
    if (!text.trim() || busy) return;
    const file = new File([text], t("paste.name"), { type: "text/plain" });
    handleFile(file, "paste");
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    await deleteLog(id);
    refresh();
  }

  return (
    <div className="home">
      <h1 className="home-title">
        {t("home.title_pre")}
        <span className="home-title-accent">{t("home.title_accent")}</span>
      </h1>
      <p className="lead">
        {t("home.lead_pre")}
        <strong className="lead-local">{t("home.lead_local")}</strong>
        {t("home.lead_post")}
      </p>

      <DropZone onFile={handleFile} busy={busy} />

      <div className="paste-block">
        <button
          type="button"
          className="paste-toggle"
          aria-expanded={showPaste}
          onClick={() => setShowPaste((v) => !v)}
        >
          {t("paste.toggle")}
        </button>
        {showPaste && (
          <div className="paste-panel">
            <textarea
              className="paste-input"
              placeholder={t("paste.placeholder")}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
            />
            <button
              type="button"
              className="paste-submit"
              disabled={busy || !pasteText.trim()}
              onClick={handlePaste}
            >
              {t("paste.submit")}
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{t(error)}</div>}

      <section className="recent">
        <h2>
          {t("home.recent")}{" "}
          {recent.length > 0 && (
            <span className="muted">{t("home.recent_count", { count: recent.length })}</span>
          )}
          <span
            className="info"
            tabIndex={0}
            role="note"
            aria-label={t("home.storage_note")}
          >
            <span className="info-mark" aria-hidden="true">ⓘ</span>
            <span className="info-tip">
              <img className="info-tip-icon" src={shieldIcon} alt="" aria-hidden="true" />
              <span>{t("home.storage_note")}</span>
            </span>
          </span>
        </h2>
        {recent.length === 0 ? (
          <p className="muted">{t("home.empty")}</p>
        ) : (
          <ul className="recent-list">
            {recent.map((f) => (
              <li
                key={f.id}
                className="recent-item"
                onClick={() => navigate(`/dashboard/${f.id}`, { state: { from: "recent" } })}
              >
                <div className="recent-main">
                  <span className="recent-name">{f.name}</span>
                  <span className="muted recent-meta">
                    {t("home.file_meta", {
                      lines: f.lines?.toLocaleString(locale),
                      size: formatSize(f.size, t),
                      date: new Date(f.importedAt).toLocaleString(locale),
                    })}
                  </span>
                </div>
                <div className="recent-side">
                  {f.errorCount > 0 && (
                    <span className="badge badge--error">
                      {t("home.badge_err", { count: f.errorCount })}
                    </span>
                  )}
                  {f.warnCount > 0 && (
                    <span className="badge badge--warn">
                      {t("home.badge_warn", { count: f.warnCount })}
                    </span>
                  )}
                  <button
                    className="icon-btn"
                    title={t("home.delete")}
                    onClick={(e) => handleDelete(e, f.id)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
