import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { netFetch, OFFLINE_ERROR } from "../lib/net.js";

// Dashboard interne (privé, verrouillé par token). Volontairement HORS i18n :
// c'est un écran d'admin, pas le produit. Le token est stocké localement et
// envoyé au Worker (/api/stats) qui agrège Analytics Engine sur 90 jours.

const TOKEN_KEY = "viewlog:stats_token";

// Libellés lisibles pour les valeurs techniques renvoyées par l'API.
const LABELS = {
  drop: "Glisser-déposer",
  picker: "Sélecteur de fichier",
  paste: "Collage",
  recent: "Depuis les récents",
  direct: "Lien direct",
  success: "Succès",
  fail: "Échec",
  s: "< 1 Mo",
  m: "1 à 10 Mo",
  l: "10 à 50 Mo",
  xl: "> 50 Mo",
  "1": "Tronqué",
  "0": "Complet",
  import: "Imports",
  open: "Réouvertures",
  home: "Accueil",
  faq: "FAQ",
  changelog: "Nouveautés",
  legal: "Mentions légales",
  search: "Recherche",
  regex: "Regex",
  filter_level: "Filtre niveau",
  time_range: "Filtre période",
  timeline_select: "Sélection graphe",
  copy_line: "Copie de ligne",
  view_patterns: "Vue Motifs",
  pattern_click: "Clic motif",
  export: "Export",
};

// Ordre canonique des tranches de taille (affichées même à 0).
const SIZE_ORDER = ["s", "m", "l", "xl"];

const num = (v) => Number(v || 0);
const fmt = (v) => num(v).toLocaleString("fr-FR");
const label = (k) => LABELS[k] ?? (k || "inconnu");

