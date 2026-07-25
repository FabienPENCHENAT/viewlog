import { useMemo, useState } from "react";
import { useI18n } from "../i18n/index.jsx";

// Rendu générique du message d'une entrée de log.
// Principe : on n'AJOUTE que de la lisibilité, on ne retire jamais de contenu,
// et on retombe toujours sur du texte brut si rien n'est reconnu.

const COLLAPSE_LINES = 6; // au-delà, on replie par défaut
const COLLAPSE_CHARS = 800; // ou si le message est très long d'un seul tenant

// Séquences d'échappement littérales -> vrais retours à la ligne (\n, \N, \r\n, \r).
const ESCAPED_NL = /\\r\\n|\\n|\\r/gi;
const ESCAPED_TAB = /\\t/gi;

// Tokens à fort bruit : UUID et longues chaînes hexadécimales (hash, ids opaques).
// On les atténue visuellement pour faire ressortir le message lisible.
const NOISE_RE =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\b[0-9a-f]{16,}\b)/gi;

// Longueur mini d'un bloc JSON pour valoir un pretty-print (évite {} ou [1,2]).
const MIN_JSON = 40;
// Au-delà, on ne tente pas la détection JSON (garde-fou perf sur gros messages).
const MAX_SCAN = 50000;

function splitLines(text) {
  return text
    .split(/\r\n|\r|\n/)
    .map((l) => l.replace(/\s+$/g, "")) // vire les blancs de fin
    .filter((l) => l.trim() !== ""); // vire les lignes vides
}

// Depuis un '{' ou '[', renvoie l'index du crochet fermant équilibré (ou -1).
// Respecte les chaînes JSON et leurs échappements.
function scanBalanced(text, start) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Repère les blocs JSON stricts (objets/tableaux) dans le texte.
function findJsonSpans(text) {
  if (text.length > MAX_SCAN) return [];
  const spans = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "{" || ch === "[") {
      const end = scanBalanced(text, i);
      if (end > i && end - i + 1 >= MIN_JSON) {
        const sub = text.slice(i, end + 1);
        try {
          const value = JSON.parse(sub);
          if (value && typeof value === "object") {
            spans.push({ start: i, end: end + 1, value });
            i = end + 1;
            continue;
          }
        } catch {
          /* pas du JSON valide : on laisse le texte tel quel */
        }
      }
    }
    i++;
  }
  return spans;
}

// Découpe le message en segments texte / JSON pretty-printé.
// IMPORTANT : la détection JSON se fait sur le message BRUT (les payloads
// contiennent souvent des "\n" échappés, valides en JSON). La normalisation
// des échappements n'est appliquée qu'aux segments texte, pour l'affichage.
function buildParts(message) {
  const raw = message || "";
  const spans = findJsonSpans(raw);

  const parts = [];
  let cursor = 0;
  const pushText = (slice) => {
    const norm = slice.replace(ESCAPED_NL, "\n").replace(ESCAPED_TAB, "    ");
    const lines = splitLines(norm);
    if (lines.length) parts.push({ type: "text", lines });
  };

  for (const s of spans) {
    if (s.start > cursor) pushText(raw.slice(cursor, s.start));
    parts.push({ type: "json", lines: splitLines(JSON.stringify(s.value, null, 2)) });
    cursor = s.end;
  }
  if (cursor < raw.length) pushText(raw.slice(cursor));

  return parts.filter((p) => p.lines.length > 0);
}

// Atténue UUID / hash sur un fragment de texte (sans surlignage de recherche).
function renderNoise(text, keyPrefix) {
  const nodes = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(NOISE_RE)) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <span key={`${keyPrefix}-n${key++}`} className="msg-noise">
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Rend une ligne : hors correspondances de recherche on garde l'atténuation
// du bruit ; les correspondances (regex ou texte) sont surlignées.
function renderLine(line, highlight, lineKey) {
  if (!highlight) return renderNoise(line, lineKey);

  highlight.lastIndex = 0;
  const nodes = [];
  let last = 0;
  let key = 0;
  let guard = 0;
  let m;
  while ((m = highlight.exec(line)) !== null) {
    if (m[0] === "") {
      highlight.lastIndex += 1; // match vide : on avance sans rien surligner
      if (++guard > 5000) break;
      continue;
    }
    if (m.index > last) nodes.push(...renderNoise(line.slice(last, m.index), `${lineKey}-g${key}`));
    nodes.push(
      <mark key={`${lineKey}-h${key++}`} className="msg-hit">
        {m[0]}
      </mark>
    );
    last = m.index + m[0].length;
    if (++guard > 5000) break;
  }
  if (last < line.length) nodes.push(...renderNoise(line.slice(last), `${lineKey}-t`));
  return nodes;
}

export default function MessageCell({ message, highlight }) {
  const { t } = useI18n();
  const parts = useMemo(() => buildParts(message), [message]);
  const [open, setOpen] = useState(false);

  if (parts.length === 0) return <span className="muted">—</span>;

  const totalLines = parts.reduce((n, p) => n + p.lines.length, 0);
  const hasJson = parts.some((p) => p.type === "json");
  const long = totalLines > COLLAPSE_LINES || (message?.length || 0) > COLLAPSE_CHARS;
  const clamped = long && !open;

  return (
    <div className={`msg ${totalLines > 1 || hasJson ? "msg--multi" : ""}`}>
      <div className={`msg-body ${clamped ? "msg-body--clamped" : ""}`}>
        {parts.map((p, pi) => {
          const rows = p.lines.map((line, i) => (
            <div className="msg-line" key={i}>
              {renderLine(line, highlight, `p${pi}l${i}`)}
            </div>
          ));
          return p.type === "json" ? (
            <div className="msg-json" key={pi}>
              {rows}
            </div>
          ) : (
            <div className="msg-text" key={pi}>
              {rows}
            </div>
          );
        })}
      </div>
      {long && (
        <button className="msg-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? t("msg.collapse") : t("msg.expand", { count: totalLines })}
        </button>
      )}
    </div>
  );
}
