import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/index.jsx";
import demoFr from "../assets/demo-spike.fr.svg";
import demoEn from "../assets/demo-spike.en.svg";

// Les cas d'usage, du plus fort au plus accessoire. Le contenu vit dans l'i18n
// (FR/EN) : ici on ne décrit que la structure.
//
// `demo` désigne le cas illustré par la démonstration animée. Il n'y en a qu'un,
// volontairement : une démonstration est une reconstruction, elle peut vieillir
// en silence quand l'interface bouge, et une démonstration fausse est pire que
// pas de démonstration. Mieux vaut deux ou trois cas soignés qu'un catalogue.
const CASES = [
  { id: "spike", demo: true },
  { id: "local" },
  { id: "context" },
  { id: "several" },
];

export default function UseCases() {
  const { t, lang } = useI18n();
  // Un seul ouvert à la fois : la page doit rester parcourable d'un coup d'œil,
  // et le premier est ouvert d'emblée pour que la démonstration accueille.
  const [open, setOpen] = useState(CASES[0].id);

  const lines = (key) => t(key).split("\n").filter(Boolean);

  return (
    <div className="uc">
      <Link to="/" className="back-link">{t("dash.back_home")}</Link>
      <h1 className="uc-title">{t("uc.title")}</h1>
      <p className="uc-lead">{t("uc.lead")}</p>

      <div className="uc-list">
        {CASES.map((c, i) => {
          const isOpen = open === c.id;
          return (
            <section key={c.id} className="card uc-item" data-open={isOpen}>
              <h2 className="uc-h">
                <button
                  type="button"
                  className="uc-head"
                  aria-expanded={isOpen}
                  aria-controls={`uc-panel-${c.id}`}
                  onClick={() => setOpen(isOpen ? null : c.id)}
                >
                  <span className="uc-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <span className="uc-head-body">
                    <span className="uc-q">{t(`uc.${c.id}_q`)}</span>
                    <span className="uc-hook">{t(`uc.${c.id}_hook`)}</span>
                  </span>
                  <span className="uc-caret" aria-hidden="true">▸</span>
                </button>
              </h2>

              {isOpen && (
                <div className="uc-panel" id={`uc-panel-${c.id}`}>
                  {t(`uc.${c.id}_problem`)
                    .split("\n\n")
                    .map((para, k) => (
                      <p key={k} className="uc-problem">{para}</p>
                    ))}

                  <h3 className="uc-sub">{t("uc.brings")}</h3>
                  <ul className="uc-bullets">
                    {lines(`uc.${c.id}_brings`).map((s, k) => (
                      <li key={k}>{s}</li>
                    ))}
                  </ul>

                  {c.demo && (
                    <figure className="uc-demo">
                      {/* Le SVG s'anime seul dans un <img> : pas de script, pas de
                          lecteur, quelques kilo-octets, net à toutes les tailles.
                          Une version par langue, générée par
                          scripts/gen-demo-svg.mjs. */}
                      <img src={lang === "fr" ? demoFr : demoEn} alt={t("uc.demo_alt")} />
                      <figcaption>{t("uc.demo_caption")}</figcaption>
                    </figure>
                  )}

                  <h3 className="uc-sub">{t("uc.more")}</h3>
                  <ul className="uc-bullets uc-bullets--more">
                    {lines(`uc.${c.id}_more`).map((s, k) => (
                      <li key={k}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="uc-cta">
        <p>{t("uc.cta_lead")}</p>
        <Link to="/" className="uc-cta-btn">{t("uc.cta")}</Link>
      </div>
    </div>
  );
}
