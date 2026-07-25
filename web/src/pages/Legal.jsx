import { Link } from "react-router-dom";
import { useI18n } from "../i18n/index.jsx";

// Sections (titre, corps) — le contenu vit dans l'i18n (FR/EN).
const SECTIONS = [
  ["legal.editor_h", "legal.editor_body"],
  ["legal.host_h", "legal.host_body"],
  ["legal.data_h", "legal.data_body"],
];

export default function Legal() {
  const { t } = useI18n();

  return (
    <div className="faq">
      <Link to="/" className="back-link">{t("dash.back_home")}</Link>
      <h1 className="faq-title">{t("legal.title")}</h1>

      <div className="faq-list">
        {SECTIONS.map(([h, b]) => (
          <section key={h} className="card faq-item">
            <h2 className="faq-q">{t(h)}</h2>
            <p className="faq-a">{t(b)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
