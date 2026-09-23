/* ==========================================================================
   FPV OPS — Datenspeicher
   Jeder Eintrag (ein Akku, ein Flug, der Stand eines Manövers …) ist ein
   eigener Datensatz mit Zeitstempel. So lassen sich zwei Geräte zusammen-
   führen, ohne dass eines das andere überschreibt: pro Datensatz gewinnt die
   neuere Fassung, Gelöschtes hinterlässt eine Markierung.

   Die Ansichten arbeiten weiter mit einem einfachen Objekt `state`. Beim
   Speichern vergleicht commit() es mit dem letzten Stand und schreibt nur,
   was sich geändert hat.

   Abgelegt wird in IndexedDB. Fehlt die, weicht der Speicher auf
   localStorage aus und im Notfall auf den Arbeitsspeicher.
   ========================================================================== */

import { uid, today } from "./util.js";
import { SEED_DRONES, SEED_PARTS, SEED_TASKS } from "./catalog.js";

const DB_NAME = "fpv-ops";
const LEGACY_KEY = "fpv-ops-v1";
const FALLBACK_KEY = "fpv-ops-v2";
export const FORMAT = "fpv-ops";
export const FORMAT_VERSION = 2;

const LISTS = [
  "batteries", "flights", "spots", "cycleLog",
  "drones", "parts", "stockLog", "maintenance", "maintTasks", "bfConfigs",
  "mvCustom", "clCustom", "linkCustom",
];
// Anpassungen an eingebauten Inhalten, nach deren ID abgelegt.
const MAPS = ["training", "checks", "mvEdit", "clEdit", "linkHidden"];

/* ------------------------------------------------------------ Zustand */

export function blankState() {
  return {
    batteries: DEFAULT_BATTERIES.map((b, i) => ({
      // Feste IDs, damit zwei frisch eingerichtete Geräte beim Abgleich nicht
      // denselben Startbestand doppelt anlegen.
      id: "default-bat-" + (i + 1),
      _order: i + 1,
      label: b.label,
      brand: b.brand,
      mah: b.mah,
      cells: b.cells,
      crate: b.crate,
      cyclesBase: 0,
      status: "storage",
      statusSince: today(),
      added: today(),
      notes: "",
    })),
    flights: [],
    spots: [],
    cycleLog: [],
    drones: [],
    parts: [],
    stockLog: [],
    maintenance: [],
    maintTasks: [],
    bfConfigs: [],
    mvCustom: [],
    clCustom: [],
    linkCustom: [],
    training: {},
    checks: {},
    mvEdit: {},
    clEdit: {},
    linkHidden: {},
    settings: { lifespan: 200 },
  };
}

// Zyklen werden nicht als Zahl gespeichert, sondern gezählt: Grundwert aus dem
// Akku-Dialog + Flüge mit diesem Akku + einzeln gebuchte Zyklen. Eine Zahl, die
// auf zwei Geräten je um eins wächst, liesse sich nicht zusammenführen.
export function autoCycles(state, batteryId) {
  let n = 0;
  state.flights.forEach((f) => {
    if ((f.batteryIds || []).indexOf(batteryId) !== -1) n++;
  });
  state.cycleLog.forEach((c) => {
    if (c.batteryId === batteryId) n++;
  });
  return n;
}

// Lagerbestand genauso: Grundwert aus dem Teile-Dialog + alle Zu- und Abgänge,
// minus was bei Flügen (Crash) und Wartungen als verbraucht eingetragen ist.
export function stockMoves(state, partId) {
  let n = 0;
  state.stockLog.forEach((m) => {
    if (m.partId === partId) n += Number(m.delta) || 0;
  });
  const used = (list) =>
    list.forEach((x) =>
      (x.partsUsed || []).forEach((u) => {
        if (u.partId === partId) n -= Number(u.qty) || 0;
      })
    );
  used(state.flights);
  used(state.maintenance);
  return n;
}

export function derive(state) {
  state.batteries.forEach((b) => {
    b.cycles = (Number(b.cyclesBase) || 0) + autoCycles(state, b.id);
  });
  state.parts.forEach((p) => {
    p.stock = Math.max(0, (Number(p.stockBase) || 0) + stockMoves(state, p.id));
  });
  return state;
}

/* ------------------------------------------ Zustand <-> Datensätze */

function key(c, id) {
  return c + "/" + id;
}

// Abgeleitete Werte werden nie gespeichert.
const DERIVED = { batteries: "cycles", parts: "stock" };

