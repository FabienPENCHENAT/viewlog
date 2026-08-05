// Accès aux zones détectées, dans la carte du graphe de volume. EXPÉRIMENTAL.
//
// Deux décisions de produit tiennent ce composant.
//
// 1. IL NE S'IMPOSE PAS. Une heuristique qui peut se tromper n'a pas sa place en
//    évidence sur le tableau de bord : ce qu'on voit sans l'avoir demandé, on le
//    prend pour un fait. Au repos, une seule ligne discrète, au même endroit que
//    l'invitation à glisser. Sans zone détectée, pas de ligne du tout, et pas de
//    message annonçant qu'il n'y a rien à dire.
//
// 2. ON N'ANNONCE PAS UN PIC, ON ANNONCE UNE TROUVAILLE. Un pic se voit déjà sur
//    le graphe ; ce qui ne se voit pas, c'est s'il contient quelque chose
//    d'atypique. Chaque zone est donc comparée au rythme habituel du fichier
//    avant d'être décrite, et la ligne dit ce qu'on y a trouvé plutôt que
//    l'horaire. Une zone où rien ne ressort s'affiche quand même, avec le verdict
//    de surcharge : c'est un résultat, pas un échec.
//
// La comparaison n'est faite QU'AU DÉPLOIEMENT, jamais au chargement : trois
// comparaisons coûtent ~700 ms sur 400 000 lignes, et derrière un clic une
// demi-seconde est attendue au lieu d'être subie. C'est ce que le choix de la
// discrétion fait gagner.

import { useMemo } from "react";
import { comparePatterns } from "../../lib/pattern-diff.js";
import { formatDuration } from "../../lib/duration.js";
import { useI18n } from "../../i18n/index.jsx";

// La comparaison porte sur le fichier entier, sans les filtres de la vue : une
// zone est proposée à propos du fichier, pas à propos de ce qu'on regarde. Sinon
// la même zone changerait de description au gré d'un filtre de niveau.
function describe(zone, entries) {
  const inside = [];
  const outside = [];
  for (const e of entries) {
    if (!e.ts) continue;
    const ms = new Date(e.ts).getTime();
    if (ms >= zone.from && ms <= zone.to) inside.push(e);
    else outside.push(e);
  }
  const diff = comparePatterns(inside, outside, zone);
  const top = diff.onlyHere[0] || diff.over[0] || null;
  return {
    onlyHere: diff.onlyHere.length,
    over: diff.over.length,
    top,
  };
}

export default function PeakHint({ peaks, entries, shown, onToggle, onPick }) {
  const { t, locale } = useI18n();

  const described = useMemo(
    () => (shown ? peaks.map((z) => ({ zone: z, ...describe(z, entries) })) : null),
    [shown, peaks, entries]
  );

  if (!peaks || peaks.length === 0) return null;

  const when = (ms) =>
    new Date(ms).toLocaleString(locale, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const finding = (d) => {
    if (d.onlyHere > 0) {
      return t(d.onlyHere === 1 ? "peaks.only_here_one" : "peaks.only_here_many", {
        count: d.onlyHere.toLocaleString(locale),
      });
    }
    if (d.over > 0) {
      return t(d.over === 1 ? "peaks.over_one" : "peaks.over_many", {
        count: d.over.toLocaleString(locale),
      });
    }
    return t("peaks.flat");
  };

  return (
    <div className="peak-hint">
      <button type="button" className="peak-toggle" aria-expanded={shown} onClick={onToggle}>
        {shown ? t("peaks.hide") : (
          <>
            {t(peaks.length === 1 ? "peaks.show_one" : "peaks.show_many", {
              count: peaks.length.toLocaleString(locale),
            })}
            <span className="peak-tag">{t("peaks.experimental")}</span>
          </>
        )}
      </button>

      {shown && described && (
        <>
          <ul className="peak-list">
            {described.map((d) => (
              <li key={d.zone.from}>
                <button
                  type="button"
                  className="peak-zone"
                  onClick={() => onPick(d.zone)}
                  title={t("peaks.open")}
                >
                  <span className="peak-when">
                    {when(d.zone.from)}
                    <i>{formatDuration(d.zone.to - d.zone.from, t, locale)}</i>
                  </span>
                  <span className="peak-stat">
                    {t("peaks.errors", { count: d.zone.errors.toLocaleString(locale) })}
                    {" · "}
                    {t("peaks.rate", {
                      lift: Math.round(d.zone.lift).toLocaleString(locale),
                    })}
                  </span>
                  <span className="peak-find">{finding(d)}</span>
                  {d.top && (
                    <span className="peak-pat">
                      <b>{d.top.count.toLocaleString(locale)}×</b>
                      {" "}
                      {d.top.template}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {/* Le statut expérimental est écrit, pas sous-entendu : le seul vrai
              risque de cette fonctionnalité est qu'un résultat approximatif soit
              lu comme un verdict. */}
          <p className="peak-caveat">{t("peaks.caveat")}</p>
        </>
      )}
    </div>
  );
}
