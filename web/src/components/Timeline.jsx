import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { LEVEL_COLORS } from "../levels.js";
import { fullRange, isPartialRange } from "../lib/time-range.js";
import { useI18n } from "../i18n/index.jsx";

export default function Timeline({ timeline, bounds, range, onRangeChange }) {
  const { t, locale } = useI18n();
  // Glisser en cours : bornes brutes (a = point de départ, b = point courant).
  const [drag, setDrag] = useState(null);

  const fmtTime = (ms) =>
    new Date(ms).toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  // Axe X numérique (échelle de temps) : indispensable pour poser une zone de
  // sélection sur des millisecondes arbitraires, et plus fidèle aux trous.
  const data = useMemo(
    () => (timeline || []).map((b) => ({ ...b, ms: new Date(b.t).getTime() })),
    [timeline]
  );

  // Largeur d'un bucket : les buckets vides ne sont pas émis, donc on prend le
  // plus petit écart entre deux points, pas la moyenne.
  const bucketMs = useMemo(() => {
    let min = Infinity;
    for (let i = 1; i < data.length; i++) {
      const d = data[i].ms - data[i - 1].ms;
      if (d > 0 && d < min) min = d;
    }
    return Number.isFinite(min) ? min : 1000;
  }, [data]);

  if (!data.length) {
    return <p className="muted">{t("chart.no_ts")}</p>;
  }

  const selectable = !!(bounds && onRangeChange);

  // Un point du graphe représente son bucket entier : on étend la borne haute
  // jusqu'à la fin du dernier bucket touché.
  function toRange(a, b) {
    const from = Math.max(bounds.lo, Math.min(a, b));
    const to = Math.min(bounds.hi, Math.max(a, b) + bucketMs);
    return from < to ? { from, to } : null;
  }

  function onDown(state) {
    if (!selectable || state?.activeLabel == null) return;
    const ms = Number(state.activeLabel);
    setDrag({ a: ms, b: ms });
  }

  function onMove(state) {
    if (!drag || state?.activeLabel == null) return;
    const ms = Number(state.activeLabel);
    setDrag((d) => (d ? { ...d, b: ms } : d));
  }

  // Relâché dans le graphe ou sorti par un bord : on valide la sélection.
  function commit() {
    if (!drag) return;
    const sel = toRange(drag.a, drag.b);
    setDrag(null);
    if (sel) onRangeChange(sel);
  }

  const preview = drag ? toRange(drag.a, drag.b) : null;
  const selected = isPartialRange(bounds, range) ? range : null;
  const zone = preview || selected;

  const domain = bounds ? [bounds.lo, bounds.hi] : ["dataMin", "dataMax"];

  return (
    <div
      className={`timeline-chart ${selectable ? "timeline-chart--pick" : ""}`}
      onDoubleClick={() => selectable && onRangeChange(fullRange(bounds))}
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={commit}
          onMouseLeave={commit}
        >
          <defs>
            <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LEVEL_COLORS.DEBUG} stopOpacity={0.35} />
              <stop offset="100%" stopColor={LEVEL_COLORS.DEBUG} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="ms"
            type="number"
            scale="time"
            domain={domain}
            tickFormatter={fmtTime}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={40}
          />
          <Tooltip
            labelFormatter={fmtTime}
            // Pendant le glisser, l'infobulle masquerait la zone en cours.
            active={drag ? false : undefined}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--ink)",
              fontSize: 13,
            }}
            labelStyle={{ color: "var(--ink-2)" }}
            itemStyle={{ color: "var(--ink)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="total"
            name={t("chart.total")}
            stroke={LEVEL_COLORS.DEBUG}
            strokeWidth={2}
            fill="url(#gTotal)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="ERROR"
            name={t("chart.errors")}
            stroke={LEVEL_COLORS.ERROR}
            strokeWidth={2}
            fillOpacity={0}
            isAnimationActive={false}
          />
          {zone && (
            <ReferenceArea
              x1={zone.from}
              x2={zone.to}
              fill="var(--accent)"
              fillOpacity={preview ? 0.2 : 0.12}
              stroke="var(--accent)"
              strokeOpacity={0.55}
              strokeDasharray={preview ? "4 3" : undefined}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      {selectable && <p className="chart-hint muted">{t("chart.select_hint")}</p>}
    </div>
  );
}
