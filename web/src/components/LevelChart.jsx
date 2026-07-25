import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { levelColor } from "../levels.js";
import { useI18n } from "../i18n/index.jsx";

export default function LevelChart({ byLevel }) {
  const { t, locale } = useI18n();
  const data = Object.entries(byLevel)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => ({ level, count }));

  if (data.length === 0) return <p className="muted">{t("chart.no_data")}</p>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
        <XAxis
          dataKey="level"
          tick={{ fill: "var(--ink-2)", fontSize: 12 }}
          axisLine={{ stroke: "var(--line)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={40}
        />
        <Tooltip
          cursor={{ fill: "var(--row-hover)" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontSize: 13,
          }}
          labelStyle={{ color: "var(--ink-2)" }}
          itemStyle={{ color: "var(--ink)" }}
          formatter={(v) => [v.toLocaleString(locale), t("chart.entries")]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64}>
          {data.map((d) => (
            <Cell key={d.level} fill={levelColor(d.level)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
