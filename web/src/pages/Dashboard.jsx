import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";

import StatCards from "../components/StatCards.jsx";
import LevelChart from "../components/LevelChart.jsx";
import Timeline from "../components/Timeline.jsx";
import LogTable from "../components/LogTable.jsx";
import { getLog } from "../lib/api.js";
import { trackOpen } from "../lib/track.js";
import { MAX_LINES } from "../parser/index.js";
import { useI18n } from "../i18n/index.jsx";

export default function Dashboard() {
  const { t, locale } = useI18n();
  const { id } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Origine de l'arrivée sur ce dashboard : "import" (déjà tracké à l'upload),
    // "recent" (clic dans la liste) ou "direct" (URL/refresh, ex. bookmark).
    const from = location.state?.from;
    // Une réouverture = usage sans import. On ne re-track pas les imports ici.
    const trackReopen = (outcome) => {
      if (from !== "import") trackOpen(from === "recent" ? "recent" : "direct", outcome);
    };
    setData(null);
    setError(null);
    getLog(id)
      .then((d) => {
        setData(d);
        trackReopen("success");
      })
      .catch((e) => {
        setError(e.message);
        trackReopen("fail");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