// `domain` (optionnel) force l'affichage de toutes les catégories, dans l'ordre,
// même celles absentes des données (comptées à 0).
function Bars({ title, rows, keyName, format, domain }) {
  const counts = new Map((rows || []).map((r) => [String(r[keyName]), num(r.n)]));
  const data = domain
    ? domain.map((k) => ({ k, n: counts.get(String(k)) || 0 }))
    : (rows || []).map((r) => ({ k: r[keyName], n: num(r.n) }));
  const max = data.reduce((m, r) => Math.max(m, r.n), 0) || 1;
  const labelFor = format || label;
  return (
    <section className="card stats-block">
      <h2 className="card-title">{title}</h2>
      {data.length === 0 ? (
        <p className="muted">Aucune donnée.</p>
      ) : (
        <div className="bars">
          {data.map((r) => (
            <div className="bar-row" key={r.k}>
              <span className="bar-label">{labelFor(r.k)}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(r.n / max) * 100}%` }} />
              </span>
              <span className="bar-val">{fmt(r.n)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const EVENT_LABELS = {
  page_view: "Page vue",
  import: "Import",
  open: "Réouverture",
  feature: "Feature",
};

// Date AE ("2026-07-27 12:34:56", UTC) vers un affichage local lisible.
function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(String(ts).replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString("fr-FR");
}

// Détail lisible d'un event selon son type.
function detailOf(r) {
  if (r.event === "import") {
    const parts = [label(r.source), r.ext, label(r.size)].filter(Boolean);
    if (String(r.truncated) === "1") parts.push("tronqué");
    return parts.join(" · ");
  }
  if (r.event === "open") return label(r.source);
  if (r.event === "feature") return label(r.feature);
  if (r.event === "page_view") return label(r.page);
  return "";
}

const PER_PAGE = 20;

// Icône du bouton de rafraîchissement (flèche circulaire).
function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function EventsTable({ rows, onRefresh, busy }) {
  const [page, setPage] = useState(0);
  const list = rows || [];
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const slice = list.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  return (
    <section className="card stats-block stats-table-block">
      <h2 className="card-title stats-table-head">
        <span>
          Dernières entrées <span className="muted">({fmt(list.length)})</span>
        </span>
        <button
          type="button"
          className={`stats-refresh ${busy ? "stats-refresh--busy" : ""}`}
          onClick={onRefresh}
          disabled={busy}
          title="Rafraîchir"
          aria-label="Rafraîchir"
        >
          <RefreshIcon />
        </button>
      </h2>
      {list.length === 0 ? (
        <p className="muted">Aucune donnée.</p>
      ) : (
        <>
          <div className="stats-table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event</th>
                  <th>Détail</th>
                  <th>Pays</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((r, i) => (
                  <tr key={current * PER_PAGE + i}>
                    <td className="st-date">{fmtDate(r.timestamp)}</td>
                    <td>{EVENT_LABELS[r.event] || r.event}</td>
                    <td className="muted">{detailOf(r)}</td>
                    <td>{r.country || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="stats-pager">
            <button
              className="stats-logout"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
            >
              ← Précédent
            </button>
            <span className="muted">Page {current + 1} / {pages}</span>
            <button
              className="stats-logout"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={current >= pages - 1}
            >
              Suivant →
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Tile({ label: lbl, value, accent }) {
  return (
    <div className="stat-tile">
      <div className={`stat-tile-val ${accent ? "stat-tile-val--accent" : ""}`}>{value}</div>
      <div className="stat-tile-label muted">{lbl}</div>
    </div>
  );
}

export default function Stats() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  });
  const [input, setInput] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [tab, setTab] = useState("stats"); // "stats" | "entries"

  // silent : rafraîchissement manuel, on garde les données à l'écran (et en
  // cas d'échec on ne renvoie pas l'admin sur l'écran de token).
  function load({ silent } = {}) {
    if (!token) return;
    silent ? setReloading(true) : setLoading(true);
    setError(null);
    netFetch("/api/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) throw new Error("Token invalide.");
        if (!r.ok) throw new Error(`Erreur ${r.status}.`);
        return r.json();
      })
      .then(setData)
      .catch((e) => {
        // Mode hors ligne : la requête n'a pas été émise, on le dit clairement
        // plutôt que d'afficher une erreur réseau trompeuse.
        setError(
          e.message === OFFLINE_ERROR
            ? "Mode hors ligne actif : aucune requête n'a été envoyée. Désactivez-le dans la barre du haut pour charger les stats."
            : e.message
        );
        if (!silent) setData(null);
      })
      .finally(() => {
        setLoading(false);
        setReloading(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function saveToken(e) {
    e.preventDefault();
    const t = input.trim();
    if (!t) return;
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* ignore */
    }
    setToken(t);
  }

  function logout() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setToken("");
    setData(null);
    setError(null);
  }

  if (!token || (error && !data)) {
    return (
      <div className="stats-page">
        <Link to="/" className="back-link">← Retour</Link>
        <h1 className="faq-title">Statistiques</h1>
        <form className="stats-login card" onSubmit={saveToken}>
          <label className="muted" htmlFor="stats-token">Token d'accès</label>
          <input
            id="stats-token"
            type="password"
            className="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          {error && <p className="error-banner">{error}</p>}
          <button type="submit" className="paste-submit">Ouvrir</button>
        </form>
      </div>
    );
  }

  if (loading || !data) {
    return <div className="loading">Chargement…</div>;
  }

  const s = data.summary || {};
  const visits = num(s.visits);
  const active = num(s.active_uses);
  const rate = visits > 0 ? Math.round((active / visits) * 100) : 0;

  return (
    <div className="stats-page">
      <div className="dash-head">
        <Link to="/" className="back-link">← Retour</Link>
        <h1 className="dash-title">Statistiques · 90 derniers jours</h1>
      </div>
      <button className="stats-logout" onClick={logout}>Se déconnecter</button>

      <div className="view-switch stats-tabs" role="group" aria-label="Vue">
        <button
          type="button"
          className={`view-btn ${tab === "stats" ? "view-btn--on" : ""}`}
          aria-pressed={tab === "stats"}
          onClick={() => setTab("stats")}
        >
          Statistiques
        </button>
        <button
          type="button"
          className={`view-btn ${tab === "entries" ? "view-btn--on" : ""}`}
          aria-pressed={tab === "entries"}
          onClick={() => setTab("entries")}
        >
          Entrées
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {tab === "entries" ? (
        <EventsTable
          rows={data.recent}
          onRefresh={() => load({ silent: true })}
          busy={reloading}
        />
      ) : (
        <>
      <div className="stats-tiles">
        <Tile label="Visites" value={fmt(visits)} />
        <Tile label="Usages actifs" value={fmt(active)} accent />
        <Tile label="Taux d'activation" value={`${rate} %`} accent />
        <Tile label="Imports OK" value={fmt(s.imports_ok)} />
        <Tile label="Imports en échec" value={fmt(s.imports_fail)} />
        <Tile label="Events feature" value={fmt(s.feature_events)} />
      </div>

      <div className="stats-grid">
        <Bars
          title="Visites par jour"
          rows={data.visitsByDay}
          keyName="day"
          format={(d) => String(d).slice(0, 10)}
        />
        <Bars title="Import vs réouverture" rows={data.importVsOpen} keyName="event" />
        <Bars title="Méthode d'import" rows={data.methods} keyName="method" />
        <Bars title="Succès / échec" rows={data.outcomes} keyName="outcome" />
        <Bars title="Fonctionnalités utilisées" rows={data.features} keyName="feature" />
        <Bars title="Extensions" rows={data.extensions} keyName="ext" />
        <Bars title="Tranches de taille" rows={data.sizes} keyName="size_bucket" domain={SIZE_ORDER} />
        <Bars title="Troncature atteinte" rows={data.truncated} keyName="truncated" />
        <Bars title="Échecs par taille" rows={data.failBySize} keyName="size_bucket" domain={SIZE_ORDER} />
        <Bars title="Pages vues" rows={data.pages} keyName="page" />
        <Bars title="Pays" rows={data.countries} keyName="country" />
      </div>
        </>
      )}
    </div>
  );
}
