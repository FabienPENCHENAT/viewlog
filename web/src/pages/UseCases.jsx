import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/index.jsx";
import { levelColor } from "../levels.js";
import spikeFr from "../assets/demo-spike.fr.svg";
import spikeEn from "../assets/demo-spike.en.svg";
import isolatedFr from "../assets/demo-isolated.fr.svg";
import isolatedEn from "../assets/demo-isolated.en.svg";

// Une démonstration par cas et par langue, générée par scripts/gen-demo-svg.mjs.
const DEMOS = {
  spike: { fr: spikeFr, en: spikeEn },
  isolated: { fr: isolatedFr, en: isolatedEn },
};

// Les cas d'usage. Le contenu vit dans l'i18n (FR/EN) : ici, la structure seule.
//
// Un how-to part d'une situation que le lecteur a vécue, pas d'un bouton de
// l'interface : « comment déposer un log » est de la FAQ, pas un cas d'usage.
const CASES = [
  { id: "spike", demo: "spike" },
  { id: "isolated", demo: "isolated" },
];

const CAP_GROUPS = ["explore", "search", "analyse"];

// Ce que chaque démonstration montre RÉELLEMENT. Le bloc s'annonce comme les
// fonctionnalités visibles dans cette démonstration, il ne peut donc pas être le
// même d'un cas à l'autre : le pic compare une zone au reste du fichier et ne
// resserre aucune fenêtre, l'échec signalé fait exactement l'inverse et ouvre en
// plus les occurrences d'un motif. Les textes, eux, ne sont écrits qu'une fois.
const CAPS = {
  spike: {
    explore: ["views", "period"],
    search: ["query", "levels"],
    analyse: ["compare", "virtual"],
  },
  isolated: {
    explore: ["views", "period", "finetune", "hits"],
    search: ["query", "levels"],
    analyse: ["virtual"],
  },
};

const LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

// Un paragraphe entièrement entre accents graves est une ligne de log. On la rend
// comme dans le produit, niveau coloré puis message en monospace : citer une ligne
// telle qu'elle apparaît vaut mieux que la décrire. Les accents graves sont déjà la
// convention de la page /changelog.
function paragraph(para, k) {
  if (!(para.startsWith("`") && para.endsWith("`"))) {
    return <p key={k} className="uc-desc">{para}</p>;
  }
  const raw = para.slice(1, -1);
  const [first, ...rest] = raw.split(" ");
  const lvl = LEVELS.includes(first) ? first : null;
  return (
    <p key={k} className="uc-logline">
      {lvl && (
        <span className="uc-log-lvl" style={{ "--c": levelColor(lvl) }}>{lvl}</span>
      )}
      <code>{lvl ? rest.join(" ") : raw}</code>
    </p>
  );
}

export default function UseCases() {
  const { t, lang } = useI18n();
  // Rien d'ouvert au départ : la grille est la vue d'ensemble, ouvrir un cas est
  // un geste.
  const [open, setOpen] = useState(null);

  const lines = (key) => t(key).split("\n").filter(Boolean);
  const active = CASES.find((c) => c.id === open);

  return (
    <div className="uc">
      <Link to="/" className="back-link">{t("dash.back_home")}</Link>
      {/* Titre lu par les lecteurs d'écran et les moteurs, sans occuper l'écran :
          une page sans titre reste un défaut, même quand le visuel n'en veut pas. */}
      <h1 className="sr-only">{t("uc.title")}</h1>

      {/* La grille ne porte que les déclencheurs, tous de même hauteur. Le détail
          vit dans un panneau à part, en dessous : déplier une carte à l'intérieur
          de la grille laisserait forcément un trou à côté d'elle, puisqu'un
          élément pleine largeur passe à la ligne suivante. */}
      <div className="uc-grid">
        {CASES.map((c, i) => {
          const isOpen = open === c.id;
          return (
            <h2 className="uc-h" key={c.id}>
              <button
                type="button"
                id={`uc-card-${c.id}`}
                className="card uc-card"
                aria-expanded={isOpen}
                aria-controls="uc-detail"
                onClick={() => setOpen(isOpen ? null : c.id)}
              >
                <span className="uc-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <span className="uc-q">{t(`uc.${c.id}_title`)}</span>
                <span className="uc-caret" aria-hidden="true">▸</span>
              </button>
            </h2>
          );
        })}
      </div>

      {active && (
        // Le panneau n'a pas de titre visible : la carte sélectionnée porte déjà
        // le sien, en accent, juste au-dessus. `aria-labelledby` le dit aux
        // lecteurs d'écran sans le répéter à l'écran.
        <section
          className="card uc-detail"
          id="uc-detail"
          aria-labelledby={`uc-card-${active.id}`}
        >
          <div className="uc-text">
            {t(`uc.${active.id}_desc`).split("\n\n").map(paragraph)}

            <h3 className="uc-sub">{t("uc.steps")}</h3>
            {/* Une liste ordonnée, parce que c'en est une : les quatre temps se
                suivent, la numérotation porte une information. */}
            <ol className="uc-steps">
              {lines(`uc.${active.id}_steps`).map((s, k) => (
                <li key={k}>{s}</li>
              ))}
            </ol>
          </div>

          <div className="uc-demo">
            {/* Le SVG s'anime seul dans un <img> : pas de script, pas de lecteur,
                quelques kilo-octets, net à toutes les tailles. */}
            <img
              src={DEMOS[active.demo][lang] || DEMOS[active.demo].en}
              alt={t(`uc.${active.id}_demo_alt`)}
              loading="lazy"
            />
          </div>

          {/* Les capacités croisées au passage : c'est le second rôle de la page,
              montrer ce que l'outil sait faire au-delà du cas qu'on est venu lire. */}
          <div className="uc-caps">
            <h3 className="uc-caps-title">{t("uc.caps_title")}</h3>
            <div className="uc-caps-grid">
              {CAP_GROUPS.map((group) => (
                <div key={group} className="uc-cap">
                  <h4 className="uc-cap-title">{t(`uc.cap_${group}`)}</h4>
                  <ul className="uc-cap-items">
                    {CAPS[active.id][group].map((feat) => (
                      <li key={feat}>{t(`uc.feat_${feat}`)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="uc-cta">
        <Link to="/" className="uc-cta-btn">{t("uc.cta")}</Link>
      </div>
    </div>
  );
}
