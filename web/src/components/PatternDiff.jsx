// Résultat de la comparaison « cette zone vs le reste du fichier ».
//
// Trois groupes, mais UN SEUL déplié : le premier qui a du contenu. Les autres
// tiennent sur une ligne repliée. La comparaison doit rendre la lecture plus
// courte que la vue Motifs, pas plus longue, sinon elle rate son but.

import { useState } from "react";
import PatternRow from "./PatternRow.jsx";
import { formatRatio, formatRate, MIN_RATIO } from "../lib/pattern-diff.js";
import { useI18n } from "../i18n/index.jsx";

// Même esprit que MAX_PATTERNS : on borne l'affichage, pas le calcul.
const MAX_ROWS = 40;

export default function PatternDiff({ diff, onPick }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);

  if (diff.degenerate) {
    return (
      <div className="lt-verdict">
        <b>{t("patterns.thin")}</b>
        <span>{t("patterns.thin_hint")}</span>
      </div>
    );
  }

  const rates = (g) =>
    t("patterns.rates", {
      inside: formatRate(g.rateHere, locale),
      outside: formatRate(g.rateThere, locale),
    });

  const groups = [
    {
      id: "only_here",
      items: diff.onlyHere,
      lead: (g) => `${g.count.toLocaleString(locale)}×`,
      second: (g) => t("patterns.example") + g.example,
      fold: null, // toujours en premier quand il a du contenu, donc jamais replié
    },
    {
      id: "over",
      items: diff.over,
      lead: (g) => `×${formatRatio(g.ratio)}`,
      second: rates,
      fold: (n) => t("patterns.fold_over", { count: n.toLocaleString(locale) }),
    },
    {
      id: "absent",
      items: diff.absent,
      lead: () => "0×",
      // Deux taux ne disent pas l'ampleur du manque. Le nombre qu'on ATTENDAIT
      // ici au rythme habituel, lui, répond à « et alors ? » : « attendu ~232,
      // vu 0 » se lit d'un coup, « 3 121 fois ailleurs » demande un calcul.
      second: (g) =>
        t("patterns.expected", {
          count: Math.round(g.expected).toLocaleString(locale),
        }),
      fold: (n) => t("patterns.fold_absent", { count: n.toLocaleString(locale) }),
    },
  ].filter((g) => g.items.length > 0);

  // Rien du tout : c'est un résultat, pas un échec. Une zone dont aucun motif ne
  // sort de l'ordinaire est un pic de volume, donc une surcharge, et le dire
  // vaut mieux qu'une liste vide qui passe pour un bug.
  if (groups.length === 0) {
    return (
      <div className="lt-verdict">
        <b>{t("patterns.flat")}</b>
        <span>{t("patterns.flat_hint")}</span>
      </div>
    );
  }

  const [first, ...folded] = groups;
  const foldLabel = folded
    .map((g) => g.fold(g.items.length))
    .join(t("patterns.fold_sep"));

  const section = (g) => (
    <div key={g.id} className="pat-diff-group">
      <div className="pat-group">
        {t(`patterns.${g.id}`)}
        <span>
          {t("patterns.group_count", { count: g.items.length.toLocaleString(locale) })}
          {" · "}
          {/* Le seuil vient de la constante : le libellé ne peut pas mentir sur
              la règle appliquée si elle est réajustée. */}
          {t(`patterns.${g.id}_sub`, { ratio: MIN_RATIO.toLocaleString(locale) })}
        </span>
      </div>
      {g.items.slice(0, MAX_ROWS).map((item) => (
        <PatternRow
          key={item.key}
          lead={g.lead(item)}
          level={item.level}
          template={item.template}
          second={g.second(item)}
          onClick={() => onPick(item.key)}
        />
      ))}
      {g.items.length > MAX_ROWS && (
        <div className="muted pat-more">
          {t("patterns.more", {
            count: (g.items.length - MAX_ROWS).toLocaleString(locale),
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="patterns">
      {section(first)}
      {folded.length > 0 && (
        <>
          <button
            type="button"
            className="pat-fold"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <i aria-hidden="true">▸</i>
            {foldLabel}
          </button>
          {open && folded.map(section)}
        </>
      )}
    </div>
  );
}
