import { formatDuration } from "../../lib/duration.js";
import { useI18n } from "../../i18n/index.jsx";

function duration(span, t, locale) {
  if (!span) return "—";
  return formatDuration(new Date(span.end) - new Date(span.start), t, locale);
}

export default function StatCards({ stats }) {
  const { t, locale } = useI18n();
  const fmt = (n) => n?.toLocaleString(locale) ?? "0";
  const cards = [
    { label: t("stats.lines"), value: fmt(stats.total), tone: "neutral" },
    { label: t("stats.errors"), value: fmt(stats.errorCount), tone: "error" },
    { label: t("stats.warnings"), value: fmt(stats.warnCount), tone: "warn" },
    { label: t("stats.duration"), value: duration(stats.timeSpan, t, locale), tone: "neutral" },
  ];
  return (
    <div className="stat-cards">
      {cards.map((c) => (
        <div key={c.label} className={`stat-card stat-card--${c.tone}`}>
          <div className="stat-value">{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
