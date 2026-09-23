/* FPV OPS — Service Worker
   Zweck: die App startet auch ohne Empfang am Feld.
   Strategie: App-Dateien beim Installieren cachen, danach zuerst aus dem Netz
   holen und bei Fehlschlag auf den Cache zurückfallen. So bekommst du
   Aktualisierungen, ohne offline im Regen zu stehen.
   Bei jeder Änderung an den App-Dateien die VERSION erhöhen. */

const VERSION = "fpv-ops-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/style.css",
  "./assets/js/data.js",
  "./assets/js/app.js",
  "./assets/js/map.js",
  "./assets/js/weather.js",
  "./assets/vendor/leaflet/leaflet.js",
  "./assets/vendor/leaflet/leaflet.css",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Fremde Adressen, etwa die Drohnenkarte, nie abfangen.
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match("./index.html"))
      )
  );
});
