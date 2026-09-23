/* FPV OPS Desktop — Hauptprozess
   Lädt die Web-App aus dem Ordner web/ über ein eigenes Protokoll (app://),
   damit Module und IndexedDB wie im Browser funktionieren. Die Daten liegen im
   Benutzerprofil von Windows (%APPDATA%\FPV OPS), nicht im Programmordner. */

"use strict";

const { app, BrowserWindow, protocol, net, ipcMain, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createSyncServer } = require("./sync-server");

const WEB = path.join(__dirname, "web");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

let win = null;
const pending = new Map();
let seq = 0;

const sync = createSyncServer({
  onRequest: (payload) =>
    new Promise((resolve, reject) => {
      if (!win) return reject(new Error("kein Fenster"));
      const id = ++seq;
      pending.set(id, { resolve, reject });
      win.webContents.send("sync:request", { id: id, payload: payload });
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error("Zeitüberschreitung"));
        }
      }, 60000);
    }),
  onEvent: (e) => win && win.webContents.send("sync:event", e),
});

ipcMain.handle("sync:start", () => sync.start());
ipcMain.handle("sync:stop", () => sync.stop());
ipcMain.on("sync:reply", (_e, msg) => {
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  if (msg.ok) p.resolve(msg.result);
  else p.reject(new Error(msg.error || "Fehler"));
});

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 480,
    backgroundColor: "#08090b",
    autoHideMenuBar: true,
    title: "FPV OPS",
    icon: path.join(WEB, "assets", "icons", "icon-512.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Links nach draussen (Drohnenkarte, Shops) im normalen Browser öffnen.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("app://")) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  win.on("closed", () => {
    sync.stop();
    win = null;
  });
  win.loadURL("app://fpv/index.html");
}

app.whenReady().then(() => {
  protocol.handle("app", (req) => {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname);
    if (!p || p === "/") p = "/index.html";
    const file = path.normalize(path.join(WEB, p));
    if (!file.startsWith(WEB)) return new Response("nicht erlaubt", { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});

app.on("window-all-closed", () => {
  sync.stop();
  app.quit();
});
