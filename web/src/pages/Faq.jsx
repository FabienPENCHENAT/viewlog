import { Link } from "react-router-dom";
import { useI18n } from "../i18n/index.jsx";
import shieldIcon from "../assets/privacy-shield.svg";

// FAQ groupée par thème (titre de section + paires question/réponse).
// Le contenu des textes vit dans l'i18n (FR/EN).
const GROUPS = [
  {
    title: "faq.group_usage",
    items: [
      ["faq.q_how", "faq.a_how"],
      ["faq.q_features", "faq.a_features"],
      ["faq.q_search", "faq.a_search"],
      ["faq.q_patterns", "faq.a_patterns"],
      ["faq.q_formats", "faq.a_formats"],
      ["faq.q_size", "faq.a_size"],
    ],
  },
  {
    title: "faq.group_privacy",
    items: [
      ["faq.q_privacy", "faq.a_privacy"],
      ["faq.q_retention", "faq.a_retention"],
      ["faq.q_delete", "faq.a_delete"],
    ],
  },
  {
    title: "faq.group_meta",
    items: [
      ["faq.q_free", "faq.a_free"],
      ["faq.q_contact", "faq.a_contact"],
    ],
  },
];

export default function Faq() {
  const { t } = useI18n();

  return (
    <div className="faq">
      <Link to="/" className="back-link">{t("dash.back_home")}</Link>
      <h1 className="faq-title">{t("faq.title")}</h1>

      <div className="faq-list">
        {GROUPS.map((group) => (
          <section key={group.title} className="faq-group">
            <h2 className="faq-group-title">{t(group.title)}</h2>
            {group.items.map(([q, a]) => (
              <section key={q} className="card faq-item">
                <h3 className="faq-q">
                  {q === "faq.q_privacy" && (
                    <img className="faq-q-icon" src={shieldIcon} alt="" aria-hidden="true" />
                  )}
                  {t(q)}
                </h3>
                <p className="faq-a">{t(a)}</p>
              </section>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
