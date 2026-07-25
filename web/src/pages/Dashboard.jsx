import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import StatCards from "../components/StatCards.jsx";
import LevelChart from "../components/LevelChart.jsx";
import Timeline from "../components/Timeline.jsx";
import LogTable from "../components/LogTable.jsx";
import { getLog } from "../lib/api.js";
import { MAX_LINES } from "../parser/index.js";
import { useI18n } from "../i18n/index.jsx";

export default function Dashboard() {
  const { t, locale } = useI18n();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    getLog(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="dashboard">
        <div className="error-banner">{t(error)}</div>
        <Link to="/" className="back-link">{t("dash.back_home")}</Link>
      </div>
    );
  }

  if (!data) return <div className="loading">{t("dash.loading")}</div>;

  const { stats, entries, meta } = data;

  return (
    <div className="dashboard">
      <div className="dash-head">
        <Link to="/" className="back-link">{t("dash.back_files")}</Link>
        <h1 className="dash-title">{meta.name || t("dash.default_name")}</h1>
      </div>

      {meta.truncated && (
        <div className="warn-banner">
          {t("dash.truncated", { max: MAX_LINES.toLocaleString(locale) })}
        </div>
      )}

      <StatCards stats={stats} />

      <div className="charts-grid">
        <section className="card">
          <h2 className="card-title">{t("dash.timeline")}</h2>
          <Timeline timeline={stats.timeline} />
        </section>
        <section className="card">
          <h2 className="card-title">{t("dash.levels")}</h2>
          <LevelChart byLevel={stats.byLevel} />
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">{t("dash.journal")}</h2>
        <LogTable entries={entries} byLevel={stats.byLevel} />
      </section>
    </div>
  );
}
