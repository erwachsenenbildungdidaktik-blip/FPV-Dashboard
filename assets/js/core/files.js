/* FPV OPS — Dateien (Bedienungsanleitungen, Bilder) nur auf diesem Gerät.
   Eigene IndexedDB, getrennt von den Datensätzen: Ein PDF mit 20 MB gehört
   nicht in den Backup-Code und nicht in den WLAN-Abgleich. Abgeglichen wird
   nur die Angabe, dass es die Datei gibt (Name, Typ, Grösse, ID). */

const DB = "fpv-ops-files";
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("kein IndexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction("files", mode);
        const r = fn(t.objectStore("files"));
        t.oncomplete = () => resolve(r && "result" in r ? r.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export function putFile(id, blob) {
  return tx("readwrite", (s) => s.put({ id: id, blob: blob }));
}

export function getFile(id) {
  return tx("readonly", (s) => s.get(id)).then((r) => (r ? r.blob : null));
}

export function delFile(id) {
  return tx("readwrite", (s) => s.delete(id));
}
