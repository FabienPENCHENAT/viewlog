import { Link, NavLink, Outlet } from "react-router-dom";
import { useI18n } from "./i18n/index.jsx";

function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t("lang.switch")}>
      {["fr", "en"].map((code) => (
        <button
          key={code}
          type="button"
          className={`lang-btn ${lang === code ? "lang-btn--on" : ""}`}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function TopNav() {
  const { t } = useI18n();
  return (
    <nav className="topnav">
      <NavLink
        to="/faq"
        className={({ isActive }) => `nav-link ${isActive ? "nav-link--on" : ""}`}
      >
        {t("nav.faq")}
      </NavLink>
    </nav>
  );
}

function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <span className="footer-brand">ViewLog · © {year}</span>
        <nav className="footer-links">
          <Link to="/faq">{t("nav.faq")}</Link>
          <Link to="/changelog">{t("footer.changelog")}</Link>
          <Link to="/mentions-legales">{t("footer.legal")}</Link>
        </nav>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <svg className="brand-logo" viewBox="0 0 100 100" aria-hidden="true">
            {/* Lignes de log empilées ; la ligne ambre = l'entrée mise en évidence. */}
            <g fill="var(--ink)">
              <rect x="10" y="10.5" width="74" height="13" rx="6.5" />
              <rect x="10" y="32.5" width="50" height="13" rx="6.5" />
              <rect x="10" y="76.5" width="44" height="13" rx="6.5" />
            </g>
            <rect x="10" y="54.5" width="84" height="13" rx="6.5" fill="var(--accent)" />
          </svg>
          ViewLog
        </Link>
        <TopNav />
        <LangSwitch />
      </header>
      <main className="content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
