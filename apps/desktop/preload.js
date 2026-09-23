/* FPV OPS Desktop — Brücke zwischen Web-App und Hauptprozess.
   Die Web-App erkennt das Programm an window.fpvDesktop. */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fpvDesktop", {
  startSync: () => ipcRenderer.invoke("sync:start"),
  stopSync: () => ipcRenderer.invoke("sync:stop"),
  // handler(payload) -> Promise<{ payload, changed }>
  onSyncRequest: (handler) => {
    ipcRenderer.removeAllListeners("sync:request");
    ipcRenderer.on("sync:request", (_e, msg) => {
      Promise.resolve()
        .then(() => handler(msg.payload))
        .then(
          (result) => ipcRenderer.send("sync:reply", { id: msg.id, ok: true, result: result }),
          (err) => ipcRenderer.send("sync:reply", { id: msg.id, ok: false, error: String((err && err.message) || err) })
        );
    });
  },
  onSyncEvent: (handler) => {
    ipcRenderer.removeAllListeners("sync:event");
    ipcRenderer.on("sync:event", (_e, ev) => handler(ev));
  },
});
