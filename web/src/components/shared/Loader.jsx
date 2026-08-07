// L'attente, et c'est le logo qui la joue.
//
// Le logo de ViewLog est une pile de lignes de log dont une en ambre, « l'entrée
// mise en évidence ». Le loader ne fait que la mettre en mouvement : une ligne
// entre par le bas, celle du haut s'en va. Quand le travail se termine, plus rien
// n'entre et la pile finit de sortir.
//
// TROIS RÈGLES TIENNENT CE FICHIER.
//
// 1. LA COURSE D'UN CYCLE VAUT LA PÉRIODE DES LARGEURS. Une boucle qui translate
//    d'un seul pas ramène une ligne courte à la place d'une longue, et ça saute à
//    chaque tour. Douze largeurs, donc une course de douze pas : le cycle dure
//    près de huit secondes et l'œil ne retrouve plus le début.
//
// 2. L'AMBRE RESTE UNE LIGNE SUR QUATRE, comme dans le logo. La fenêtre ne montre
//    que quatre lignes et demie : l'espacer davantage laisserait l'icône sans
//    couleur pendant des secondes, donc sans son signe distinctif.
//
// 3. LES BORDS SONT ESTOMPÉS. Une ligne se révèle en entrant et s'efface en
//    sortant, au lieu de surgir et d'être coupée net.
//
// Que des `div` : aucune image, aucun SVG, aucune dépendance. La géométrie du logo
// est exprimée en pourcentages du carré (lignes de 13 % de haut, un pas de 22 %,
// la première à 10,5 %, marge de 10 % à gauche), donc une seule variable de taille
// suffit et le rendu reste net à n'importe quelle dimension.

// Douze largeurs, en pourcentage du carré. Écrites à la main plutôt que tirées au
// hasard, pour éviter ce qu'un tirage produit de laid : deux voisines de longueur
// presque égale, qui passent pour un défaut d'affichage, et les rampes régulières,
// qui se remarquent comme un motif. Les quatre largeurs du logo (74, 50, 84, 44)
// sont dedans.
const WIDTHS = [74, 46, 84, 38, 62, 52, 90, 30, 68, 44, 80, 56];

const AMBER_EVERY = 4;
const AMBER_OFFSET = 2; // la troisième ligne est ambre, comme dans le logo

// Assez de lignes pour couvrir la course ET la hauteur visible : à la fin du
// cycle, la fenêtre montre déjà les lignes suivantes.
const LINES = WIDTHS.length + 5;

const bars = Array.from({ length: LINES }, (_, i) => ({
  i,
  w: WIDTHS[i % WIDTHS.length],
  amber: i % AMBER_EVERY === AMBER_OFFSET,
}));

/**
 * @param {object} props
 * @param {number} [props.size] côté du carré, en pixels
 * @param {string} [props.label] texte à côté (en ligne) ou en dessous (en bloc)
 * @param {boolean} [props.block] disposition verticale, pour une grande attente
 */
export default function Loader({ size = 40, label, block = false }) {
  const icon = (
    <span className="loader" style={{ "--loader-size": `${size}px` }} aria-hidden="true">
      <span className="loader-roll">
        {bars.map((b) => (
          <i
            key={b.i}
            className={b.amber ? "loader-bar loader-bar--amber" : "loader-bar"}
            style={{ "--i": b.i, "--w": b.w }}
          />
        ))}
      </span>
    </span>
  );

  // `role="status"` sans `aria-live` agressif : l'attente est annoncée une fois,
  // et l'icône est cachée aux lecteurs d'écran puisqu'elle ne dit rien de plus
  // que le texte.
  return (
    <span className={block ? "loader-wrap loader-wrap--block" : "loader-wrap"} role="status">
      {icon}
      {label && <span className="loader-label">{label}</span>}
    </span>
  );
}
