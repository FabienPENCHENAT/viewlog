// Ce que les chiffres ne disent pas.
//
// Une bande d'identité qui affiche « 1 501 erreurs, 5,8 % » a déjà tout dit de
// combien. Une phrase qui répète « 3 095 lignes, soit 12 % » n'apporte rien : le
// lecteur vient de lire les trois nombres qui la composent. Pour valoir sa place,
// un message doit répondre à la question SUIVANTE.
//
// Celle-ci : ces erreurs sont-elles une rafale ou un bruit de fond ? C'est la
// première chose qu'on veut savoir après leur nombre, aucun compteur ne la donne,
// et elle se calcule sans rien parcourir de neuf, la série temporelle du graphe
// étant déjà en mémoire.
//
// Graine de [04, Smart Insights] du backlog : les prochaines observations du même
// genre se rangeront ici.

// En dessous, la série est trop grossière pour que « la moitié des erreurs » ait
// un sens : sur trois tranches, la réponse est toujours « une tranche ».
const MIN_BUCKETS = 6;

/**
 * Durée dans laquelle tient la moitié des erreurs du fichier.
 *
 * @param {{timeline?:Array, errorCount?:number, timeSpan?:{start:string,end:string}}} stats
 * @returns {{ms:number, share:number}|null} `share` est la part de la période
 *   couverte, donc 0,02 pour « la moitié des erreurs tiennent dans 2 % du temps ».
 */
export function halfErrorsWithin(stats) {
  const timeline = stats?.timeline;
  const errors = stats?.errorCount || 0;
  if (!timeline || timeline.length < MIN_BUCKETS || errors <= 0) return null;
  if (!stats.timeSpan) return null;

  const span = new Date(stats.timeSpan.end) - new Date(stats.timeSpan.start);
  if (!(span > 0)) return null;

  // Largeur d'une tranche : les tranches vides ne sont pas émises, donc on prend
  // le plus petit écart entre deux points et non la moyenne, comme le graphe.
  let bucket = Infinity;
  for (let i = 1; i < timeline.length; i++) {
    const gap = new Date(timeline[i].t) - new Date(timeline[i - 1].t);
    if (gap > 0 && gap < bucket) bucket = gap;
  }
  if (!Number.isFinite(bucket) || bucket <= 0) return null;

  // Combien de tranches, prises des plus chargées aux moins chargées, suffisent
  // à contenir la moitié des erreurs.
  const counts = timeline.map((b) => b.ERROR || 0).sort((a, b) => b - a);
  let seen = 0;
  let used = 0;
  for (const count of counts) {
    if (seen >= errors / 2) break;
    seen += count;
    used += 1;
  }
  if (used === 0) return null;

  const ms = Math.min(span, used * bucket);
  return { ms, share: ms / span };
}
