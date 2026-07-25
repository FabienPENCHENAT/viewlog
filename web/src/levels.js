// Couleurs par niveau. L'identité ne repose jamais sur la couleur seule :
// chaque niveau est toujours accompagné de son libellé (axe, chip, légende).
export const LEVEL_COLORS = {
  TRACE: "#898781", // gris muted
  DEBUG: "#3987e5", // bleu
  INFO: "#1baf7a", // aqua
  WARN: "#fab219", // warning
  ERROR: "#d03b3b", // critical
  FATAL: "#4a3aa7", // violet (sévère)
  OTHER: "#c3c2b7", // gris clair
};

export function levelColor(level) {
  return LEVEL_COLORS[level] || LEVEL_COLORS.OTHER;
}
