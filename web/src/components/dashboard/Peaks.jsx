// Zones à surveiller, dans la carte du graphe de volume. EXPÉRIMENTAL.
//
// Deux décisions de produit tiennent ce fichier.
//
// 1. ÇA NE S'IMPOSE PAS. Une heuristique qui peut se tromper n'a pas sa place en
//    évidence sur le tableau de bord : ce qu'on voit sans l'avoir demandé, on le
//    prend pour un fait. D'où deux exports plutôt qu'un composant : `PeakToggle`
//    vit DANS la ligne d'invitation sous le graphe, comme un lien secondaire, et
//    `PeakZones` n'existe qu'après le clic. Un bouton centré sous cette ligne
//    formait un bloc à lui seul, donc cessait d'être secondaire.
//
// 2. ON N'ANNONCE PAS UN PIC, ON ANNONCE UNE TROUVAILLE. Un pic se voit déjà sur
//    le graphe ; ce qui ne se voit pas, c'est s'il contient quelque chose
//    d'atypique. Chaque zone est donc comparée au rythme habituel du fichier
//    avant d'être décrite. Une zone où rien ne ressort s'affiche quand même, avec
//    le verdict de surcharge : c'est un résultat, pas un échec.
//
// La comparaison n'est faite QU'AU DÉPLOIEMENT, jamais au chargement : trois
// comparaisons coûtent ~700 ms sur 400 000 lignes, et derrière un clic une
// demi-seconde est attendue au lieu d'être subie.

import { useMemo } from "react";
import { comparePatterns } from "../../lib/pattern-diff.js";
import { formatDuration } from "../../lib/duration.js";
import { useI18n } from "../../i18n/index.jsx";

/** Accès, rendu en ligne dans l'invitation sous le graphe. */
export function PeakToggle({ count, shown, onToggle }) {
  const { t, locale } = useI18n();
  if (!count) return null;
  return (
    <button type="button" className="peak-toggle" aria-expanded={shown} onClick={onToggle}>
      {shown
        ? t("peaks.hide")
        : t(count === 1 ? "peaks.show_one" : "peaks.show_many", {
            count: count.toLocaleString(locale),
          })}
      {!shown && <span className="peak-tag">{t("peaks.experimental")}</span>}
    </button>
  );
}

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
  return {
    onlyHere: diff.onlyHere.length,
    over: diff.over.length,
    top: diff.onlyHere[0] || diff.over[0] || null,
  };
}

export default function PeakZones({ peaks, entries, shown, onPick }) {
  const { t, locale } = useI18n();

  const described = useMemo(
    () =>
      shown && peaks.length ? peaks.map((z) => ({ zone: z, ...describe(z, entries) })) : null,
    [shown, peaks, entries]
  );

  if (!described) return null;

  // Jour et heure suffisent : l'année et le mois sont déjà donnés par l'axe du
  // graphe juste au-dessus, et une date complète alourdit chaque ligne.
  const when = (ms) =>
    new Date(ms).toLocaleString(locale, {
      weekday: "long",
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
    <div className="peaks">
      <ul className="peak-list">
        {described.map((d) => (
          <li key={d.zone.from}>
            <button
              type="button"
              className="peak-zone"
              onClick={() => onPick(d.zone)}
              title={t("peaks.open")}
            >
              <i className="peak-caret" aria-hidden="true">▸</i>
              <span className="peak-when">
                {when(d.zone.from)}
                <em>{formatDuration(d.zone.to - d.zone.from, t, locale)}</em>
              </span>
              <span className="peak-stat">
                {t("peaks.errors", { count: d.zone.errors.toLocaleString(locale) })}
                <em>
                  {"×"}
                  {d.zone.lift.toLocaleString(locale, { maximumFractionDigits: 1 })}
                </em>
              </span>
              <span className="peak-find">{finding(d)}</span>
              {/* Le motif est le seul élément élastique : c'est lui qui absorbe
                  la largeur restante, et lui seul qu'on coupe. */}
              {/* Pas de préfixe de niveau : le gabarit d'un log texte contient
                  déjà le sien, et « 379× ERROR ERROR [pump] … » a l'air d'un
                  bogue. La comparaison ouverte au clic, elle, porte la pastille
                  de niveau là où elle a la place. */}
              <span className="peak-pat">
                {d.top && (
                  <>
                    <b>{d.top.count.toLocaleString(locale)}×</b> {d.top.template}
                  </>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* Le statut expérimental est écrit, pas sous-entendu : le seul vrai risque
          de cette fonctionnalité est qu'un résultat approximatif soit lu comme un
          verdict. */}
      <p className="peak-caveat">{t("peaks.caveat")}</p>
    </div>
  );
}
