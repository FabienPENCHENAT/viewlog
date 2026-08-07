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

// Pas de `getAll()` ici, volontairement : il rendrait les enregistrements
// entiers, contenus compris, et c'est exactement le défaut que `dbListMeta`
// corrige. Une lecture de contenu se fait par `dbGet`, un fichier à la fois.

// Champs recopiés par `dbListMeta`. Tout ce qui n'est pas là reste sur le disque,
// et `content` en particulier ne doit JAMAIS entrer dans cette liste.
const META_FIELDS = ["id", "name", "label", "hue", "order", "size", "importedAt", "meta"];

/**
 * Les métadonnées de tous les logs, sans leur contenu.
 *
 * `getAll()` rend les enregistrements ENTIERS : afficher la liste des fichiers
 * récents, ou rafraîchir la barre d'onglets, faisait donc monter en mémoire le
 * contenu des cinq logs stockés pour y lire cinq nombres. Sur des fichiers de
 * 200 Mo, cela fait un giga-octet matérialisé d'un coup, à chaque changement
 * d'onglet, sans même ouvrir un log.
 *
 * Le curseur ne tient qu'un enregistrement à la fois, et on n'en recopie que les
 * champs utiles : le pic tombe à un contenu au lieu de cinq, et il est
 * immédiatement collectable.
 */
export function dbListMeta() {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const out = [];
        const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) {
            resolve(out);
            return;
          }
          const record = cursor.value;
          const light = {};
          for (const field of META_FIELDS) light[field] = record[field];
          out.push(light);
          cursor.continue();
        };
        req.onerror = () => reject(req.error);
      })
  );
}

/**
 * Modifie quelques champs d'un enregistrement, sans jamais le reconstruire.
 *
 * Indispensable depuis que la liste est allégée : écrire un objet de
 * métadonnées avec `dbPut` remplacerait l'enregistrement entier et
 * **effacerait son contenu**. Ici la lecture et l'écriture se font dans la même
 * transaction, donc personne ne peut se glisser entre les deux.
 */
export function dbPatch(id, fields) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const store = db.transaction(STORE, "readwrite").objectStore(STORE);
        const get = store.get(id);
        get.onerror = () => reject(get.error);
        get.onsuccess = () => {
          const record = get.result;
          if (!record) {
            resolve(false);
            return;
          }
          Object.assign(record, fields);
          const put = store.put(record);
          put.onsuccess = () => resolve(true);
          put.onerror = () => reject(put.error);
        };
      })
  );
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
