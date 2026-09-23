/* ==========================================================================
   FPV OPS — Abgleich Handy <-> Laptop im WLAN
   Windows-Programm: startet einen kleinen Server und zeigt einen QR-Code mit
   Adresse und Einmal-Code. Android-App: scannt den Code und schickt ihren
   Stand; der Laptop führt zusammen und antwortet mit seinem Stand, den das Handy
   ebenfalls zusammenführt. Danach sind beide gleich.
   Im Browser geht das nicht: eine Seite von github.io darf keine Geräte im
   Heimnetz ansprechen.
   ========================================================================== */

import { $, h } from "../core/util.js";
import qrcode from "../../vendor/qrcode/qrcode.mjs";

const RELEASES = "https://github.com/erwachsenenbildungdidaktik-blip/FPV-Dashboard/releases/tag/apps-latest";

export function mode() {
  if (window.fpvDesktop) return "desktop";
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return "mobile";
  return "web";
}

export function createSync(ctx) {
  let running = false;
  let scanStop = null;

  function status(msg, cls) {
    const el = $("#sync-status");
    if (!el) return;
    el.textContent = msg;
    el.style.color = cls === "bad" ? "var(--bad)" : cls === "ok" ? "var(--ok)" : "";
  }

  function changedText(n) {
    return n ? n + (n === 1 ? " Eintrag" : " Einträge") : "nichts Neues";
  }

  /* ------------------------------------------------------------ Laptop */

  if (mode() === "desktop") {
    window.fpvDesktop.onSyncRequest((payload) =>
      ctx.applyPayload(payload).then((changed) => ({ payload: ctx.exportPayload(), changed: changed }))
    );
    window.fpvDesktop.onSyncEvent((e) => {
      if (e.type === "request") status("Handy verbunden, gleiche ab …");
      if (e.type === "done") {
        status("Abgeglichen: hier " + changedText(e.changed) + " übernommen.", "ok");
        ctx.toast("Abgleich mit Handy fertig");
      }
      if (e.type === "wrong") status("Falscher Code vom Handy (" + e.count + "/5).", "bad");
      if (e.type === "error") status("Fehler: " + e.error, "bad");
      if (e.type === "stopped") running = false;
    });
    const dlg = document.getElementById("dlg");
    dlg.addEventListener("close", () => {
      if (running) window.fpvDesktop.stopSync();
      running = false;
    });
  }

  function desktopDialog() {
    ctx.openDialog(
      "Abgleich mit Handy",
      '<div id="sync-box"><div class="empty">Starte …</div></div>' +
        '<p id="sync-status" class="row__meta" style="margin:12px 0 0"></p>',
      '<button type="button" class="btn" data-act="sync-stop">Beenden</button>'
    );
    window.fpvDesktop.startSync().then(
      (info) => {
        running = true;
        const data = JSON.stringify({ fpv: 1, h: info.hosts, p: info.port, t: info.token });
        const qr = qrcode(0, "M");
        qr.addData(data);
        qr.make();
        const addr = info.hosts.length ? info.hosts.map((x) => x + ":" + info.port).join(" oder ") : "keine Netzwerkadresse gefunden";
        $("#sync-box").innerHTML =
          '<div style="background:#fff;padding:12px;border-radius:10px;max-width:280px;margin:0 auto">' +
          qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }) +
          "</div>" +
          '<div style="text-align:center;margin-top:12px"><div class="label">Code</div>' +
          '<div class="mono" style="font-size:1.6rem;font-weight:700;letter-spacing:.2em">' + h(info.token) + "</div>" +
          '<div class="row__meta">Adresse: ' + h(addr) + "</div></div>" +
          '<p class="row__meta" style="margin:12px 0 0">In der Android-App unter <em>Backup → Mit Laptop abgleichen</em> den QR-Code scannen. ' +
          "Handy und Laptop müssen im selben WLAN sein; unterwegs den Laptop mit dem Hotspot des Handys verbinden. " +
          "Fragt Windows beim ersten Mal nach dem Netzwerkzugriff: für private Netzwerke erlauben.</p>";
        status("Wartet auf das Handy …");
      },
      (e) => {
        $("#sync-box").innerHTML = '<div class="banner">Abgleich liess sich nicht starten: ' + h(String((e && e.message) || e)) + "</div>";
      }
    );
  }

  /* ------------------------------------------------------------ Handy */

  function mobileDialog() {
    ctx.openDialog(
      "Mit Laptop abgleichen",
      '<p class="row__meta" style="margin:0 0 12px">Am Laptop im Programm FPV OPS unter <em>Backup → Abgleich mit Handy</em> den QR-Code anzeigen, dann hier scannen.</p>' +
        '<div id="scan-box" style="margin-bottom:12px"></div>' +
        '<button type="button" class="btn btn--primary btn--block" data-act="sync-scan">QR-Code scannen</button>' +
        '<div class="label" style="margin:16px 0 7px">Oder von Hand</div>' +
        '<div class="form-row">' +
        '<label class="field"><span class="label">Adresse</span><input type="text" id="sync-host" inputmode="decimal" placeholder="192.168.1.20:47800"></label>' +
        '<label class="field"><span class="label">Code</span><input type="text" id="sync-code" inputmode="numeric" maxlength="6" placeholder="123456"></label>' +
        "</div>" +
        '<button type="button" class="btn btn--block" data-act="sync-manual">Abgleichen</button>' +
        '<p id="sync-status" class="row__meta" style="margin:12px 0 0"></p>'
    );
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("Zeitüberschreitung")), ms))]);
  }

  function reachable(hosts, port, token) {
    // Alle Adressen gleichzeitig anpingen, die erste Antwort gewinnt.
    return new Promise((resolve, reject) => {
      let left = hosts.length;
      if (!left) return reject(new Error("keine Adresse"));
      hosts.forEach((host) => {
        withTimeout(fetch("http://" + host + ":" + port + "/ping?t=" + encodeURIComponent(token)), 4000)
          .then((r) => (r.ok ? resolve(host) : Promise.reject(new Error(r.status === 403 ? "falscher Code" : "HTTP " + r.status))))
          .catch((e) => {
            if (--left === 0) reject(e);
          });
      });
    });
  }

  function runSync(hosts, port, token) {
    stopScan();
    status("Suche den Laptop …");
    return reachable(hosts, port, token)
      .then((host) => {
        status("Verbunden mit " + host + ", gleiche ab …");
        return withTimeout(
          fetch("http://" + host + ":" + port + "/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ t: token, payload: ctx.exportPayload() }),
          }),
          60000
        );
      })
      .then((r) => r.json().then((j) => (r.ok && j.ok ? j : Promise.reject(new Error(j.error || "HTTP " + r.status)))))
      .then((j) => ctx.applyPayload(j.payload).then((here) => ({ here: here, there: j.changed })))
      .then((res) => {
        status("Fertig. Hier " + changedText(res.here) + ", am Laptop " + changedText(res.there) + " übernommen.", "ok");
        ctx.toast("Abgleich mit Laptop fertig");
      })
      .catch((e) => {
        const m = String((e && e.message) || e);
        status(
          m === "falscher Code"
            ? "Falscher Code. Am Laptop einen neuen QR-Code anzeigen."
            : "Laptop nicht erreichbar (" + m + "). Selbes WLAN? Abgleich am Laptop offen? Windows-Firewall für private Netzwerke erlaubt?",
          "bad"
        );
      });
  }

  function parseCode(text) {
    try {
      const o = JSON.parse(text);
      if (o && o.fpv === 1 && Array.isArray(o.h) && o.p && o.t) return o;
    } catch (e) {}
    return null;
  }

  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "./assets/vendor/jsqr/jsQR.js";
      s.onload = () => resolve(window.jsQR);
      s.onerror = () => reject(new Error("Scanner nicht geladen"));
      document.head.appendChild(s);
    });
  }

  function stopScan() {
    if (scanStop) scanStop();
    scanStop = null;
  }

  function scan() {
    const box = $("#scan-box");
    if (!box) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return status("Keine Kamera verfügbar. Adresse und Code von Hand eingeben.", "bad");
    }
    stopScan();
    box.innerHTML =
      '<video id="scan-video" playsinline muted style="width:100%;border-radius:10px;background:#000"></video>' +
      '<canvas id="scan-canvas" hidden></canvas>';
    status("Kamera auf den QR-Code am Laptop richten …");
    let stream = null;
    let alive = true;
    scanStop = () => {
      alive = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const b = $("#scan-box");
      if (b) b.innerHTML = "";
    };
    Promise.all([loadJsQR(), navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })])
      .then(([jsQR, s]) => {
        stream = s;
        if (!alive) return stopScan();
        const video = $("#scan-video");
        const canvas = $("#scan-canvas");
        const g = canvas.getContext("2d", { willReadFrequently: true });
        video.srcObject = s;
        video.play();
        const tick = () => {
          if (!alive) return;
          if (video.readyState >= 2 && video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            g.drawImage(video, 0, 0);
            const img = g.getImageData(0, 0, canvas.width, canvas.height);
            const res = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            const code = res && parseCode(res.data);
            if (code) return runSync(code.h, code.p, code.t);
          }
          requestAnimationFrame(tick);
        };
        tick();
      })
      .catch((e) => {
        stopScan();
        status("Kamera nicht verfügbar (" + String((e && e.message) || e) + "). Adresse und Code von Hand eingeben.", "bad");
      });
  }

  function manual() {
    const raw = ($("#sync-host").value || "").trim();
    const code = ($("#sync-code").value || "").trim();
    const m = /^([\w.-]+)(?::(\d+))?$/.exec(raw);
    if (!m || !/^\d{6}$/.test(code)) return status("Adresse wie 192.168.1.20:47800 und den sechsstelligen Code eingeben.", "bad");
    runSync([m[1]], Number(m[2] || 47800), code);
  }

  /* ------------------------------------------------------------ Einstieg */

  function section() {
    const m = mode();
    if (m === "desktop")
      return (
        '<p style="margin-bottom:8px"><strong>Abgleich mit Handy</strong> im selben WLAN, ohne Datei.</p>' +
        '<button type="button" class="btn btn--primary" data-act="sync-open" style="margin-bottom:16px">Abgleich mit Handy</button>'
      );
    if (m === "mobile")
      return (
        '<p style="margin-bottom:8px"><strong>Mit Laptop abgleichen</strong> im selben WLAN, ohne Datei.</p>' +
        '<button type="button" class="btn btn--primary" data-act="sync-open" style="margin-bottom:16px">Mit Laptop abgleichen</button>'
      );
    return (
      '<p class="row__meta" style="margin:0 0 14px">Direkter Abgleich per WLAN und QR-Code geht nur zwischen Android-App und Windows-Programm. ' +
      'Im Browser bleibt der Backup-Code. <a href="' + RELEASES + '" target="_blank" rel="noopener">Android-App und Windows-Programm herunterladen</a></p>'
    );
  }

  function click(act) {
    switch (act) {
      case "sync-open":
        return mode() === "desktop" ? desktopDialog() : mobileDialog(), true;
      case "sync-stop":
        if (running) window.fpvDesktop.stopSync();
        running = false;
        ctx.closeDialog();
        return true;
      case "sync-scan":
        return scan(), true;
      case "sync-manual":
        return manual(), true;
    }
    return false;
  }

  document.getElementById("dlg").addEventListener("close", stopScan);

  return { section: section, click: click, mode: mode };
}
