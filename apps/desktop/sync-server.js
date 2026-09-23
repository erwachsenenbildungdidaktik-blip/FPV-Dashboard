/* FPV OPS Desktop — Abgleich-Server im WLAN
   Läuft nur, solange im Programm "Abgleich mit Handy" offen ist. Das Handy
   schickt seinen Datenstand mit dem sechsstelligen Code aus dem QR-Code, der
   Laptop führt zusammen und antwortet mit seinem Stand. Danach haben beide
   Geräte dasselbe. Keine Cloud, kein Internet nötig. */

"use strict";

const http = require("node:http");
const os = require("node:os");
const crypto = require("node:crypto");

const DEFAULT_PORT = 47800;
const MAX_BODY = 50 * 1024 * 1024;
const MAX_WRONG = 5;

function lanAddresses() {
  const out = [];
  const ifs = os.networkInterfaces();
  Object.keys(ifs).forEach((name) => {
    (ifs[name] || []).forEach((a) => {
      if (a.family === "IPv4" && !a.internal) out.push(a.address);
    });
  });
  // Übliche Heimnetze und Handy-Hotspots zuerst.
  const rank = (ip) => (/^192\.168\./.test(ip) ? 0 : /^10\./.test(ip) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return out.sort((a, b) => rank(a) - rank(b));
}

function sameToken(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function createSyncServer(opts) {
  const onRequest = opts.onRequest; // (payload) => Promise<{ payload, changed }>
  const onEvent = opts.onEvent || function () {};
  let server = null;
  let token = "";
  let wrong = 0;

  function send(res, code, obj) {
    res.writeHead(code, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Private-Network": "true",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(obj));
  }

  function handle(req, res) {
    if (req.method === "OPTIONS") return send(res, 204, {});
    const url = new URL(req.url, "http://x");

    if (req.method === "GET" && url.pathname === "/ping") {
      if (!sameToken(url.searchParams.get("t"), token)) return reject(res);
      return send(res, 200, { ok: true, app: "fpv-ops" });
    }

    if (req.method !== "POST" || url.pathname !== "/sync") return send(res, 404, { ok: false, error: "unbekannt" });

    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        send(res, 413, { ok: false, error: "zu gross" });
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (res.writableEnded) return;
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch (e) {
        return send(res, 400, { ok: false, error: "kein JSON" });
      }
      if (!sameToken(body.t, token)) return reject(res);
      wrong = 0;
      onEvent({ type: "request" });
      Promise.resolve()
        .then(() => onRequest(body.payload))
        .then(
          (r) => {
            send(res, 200, { ok: true, payload: r.payload, changed: r.changed });
            onEvent({ type: "done", changed: r.changed });
          },
          (e) => {
            send(res, 500, { ok: false, error: String((e && e.message) || e) });
            onEvent({ type: "error", error: String(e) });
          }
        );
    });
  }

  function reject(res) {
    wrong++;
    send(res, 403, { ok: false, error: "falscher Code" });
    onEvent({ type: "wrong", count: wrong });
    // Wer rät, bekommt nicht beliebig viele Versuche.
    if (wrong >= MAX_WRONG) stop();
  }

  function listen(port) {
    return new Promise((resolve, reject) => {
      const s = http.createServer(handle);
      s.once("error", reject);
      s.listen(port, "0.0.0.0", () => resolve(s));
    });
  }

  function start() {
    stop();
    token = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    wrong = 0;
    return listen(DEFAULT_PORT)
      .catch(() => listen(0))
      .then((s) => {
        server = s;
        return { port: s.address().port, token: token, hosts: lanAddresses() };
      });
  }

  function stop() {
    if (server) {
      server.close();
      server.closeAllConnections && server.closeAllConnections();
      server = null;
      onEvent({ type: "stopped" });
    }
    token = "";
  }

  return { start: start, stop: stop, running: () => !!server };
}

module.exports = { createSyncServer: createSyncServer, lanAddresses: lanAddresses };
