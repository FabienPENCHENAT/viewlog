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
//
// Colonnes verticales, et non des barres horizontales : le bloc tient alors sur
// la même hauteur que le graphe des visites, au prix de libellés inclinés.
//
// UNE seule teinte pour toutes les colonnes : la hauteur porte déjà la valeur, un
// dégradé la répéterait en brûlant le seul canal libre, et sur des catégories sans
// ordre naturel une échelle de couleur ne veut rien dire.
export function RankedBars({ title, rows, keyName, format, dim, height = 190 }) {
  const data = useMemo(() => {
    const labelFor = format || ((k) => k);
    return (rows || [])
      .map((r) => ({ k: String(r[keyName] ?? ""), name: labelFor(r[keyName]), n: Number(r.n || 0) }))
      .sort((a, b) => b.n - a.n);
  }, [rows, keyName, format]);

  return (
    <section className="card stats-block" data-dim={dim || undefined}>
      <h2 className="card-title">{title}</h2>
      {data.length === 0 ? (
        <p className="muted">Aucune donnée.</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            // La marge basse réserve la bande des libellés inclinés : sans elle,
            // le graphe tient et les libellés sont rognés.
            margin={{ top: 18, right: 8, bottom: 52, left: 8 }}
          >
            <XAxis
              dataKey="name"
              interval={0}
              angle={-38}
              textAnchor="end"
              tick={{ fill: "var(--ink-2)", fontSize: 10 }}
              axisLine={{ stroke: "var(--line)" }}
              tickLine={false}
              height={52}
            />
            {/* Pas d'axe des valeurs : chaque colonne porte la sienne, ce qui est
                plus direct et rend la hauteur du bloc au graphe. */}
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "var(--row-hover)" }}
              contentStyle={TOOLTIP}
              labelStyle={{ color: "var(--ink-2)" }}
              itemStyle={{ color: "var(--ink)" }}
              formatter={(v) => [fmt(v), "Events"]}
            />
            <Bar dataKey="n" radius={[4, 4, 0, 0]} maxBarSize={26}>
              {data.map((r) => (
                <Cell key={r.k} fill="var(--accent)" />
              ))}
              {/* La valeur reste lisible sans survol : l'infobulle complète, elle
                  ne conditionne pas la lecture. */}
              <LabelList
                dataKey="n"
                position="top"
                formatter={fmt}
                style={{ fill: "var(--ink)", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
