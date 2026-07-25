// Stockage 100 % navigateur (IndexedDB). Rien n'est envoyé ni persisté sur le
// serveur : les fichiers analysés vivent uniquement sur la machine du client.
// IndexedDB (et pas localStorage) car un log peut peser plusieurs Mo.

const DB_NAME = "viewlog";
const STORE = "logs";
const VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export function dbGetAll() {
  return run("readonly", (store) => store.getAll()).then((r) => r || []);
}

export function dbGet(id) {
  return run("readonly", (store) => store.get(id));
}

export function dbPut(record) {
  return run("readwrite", (store) => store.put(record));
}

export function dbDelete(id) {
  return run("readwrite", (store) => store.delete(id));
}