function strip(c, x) {
  if (!DERIVED[c]) return x;
  const o = Object.assign({}, x);
  delete o[DERIVED[c]];
  return o;
}

function flatten(state) {
  const out = new Map();
  LISTS.forEach((c) => {
    (state[c] || []).forEach((x) => {
      out.set(key(c, x.id), { c: c, id: x.id, data: strip(c, x) });
    });
  });
  MAPS.forEach((c) => {
    Object.keys(state[c] || {}).forEach((id) => {
      out.set(key(c, id), { c: c, id: id, data: state[c][id] });
    });
  });
  out.set(key("settings", "main"), { c: "settings", id: "main", data: state.settings });
  return out;
}

function unflatten(records) {
  const s = { settings: {} };
  LISTS.forEach((c) => (s[c] = []));
  MAPS.forEach((c) => (s[c] = {}));
  records.forEach((r) => {
    if (r.d || !r.data) return;
    if (LISTS.indexOf(r.c) !== -1) s[r.c].push(clone(r.data));
    else if (MAPS.indexOf(r.c) !== -1) s[r.c][r.id] = clone(r.data);
    else if (r.c === "settings") s.settings = clone(r.data);
  });
  s.settings = Object.assign({ lifespan: 200 }, s.settings);
  // Reihenfolge wie erfasst, damit die Listen nach einem Abgleich nicht springen.
  LISTS.forEach((c) => s[c].sort((a, b) => (a._order || 0) - (b._order || 0)));
  return derive(s);
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

/* ------------------------------------------- Altes Format (v1) */

// Wandelt einen Stand aus localStorage oder einem alten Backup in das neue
// Format. Bisher standen die Zyklen als Zahl im Akku, inklusive der Flüge.
export function fromLegacy(p) {
  if (!p || typeof p !== "object") throw new Error("kein Objekt");
  const b = blankState();
  const s = {
    batteries: Array.isArray(p.batteries) ? p.batteries : b.batteries,
    flights: Array.isArray(p.flights) ? p.flights : [],
    spots: Array.isArray(p.spots) ? p.spots : [],
    cycleLog: [],
    training: p.training && typeof p.training === "object" ? p.training : {},
    checks: p.checks && typeof p.checks === "object" ? p.checks : {},
    settings: Object.assign({ lifespan: 200 }, p.settings || {}),
  };
  const blank = blankState();
  LISTS.forEach((c) => (s[c] = s[c] || blank[c]));
  MAPS.forEach((c) => (s[c] = s[c] || blank[c]));
  s.batteries = s.batteries.map((x) => {
    const o = Object.assign({}, x);
    if (o.cyclesBase == null) {
      let flown = 0;
      s.flights.forEach((f) => {
        if ((f.batteryIds || []).indexOf(o.id) !== -1) flown++;
      });
      o.cyclesBase = Math.max(0, (Number(o.cycles) || 0) - flown);
    }
    delete o.cycles;
    return o;
  });
  return derive(s);
}

export function isLegacy(p) {
  return !(p && p.format === FORMAT);
}

/* ------------------------------------------------------ Ablage */

function idbBackend() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("kein IndexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("records", { keyPath: "k" });
      db.createObjectStore("meta", { keyPath: "key" });
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = (stores, mode, fn) =>
        new Promise((res, rej) => {
          const t = db.transaction(stores, mode);
          const out = fn(t);
          t.oncomplete = () => res(out instanceof IDBRequest ? out.result : undefined);
          t.onerror = () => rej(t.error);
          t.onabort = () => rej(t.error);
        });
      resolve({
        kind: "indexeddb",
        getAll: () => tx(["records"], "readonly", (t) => t.objectStore("records").getAll()),
        put: (recs) =>
          tx(["records"], "readwrite", (t) => {
            const st = t.objectStore("records");
            recs.forEach((r) => st.put(r));
          }),
        clear: () => tx(["records"], "readwrite", (t) => t.objectStore("records").clear()),
        getMeta: (k) =>
          tx(["meta"], "readonly", (t) => t.objectStore("meta").get(k)).then((r) => (r ? r.value : undefined)),
        setMeta: (k, v) => tx(["meta"], "readwrite", (t) => t.objectStore("meta").put({ key: k, value: v })),
      });
    };
  });
}

