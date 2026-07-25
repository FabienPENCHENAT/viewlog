import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { LEVEL_COLORS } from "../levels.js";
import { useI18n } from "../i18n/index.jsx";

export default function Timeline({ timeline }) {
  const { t, locale } = useI18n();

  const fmtTime = (iso) =>
    new Date(iso).toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (!timeline || timeline.length === 0) {
    return <p className="muted">{t("chart.no_ts")}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={timeline} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LEVEL_COLORS.DEBUG} stopOpacity={0.35} />
            <stop offset="100%" stopColor={LEVEL_COLORS.DEBUG} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="t"
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
        />
        <Area
          type="monotone"
          dataKey="ERROR"
          name={t("chart.errors")}
          stroke={LEVEL_COLORS.ERROR}
          strokeWidth={2}
          fillOpacity={0}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
