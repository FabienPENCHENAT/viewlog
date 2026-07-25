// Lance le parsing dans un Web Worker et renvoie une promesse.
// withEntries=false → ne renvoie que les métadonnées (upload) ;
// withEntries=true  → renvoie aussi les entrées parsées (dashboard).
export function parseAsync(content, withEntries = true) {
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
    worker.postMessage({ content, withEntries });
  });
}
