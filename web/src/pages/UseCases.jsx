import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/index.jsx";
import demoFr from "../assets/demo-spike.fr.svg";
import demoEn from "../assets/demo-spike.en.svg";

// Les cas d'usage. Le contenu vit dans l'i18n (FR/EN) : ici, la structure seule.
//
// `demo` désigne le cas illustré par la démonstration animée. Une reconstruction
// peut vieillir en silence quand l'interface bouge, et une démonstration fausse
// est pire que pas de démonstration : mieux vaut deux ou trois cas soignés qu'un
// catalogue.
const CASES = [{ id: "spike", demo: true }];

export default function UseCases() {
  const { t, lang } = useI18n();
  // Rien d'ouvert au départ : la grille de cartes est la vue d'ensemble, et
  // ouvrir un cas est un geste, pas un état par défaut.
  const [open, setOpen] = useState(null);

  const lines = (key) => t(key).split("\n").filter(Boolean);

  return (
    <div className="uc">
      <Link to="/" className="back-link">{t("dash.back_home")}</Link>
      {/* Titre lu par les lecteurs d'écran et les moteurs, sans occuper l'écran :
          une page sans titre reste un défaut, même quand le visuel n'en veut pas. */}
      <h1 className="sr-only">{t("uc.title")}</h1>

      <div className="uc-grid">
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
                  <span className="uc-q">{t(`uc.${c.id}_title`)}</span>
                  <span className="uc-caret" aria-hidden="true">▸</span>
                </button>
              </h2>

              {isOpen && (
                <div className="uc-panel" id={`uc-panel-${c.id}`}>
                  {/* Le texte à gauche, la démonstration à droite : côte à côte,
                      on lit le problème en regardant le geste. */}
                  <div className="uc-text">
                    {t(`uc.${c.id}_desc`)
                      .split("\n\n")
                      .map((para, k) => (
                        <p key={k} className="uc-desc">{para}</p>
                      ))}

                    <h3 className="uc-sub">{t("uc.steps")}</h3>
                    {/* Une liste ordonnée, parce que c'en est une : les quatre
                        temps se suivent, la numérotation porte une information. */}
                    <ol className="uc-steps">
                      {lines(`uc.${c.id}_steps`).map((s, k) => (
                        <li key={k}>{s}</li>
                      ))}
                    </ol>
                  </div>

                  {c.demo && (
                    <div className="uc-demo">
                      {/* Le SVG s'anime seul dans un <img> : pas de script, pas de
                          lecteur, quelques kilo-octets, net à toutes les tailles.
                          Une version par langue, générée par
                          scripts/gen-demo-svg.mjs. */}
                      <img src={lang === "fr" ? demoFr : demoEn} alt={t("uc.demo_alt")} />
                    </div>
                  )}

                  {/* Les fonctionnalités croisées au passage, valables sur
                      n'importe quel log : c'est le second rôle de la page. */}
                  <div className="uc-seen">
                    <h3 className="uc-sub">{t("uc.seen")}</h3>
                    <ul className="uc-feats">
                      {lines(`uc.${c.id}_seen`).map((s, k) => (
                        <li key={k}>{s}</li>
                      ))}
                    </ul>
                  </div>
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
