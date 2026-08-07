// Lance le parsing dans un Web Worker et renvoie une promesse.
//
// ⚠️ LES OCTETS SONT TRANSFÉRÉS. L'`ArrayBuffer` passé ici est détaché aussitôt :
// l'appelant ne doit plus s'en servir après l'appel. C'est le prix, assumé, de ne
// jamais dupliquer un fichier de 500 Mo. Les octets reviennent dans la réponse,
// transférés de la même façon.
//
// `withPeaks=false` sur un simple import : on n'a besoin que des métadonnées, et
// la détection des zones ne sert qu'au dashboard.
export function parseAsync(bytes, withPeaks = true) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../parser.worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };
    worker.postMessage({ bytes, withPeaks }, [bytes]);
  });
}
