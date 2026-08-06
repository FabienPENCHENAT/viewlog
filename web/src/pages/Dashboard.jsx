import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";

import FileIdentity from "../components/dashboard/FileIdentity.jsx";
import Timeline from "../components/dashboard/Timeline.jsx";
import LogTable from "../components/dashboard/LogTable.jsx";
import TabBar from "../components/dashboard/TabBar.jsx";
import PeakZones, { PeakToggle } from "../components/dashboard/Peaks.jsx";
import { getLog, listLogs, deleteLog, renameLog, reorderLogs, MAX_FILES } from "../lib/api.js";
import ImportManager from "../components/shared/ImportManager.jsx";
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
  const importer = useRef(null);

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
  // Zones détectées : rien n'est affiché avant un geste explicite.
  const [showPeaks, setShowPeaks] = useState(false);
  // Incrémenté au clic sur une zone : il entre dans la clé de LogTable pour
  // le remonter, donc pour qu'il relise la vue et le mode qu'on vient d'écrire
  // dans l'état d'onglet. Sans ça, la comparaison ne s'ouvrirait pas.
  const [peakNonce, setPeakNonce] = useState(0);
  useEffect(() => {
    // Reprise de la période là où on l'avait laissée sur CET onglet : revenir
    // dessus doit rendre le journal tel qu'on l'a quitté.
    const saved = getTabState(id)?.range;
    setRange(saved ? clampRange(saved, bounds) : fullRange(bounds));
    setShowPeaks(false);
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

  // Un clic sur une zone proposée : la période devient la zone, et le journal
  // s'ouvre directement sur la comparaison des motifs. Le bloc est une entrée
  // dans la fonctionnalité existante, pas une seconde analyse.
  function pickPeak(zone) {
    trackFeature("peaks_pick");
    setTabState(id, { view: "patterns", compare: true });
    selectRange({ from: zone.from, to: zone.to }, "timeline_select");
    setPeakNonce((n) => n + 1);
  }

  function togglePeaks() {
    if (!showPeaks) trackFeature("peaks_show");
    setShowPeaks((v) => !v);
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
      {/* La barre occupe sa propre ligne, sur toute la largeur : partagée avec le
          lien de retour, il lui manquait la place de cinq étiquettes anglaises
          avec les secondes, et elle débordait à droite du contenu. Le cadre est
          désormais fixe et c'est la piste des onglets qui défile, voir TabBar. */}
      {tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activeId={id}
          max={MAX_FILES}
          onSelect={selectTab}
          onClose={closeTab}
          onRename={rename}
          onReorder={reorder}
          onAdd={() => importer.current?.openFiles()}
        />
      )}
      <div className="dash-head-row">
        <Link to="/" className="back-link">{t("dash.back_files")}</Link>
        {/* Le nom brut vient des onglets tant que le parsing n'est pas fini :
            sinon le titre clignoterait sur « Log » à chaque changement d'onglet. */}
        <h1 className="dash-title">
          {data?.meta.name ||
            tabs.find((tab) => tab.id === id)?.name ||
            t("dash.default_name")}
        </h1>
      </div>
      {/* Même orchestrateur que l'accueil : le « + » doit accepter plusieurs
          fichiers et proposer le même choix au-delà de la capacité. */}
      <ImportManager
        ref={importer}
        onDone={(ids) => navigate(`/dashboard/${ids[0]}`, { state: { from: "import" } })}
        onError={setError}
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

      <FileIdentity stats={stats} />

      {/* Le graphe prend toute la largeur : c'est la vedette de l'écran, et
          l'histogramme par niveau qui lui prenait la moitié est remplacé par la
          bande d'identité, plus basse et plus lisible. */}
      <section className="card">
        <h2 className="card-title">{t("dash.timeline")}</h2>
        <Timeline
          timeline={stats.timeline}
          bounds={bounds}
          range={range}
          marks={showPeaks ? data.peaks : null}
          onRangeChange={(r) => selectRange(r, "timeline_select")}
        >
          {/* L'accès aux zones vit DANS l'invitation à glisser, pas en dessous :
              un accès secondaire qui forme son propre bloc cesse d'être
              secondaire. */}
          <PeakToggle
            count={(data.peaks || []).length}
            shown={showPeaks}
            onToggle={togglePeaks}
          />
        </Timeline>
        <PeakZones
          peaks={data.peaks || []}
          entries={entries}
          shown={showPeaks}
          onPick={pickPeak}
        />
      </section>

      <section className="card">
        <h2 className="card-title">{t("dash.journal")}</h2>
        <LogTable
          key={`${id}:${peakNonce}`}
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
