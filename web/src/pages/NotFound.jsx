import { Link, useLocation } from "react-router-dom";
import { levelColor } from "../levels.js";
import { useI18n } from "../i18n/index.jsx";

// 404 volontairement "log-flavored" : on affiche l'erreur comme une ligne de log.
export default function NotFound() {
  const { t } = useI18n();
  const { pathname } = useLocation();

  return (
    <div className="notfound">
      <div className="nf-code">404</div>

      <div className="card nf-log">
        <span className="level-tag" style={{ "--chip-color": levelColor("ERROR") }}>
          ERROR
        </span>
        <code className="nf-log-msg">{t("nf.log", { path: pathname })}</code>
      </div>

      <h1 className="nf-title">{t("nf.title")}</h1>
      <p className="nf-quip">{t("nf.quip")}</p>

      <Link to="/" className="paste-submit nf-home">{t("nf.home")}</Link>
    </div>
  );
}
