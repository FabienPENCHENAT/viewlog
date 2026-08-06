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
// 3. UNE ZONE DIT CE QUI L'A FAIT SORTIR. Il y a deux signaux (voir `lib/peaks.js`)
//    et ils ne se racontent pas pareil. Une zone d'erreurs met en avant ses
//    erreurs et leur taux ; une zone de volume met en avant ses lignes et son
//    débit, et porte en plus la mention « volume inhabituel ». Sans elle, une
//    zone dont le taux d'erreur n'a pas bougé passe pour un faux positif, alors
//    qu'elle est là parce qu'on a cessé de faire confiance au niveau des lignes.
//
// La comparaison n'est faite QU'AU DÉPLOIEMENT, jamais au chargement : trois
// comparaisons coûtent ~700 ms sur 400 000 lignes, et derrière un clic une
// demi-seconde est attendue au lieu d'être subie.

import { useMemo } from "react";
import { comparePatterns, formatRate } from "../../lib/pattern-diff.js";
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
  const clock = (ms) =>
    new Date(ms).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  // Un débit se lit en entier quand il est gros, et à la décimale quand il est
  // petit : « 246 lignes/min ici, 6 ailleurs » se compare d'un coup d'œil, alors
  // que « 0 ailleurs » ferait croire à un fichier vide.
  const rhythm = (perMin) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: perMin >= 10 ? 0 : 1,
    }).format(perMin);

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
        {described.map((d) => {
          const volume = d.zone.kind === "volume";
          return (
          <li key={d.zone.from}>
            <button
              type="button"
              className="peak-zone"
              onClick={() => onPick(d.zone)}
              title={t("peaks.open")}
            >
              <i className="peak-caret" aria-hidden="true">▸</i>
              {/* Deux lignes et non une : quand et combien, puis ce qu'on y a
                  trouvé. Tout mettre sur une seule ligne tenait en largeur, mais
                  demandait de lire cinq choses d'un coup. */}
              <span className="peak-head">
                {/* Une plage se dit avec SES DEUX BORNES. « 1 h 14 min » posé
                    seul demandait de deviner de quoi c'était la durée, et une
                    icône n'aurait fait que déplacer la devinette. Avec la borne
                    de fin, la durée entre parenthèses ne fait plus que
                    confirmer, et on gagne au passage l'heure de fin. */}
                <span className="peak-when">
                  {when(d.zone.from)} → {clock(d.zone.to)}
                </span>
                <span className="peak-dur">
                  ({formatDuration(d.zone.to - d.zone.from, t, locale)})
                </span>
                {/* Le seul élément coloré de la ligne, et il dit CE QUI A FAIT
                    sortir la zone : les erreurs quand c'est leur concentration,
                    les lignes quand c'est le débit. Afficher « 768 erreurs » sur
                    une zone trouvée sur le volume ferait croire que le niveau
                    des lignes est ce qu'on a regardé, alors que c'est justement
                    ce dont on se méfie. Une seule touche de couleur par ligne
                    dans les deux cas. */}
                {volume ? (
                  <b className="peak-count peak-count-volume">
                    {t("peaks.lines", { count: d.zone.lines.toLocaleString(locale) })}
                  </b>
                ) : (
                  <b className="peak-count">
                    {t("peaks.errors", { count: d.zone.errors.toLocaleString(locale) })}
                  </b>
                )}
                {/* Les deux mesures en clair plutôt qu'un « ×8,7 » que rien à
                    l'écran ne permet de décoder. Même formulation que la
                    comparaison de motifs, qui dit déjà « x % ici, y % ailleurs ». */}
                <span className="peak-density">
                  {volume
                    ? t("peaks.rhythm", {
                        inside: rhythm(d.zone.perMin),
                        outside: rhythm(d.zone.perMinOutside),
                      })
                    : t("peaks.density", {
                        inside: formatRate(d.zone.rate, locale),
                        outside: formatRate(d.zone.rateOutside, locale),
                      })}
                </span>
                {/* Le seul cas où on explique la MÉTHODE dans la liste : une
                    zone sans hausse du taux d'erreur n'a aucune raison évidente
                    d'être là, et sans ce mot elle passe pour un faux positif. */}
                {volume && (
                  <span className="peak-why" title={t("peaks.why_volume_hint")}>
                    {t("peaks.why_volume")}
                  </span>
                )}
              </span>
              <span className="peak-body">
                <span className="peak-find">{finding(d)}</span>
                {/* Pas de préfixe de niveau : le gabarit d'un log texte contient
                    déjà le sien, et « 379× ERROR ERROR [pump] … » a l'air d'un
                    bogue. Le motif est le seul élément élastique, donc le seul
                    qu'on coupe. */}
                {d.top && (
                  <span className="peak-pat">
                    <b>{d.top.count.toLocaleString(locale)}×</b> {d.top.template}
                  </span>
                )}
              </span>
            </button>
          </li>
          );
        })}
      </ul>
      {/* Le statut expérimental est écrit, pas sous-entendu : le seul vrai risque
          de cette fonctionnalité est qu'un résultat approximatif soit lu comme un
          verdict. */}
      <p className="peak-caveat">{t("peaks.caveat")}</p>
    </div>
  );
}
