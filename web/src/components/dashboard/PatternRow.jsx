// Une ligne de motif, partagée par la vue Motifs et par la comparaison de zone.
//
// Extraite pour que les deux listes ne divergent jamais : même gabarit, même
// alignement, seule la première case change de sens (un nombre d'occurrences
// dans un cas, un rapport de densité dans l'autre).

import { levelColor } from "../../levels.js";

export default function PatternRow({ lead, level, template, second, onClick }) {
  return (
    <button type="button" className="pat-row" onClick={onClick}>
      <span className="pat-count">{lead}</span>
      <span className="level-tag" style={{ "--chip-color": levelColor(level) }}>
        {level}
      </span>
      <span className="pat-body">
        <span className="pat-template">{template}</span>
        <span className="pat-example muted">{second}</span>
      </span>
    </button>
  );
}
