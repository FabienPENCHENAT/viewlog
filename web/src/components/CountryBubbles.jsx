import { useMemo } from "react";

// Pays de connexion, en bulles.
//
// L'aire d'un disque porte la valeur, donc le diamètre suit la RACINE du compte :
// proportionner le diamètre gonflerait visuellement les gros pays au carré.
//
// Une seule teinte pour toutes les bulles. La taille dit déjà la magnitude ; un
// dégradé de couleur la répéterait en brûlant le seul canal libre, et sur des
// catégories sans ordre naturel une échelle de couleur ne veut rien dire.

const MIN_D = 56;
const MAX_D = 132;

// Drapeau depuis un code ISO à deux lettres, via les indicateurs régionaux.
// Aucune image à embarquer. Windows ne les rend pas en drapeau : le code reste
// écrit dans la bulle, donc l'information ne dépend jamais de l'emoji.
function flagOf(code) {
  if (!/^[A-Za-z]{2}$/.test(code || "")) return "🌐";
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

let names = null;
function nameOf(code) {
  if (!/^[A-Za-z]{2}$/.test(code || "")) return "Inconnu";
  try {
    if (!names) names = new Intl.DisplayNames(["fr"], { type: "region" });
    return names.of(code.toUpperCase()) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

const fmt = (v) => Number(v || 0).toLocaleString("fr-FR");

export default function CountryBubbles({ title, rows, dim }) {
  const { data, total } = useMemo(() => {
    const list = (rows || [])
      .map((r) => ({ code: String(r.country || ""), n: Number(r.n || 0) }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n);

    const sum = list.reduce((acc, r) => acc + r.n, 0);
    const top = list.length ? list[0].n : 1;

    return {
      total: sum,
      data: list.map((r) => ({
        ...r,
        name: nameOf(r.code),
        flag: flagOf(r.code),
        share: sum > 0 ? (r.n / sum) * 100 : 0,
        // Racine carrée : l'aire, et non le diamètre, est proportionnelle au compte.
        d: Math.round(MIN_D + (MAX_D - MIN_D) * Math.sqrt(r.n / top)),
      })),
    };
  }, [rows]);

  return (
    <section className="card stats-block stats-block--wide" data-dim={dim || undefined}>
      <h2 className="card-title stats-chart-head">
        <span>{title}</span>
        <span className="stats-chart-note">
          {data.length} pays · {fmt(total)} events
        </span>
      </h2>

      {data.length === 0 ? (
        <p className="muted">Aucune donnée.</p>
      ) : (
        <ul className="bubbles">
          {data.map((r) => (
            <li
              key={r.code || "unknown"}
              className="bubble"
              style={{ "--d": `${r.d}px` }}
              title={`${r.name} · ${fmt(r.n)} events · ${r.share.toFixed(1)} %`}
            >
              <span className="bubble-flag" aria-hidden="true">{r.flag}</span>
              <span className="bubble-code">{r.code || "??"}</span>
              <span className="bubble-n">{fmt(r.n)}</span>
              {/* Le nom complet pour les lecteurs d'écran : le drapeau est
                  décoratif et le code seul ne se prononce pas. */}
              <span className="sr-only">{`${r.name}, ${fmt(r.n)} events`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
