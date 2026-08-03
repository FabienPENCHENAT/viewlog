import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";

import StatCards from "../components/StatCards.jsx";
import LevelChart from "../components/LevelChart.jsx";
import Timeline from "../components/Timeline.jsx";
import LogTable from "../components/LogTable.jsx";
import TabBar from "../components/TabBar.jsx";
import { getLog, listLogs, deleteLog, renameLog, reorderLogs, MAX_FILES } from "../lib/api.js";
import { importLog } from "../lib/import-log.js";
import { labelTabs } from "../lib/tab-label.js";
import { getTabState, setTabState, dropTabState } from "../lib/tab-state.js";
import { trackOpen, trackFeature, featureOnce } from "../lib/track.js";
import { timeBounds, fullRange, clampRange, isPartialRange } from "../lib/time-range.js";
import { MAX_LINES } from "../parser/index.js";
import { useI18n } from "../i18n/index.jsx";

export default function Dashboard() {
  const { t, lang, locale } = useI18n();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);
  const fileInput = useRef(null);

  const refreshTabs = useCallback(() => {
    listLogs()
      .then(setFiles)
      .catch(() => setFiles([]));
  }, []);

  // Relu à chaque changement d'onglet : la route change sans remonter la page,
  // donc sans `id` dans les dépendances un nouvel import n'apparaîtrait jamais
  // dans la barre.
  useEffect(() => {
    refreshTabs();
  }, [refreshTabs, id]);

  useEffect(() => {
    // Origine de l'arrivée sur ce dashboard : "import" (déjà tracké à l'upload),
    // "recent" (clic dans la liste), "tab" (clic dans la barre d'onglets) ou
    // "direct" (URL/refresh, ex. bookmark).
    const from = location.state?.from;
    // Une réouverture = usage sans import. On ne re-track pas les imports ici.
    const trackReopen = (outcome) => {
      if (from === "import") return;
      const source = from === "recent" || from === "tab" ? from : "direct";
      trackOpen(source, outcome);
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

  // Étiquettes des onglets : jamais le nom du fichier, et un format commun à
  // toute la barre (voir lib/tab-label.js).
  const tabs = useMemo(() => labelTabs(files, lang), [files, lang]);

  // Fenêtre temporelle partagée : le graphe de volume et le journal la lisent
  // et l'écrivent tous les deux, donc elle vit ici.
  const bounds = useMemo(() => (data ? timeBounds(data.entries) : null), [data]);
  const [range, setRange] = useState(null);
  useEffect(() => {
    // Reprise de la période là où on l'avait laissée sur CET onglet : revenir
    // dessus doit rendre le journal tel qu'on l'a quitté.
    const saved = getTabState(id)?.range;
    setRange(saved ? clampRange(saved, bounds) : fullRange(bounds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds]);

  // Adoption comptée une fois par fichier ouvert (voir featureOnce).
  const markRef = useRef(null);
  if (markRef.current === null) markRef.current = featureOnce();
  useEffect(() => {
    markRef.current = featureOnce();
  }, [id]);

  function selectRange(next, source) {
    const r = clampRange(next, bounds);
    setRange(r);
    setTabState(id, { range: r });
    // Un retour à la période complète n'est pas un usage du filtre.
    if (source && isPartialRange(bounds, r)) markRef.current(source);
  }

  function selectTab(nextId) {
    if (nextId === id) return;
    trackFeature("tab_switch");
    navigate(`/dashboard/${nextId}`, { state: { from: "tab" } });
  }

  async function closeTab(closedId) {
    const index = tabs.findIndex((tab) => tab.id === closedId);
    await deleteLog(closedId);
    dropTabState(closedId);
    const remaining = tabs.filter((tab) => tab.id !== closedId);
    setFiles(remaining);

    if (closedId !== id) return;
    // Fermer l'onglet courant : on tombe sur son voisin, ou sur l'accueil s'il
    // n'en reste aucun.
    const next = remaining[index] || remaining[index - 1];
    navigate(next ? `/dashboard/${next.id}` : "/", {
      state: next ? { from: "tab" } : undefined,
    });
  }

  async function rename(renamedId, label) {
    trackFeature("tab_rename");
    // Optimiste : l'étiquette doit changer sous le curseur, pas après un
    // aller-retour IndexedDB.
    setFiles((prev) =>
      prev.map((f) => (f.id === renamedId ? { ...f, label: label.trim() || null } : f))
    );
    try {
      await renameLog(renamedId, label);
    } catch {
      refreshTabs();
    }
  }

  async function reorder(ids) {
    trackFeature("tab_reorder");
    const byId = new Map(files.map((f) => [f.id, f]));
    setFiles(ids.map((tabId) => byId.get(tabId)).filter(Boolean));
    try {
      await reorderLogs(ids);
    } catch {
      refreshTabs();
    }
  }

  async function addFile(file) {
    if (!file) return;
    try {
      const { id: newId } = await importLog(file, "tab_add");
      navigate(`/dashboard/${newId}`, { state: { from: "import" } });
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="error-banner">{t(error)}</div>
        <Link to="/" className="back-link">{t("dash.back_home")}</Link>
      </div>
    );
  }

  const head = (
    <div className="dash-head">
      <div className="dash-head-row">
        <Link to="/" className="back-link">{t("dash.back_files")}</Link>
        {tabs.length > 0 && (
          <TabBar
            tabs={tabs}
            activeId={id}
            max={MAX_FILES}
            onSelect={selectTab}
            onClose={closeTab}
            onRename={rename}
            onReorder={reorder}
            onAdd={() => fileInput.current?.click()}
          />
        )}
      </div>
      {/* Le nom brut vient des onglets tant que le parsing n'est pas fini :
          sinon le titre clignoterait sur « Log » à chaque changement d'onglet. */}
      <h1 className="dash-title">
        {data?.meta.name ||
          tabs.find((tab) => tab.id === id)?.name ||
          t("dash.default_name")}
      </h1>
      <input
        ref={fileInput}
        type="file"
        accept=".log,.txt,.csv,text/plain,text/csv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          addFile(file);
        }}
      />
    </div>
  );

  // La barre reste montée pendant le chargement : sans ça, changer d'onglet
  // ferait disparaître la barre sur laquelle on vient de cliquer.
  if (!data) {
    return (
      <div className="dashboard">
        {head}
        <div className="loading">{t("dash.loading")}</div>
      </div>
    );
  }

  const { stats, entries, meta } = data;

  return (
    <div className="dashboard">
      {head}

      {meta.truncated && (
        <div className="warn-banner">
          {t("dash.truncated", { max: MAX_LINES.toLocaleString(locale) })}
        </div>
      )}

      <StatCards stats={stats} />

      <div className="charts-grid">
        <section className="card">
          <h2 className="card-title">{t("dash.timeline")}</h2>
          <Timeline
            timeline={stats.timeline}
            bounds={bounds}
            range={range}
            onRangeChange={(r) => selectRange(r, "timeline_select")}
          />
        </section>
        <section className="card">
          <h2 className="card-title">{t("dash.levels")}</h2>
          <LevelChart byLevel={stats.byLevel} />
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">{t("dash.journal")}</h2>
        <LogTable
          key={id}
          tabId={id}
          entries={entries}
          byLevel={stats.byLevel}
          bounds={bounds}
          range={range}
          onRangeChange={(r) => selectRange(r, "time_range")}
        />
      </section>
    </div>
  );
}
