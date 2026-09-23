/* ==========================================================================
   FPV OPS — Aufnahmen
   Liest Videos und Begleitdateien von der microSD der Air Unit oder der Brille
   ein. Gespeichert werden nur Angaben (Name, Zeit, Länge, Grösse, Quelle, Flug),
   nie das Video selbst: dafür ist der Speicher der App nicht gemacht.
   .srt-Dateien werden geöffnet und auf GPS-Koordinaten geprüft. Damit zeigt die
   App direkt, ob die Drohne ihre Position mitschreibt.
   ========================================================================== */

import { $, uid, h, deDate } from "../core/util.js";

const VIDEO = /\.(mp4|mov|mkv|avi|ts)$/i;

const EDITORS = [
  {
    title: "Gyroflow",
    url: "https://gyroflow.xyz/",
    desc: "Stabilisiert nachträglich mit den Gyro-Daten der Kamera. Die O4 Pro unterstützt das, wenn RockSteady beim Aufnehmen aus ist. Gratis, Windows/Mac/Linux.",
  },
  {
    title: "DaVinci Resolve",
    url: "https://www.blackmagicdesign.com/products/davinciresolve",
    desc: "Professioneller Schnitt und Farbkorrektur, die Grundversion ist gratis. Braucht einen kräftigen Laptop.",
  },
  {
    title: "CapCut",
    url: "https://www.capcut.com/",
    desc: "Schneller Schnitt direkt am Handy oder am PC, mit Vorlagen und Musik. Für kurze Clips am Feld.",
  },
  {
    title: "Shotcut",
    url: "https://shotcut.org/",
    desc: "Schlanker, freier Videoschnitt für Windows. Gut, wenn Resolve zu schwer ist.",
  },
  {
    title: "Kdenlive",
    url: "https://kdenlive.org/",
    desc: "Freier Videoschnitt mit Mehrspur-Timeline, Windows und Linux.",
  },
];

// Bekannte Schreibweisen von Koordinaten in .srt-Dateien, etwa
// "[latitude: 47.1] [longitude: 8.5]" oder "GPS(8.5,47.1,..)" bei DJI-Kameradrohnen.
function findGps(text) {
  const pts = [];
  const re1 = /lat(?:itude)?\s*[:=]\s*(-?\d{1,2}\.\d+)[^\d-]{1,40}?lon(?:gitude)?\s*[:=]\s*(-?\d{1,3}\.\d+)/gi;
  const re2 = /GPS\s*\(\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,2}\.\d+)/gi;
  let m;
  while ((m = re1.exec(text)) && pts.length < 5000) pts.push([Number(m[1]), Number(m[2])]);
  while ((m = re2.exec(text)) && pts.length < 5000) pts.push([Number(m[2]), Number(m[1])]);
  // Nullwerte heissen meist "kein Fix".
  return pts.filter((p) => Math.abs(p[0]) > 0.001 && Math.abs(p[1]) > 0.001 && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180);
}

function localDate(ms) {
  const d = new Date(ms);
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString();
}

function fmtSize(b) {
  if (!b) return "—";
  if (b > 1e9) return (b / 1e9).toFixed(2) + " GB";
  return (b / 1e6).toFixed(0) + " MB";
}

