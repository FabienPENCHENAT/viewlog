import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { levelColor } from "../levels.js";
import MessageCell from "./MessageCell.jsx";
import PatternRow from "./PatternRow.jsx";
import PatternDiff from "./PatternDiff.jsx";
import { formatDuration } from "../lib/duration.js";
import { groupPatterns, patternKey, templateFromKey } from "../lib/patterns.js";
import { comparePatterns } from "../lib/pattern-diff.js";
import { featureOnce } from "../lib/track.js";
import { copyText } from "../lib/clipboard.js";
import { fullRange, rangeStep, isPartialRange } from "../lib/time-range.js";
import { getTabState, setTabState } from "../lib/tab-state.js";
import { useI18n } from "../i18n/index.jsx";

const MAX_PATTERNS = 100; // motifs affichés au maximum

// Icône du bouton de copie : deux feuillets, puis une coche une fois copié.
function CopyIcon({ done }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {done ? (
        <path d="M20 6 9 17l-5-5" />
      ) : (
        <>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </>
      )}
    </svg>
  );
}

// Icône du saut vers le contexte : une flèche qui désigne une ligne au milieu
// des autres, « montre-moi cette ligne à sa place dans le journal ».
function ContextIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5h10M11 12h10M11 19h10" />
      <path d="M3 8l4 4-4 4" />
    </svg>
  );
}

