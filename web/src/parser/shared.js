// Socle commun aux parseurs (texte et CSV) : niveaux de sévérité, détection
// d'horodatage et de niveau. Exécuté côté navigateur (dans un Web Worker).

// Garde-fou anti-fichier-fou, en LIGNES. Relevé de un à cinq millions avec le
// modèle colonnaire : une entrée coûte désormais dix-neuf octets d'index au lieu
// d'un objet et de ses chaînes.
//
// Mesuré sur un fichier de 500 Mo à lignes courtes, soit le pire cas pour ce
// plafond, 4 851 948 entrées : 93 Mo d'index, 1,69 s d'indexation, 593 Mo en
// mémoire au total. Les agrégats prennent 0,10 s, la détection de zones 0,22 s,
// un filtre plein texte sur tout le fichier 0,50 s.
export const MAX_LINES = 5000000;

// Plafond en OCTETS, refusé à l'import. Les deux garde-fous ne disent pas la
// même chose : un fichier peut tenir sous le plafond de lignes et peser 800 Mo
// (lignes très longues), ou faire 40 Mo et porter dix millions de lignes. Sans
// limite de taille, un fichier assez gros faisait tuer l'onglet par le navigateur,
// ce qui ne s'explique pas à l'utilisateur.
//
// 250 Mo tant que le fichier devait exister en chaîne de caractères, 500 depuis
// qu'il n'existe qu'en octets. Ce n'était pas un choix de confort : une chaîne
// JavaScript ne peut pas dépasser 536 870 888 caractères, mesuré, et un fichier de
// 500 Mo en occupait 526 653 114, soit 98 % de la limite. Un fichier à peine plus
// gros, ou simplement accentué, faisait lever « Invalid string length » avant même
// le parsing.
//
// Le plafond décrit ce que le moteur encaisse AUJOURD'HUI, jamais la cible d'un
// chantier en cours : un garde-fou qui laisse passer ce qui plante ne garde rien.
export const MAX_BYTES = 500 * 1024 * 1024;

// Le même plafond en Mo, pour les textes affichés : le seuil ne doit exister
// qu'à un seul endroit, sinon un message finit par annoncer une limite qui n'est
// plus celle du code.
export const MAX_MB = MAX_BYTES / (1024 * 1024);

// Niveaux canoniques (ordre de sévérité croissant).
export const LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL", "OTHER"];

export const LEVEL_ALIASES = {
  TRACE: "TRACE",
  DEBUG: "DEBUG",
  INFO: "INFO",
  INFORMATION: "INFO",
  NOTICE: "INFO",
  WARN: "WARN",
  WARNING: "WARN",
  ERR: "ERROR",
  ERROR: "ERROR",
  FATAL: "FATAL",
  CRIT: "FATAL",
  CRITICAL: "FATAL",
  SEVERE: "FATAL",
  EMERG: "FATAL",
  EMERGENCY: "FATAL",
};

const LEVEL_RE = new RegExp(`\\b(${Object.keys(LEVEL_ALIASES).join("|")})\\b`, "i");

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function tz(offset) {
  if (!offset) return "";
  return `${offset.slice(0, 3)}:${offset.slice(3)}`;
}

// Chaque entrée : { re, parse(match) -> Date|null }
const TIMESTAMP_MATCHERS = [
  // ISO 8601 : 2024-01-02T15:04:05.123Z / 2024-01-02 15:04:05,123
  {
    re: /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)/,
    parse: (m) => new Date(m[1].replace(" ", "T").replace(",", ".")),
  },
  // Apache/CLF : 02/Jan/2024:15:04:05 +0000
  {
    re: /(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})(?:\s([+-]\d{4}))?/,
    parse: (m) => {
      const month = MONTHS[m[2].toLowerCase()];
      if (month === undefined) return null;
      return new Date(`${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1]}T${m[4]}:${m[5]}:${m[6]}${tz(m[7])}`);
    },
  },
  // Syslog : Jan  2 15:04:05  (pas d'année -> on suppose l'année courante)
  {
    re: /\b([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\b/,
    parse: (m) => {
      const month = MONTHS[m[1].toLowerCase()];
      if (month === undefined) return null;
      const year = new Date().getFullYear();
      return new Date(year, month, Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
    },
  },
];

export function detectTimestamp(line) {
  for (const matcher of TIMESTAMP_MATCHERS) {
    const m = line.match(matcher.re);
    if (m) {
      const d = matcher.parse(m);
      if (d && !Number.isNaN(d.getTime())) {
        // `index` sert à distinguer un horodatage d'en-tête (en tête de ligne)
        // d'un horodatage noyé dans le contenu (payload JSON, dump SQL...).
        return { date: d, raw: m[0], index: m.index };
      }
    }
  }
  return null;
}

export function detectLevel(line) {
  const m = line.match(LEVEL_RE);
  if (!m) return null;
  return LEVEL_ALIASES[m[1].toUpperCase()] || null;
}

// Niveau à partir d'une cellule exacte (CSV) : normalise le libellé s'il est connu.
export function normalizeLevel(cell) {
  if (!cell) return null;
  return LEVEL_ALIASES[cell.trim().toUpperCase()] || null;
}