function localBackend() {
  // Rückfall: alle Datensätze als ein Eintrag in localStorage.
  localStorage.setItem(FALLBACK_KEY + ":probe", "1");
  localStorage.removeItem(FALLBACK_KEY + ":probe");
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(FALLBACK_KEY) || '{"records":{},"meta":{}}');
    } catch (e) {
      return { records: {}, meta: {} };
    }
  };
  const write = (o) => localStorage.setItem(FALLBACK_KEY, JSON.stringify(o));
  return {
    kind: "localstorage",
    getAll: () => Promise.resolve(Object.values(read().records)),
    put: (recs) => {
      const o = read();
      recs.forEach((r) => (o.records[r.k] = r));
      write(o);
      return Promise.resolve();
    },
    clear: () => {
      const o = read();
      o.records = {};
      write(o);
      return Promise.resolve();
    },
    getMeta: (k) => Promise.resolve(read().meta[k]),
    setMeta: (k, v) => {
      const o = read();
      o.meta[k] = v;
      write(o);
      return Promise.resolve();
    },
  };
}

function memoryBackend() {
  const recs = new Map();
  const meta = new Map();
  return {
    kind: "memory",
    getAll: () => Promise.resolve(Array.from(recs.values())),
    put: (list) => {
      list.forEach((r) => recs.set(r.k, r));
      return Promise.resolve();
    },
    clear: () => {
      recs.clear();
      return Promise.resolve();
    },
    getMeta: (k) => Promise.resolve(meta.get(k)),
    setMeta: (k, v) => {
      meta.set(k, v);
      return Promise.resolve();
    },
  };
}

/* ------------------------------------------------------ Speicher */

// Merkt sich die Erfassungsreihenfolge im Eintrag selbst. Die Datenbank liefert
// nach Schlüssel sortiert, und nach einem Abgleich sollen Listen nicht springen.
function stampOrder(state) {
  LISTS.forEach((c) =>
    (state[c] || []).forEach((x) => {
      if (x._order == null) x._order = tick();
    })
  );
}

let backend = null;
let device = "";
let clock = 0;
const recs = new Map(); // k -> Datensatz, inklusive Löschmarkierungen
const snap = new Map(); // k -> JSON der Daten beim letzten commit
let queue = Promise.resolve();

function tick() {
  clock = Math.max(Date.now(), clock + 1);
  return clock;
}

function remember(r) {
  recs.set(r.k, r);
  snap.set(r.k, r.d ? null : JSON.stringify(r.data));
}

function write(list) {
  if (!list.length) return queue;
  queue = queue.then(() => backend.put(list));
  return queue;
}

// Start-Datensätze bekommen den Zeitstempel 1: jede echte Änderung auf einem
// anderen Gerät ist neuer und gewinnt beim Abgleich.
function seed(state, u) {
  stampOrder(state);
  const list = [];
  flatten(state).forEach((v, k) => {
    list.push({ k: k, c: v.c, id: v.id, u: u, dev: device, data: clone(v.data) });
  });
  return list;
}

export function storageKind() {
  return backend ? backend.kind : "memory";
}

export function deviceId() {
  return device;
}

export function open() {
  return idbBackend()
    .catch(() => {
      try {
        return localBackend();
      } catch (e) {
        return memoryBackend();
      }
    })
    .then((b) => {
      backend = b;
      return Promise.all([b.getMeta("device"), b.getMeta("migrated"), b.getAll()]);
    })
    .then(([dev, migrated, all]) => {
      device = dev || uid();
      const jobs = [];
      if (!dev) jobs.push(backend.setMeta("device", device));
      all.forEach((r) => {
        remember(r);
        clock = Math.max(clock, r.u || 0);
      });

      if (!all.length) {
        let legacy = null;
        if (!migrated) {
          try {
            const raw = localStorage.getItem(LEGACY_KEY);
            if (raw) legacy = fromLegacy(JSON.parse(raw));
          } catch (e) {
            console.warn("Alter Speicher nicht lesbar.", e);
          }
        }
        // Übernommene Daten sind echte Daten und bekommen die aktuelle Zeit.
        const list = legacy ? seed(legacy, tick()) : seed(blankState(), 1);
        list.forEach(remember);
        jobs.push(write(list));
        // Der alte Eintrag bleibt als Sicherheitskopie liegen, wird aber nie
        // wieder eingelesen.
        jobs.push(backend.setMeta("migrated", 1));
      }
      jobs.push(write(seedCatalog()));
      return Promise.all(jobs);
    })
    .then(() => unflatten(recs));
}

