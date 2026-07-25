import { Link } from "react-router-dom";
import { useI18n } from "../i18n/index.jsx";
// Source unique : docs/CHANGELOG.md, importé tel quel.
import raw from "../../../docs/CHANGELOG.md?raw";

// Parse minimal, calé sur notre format Keep a Changelog :
//   ## [version] - date   → une release
//   ### Catégorie         → un groupe (Added / Changed / Fixed / Removed)
//   - item                → une entrée
function parseChangelog(md) {
  const releases = [];
  let release = null;
  let group = null;

  for (const line of md.split(/\r?\n/)) {
    const ver = /^##\s+(.+)$/.exec(line);
    const cat = /^###\s+(.+)$/.exec(line);
    const item = /^-\s+(.+)$/.exec(line);

    if (cat && release) {
      group = { name: cat[1].trim(), items: [] };
      release.groups.push(group);
    } else if (ver) {
      const m = /\[(.+?)\]\s*-?\s*(.*)$/.exec(ver[1].trim());
      release = {
        version: m ? m[1] : ver[1].trim(),
        date: m ? m[2].trim() : "",
        groups: [],
      };
      group = null;
      releases.push(release);
    } else if (item && release) {
      if (!group) {
        group = { name: "", items: [] };
        release.groups.push(group);
      }
      group.items.push(item[1].trim());
    }
  }

  // On n'affiche que les releases qui ont au moins une entrée.
  return releases.filter((r) => r.groups.some((g) => g.items.length > 0));
}

// Rend le `code` inline (backticks) ; le reste en texte brut.
function renderInline(text) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i}>{part.slice(1, -1)}</code>
    ) : (
      part
    )
  );
}

export default function Changelog() {
  const { t } = useI18n();
  const releases = parseChangelog(raw);

  return (
    <div className="changelog">
      <Link to="/" className="back-link">{t("dash.back_home")}</Link>
      <h1 className="faq-title">{t("changelog.title")}</h1>
      <p className="changelog-intro">{t("changelog.intro")}</p>

      {releases.map((r) => (
        <section key={r.version} className="changelog-release">
          <h2 className="changelog-version">
            {r.version}
            {r.date && <span className="changelog-date">{r.date}</span>}
          </h2>
          {r.groups.map((g, gi) => (
            <div key={gi} className="changelog-group">
              {g.name && <h3 className="changelog-cat">{g.name}</h3>}
              <ul className="changelog-items">
                {g.items.map((it, ii) => (
                  <li key={ii}>{renderInline(it)}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