// Petit hook de débounce : évite de refiltrer des centaines de milliers de
// lignes à chaque frappe / mouvement de curseur.
function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// La période ({ bounds, range, onRangeChange }) est portée par le Dashboard :
// le graphe de volume et ce tableau agissent sur la même fenêtre.
export default function LogTable({ tabId, entries, byLevel, bounds, range, onRangeChange }) {
  const { t, locale } = useI18n();

  // Filtres repris là où on les avait laissés sur cet onglet. Le composant est
  // remonté à chaque changement d'onglet (clé sur l'id côté Dashboard), donc les
  // initialiseurs paresseux suffisent : pas besoin de remonter cet état.
  const restored = useRef(getTabState(tabId) || {});
  const [query, setQuery] = useState(() => restored.current.query || "");
  const [active, setActive] = useState(() => new Set(restored.current.levels || []));
  const [view, setView] = useState(() => restored.current.view || "journal"); // "journal" | "patterns"
  const [patternFilter, setPatternFilter] = useState(() => restored.current.patternFilter ?? null); // clé de motif (drill-down)
  const [regexMode, setRegexMode] = useState(() => restored.current.regexMode || false); // recherche : contains vs regex
  // Comparaison de la zone sélectionnée avec le reste du fichier : un mode de la
  // vue Motifs, pas une troisième vue. Il n'a de sens qu'avec une période active.
  const [compare, setCompare] = useState(() => restored.current.compare || false);

  // Analytics feature : on ne compte chaque feature qu'UNE fois par fichier
  // ouvert (mesure l'adoption, pas le volume de clics). Remis à zéro au fichier.
  const firedRef = useRef(null);
  if (firedRef.current === null) firedRef.current = featureOnce();
  const markFeature = (name) => firedRef.current(name);
  useEffect(() => {
    firedRef.current = featureOnce();
  }, [entries]);

  // Pas de remise à zéro sur changement de fichier : le composant est remonté à
  // chaque onglet (clé sur l'id côté Dashboard), donc le montage EST la remise à
  // zéro. Un effet ici s'exécuterait aussi au montage et effacerait le bandeau de
  // retour et le repère qu'on vient justement de restaurer.

  function switchView(v) {
    // Changer de vue à la main, c'est quitter le contexte de son plein gré : le
    // bandeau de retour parle d'une ligne du journal et ne veut plus rien dire
    // ailleurs (« Revoir la ligne » n'aurait nulle part où défiler).
    clearJump();
    setView(v);
    if (v === "patterns") {
      setPatternFilter(null); // le regroupement porte sur l'ensemble filtré
      markFeature("view_patterns");
    } else {
      // La comparaison parle de motifs : elle n'a rien à dire dans le journal.
      setCompare(false);
    }
  }

  // Ligne copiée (n° de ligne) : accusé de réception visuel, effacé après 1,5 s.
  const [copied, setCopied] = useState(null);
  const copiedTimer = useRef(null);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  async function copyRow(entry) {
    if (!(await copyText(entry.raw))) return;
    markFeature("copy_line");
    setCopied(entry.i);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 1500);
  }

  const step = rangeStep(bounds);
  const timeActive = isPartialRange(bounds, range);

  // --- Saut vers le contexte -------------------------------------------------
  // Depuis une liste filtrée (recherche, regex, niveaux, période, motif), on
  // veut voir une ligne à sa place dans le journal complet, avec ses voisines.
  // Il faut relâcher TOUS les filtres : si l'un d'eux exclut encore la ligne,
  // elle n'est pas rendue et le défilement échouerait sans rien dire.
  // Repris de l'onglet : quitter un fichier au milieu d'un saut vers le contexte
  // et y revenir doit rendre le bandeau de retour ET le repère.
  const [saved, setSaved] = useState(() => restored.current.saved ?? null); // filtres d'avant le saut (retour)
  // { at, flash, mark } : la cible, et les deux signaux, indépendants.
  //  - flash : pulsation d'arrivée, utile dans les deux sens de navigation ;
  //  - mark  : repère persistant, réservé au journal complet où la ligne se
  //            perd au milieu des autres. Inutile dans une liste filtrée.
  //
  // Au retour sur l'onglet, on redemande un défilement vers la ligne repérée :
  // le repère seul ne servirait à rien si la ligne était hors écran.
  const [pendingJump, setPendingJump] = useState(() =>
    restored.current.marked != null
      ? { at: restored.current.marked, flash: true, mark: true }
      : null
  );
  const [flash, setFlash] = useState(null); // pulsation brève à l'arrivée
  // Repère persistant : le flash attire l'œil, mais il s'éteint. Sans marque
  // durable, la ligne visée devient introuvable dès qu'on a défilé un peu.
  const [marked, setMarked] = useState(() => restored.current.marked ?? null);

  // Un seul effet de sauvegarde, déclaré après tout l'état qu'il observe :
  // revenir sur l'onglet doit rendre le journal tel qu'on l'a quitté, sinon
  // changer d'onglet passe pour une perte de travail. Le saut vers le contexte en
  // fait partie : sans `saved` ni `marked`, on retrouverait la bonne ligne mais
  // plus le bandeau qui ramène aux résultats, donc plus aucun retour possible.
  useEffect(() => {
    setTabState(tabId, {
      query,
      levels: [...active],
      view,
      patternFilter,
      regexMode,
      compare,
      saved,
      marked,
    });
  }, [tabId, query, active, view, patternFilter, regexMode, compare, saved, marked]);

  // Relâcher la période retire la référence : sans zone, il n'y a plus rien à
  // comparer au reste du fichier. Vaut pour le bouton « Tout » comme pour un
  // double-clic dans le graphe de volume, qui passent tous les deux par ici.
  useEffect(() => {
    if (!timeActive) setCompare(false);
  }, [timeActive]);

  const anyFilter =
    active.size > 0 || !!query.trim() || timeActive || patternFilter != null;

  // Abandon du saut : plus de bandeau, plus de repère, plus de cible en attente.
  function clearJump() {
    setSaved(null);
    setFlash(null);
    setMarked(null);
    setPendingJump(null);
  }

  function goToContext(entry) {
    markFeature("jump_context");
    setSaved({ query, regexMode, active, range, patternFilter, view, at: entry.i });
    setQuery("");
    setRegexMode(false);
    setActive(new Set());
    setPatternFilter(null);
    setView("journal");
    if (bounds) onRangeChange(fullRange(bounds));
    setPendingJump({ at: entry.i, flash: true, mark: true });
  }

  function backToResults() {
    if (!saved) return;
    setQuery(saved.query);
    setRegexMode(saved.regexMode);
    setActive(saved.active);
    setPatternFilter(saved.patternFilter);
    setView(saved.view);
    if (saved.range) onRangeChange(saved.range);
    // On se replace sur la ligne d'où l'on venait : elle pulse pour situer
    // l'arrivée, mais ne garde pas de repère, inutile dans une liste filtrée.
    setFlash(null);
    setMarked(null);
    setPendingJump(
      saved.view === "journal" ? { at: saved.at, flash: true, mark: false } : null
    );
    setSaved(null);
  }

  // Feature analytics : recherche effectuée (la période est suivie côté
  // Dashboard, qui reçoit aussi les sélections faites dans le graphe).
  useEffect(() => {
    if (query.trim()) markFeature("search");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Valeurs débouncées utilisées pour le filtrage (l'affichage reste live).
  const dQuery = useDebounced(query, 150);
  const dRange = useDebounced(range, 80);

  // Recherche "contains" (défaut) ou regex. On expose un test (compilé une fois)
  // + un motif de surlignage (global, insensible à la casse) + un flag d'invalidité.
  const searchRe = useMemo(() => {
    const q = dQuery.trim();
    if (!q) return { test: null, highlight: null, invalid: false };
    if (regexMode) {
      try {
        const re = new RegExp(q, "i");
        return { test: (raw) => re.test(raw), highlight: new RegExp(q, "gi"), invalid: false };
      } catch {
        return { test: null, highlight: null, invalid: true };
      }
    }
    const lower = q.toLowerCase();
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return {
      test: (raw) => raw.toLowerCase().includes(lower),
      highlight: new RegExp(esc, "gi"),
      invalid: false,
    };
  }, [dQuery, regexMode]);

  const fmtTs = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const fmtRange = (ms) =>
    new Date(ms).toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const availableLevels = useMemo(
    () => Object.entries(byLevel).filter(([, n]) => n > 0).map(([l]) => l),
    [byLevel]
  );

  // Drill-down sur un motif : depuis la vue Motifs comme depuis la comparaison,
  // le clic mène au journal filtré dessus. Comportement inchangé, un seul chemin.
  function pickPattern(key) {
    markFeature("pattern_click");
    setPatternFilter(key);
    setView("journal");
    setCompare(false);
  }

  function toggleLevel(level) {
    markFeature("filter_level");
    setActive((prev) => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  }

  // Clés de motif pré-calculées, uniquement quand un drill-down est actif
  // (évite de normaliser 300k lignes tant que ce n'est pas nécessaire).
  const patternKeys = useMemo(
    () => (patternFilter != null ? entries.map(patternKey) : null),
    [entries, patternFilter]
  );

  const filtered = useMemo(() => {
    const timeFilter = !!(bounds && dRange && (dRange.from > bounds.lo || dRange.to < bounds.hi));
    return entries.filter((e, idx) => {
      if (active.size > 0 && !active.has(e.level)) return false;
      if (searchRe.test && !searchRe.test(e.raw)) return false;
      if (timeFilter) {
        if (!e.ts) return false; // entrées sans horodatage exclues quand on filtre le temps
        const ms = new Date(e.ts).getTime();
        if (ms < dRange.from || ms > dRange.to) return false;
      }
      if (patternFilter && patternKeys && patternKeys[idx] !== patternFilter) return false;
      return true;
    });
  }, [entries, searchRe, active, dRange, bounds, patternFilter, patternKeys]);

  // Regroupement par motif (seulement en vue "Motifs").
  const groups = useMemo(
    () => (view === "patterns" ? groupPatterns(filtered) : null),
    [view, filtered]
  );

  const diffOn = compare && view === "patterns" && timeActive;

  // Le reste du fichier, référence de la comparaison. Les niveaux et la
  // recherche restent appliqués des DEUX côtés : sans ça, avec un filtre ERROR
  // actif, le complément ramènerait tous les INFO et noierait la comparaison.
  // Seule la période est inversée.
  const complement = useMemo(() => {
    if (!diffOn || !bounds || !dRange) return null;
    return entries.filter((e) => {
      if (active.size > 0 && !active.has(e.level)) return false;
      if (searchRe.test && !searchRe.test(e.raw)) return false;
      // Une entrée sans horodatage n'est ni dedans ni dehors : la comparaison
      // est temporelle, donc elle ne participe pas plutôt que de peser d'un côté.
      if (!e.ts) return false;
      const ms = new Date(e.ts).getTime();
      return ms < dRange.from || ms > dRange.to;
    });
  }, [diffOn, entries, active, searchRe, dRange, bounds]);

  // La zone est passée à la comparaison : sa DURÉE définit les fenêtres de
  // référence, donc « le taux habituel sur une zone équivalente ailleurs »
  // plutôt que « le taux moyen de tout le reste ». C'est ce qui empêche un
  // second pic ailleurs dans le fichier d'écraser la comparaison.
  const diff = useMemo(
    () => (complement ? comparePatterns(filtered, complement, dRange) : null),
    [complement, filtered, dRange]
  );

  // --- Virtualisation du journal : on ne rend que les lignes visibles.
  const scrollRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: view === "journal" ? filtered.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 41,
    overscan: 14,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  // Recherche et période sont débouncées : après avoir relâché les filtres,
  // `filtered` se met à jour en plusieurs temps. Défiler dès que la ligne
  // apparaît viserait une liste intermédiaire, puis la liste finale, plus
  // longue, décalerait la cible loin de l'écran. On attend donc que les valeurs
  // débouncées aient rattrapé les valeurs vivantes.
  const rangeSettled =
    dRange === range ||
    (!!dRange && !!range && dRange.from === range.from && dRange.to === range.to);
  const filtersSettled = dQuery === query && rangeSettled;

  // Les lignes sont mesurées à la volée (messages multi-lignes, stack traces) :
  // un premier défilement ne connaît que des hauteurs estimées, et les mesures
  // réelles déplacent ensuite le contenu. On recentre donc à chaque frame
  // jusqu'à ce que la position se stabilise, sinon la ligne visée atterrit hors
  // écran et il faut cliquer « Revoir la ligne ».
  const settleFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(settleFrame.current), []);

  // Changer de vue remet la liste en haut : les deux vues n'ont pas du tout la
  // même longueur, et un journal parcouru jusqu'en bas laissait la liste de
  // motifs, bien plus courte, collée à son propre bas. Placé en effet de mise en
  // page pour passer AVANT le recentrage d'un éventuel saut en attente.
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [view]);

  function centerOn(idx) {
    cancelAnimationFrame(settleFrame.current);
    let tries = 0;
    let previous = -1;
    const step = () => {
      rowVirtualizer.scrollToIndex(idx, { align: "center" });
      const top = scrollRef.current?.scrollTop ?? 0;
      if (Math.abs(top - previous) < 1 || ++tries >= 24) return; // stabilisé
      previous = top;
      settleFrame.current = requestAnimationFrame(step);
    };
    step();
  }

  useEffect(() => {
    if (!pendingJump || view !== "journal" || !filtersSettled) return;
    const idx = filtered.findIndex((e) => e.i === pendingJump.at);
    if (idx === -1) return;
    centerOn(idx);
    if (pendingJump.flash) setFlash(pendingJump.at);
    if (pendingJump.mark) setMarked(pendingJump.at);
    setPendingJump(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJump, filtered, filtersSettled, view]);

  // Le surlignage s'éteint tout seul : c'est un repère, pas une sélection.
  const flashTimer = useRef(null);
  useEffect(() => {
    if (flash == null) return;
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(flashTimer.current);
  }, [flash]);

  const pct = (ms) => ((ms - bounds.lo) / (bounds.hi - bounds.lo)) * 100;

  return (
    <div className="logtable">
      <div className="logtable-toolbar">
        <div className="view-switch" role="group" aria-label={t("table.view")}>
          {["journal", "patterns"].map((v) => (
            <button
              key={v}
              type="button"
              className={`view-btn ${view === v ? "view-btn--on" : ""}`}
              aria-pressed={view === v}
              onClick={() => switchView(v)}
            >
              {t(v === "journal" ? "table.view_journal" : "table.view_patterns")}
            </button>
          ))}
        </div>
        <div className="search-wrap">
          <input
            className={`search ${searchRe.invalid ? "search--invalid" : ""}`}
            type="search"
            placeholder={t("table.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className={`regex-toggle ${regexMode ? "regex-toggle--on" : ""}`}
            aria-pressed={regexMode}
            title={t("table.regex")}
            onClick={() =>
              setRegexMode((v) => {
                if (!v) markFeature("regex");
                return !v;
              })
            }
          >
            .*
          </button>
        </div>
        <div className="level-filters">
          {availableLevels.map((level) => {
            const on = active.size === 0 || active.has(level);
            return (
              <button
                key={level}
                className={`chip ${on ? "chip--on" : "chip--off"}`}
                style={{ "--chip-color": levelColor(level) }}
                onClick={() => toggleLevel(level)}
              >
                <span className="chip-dot" /> {level}
                <span className="chip-count">{byLevel[level].toLocaleString(locale)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {bounds && range && (
        <div className="logtable-period">
          <div className="period-head">
            <span className="period-label">{t("table.period")}</span>
            <span className="period-vals">
              {fmtRange(range.from)} → {fmtRange(range.to)}
            </span>
            <span className="muted period-dur">
              · {formatDuration(range.to - range.from, t, locale)}
            </span>
            {timeActive && (
              <button
                className="period-reset"
                onClick={() => onRangeChange(fullRange(bounds))}
              >
                {t("table.period_all")}
              </button>
            )}
          </div>
          <div className="timerange">
            <div className="timerange-track" />
            <div
              className="timerange-sel"
              style={{ left: `${pct(range.from)}%`, width: `${pct(range.to) - pct(range.from)}%` }}
            />
            <input
              type="range"
              min={bounds.lo}
              max={bounds.hi}
              step={step}
              value={range.from}
              aria-label={t("table.period_from")}
              onChange={(e) =>
                onRangeChange({
                  ...range,
                  from: Math.min(Number(e.target.value), range.to - step),
                })
              }
            />
            <input
              type="range"
              min={bounds.lo}
              max={bounds.hi}
              step={step}
              value={range.to}
              aria-label={t("table.period_to")}
              onChange={(e) =>
                onRangeChange({
                  ...range,
                  to: Math.max(Number(e.target.value), range.from + step),
                })
              }
            />
          </div>
        </div>
      )}

      {view === "journal" && patternFilter && (
        <div className="pattern-banner">
          <span className="muted">{t("patterns.filtered")}</span>
          <span className="pattern-tpl">{templateFromKey(patternFilter)}</span>
          <button
            type="button"
            aria-label={t("patterns.clear")}
            onClick={() => setPatternFilter(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Même idiome que les deux autres bandeaux : une bande contextuelle qui
          apparaît avec un mode et se referme d'un ✕. */}
      {diffOn && (
        <div className="pattern-banner">
          <span className="banner-txt">{t("patterns.compare_on")}</span>
          <button
            type="button"
            title={t("patterns.compare_off")}
            aria-label={t("patterns.compare_off")}
            onClick={() => setCompare(false)}
          >
            ✕
          </button>
        </div>
      )}

      {saved && (
        <div className="pattern-banner context-banner">
          <span className="muted">
            {t("context.banner", { line: (saved.at + 1).toLocaleString(locale) })}
          </span>
          {/* Le flash s'éteint : il faut un moyen explicite de revenir dessus. */}
          <button
            type="button"
            className="context-recenter"
            onClick={() => setPendingJump({ at: saved.at, flash: true, mark: true })}
          >
            {t("context.recenter")}
          </button>
          <button type="button" className="context-back" onClick={backToResults}>
            {t("context.back")}
          </button>
          {/* Sortir du contexte en gardant le journal complet sous les yeux :
              revenir aux résultats n'est pas toujours ce qu'on veut. */}
          <button
            type="button"
            className="context-dismiss"
            title={t("context.dismiss")}
            aria-label={t("context.dismiss")}
            onClick={clearJump}
          >
            ✕
          </button>
        </div>
      )}

      <div className="logtable-count muted">
        {t("table.entries", { count: filtered.length.toLocaleString(locale) })}
        {view === "patterns" &&
          " → " + t("patterns.unique", { count: groups.length.toLocaleString(locale) })}
        {/* Le point d'entrée de la comparaison : une action au bout d'une ligne
            qui existe déjà, et seulement quand une période borne une zone. Rien
            n'est ajouté à l'écran tant que la fonctionnalité est inutilisable. */}
        {view === "patterns" && timeActive && !compare && (
          <>
            {" · "}
            <button
              type="button"
              className="count-cmp"
              onClick={() => {
                markFeature("pattern_diff");
                setCompare(true);
              }}
            >
              {t("patterns.compare")}
            </button>
          </>
        )}
      </div>

      <div className="logtable-scroll" ref={scrollRef}>
        {diffOn && diff ? (
          <PatternDiff diff={diff} onPick={pickPattern} />
        ) : view === "patterns" ? (
          <div className="patterns">
            {groups.length === 0 && <div className="lt-empty muted">{t("table.empty")}</div>}
            {groups.slice(0, MAX_PATTERNS).map((g) => (
              <PatternRow
                key={g.key}
                lead={`${g.count.toLocaleString(locale)}×`}
                level={g.level}
                template={g.template}
                second={t("patterns.example") + g.example}
                onClick={() => pickPattern(g.key)}
              />
            ))}
            {groups.length > MAX_PATTERNS && (
              <div className="muted pat-more">
                {t("patterns.more", { count: (groups.length - MAX_PATTERNS).toLocaleString(locale) })}
              </div>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="col-line">{t("table.col_line")}</th>
                <th className="col-ts">{t("table.col_ts")}</th>
                <th className="col-level">{t("table.col_level")}</th>
                <th className="col-msg">{t("table.col_msg")}</th>
                <th className="col-actions" aria-label={t("table.actions")} />
              </tr>
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr className="vpad" style={{ height: paddingTop }}>
                  <td colSpan={5} />
                </tr>
              )}
              {virtualItems.map((vi) => {
                const e = filtered[vi.index];
                return (
                  <tr
                    key={e.i}
                    data-index={vi.index}
                    ref={rowVirtualizer.measureElement}
                    className={
                      `${flash === e.i ? "row-flash " : ""}${marked === e.i ? "row-marked" : ""}`.trim() ||
                      undefined
                    }
                  >
                    <td className="col-line muted">
                      {anyFilter ? (
                        <button
                          type="button"
                          className="line-jump"
                          title={t("context.jump")}
                          onClick={() => goToContext(e)}
                        >
                          {e.i + 1}
                        </button>
                      ) : (
                        e.i + 1
                      )}
                    </td>
                    <td className="col-ts">{fmtTs(e.ts)}</td>
                    <td className="col-level">
                      <span className="level-tag" style={{ "--chip-color": levelColor(e.level) }}>
                        {e.level}
                      </span>
                    </td>
                    <td className="col-msg">
                      <MessageCell message={e.message} highlight={searchRe.highlight} />
                    </td>
                    {/* Actions de la ligne, empilées : copier, puis retrouver la
                        ligne dans le journal complet. */}
                    <td className="col-actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className={`row-copy ${copied === e.i ? "row-copy--done" : ""}`}
                          title={copied === e.i ? t("table.copied") : t("table.copy")}
                          aria-label={copied === e.i ? t("table.copied") : t("table.copy")}
                          onClick={() => copyRow(e)}
                        >
                          <CopyIcon done={copied === e.i} />
                        </button>
                        {anyFilter && (
                          <button
                            type="button"
                            className="row-copy row-context"
                            title={t("context.jump")}
                            aria-label={t("context.jump")}
                            onClick={() => goToContext(e)}
                          >
                            <ContextIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr className="vpad" style={{ height: paddingBottom }}>
                  <td colSpan={5} />
                </tr>
              )}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted empty-row">
                    {t("table.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