// Legt Katalogteile und die Startdrohne an, falls es sie auf diesem Gerät noch
// nie gab. Feste IDs und Zeitstempel 1: kein Doppel beim Abgleich, jede eigene
// Änderung gewinnt, und ein gelöschter Eintrag kommt nicht zurück, weil seine
// Löschmarkierung liegen bleibt.
function seedCatalog() {
  const list = [];
  const add = (c, x) => {
    const k = key(c, x.id);
    if (recs.has(k)) return;
    list.push({ k: k, c: c, id: x.id, u: 1, dev: "seed", data: clone(x) });
  };
  SEED_DRONES.forEach((d) => add("drones", d));
  SEED_PARTS.forEach((p) => add("parts", p));
  SEED_TASKS.forEach((t) => add("maintTasks", t));
  list.forEach(remember);
  return list;
}

// Speichert, was sich seit dem letzten Aufruf geändert hat.
export function commit(state) {
  derive(state);
  stampOrder(state);
  const now = flatten(state);
  const list = [];
  now.forEach((v, k) => {
    const json = JSON.stringify(v.data);
    if (snap.get(k) === json) return;
    list.push({ k: k, c: v.c, id: v.id, u: tick(), dev: device, data: JSON.parse(json) });
  });
  snap.forEach((json, k) => {
    if (json === null || now.has(k)) return;
    const old = recs.get(k);
    list.push({ k: k, c: old.c, id: old.id, u: tick(), dev: device, d: 1 });
  });
  list.forEach(remember);
  return write(list);
}

/* ------------------------------------------------ Zusammenführen */

export function exportPayload() {
  return {
    format: FORMAT,
    v: FORMAT_VERSION,
    device: device,
    at: new Date().toISOString(),
    records: Array.from(recs.values()),
  };
}

function newer(a, b) {
  if (a.u !== b.u) return a.u > b.u;
  // Gleicher Zeitstempel: fest entscheiden, damit beide Geräte gleich wählen.
  return JSON.stringify(a) > JSON.stringify(b);
}

// Trainingsnotizen, die auf beiden Geräten zum selben Manöver erfasst wurden,
// sollen beide erhalten bleiben.
function mergeTraining(win, lose) {
  if (win.d || lose.d || !win.data || !lose.data) return null;
  const seen = new Set();
  const log = [];
  (win.data.log || []).concat(lose.data.log || []).forEach((e) => {
    const k = JSON.stringify([e.date, e.ok, e.issue]);
    if (seen.has(k)) return;
    seen.add(k);
    log.push(e);
  });
  log.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (log.length === (win.data.log || []).length) return null;
  return Object.assign({}, win.data, { log: log });
}

function checkRecord(r) {
  return (
    r && typeof r === "object" &&
    (LISTS.indexOf(r.c) !== -1 || MAPS.indexOf(r.c) !== -1 || (r.c === "settings" && r.id === "main")) &&
    typeof r.id === "string" &&
    typeof r.u === "number" && (r.d || (r.data && typeof r.data === "object"))
  );
}

// Führt Datensätze eines anderen Geräts oder Backups ein. Gibt den neuen
// Zustand und die Zahl der übernommenen Änderungen zurück.
export function merge(payload) {
  const incoming = isLegacy(payload)
    ? seed(fromLegacy(payload), tick())
    : (payload.records || []).filter(checkRecord).map((r) => Object.assign({}, r, { k: key(r.c, r.id) }));

  const list = [];
  incoming.forEach((r) => {
    const mine = recs.get(r.k);
    if (!mine) return list.push(r);
    if (JSON.stringify(mine) === JSON.stringify(r)) return;
    const win = newer(r, mine) ? r : mine;
    const lose = win === r ? mine : r;
    if (r.c === "training") {
      const data = mergeTraining(win, lose);
      if (data) return list.push({ k: r.k, c: r.c, id: r.id, u: tick(), dev: device, data: data });
    }
    if (win === r) list.push(r);
  });

  list.forEach(remember);
  clock = Math.max(clock, ...list.map((r) => r.u || 0));
  return write(list).then(() => ({ state: unflatten(recs), changed: list.length }));
}

// Löscht alles auf diesem Gerät, ohne Löschmarkierungen: ein späterer Abgleich
// holt die Daten vom anderen Gerät zurück, statt sie dort auch zu löschen.
export function reset() {
  recs.clear();
  snap.clear();
  const list = seed(blankState(), 1);
  list.forEach(remember);
  list.push.apply(list, seedCatalog());
  queue = queue.then(() => backend.clear());
  return write(list).then(() => unflatten(recs));
}
