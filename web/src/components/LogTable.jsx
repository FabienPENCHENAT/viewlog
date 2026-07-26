import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { levelColor } from "../levels.js";
import MessageCell from "./MessageCell.jsx";
import { formatDuration } from "../lib/duration.js";
import { groupPatterns, patternKey, templateFromKey } from "../lib/patterns.js";
import { trackFeature } from "../lib/track.js";
import { useI18n } from "../i18n/index.jsx";

const MAX_PATTERNS = 100; // motifs affichés au maximum

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

export default function LogTable({ entries, byLevel }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(() => new Set());
  const [view, setView] = useState("journal"); // "journal" | "patterns"
  const [patternFilter, setPatternFilter] = useState(null); // clé de motif (drill-down)
  const [regexMode, setRegexMode] = useState(false); // recherche : contains vs regex

  // Analytics feature : on ne compte chaque feature qu'UNE fois par fichier
  // ouvert (mesure l'adoption, pas le volume de clics). Remis à zéro au fichier.
  const firedRef = useRef(null);
  if (firedRef.current === null) firedRef.current = new Set();
  function markFeature(name) {
    if (!firedRef.current.has(name)) {
      firedRef.current.add(name);
      trackFeature(name);
    }
  }
  useEffect(() => {
    firedRef.current = new Set();
  }, [entries]);

  function switchView(v) {
    setView(v);
    if (v === "patterns") {
      setPatternFilter(null); // le regroupement porte sur l'ensemble filtré
      markFeature("view_patterns");
    }
  }

  // Bornes temporelles du fichier (min/max des timestamps).
  const bounds = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const e of entries) {
      if (!e.ts) continue;
      const ms = new Date(e.ts).getTime();
      if (ms < lo) lo = ms;
      if (ms > hi) hi = ms;
    }
    return hi > lo ? { lo, hi } : null;
  }, [entries]);

  // Fenêtre temporelle sélectionnée ({ from, to } en ms) ; réinitialisée à
  // la période complète dès qu'on change de fichier.
  const [range, setRange] = useState(null);
  useEffect(() => {
    setRange(bounds ? { from: bounds.lo, to: bounds.hi } : null);
  }, [bounds]);

  const step = bounds ? Math.max(1000, Math.floor((bounds.hi - bounds.lo) / 500)) : 1000;
  const timeActive = !!(bounds && range && (range.from > bounds.lo || range.to < bounds.hi));

  // Feature analytics : recherche effectuée et filtre de période utilisé.
  useEffect(() => {
    if (query.trim()) markFeature("search");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => {
    if (timeActive) markFeature("time_range");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeActive]);

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
                onClick={() => setRange({ from: bounds.lo, to: bounds.hi })}
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
                setRange((r) => ({ ...r, from: Math.min(Number(e.target.value), r.to - step) }))
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
                setRange((r) => ({ ...r, to: Math.max(Number(e.target.value), r.from + step) }))
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

      <div className="logtable-count muted">
        {t("table.entries", { count: filtered.length.toLocaleString(locale) })}
        {view === "patterns" &&
          " → " + t("patterns.unique", { count: groups.length.toLocaleString(locale) })}
      </div>

      <div className="logtable-scroll" ref={scrollRef}>
        {view === "patterns" ? (
          <div className="patterns">
            {groups.length === 0 && <div className="lt-empty muted">{t("table.empty")}</div>}
            {groups.slice(0, MAX_PATTERNS).map((g) => (
              <button
                key={g.key}
                type="button"
                className="pat-row"
                onClick={() => {
                  markFeature("pattern_click");
                  setPatternFilter(g.key);
                  setView("journal");
                }}
              >
                <span className="pat-count">{g.count.toLocaleString(locale)}×</span>
                <span className="level-tag" style={{ "--chip-color": levelColor(g.level) }}>
                  {g.level}
                </span>
                <span className="pat-body">
                  <span className="pat-template">{g.template}</span>
                  <span className="pat-example muted">
                    {t("patterns.example")}
                    {g.example}
                  </span>
                </span>
              </button>
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
              </tr>
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr className="vpad" style={{ height: paddingTop }}>
                  <td colSpan={4} />
                </tr>
              )}
              {virtualItems.map((vi) => {
                const e = filtered[vi.index];
                return (
                  <tr key={e.i} data-index={vi.index} ref={rowVirtualizer.measureElement}>
                    <td className="col-line muted">{e.i + 1}</td>
                    <td className="col-ts">{fmtTs(e.ts)}</td>
                    <td className="col-level">
                      <span className="level-tag" style={{ "--chip-color": levelColor(e.level) }}>
                        {e.level}
                      </span>
                    </td>
                    <td className="col-msg">
                      <MessageCell message={e.message} highlight={searchRe.highlight} />
                    </td>
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr className="vpad" style={{ height: paddingBottom }}>
                  <td colSpan={4} />
                </tr>
              )}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted empty-row">
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
