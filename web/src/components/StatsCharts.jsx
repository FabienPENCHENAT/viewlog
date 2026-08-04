import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Graphes de la page privée /stats. Mêmes conventions que les graphes du
// dashboard : grille en filet, axes en retrait, une seule teinte.

const TOOLTIP = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 13,
};

const fmt = (v) => Number(v || 0).toLocaleString("fr-FR");

// « Visites par jour » : une série temporelle, donc l'axe reste CHRONOLOGIQUE.
// Inverser le temps sur un graphe se lit de travers ; pour que le jour le plus
// récent saute quand même aux yeux, c'est lui qui porte le point et la valeur.
export function DayChart({ title, rows, dim }) {
  const data = useMemo(() => {
    const list = (rows || []).map((r) => ({
      day: String(r.day).slice(0, 10),
      n: Number(r.n || 0),
    }));
    // La requête trie déjà par jour croissant, mais on ne s'en remet pas à ça.
    return list.sort((a, b) => a.day.localeCompare(b.day));
  }, [rows]);

  const last = data.length ? data[data.length - 1] : null;
  const total = data.reduce((sum, r) => sum + r.n, 0);

  return (
    <section className="card stats-block" data-dim={dim || undefined}>
      <h2 className="card-title stats-chart-head">
        <span>{title}</span>
        {last && (
          <span className="stats-chart-note">
            {fmt(total)} au total · dernier jour <b>{fmt(last.n)}</b>
          </span>
        )}
      </h2>
      {data.length === 0 ? (
        <p className="muted">Aucune donnée.</p>
      ) : (
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={data} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="stats-day-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={(d) => d.slice(5).split("-").reverse().join("/")}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--line)" }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={34}
            />
            <Tooltip
              contentStyle={TOOLTIP}
              labelStyle={{ color: "var(--ink-2)" }}
              itemStyle={{ color: "var(--ink)" }}
              formatter={(v) => [fmt(v), "Visites"]}
            />
            <Area
              type="monotone"
              dataKey="n"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#stats-day-fill)"
              // Un point sur chaque jour ferait du bruit sur 90 jours : seul le
              // dernier est marqué, c'est celui qu'on vient lire.
              dot={false}
              activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

// Comparaison de magnitude entre catégories, triée du plus au moins utilisé.
// Barres horizontales : les libellés sont longs et se lisent sans être tournés.
// UNE seule teinte pour toutes les barres : la longueur porte déjà la valeur,
// un dégradé la répéterait en brûlant le seul canal libre.
export function RankedBars({ title, rows, keyName, format, wide, dim }) {
  const data = useMemo(() => {
    const labelFor = format || ((k) => k);
    return (rows || [])
      .map((r) => ({ k: String(r[keyName] ?? ""), name: labelFor(r[keyName]), n: Number(r.n || 0) }))
      .sort((a, b) => b.n - a.n);
  }, [rows, keyName, format]);

  const top = data.length ? data[0].n : 0;
  // Hauteur pilotée par le nombre de barres, sinon elles s'écrasent ou flottent.
  const height = Math.max(140, data.length * 30 + 24);

  return (
    <section
      className={`card stats-block ${wide ? "stats-block--wide" : ""}`}
      data-dim={dim || undefined}
    >
      <h2 className="card-title">{title}</h2>
      {data.length === 0 ? (
        <p className="muted">Aucune donnée.</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 52, bottom: 0, left: 0 }}
            barCategoryGap={8}
          >
            <CartesianGrid stroke="var(--grid)" horizontal={false} />
            <XAxis type="number" domain={[0, top]} hide />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "var(--ink-2)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={168}
            />
            <Tooltip
              cursor={{ fill: "var(--row-hover)" }}
              contentStyle={TOOLTIP}
              labelStyle={{ color: "var(--ink-2)" }}
              itemStyle={{ color: "var(--ink)" }}
              formatter={(v) => [fmt(v), "Events"]}
            />
            <Bar dataKey="n" radius={[4, 4, 4, 4]} maxBarSize={14}>
              {data.map((r) => (
                <Cell key={r.k} fill="var(--accent)" />
              ))}
              {/* La valeur est lisible sans survol : l'infobulle complète, elle
                  ne conditionne pas la lecture. */}
              <LabelList
                dataKey="n"
                position="right"
                formatter={fmt}
                style={{ fill: "var(--ink)", fontSize: 12 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