function fmtDur(s) {
  if (!s) return "—";
  s = Math.round(s);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function base(name) {
  return name.replace(/\.[^.]+$/, "").toLowerCase();
}

export function createMedia(ctx) {
  const S = () => ctx.state();
  // Dateien der aktuellen Sitzung, damit "Sichern" ohne erneutes Wählen geht.
  // Sie bleiben nur bis zum Neuladen, gespeichert werden nur die Angaben.
  const session = new Map();

  function duration(file) {
    return new Promise((resolve) => {
      const v = document.createElement("video");
      const url = URL.createObjectURL(file);
      const done = (d) => {
        URL.revokeObjectURL(url);
        resolve(d);
      };
      v.preload = "metadata";
      v.onloadedmetadata = () => done(isFinite(v.duration) ? v.duration : 0);
      v.onerror = () => done(0);
      setTimeout(() => done(0), 8000);
      v.src = url;
    });
  }

  function guessFlight(dateIso, droneId) {
    const day = dateIso.slice(0, 10);
    const f = S().flights.filter((x) => x.date === day && (!droneId || ctx.flightDrone(x) === droneId));
    return f.length ? f[0].id : "";
  }

  function importFiles(files, source) {
    const s = S();
    const list = Array.prototype.slice.call(files);
    const videos = list.filter((f) => VIDEO.test(f.name));
    const srts = list.filter((f) => /\.srt$/i.test(f.name));
    const osds = list.filter((f) => /\.osd$/i.test(f.name));
    const drone = ctx.activeDrone();
    const droneId = drone ? drone.id : "";
    if (!videos.length && !srts.length) return Promise.resolve(ctx.toast("Keine Videos oder .srt-Dateien gewählt"));

    return Promise.all(srts.map((f) => f.text().then((t) => ({ f: f, text: t })))).then((srtTexts) =>
      Promise.all(videos.map((f) => duration(f).then((d) => ({ f: f, d: d })))).then((vids) => {
        let added = 0;
        let gpsFiles = 0;
        const report = [];
        const known = new Set(s.media.map((m) => m.name + "|" + m.size));

        vids.forEach(({ f, d }) => {
          session.set(f.name + "|" + f.size, f);
          if (known.has(f.name + "|" + f.size)) return;
          const srt = srtTexts.find((x) => base(x.f.name) === base(f.name));
          const gps = srt ? findGps(srt.text) : [];
          const rec = localDate(f.lastModified);
          s.media.push({
            id: uid(),
            name: f.name,
            size: f.size,
            recordedAt: rec,
            duration: Math.round(d),
            source: source,
            droneId: droneId,
            flightId: guessFlight(rec, droneId),
            srt: srt ? { name: srt.f.name, hasGps: gps.length > 0, points: gps.length, sample: srt.text.split("\n").slice(0, 12).join("\n") } : null,
            osd: osds.some((o) => base(o.name) === base(f.name)),
            note: "",
          });
          added++;
        });

        srtTexts.forEach((x) => {
          const n = findGps(x.text).length;
          if (n) gpsFiles++;
          report.push(x.f.name + ": " + (n ? n + " GPS-Punkte" : "keine Koordinaten"));
        });

        ctx.save();
        ctx.rerender();
        if (srtTexts.length) {
          showSrtReport(report, gpsFiles, srtTexts);
        } else {
          ctx.toast(added ? added + (added === 1 ? " Aufnahme" : " Aufnahmen") + " eingelesen" : "Alles schon eingelesen");
        }
      })
    );
  }

  function showSrtReport(report, gpsFiles, srtTexts) {
    const sample = srtTexts[0] ? srtTexts[0].text.split("\n").slice(0, 16).join("\n") : "";
    ctx.openDialog(
      gpsFiles ? "GPS in den Aufnahmen gefunden" : "Keine GPS-Daten in den .srt-Dateien",
      (gpsFiles
        ? '<p style="margin-bottom:10px">Die Begleitdateien enthalten Koordinaten. Damit lässt sich der Flugweg auf der Karte zeigen (nächste Etappe).</p>'
        : '<p style="margin-bottom:10px">Die Begleitdateien enthalten keine erkennbaren Koordinaten, vermutlich nur Funk- und Kamerawerte. ' +
          "Der Flugweg müsste dann aus der OSD-Aufzeichnung der Brille oder dem Blackbox-Log kommen.</p>") +
        '<div class="label" style="margin:10px 0 6px">Dateien</div>' +
        '<div class="row__meta">' + report.map(h).join("<br>") + "</div>" +
        (sample
          ? '<div class="label" style="margin:14px 0 6px">Anfang der ersten Datei</div>' +
            '<textarea rows="10" readonly style="font-family:var(--mono);font-size:.7rem">' + h(sample) + "</textarea>" +
            '<p class="row__meta" style="margin:8px 0 0">Wenn du unsicher bist: diesen Ausschnitt kopieren und an Claude schicken.</p>'
          : "")
    );
  }

  /* ------------------------------------------------------------ Sichern */

  function sessionFiles(items) {
    return items.map((m) => session.get(m.name + "|" + m.size)).filter(Boolean);
  }

  function saveFiles(items) {
    const files = sessionFiles(items);
    if (!files.length) return ctx.toast("Dateien zuerst in dieser Sitzung neu wählen");
    if (navigator.canShare && navigator.canShare({ files: files })) {
      return navigator.share({ files: files, title: "FPV-Aufnahmen" }).catch((e) => {
        if (!e || e.name !== "AbortError") download(files);
      });
    }
    download(files);
  }

  function download(files) {
    files.forEach((f, i) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(f);
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 4000);
      }, i * 600)
    );
    ctx.toast(files.length + (files.length === 1 ? " Datei" : " Dateien") + " werden gespeichert");
  }

  /* ------------------------------------------------------------ Ansicht */

  function flightLabel(id) {
    const f = S().flights.find((x) => x.id === id);
    return f ? deDate(f.date) + " · " + (Number(f.minutes) || 0) + " min" : "";
  }

  function render() {
    const s = S();
    const native = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    let out =
      '<div class="section-head"><span class="label label--accent">Karte einlesen</span><span class="section-head__rule"></span></div>' +
      '<div class="card">' +
      '<div class="form-row" style="align-items:flex-end">' +
      '<label class="field"><span class="label">Quelle</span><select id="md-source"><option value="Air Unit">Drohne (Air Unit)</option><option value="Brille">Brille</option></select></label>' +
      '<div class="field"><button class="btn btn--primary btn--block" data-act="md-pick">Dateien wählen</button></div>' +
      "</div>" +
      '<input type="file" id="md-file" multiple accept="video/*,.mp4,.mov,.srt,.osd" hidden>' +
      '<p class="row__meta" style="margin:4px 0 0">Videos und, falls vorhanden, die gleichnamigen <code>.srt</code>-Dateien zusammen wählen. ' +
      "Gespeichert werden nur die Angaben zu den Aufnahmen, nie die Videos selbst.</p></div>";

    /* ---- Liste ---- */
    const list = s.media.slice().sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
    out +=
      '<div class="section-head"><span class="label label--accent">Aufnahmen</span><span class="section-head__rule"></span>' +
      (list.length ? '<button class="btn btn--sm" data-act="md-save-all">Alle sichern</button>' : "") +
      "</div>";
    if (!list.length) out += '<div class="empty">Noch keine Aufnahmen eingelesen.</div>';
    else {
      const flights = s.flights.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      out += '<div class="card card--flush">';
      list.forEach((m) => {
        const inSession = session.has(m.name + "|" + m.size);
        out +=
          '<div class="row"><div class="row__main">' +
          '<div class="row__title">' + h(m.name) + ' <span class="chip">' + h(m.source) + "</span>" +
          (m.srt ? ' <span class="chip ' + (m.srt.hasGps ? "chip--ok" : "") + '">' + (m.srt.hasGps ? "GPS" : "SRT ohne GPS") + "</span>" : "") +
          (m.osd ? ' <span class="chip">OSD</span>' : "") +
          "</div>" +
          '<div class="row__meta">' + deDate(m.recordedAt) + " " + h(String(m.recordedAt).slice(11, 16)) + " · " + fmtDur(m.duration) + " · " + fmtSize(m.size) + "</div>" +
          '<div style="margin-top:6px"><select data-md-flight="' + m.id + '" style="width:auto;max-width:100%;font-size:.75rem;padding:5px 24px 5px 8px">' +
          '<option value="">Keinem Flug zugeordnet</option>' +
          flights.map((f) => '<option value="' + f.id + '"' + (f.id === m.flightId ? " selected" : "") + ">Flug " + h(flightLabel(f.id)) + "</option>").join("") +
          "</select></div></div>" +
          '<div class="row__actions">' +
          (inSession ? '<button class="btn btn--sm" data-act="md-save" data-id="' + m.id + '">Sichern</button>' : "") +
          '<button class="btn btn--sm btn--ghost" data-act="md-del" data-id="' + m.id + '">Entfernen</button>' +
          "</div></div>";
      });
      out += "</div>";
      out +=
        '<p class="row__meta" style="margin:8px 0 0">„Sichern“ geht für Dateien, die du seit dem letzten Öffnen der App gewählt hast. ' +
        (native
          ? "In der Android-App öffnet sich dafür das Teilen-Menü, sofern Android es anbietet. Sonst die Videos mit der Dateien-App vom Kartenleser in den Ordner <em>DCIM</em> oder <em>Movies</em> kopieren, dann erscheinen sie in der Galerie."
          : "Am Handy öffnet sich das Teilen-Menü (etwa „In Fotos speichern“), sonst landen die Dateien im Download-Ordner.") +
        "</p>";
    }

    /* ---- Anleitung ---- */
    out +=
      '<div class="section-head"><span class="label label--accent">So kommt die Karte ans Handy</span><span class="section-head__rule"></span></div>' +
      '<div class="card"><ol class="steps">' +
      "<li>microSD aus der Air Unit (oder der Brille) nehmen und in einen USB-C-Kartenleser stecken, dann ans Handy.</li>" +
      "<li>Android meldet einen USB-Speicher. Oben „Dateien wählen“, im Auswahlfenster links den Kartenleser öffnen. Die Videos liegen meist in einem Ordner unter <em>DCIM</em>.</li>" +
      "<li>Videos und gleichnamige <code>.srt</code> markieren und übernehmen. Die App ordnet sie nach Datum dem Flug zu.</li>" +
      "<li>Sichern, dann erst am Handy prüfen, ob alles angekommen ist. Die Karte formatierst du am besten in der Brille bzw. der Drohne, nicht am Handy.</li>" +
      "</ol></div>";

    /* ---- Schnitt ---- */
    out +=
      '<div class="section-head"><span class="label label--accent">Schnitt</span><span class="section-head__rule"></span></div>' +
      '<div class="card" style="margin-bottom:12px"><p class="row__meta" style="margin:0">Für Gyroflow beim Aufnehmen RockSteady ausschalten, sonst ist das Bild schon digital stabilisiert und die Gyro-Daten passen nicht mehr. ' +
      "Erst stabilisieren, dann schneiden. Originale erst löschen, wenn das fertige Video gesichert ist.</p></div>" +
      '<div class="grid grid--cards">' +
      EDITORS.map(
        (l) =>
          '<a class="linkcard" href="' + h(l.url) + '" target="_blank" rel="noopener">' +
          '<div class="linkcard__title">' + h(l.title) + '<span class="linkcard__arrow">→</span></div>' +
          '<div class="linkcard__desc">' + h(l.desc) + "</div></a>"
      ).join("") +
      "</div>";

    $("#view-media").innerHTML = out;
  }

  /* ------------------------------------------------------------ Aktionen */

  function click(act, el) {
    const s = S();
    switch (act) {
      case "md-pick":
        $("#md-file").click();
        return true;
      case "md-save": {
        const m = s.media.find((x) => x.id === el.dataset.id);
        if (m) saveFiles([m]);
        return true;
      }
      case "md-save-all":
        saveFiles(s.media);
        return true;
      case "md-del":
        s.media = s.media.filter((x) => x.id !== el.dataset.id);
        ctx.save();
        render();
        return true;
    }
    return false;
  }

  function change(ev) {
    if (ev.target.id === "md-file" && ev.target.files && ev.target.files.length) {
      const src = $("#md-source") ? $("#md-source").value : "Air Unit";
      importFiles(ev.target.files, src).finally(() => (ev.target.value = ""));
      return true;
    }
    if (ev.target.dataset && ev.target.dataset.mdFlight) {
      const m = S().media.find((x) => x.id === ev.target.dataset.mdFlight);
      if (m) {
        m.flightId = ev.target.value;
        ctx.save();
        ctx.rerender();
      }
      return true;
    }
    return false;
  }

  function flightSummary(flightId) {
    const clips = S().media.filter((m) => m.flightId === flightId);
    if (!clips.length) return "";
    const secs = clips.reduce((a, m) => a + (m.duration || 0), 0);
    return clips.length + (clips.length === 1 ? " Clip" : " Clips") + (secs ? " " + fmtDur(secs) : "");
  }

  return { render: render, click: click, change: change, flightSummary: flightSummary, findGps: findGps };
}
