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

import { useEffect, useState } from "react";
import Loader from "../shared/Loader.jsx";
import { comparePatterns, formatRate } from "../../lib/pattern-diff.js";
import { firstLine, patternize } from "../../lib/patterns.js";
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

// Les trois zones décrites en une fois, et rien de plus que le nécessaire.
//
// La comparaison porte sur le fichier ENTIER, sans les filtres de la vue : une
// zone est proposée à propos du fichier, pas à propos de ce qu'on regarde. Sinon
// la même zone changerait de description au gré d'un filtre de niveau.
//
// Trois économies, chacune mesurée sur un fichier réel :
//
//  1. L'horodatage et le gabarit ne dépendent pas de la zone, et ils étaient
//     recalculés pour chacune. Trois zones payaient trois fois le même travail.
//     Le gabarit est maintenant calculé une fois, sur la première ligne ENTIÈRE,
//     et prêté à la comparaison, qui ne le recalcule donc jamais.
//  2. `patternize` est plafonné (voir lib/patterns.js) : sur un message de
//     quatre kilo-octets d'un seul tenant, il coûtait à lui seul dix secondes.
//  3. On ne matérialise PAS l'entrée complète. La comparaison n'a besoin que de
//     l'horodatage, du niveau et du gabarit ; fabriquer cent mille entrées de
//     quatre kilo-octets pour les jeter aussitôt coûterait un giga-octet, soit
//     exactement ce que le modèle colonnaire vient de supprimer. Le message porté
//     par l'entrée allégée ne sert plus qu'à l'exemple, que ce bloc n'affiche pas,
//     d'où son plafond.
const LIGHT_MESSAGE = 301;

function describeAll(zones, store) {
  const times = new Float64Array(store.count);
  const light = new Array(store.count);
  const templates = new Array(store.count);

  for (let i = 0; i < store.count; i++) {
    times[i] = store.time(i);
    const fl = firstLine(store.message(i) || "");
    templates[i] = patternize(fl);
    light[i] = {
      ts: Number.isNaN(times[i]) ? null : new Date(times[i]).toISOString(),
      level: store.level(i),
      message: fl.length > LIGHT_MESSAGE ? fl.slice(0, LIGHT_MESSAGE) : fl,
      row: i,
    };
  }
  const templateAt = (e) => templates[e.row];

  return zones.map((zone) => {
    const inside = [];
    const outside = [];
    for (let i = 0; i < store.count; i++) {
      const ms = times[i];
      if (Number.isNaN(ms)) continue;
      if (ms >= zone.from && ms <= zone.to) inside.push(light[i]);
      else outside.push(light[i]);
    }
    const diff = comparePatterns(inside, outside, zone, templateAt);
    return {
      zone,
      onlyHere: diff.onlyHere.length,
      over: diff.over.length,
      top: diff.onlyHere[0] || diff.over[0] || null,
    };
  });
}

export default function PeakZones({ peaks, store, shown, onPick }) {
  const { t, locale } = useI18n();
  const [described, setDescribed] = useState(null);

  // Le calcul est DIFFÉRÉ d'un tour de boucle, et ce n'est pas un détail : tant
  // qu'il tourne, le thread principal ne peint pas. Fait dans un `useMemo`, il
  // aurait lieu AVANT le premier affichage, donc aucun loader n'aurait jamais pu
  // apparaître, quelle que soit sa durée. On rend d'abord l'attente, puis on
  // calcule.
  useEffect(() => {
    if (!shown || !peaks.length) {
      setDescribed(null);
      return;
    }
    setDescribed(null);
    const id = setTimeout(() => setDescribed(describeAll(peaks, store)), 0);
    return () => clearTimeout(id);
  }, [shown, peaks, store]);

  if (!shown || !peaks.length) return null;

  // L'attente occupe la hauteur des cartes à venir : un bloc qui grandit d'un
  // coup à l'arrivée du résultat déplace ce qu'on était en train de lire.
  if (!described) {
    return (
      <div className="peaks peaks--waiting" style={{ "--rows": peaks.length }}>
        <Loader size={32} />
      </div>
    );
  }

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
            {/* Plus de `title` : l'action est écrite dans la carte, une bulle
                qui répéterait le même mot au survol ne ferait que passer devant
                les chiffres qu'on est en train de lire. */}
            <button type="button" className="peak-zone" onClick={() => onPick(d.zone)}>
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
                    {/* Le « ⓘ » dit qu'il y a une explication au survol, sans
                        laisser croire que l'étiquette prend le clic à sa charge :
                        la ligne entière reste le geste, et elle ouvre la zone. */}
                    <i className="peak-why-info" aria-hidden="true">ⓘ</i>
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
              {/* L'action est écrite, pas seulement suggérée : deux tentatives
                  d'affordance en pointillés et en chevron coloré n'ont pas suffi
                  à dire qu'une zone s'ouvre. Un mot et une flèche le disent. */}
              <span className="peak-go">
                {t("peaks.open")}
                <i className="peak-go-arrow" aria-hidden="true">→</i>
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
