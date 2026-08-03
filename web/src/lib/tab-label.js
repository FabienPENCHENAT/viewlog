// Étiquette d'un onglet de log.
//
// Elle ne vient JAMAIS du nom du fichier. Cinq logs peuvent venir de cinq
// produits nommés différemment (un `application.log`, un UUID de 72 caractères,
// un blob hexadécimal, un chemin de pod) : aucune règle ne rend ces noms
// comparables, et une barre dont les cellules ont des largeurs inégales ne
// glisse pas. On date donc l'import, une donnée qu'on possède toujours, dans un
// format commun à toute la barre.
//
// Le nom brut reste affiché dans le titre du dashboard et dans l'infobulle de
// l'onglet : il est accessible en permanence, il ne dicte plus la géométrie.

// L'anglais utilise la convention US (mois/jour, 12 h) : c'est ce que la barre
// doit montrer, et `Intl` s'occupe de l'ordre comme du 12 h/24 h.
const LABEL_LOCALES = { fr: "fr-FR", en: "en-US" };

// Du plus court au plus précis. Le format retenu est le premier qui distingue
// TOUS les onglets ouverts : uniforme par construction (donc même largeur),
// distinct par construction (donc jamais deux étiquettes identiques).
//
// Heure sur DEUX chiffres, y compris en 12 h : `hour: "numeric"` produirait
// "9:47 AM" puis "11:02 AM", donc des étiquettes de largeurs différentes, ce qui
// ruine l'alignement que toute la barre cherche à obtenir.
const SHAPES = [
  { hour: "2-digit", minute: "2-digit" },
  { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" },
  {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  },
];

// Plafond du renommage. Ce n'est pas une contrainte technique : c'est ce qui
// garde les cellules régulières.
export const MAX_LABEL = 14;

function formatter(lang, shape) {
  const f = new Intl.DateTimeFormat(LABEL_LOCALES[lang] || LABEL_LOCALES.en, shape);
  // Intl sépare la date de l'heure par une virgule ("08/03, 3:16 PM") : une
  // barre d'onglets n'a pas la place pour de la ponctuation.
  return (date) => f.format(date).replace(/,\s*/g, " ").trim();
}

function sameDay(dates) {
  return dates.every((d) => d.toDateString() === dates[0].toDateString());
}

// records : [{ id, importedAt, label }] où `label` est le renommage éventuel.
// Renvoie les mêmes objets enrichis de { tabLabel, autoLabel, renamed }.
export function labelTabs(records, lang) {
  const dates = records.map((r) => new Date(r.importedAt));

  // L'heure seule n'est lisible que si tous les imports sont du même jour :
  // "3:16 PM" pour un fichier d'avant-hier serait un mensonge.
  const start = dates.length > 0 && sameDay(dates) ? 0 : 1;

  let render = formatter(lang, SHAPES[SHAPES.length - 1]);
  for (let i = start; i < SHAPES.length; i++) {
    const candidate = formatter(lang, SHAPES[i]);
    const out = dates.map(candidate);
    if (new Set(out).size === out.length) {
      render = candidate;
      break;
    }
  }

  // Deux imports dans la même seconde : le rang départage. C'est laid, et c'est
  // exactement le cas où renommer n'est plus optionnel.
  const seen = new Map();

  return records.map((record, i) => {
    const base = render(dates[i]);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    const autoLabel = n > 1 ? `${base} (${n})` : base;
    const custom = (record.label || "").trim();
    return {
      ...record,
      autoLabel,
      renamed: custom.length > 0,
      tabLabel: custom ? custom.slice(0, MAX_LABEL) : autoLabel,
    };
  });
}
