// La carte d'identité du fichier : ce qu'il est à gauche, ce qu'il contient à
// droite. Remplace les quatre cartes de statistiques et l'histogramme par niveau.
//
// LA RÈGLE QUI GOUVERNE TOUT : ce bloc informe, il ne doit pas concurrencer le
// graphe de volume, qui est la vedette de l'écran. D'où une bande basse (~80 px
// contre 110 pour les seules quatre cartes, et près de 300 pour l'histogramme
// dans sa carte), et un découpage 20 / 80 : à gauche ce qui décrit le fichier
// lui-même, à droite ce qui décrit son contenu.
//
// Ce que le graphe y gagne se mesure : sa zone de tracé passe d'environ 475 px
// de large à 1 050, soit 2,2 fois plus de surface pour la même hauteur.
//
// DEUX DÉFAUTS D'INFORMATION CORRIGÉS AU PASSAGE :
//
//  1. `stats.errorCount` vaut ERROR + FATAL, donc l'ancienne carte « Erreurs »
//     fondait les niveaux fatals dans les erreurs. Sur le fichier d'essai, 16
//     FATAL disparaissaient dans 1 485 ERROR, et l'histogramme ne les montrait
//     pas non plus (16 sur 14 000 fait moins d'un pixel de colonne). Les niveaux
//     sont désormais listés un par un.
//  2. La durée affichait un tiret cadratin quand le fichier n'était pas
//     horodaté, ce que les règles du projet interdisent, et qui ne disait rien.
//
// PARTI PRIS VISUEL : aucun encadré, aucun fond teinté, aucun arrondi, aucun
// dégradé. Des filets d'un pixel, des chiffres alignés, et une seule figure. La
// hiérarchie vient du CONTRASTE : les niveaux qui signalent un problème gardent
// l'encre pleine, les autres passent en gris. La couleur ne sert qu'à nommer le
// niveau, jamais à remplir un fond.

import { formatDuration } from "../../lib/duration.js";
import { halfErrorsWithin } from "../../lib/insight.js";
// Le format de pourcentage du projet vit là, on n'en veut pas deux.
import { formatRate } from "../../lib/pattern-diff.js";
import { levelColor } from "../../levels.js";
import { useI18n } from "../../i18n/index.jsx";

// Gravité décroissante : on ouvre un log pour chercher ce qui va mal, et ce qui
// va mal se lit à gauche, là où l'œil commence. Trier par nombre mettrait INFO
// en tête, ce qui est vrai et inutile.
const ORDER = ["FATAL", "ERROR", "WARN", "INFO", "DEBUG", "TRACE", "OTHER"];

// Les niveaux qui signalent un problème : ce sont eux qui gardent l'encre pleine
// quand les autres passent en gris.
const TROUBLE = new Set(["FATAL", "ERROR", "WARN"]);

// Un nombre et son unité : « 6 j 23 h » se compose, les lettres plus petites et
// grises, collées à leur chiffre. Ça ne coûte rien en hauteur et c'est ce qui
// fait qu'un nombre a l'air posé plutôt que recraché.
function Duration({ span, t, locale }) {
  if (!span) return <b>{t("stats.no_span")}</b>;
  const text = formatDuration(new Date(span.end) - new Date(span.start), t, locale);
  const parts = text.split(" ");
  // Une durée sans chiffre (« instantané ») reste un mot, pas une unité.
  if (!parts.some((p) => /\d/.test(p))) return <b>{text}</b>;
  return parts.map((part, i) =>
    /\d/.test(part) ? <b key={i}>{part}</b> : <i key={i}>{part}</i>
  );
}

export default function FileIdentity({ stats }) {
  const { t, locale } = useI18n();
  const total = stats.total || 0;
  const num = (n) => n.toLocaleString(locale);

  const levels = ORDER.map((name) => ({ name, count: stats.byLevel?.[name] || 0 })).filter(
    (l) => l.count > 0
  );

  // Rafale ou bruit de fond ? Des erreurs réparties uniformément mettent la
  // moitié d'elles-mêmes dans la moitié de la période ; en dessous du tiers, la
  // concentration mérite d'être dite.
  const half = halfErrorsWithin(stats);
  let verdict = null;
  if (total > 0 && (stats.errorCount || 0) === 0) {
    verdict = t("stats.no_errors");
  } else if (half) {
    verdict =
      half.share <= 1 / 3
        ? t("stats.errors_burst", { dur: formatDuration(half.ms, t, locale) })
        : t("stats.errors_spread");
  }

  return (
    <section className="card file-id">
      <div className="fid-file">
        <p className="fid-kpi">
          <b>{num(total)}</b>
          <span>{t("stats.lines")}</span>
        </p>
        <p className="fid-kpi">
          <Duration span={stats.timeSpan} t={t} locale={locale} />
          <span>{t("stats.span_short")}</span>
        </p>
      </div>

      {total > 0 && levels.length > 0 && (
        <div className="fid-content">
          <div className="fid-levels">
            {levels.map((l) => (
              <span className="fid-lv" key={l.name}>
                <span className="fid-lv-name" style={{ color: levelColor(l.name) }}>
                  {l.name}
                </span>
                <b className={`fid-lv-n${TROUBLE.has(l.name) ? "" : " fid-lv-n--quiet"}`}>
                  {num(l.count)}
                </b>
                <span className="fid-lv-p">{formatRate(l.count / total, locale)}</span>
              </span>
            ))}
          </div>

          <div>
            {/* La seule figure de la bande, et elle est droite : elle se lit comme
                une mesure et pas comme un ornement. Chaque niveau présent garde
                au moins trois pixels, sinon un niveau à 0,06 % du fichier
                mesurerait un demi-pixel et disparaîtrait. */}
            <div className="fid-rail">
              {levels.map((l) => (
                <i
                  key={l.name}
                  style={{ flexGrow: l.count, background: levelColor(l.name) }}
                  title={`${l.name} ${num(l.count)}`}
                />
              ))}
            </div>
            {/* La phrase répond à la question SUIVANTE, jamais à celle que les
                chiffres viennent de traiter : « 3 095 lignes, soit 12 % » ne
                faisait que réécrire trois nombres affichés juste au-dessus. Ces
                erreurs sont-elles une rafale ou un bruit de fond ? Aucun compteur
                ne le dit, et la série du graphe suffit à le calculer. */}
            {verdict && <p className="fid-verdict">{verdict}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
