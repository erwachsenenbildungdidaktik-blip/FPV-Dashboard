/* ==========================================================================
   FPV OPS — Logik und Ansichten
   Daten liegen ausschliesslich auf diesem Gerät (siehe core/store.js).
   Backup läuft über einen Backup-Code zum Teilen oder als Datei und führt
   beim Einlesen zusammen, statt zu überschreiben.
   ========================================================================== */

import { $, $$, uid, h, today, deDate, daysSince, fmtMin } from "./core/util.js";
import * as store from "./core/store.js";
import { encodeBackup, decodeBackup } from "./core/backup.js";
import { createWorkshop } from "./views/workshop.js";
import { createContent } from "./views/content.js";
import { createSync } from "./views/sync.js";
import { createMedia } from "./views/media.js";

(function () {
  "use strict";

  // Nur noch für Kleinigkeiten pro Gerät, etwa den zuletzt offenen Reiter.
  const KEY = "fpv-ops-v1";

  let state;

  function save() {
    store.commit(state).catch(function (e) {
      console.warn("Speichern fehlgeschlagen.", e);
      toast("Speichern fehlgeschlagen — Browserspeicher blockiert?");
    });
    return true;
  }

  const workshop = createWorkshop({
    state: () => state,
    save: save,
    openDialog: (t, b, f) => openDialog(t, b, f),
    closeDialog: () => closeDialog(),
    toast: (m) => toast(m),
    rerender: () => renderAll(),
  });

  const content = createContent({
    state: () => state,
    save: save,
    openDialog: (t, b, f) => openDialog(t, b, f),
    closeDialog: () => closeDialog(),
    toast: (m) => toast(m),
    rerender: () => renderAll(),
  });

  const sync = createSync({
    applyPayload: (p) => applyBackup(p),
    exportPayload: () => store.exportPayload(),
    openDialog: (t, b, f) => openDialog(t, b, f),
    closeDialog: () => closeDialog(),
    toast: (m) => toast(m),
  });

  const media = createMedia({
    state: () => state,
    save: save,
    openDialog: (t, b, f) => openDialog(t, b, f),
    closeDialog: () => closeDialog(),
    toast: (m) => toast(m),
    rerender: () => renderAll(),
    activeDrone: () => workshop.activeDrone(),
    flightDrone: (f) => workshop.flightDrone(f),
  });

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("is-on"), 2200);
  }

  /* ------------------------------------------------------- Berechnungen */

  function allManeuvers() {
    return content.allManeuvers();
  }

  function mvState(id) {
    return state.training[id] || { status: "todo", attempts: 0, log: [] };
  }

  function levelStats(level) {
    let done = 0,
      wip = 0;
    level.maneuvers.forEach((m) => {
      const s = mvState(m.id).status;
      if (s === "done") done++;
      else if (s === "wip") wip++;
    });
    return { done: done, wip: wip, total: level.maneuvers.length };
  }

  function stats() {
    const f = state.flights;
    const minutes = f.reduce((a, x) => a + (Number(x.minutes) || 0), 0);
    const speeds = f.map((x) => Number(x.maxSpeed) || 0);
    const alts = f.map((x) => Number(x.maxAlt) || 0);
    const cycles = state.batteries.reduce((a, b) => a + (Number(b.cycles) || 0), 0);
    const mv = allManeuvers();
    const done = mv.filter((m) => mvState(m.id).status === "done").length;
    return {
      minutes: minutes,
      flights: f.length,
      avg: f.length ? minutes / f.length : 0,
      topSpeed: speeds.length ? Math.max.apply(null, speeds) : 0,
      maxAlt: alts.length ? Math.max.apply(null, alts) : 0,
      cycles: cycles,
      crashes: f.filter((x) => x.crash).length,
      mvDone: done,
      mvTotal: mv.length,
      spots: state.spots.length,
    };
  }

  function spotName(id) {
    const s = state.spots.find((x) => x.id === id);
    return s ? s.name : "—";
  }

  function batteryLabel(id) {
    const b = state.batteries.find((x) => x.id === id);
    return b ? b.label : "?";
  }

  function batteryHealth(b) {
    const life = Number(state.settings.lifespan) || 200;
    const pct = Math.min(100, Math.round(((Number(b.cycles) || 0) / life) * 100));
    let cls = "bar__fill--ok";
    if (pct >= 85) cls = "bar__fill--bad";
    else if (pct >= 60) cls = "bar__fill--warn";
    return { pct: pct, cls: cls, left: Math.max(0, life - (Number(b.cycles) || 0)) };
  }

  // Startgewicht = gewogene Drohne ohne Akku + Akku. Beides trägst du selbst ein,
  // Herstellerangaben dazu sind oft ungenau.
  function takeoffWeight(b) {
    const d = workshop.activeDrone();
    const dry = Number(d && d.weightDry) || 0;
    const pack = Number(b.weight) || 0;
    if (!dry || !pack) return null;
    return dry + pack;
  }

  function weightChip(g) {
    if (g == null) return "";
    return g < 250
      ? '<span class="chip chip--ok" style="text-transform:none">Startgewicht ' + g + " g · unter 250 g</span>"
      : '<span class="chip chip--warn" style="text-transform:none">Startgewicht ' + g + " g · ab 250 g</span>";
  }

  function storageWarnings() {
    return state.batteries.filter((b) => {
      if (b.status !== "charged") return false;
      const d = daysSince(b.statusSince);
      return d !== null && d >= STORAGE_WARN_DAYS;
    });
  }

  /* ------------------------------------------------------------- Charts */

  function barChart(rows, unit) {
    if (!rows.length) return '<div class="empty">Noch keine Daten.</div>';
    const W = 320,
      H = 90,
      pad = 14;
    const max = Math.max.apply(null, rows.map((r) => r.v)) || 1;
    const bw = (W - pad * 2) / rows.length;
    let out = '<svg class="chart" viewBox="0 0 ' + W + " " + (H + 18) + '" role="img">';
    rows.forEach((r, i) => {
      const bh = Math.max(1, Math.round((r.v / max) * (H - pad)));
      const x = pad + i * bw + bw * 0.16;
      const w = bw * 0.68;
      const y = H - bh;
      out +=
        '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) +
        '" height="' + bh + '" rx="2" fill="#ff6a13" opacity="' +
        (r.v ? 0.9 : 0.25) + '"></rect>';
      out +=
        '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H + 11) +
        '" text-anchor="middle">' + h(r.k) + "</text>";
      if (r.v)
        out +=
          '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y - 3) +
          '" text-anchor="middle" fill="#9aa3ac">' + r.v + "</text>";
    });
    out += "</svg>";
    if (unit) out += '<div class="label" style="margin-top:6px">' + h(unit) + "</div>";
    return out;
  }

  function monthlyRows() {
    const months = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      const lbl = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"][d.getMonth()];
      months.push({ key: key, k: lbl, v: 0 });
    }
    state.flights.forEach((f) => {
      const k = String(f.date || "").slice(0, 7);
      const m = months.find((x) => x.key === k);
      if (m) m.v += Number(f.minutes) || 0;
    });
    return months;
  }

  /* ---------------------------------------------------------- Dashboard */

  function renderDashboard() {
    const s = stats();
    const warn = storageWarnings();
    let out = "";

    if (warn.length) {
      out +=
        '<div class="banner"><strong>Lagerspannung:</strong> ' +
        warn.map((b) => h(b.label)).join(", ") +
        (warn.length > 1 ? " sind " : " ist ") +
        "seit mindestens " + STORAGE_WARN_DAYS +
        " Tagen voll geladen. LiPo auf Lagerspannung bringen, sonst altern die Zellen schneller.</div>";
    }

    const due = workshop.dueTasks();
    if (due.length) {
      out +=
        '<div class="banner"><strong>Wartung fällig:</strong> ' +
        due.map((x) => h(x.drone.name) + ": " + h(x.t.title)).join("; ") +
        ' <button class="btn btn--sm" data-goto="workshop" style="margin-left:6px">Zur Werkstatt</button></div>';
    }

    out += '<div id="preflight"></div>';

    out +=
      '<div class="grid grid--kpi">' +
      kpi("Gesamtflugzeit", fmtMin(s.minutes)) +
      kpi("Flüge", s.flights) +
      kpi("Ø pro Flug", s.flights ? fmtMin(s.avg) : "—") +
      kpi("Topspeed", s.topSpeed ? s.topSpeed : "—", s.topSpeed ? "km/h" : "", true) +
      kpi("Max. Höhe", s.maxAlt ? s.maxAlt : "—", s.maxAlt ? "m" : "", true) +
      kpi("Akkuzyklen", s.cycles) +
      kpi("Manöver sitzen", s.mvDone + " / " + s.mvTotal) +
      kpi("Crashes", s.crashes) +
      "</div>";

    out +=
      '<div class="section-head"><span class="label label--accent">Flugzeit pro Monat</span><span class="section-head__rule"></span></div>' +
      '<div class="card">' + barChart(monthlyRows(), "Minuten pro Monat, letzte 8 Monate") + "</div>";

    out +=
      '<div class="section-head"><span class="label label--accent">Trainingsfortschritt</span><span class="section-head__rule"></span></div>' +
      '<div class="card">';
    content.levels().forEach((l) => {
      const st = levelStats(l);
      const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
      out +=
        '<div style="margin-bottom:13px">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:5px">' +
        '<span style="font-size:.8rem;font-weight:600">Stufe ' + l.n + " · " + h(l.title) + "</span>" +
        '<span class="label">' + st.done + " / " + st.total + "</span></div>" +
        '<div class="bar"><div class="bar__fill' + (pct === 100 ? " bar__fill--ok" : "") +
        '" style="width:' + pct + '%"></div></div></div>';
    });
    out += "</div>";

    const recent = state.flights.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
    out +=
      '<div class="section-head"><span class="label label--accent">Letzte Flüge</span><span class="section-head__rule"></span>' +
      '<button class="btn btn--sm" data-goto="flights">Alle ansehen</button></div>' +
      '<div class="card card--flush">';
    if (!recent.length) {
      out += '<div class="empty">Noch kein Flug erfasst. Der erste Eintrag ist der schwerste.</div>';
    } else {
      recent.forEach((f) => {
        out +=
          '<div class="row"><div class="row__main">' +
          '<div class="row__title">' + h(spotName(f.spotId)) + " · " + fmtMin(f.minutes) + "</div>" +
          '<div class="row__meta">' + deDate(f.date) +
          (f.maxSpeed ? " · " + h(f.maxSpeed) + " km/h" : "") +
          (f.weather ? " · " + h(f.weather) : "") + "</div></div>" +
          (f.crash ? '<span class="chip chip--bad">Crash</span>' : "") +
          "</div>";
      });
    }
    out += "</div>";

    out +=
      '<div class="section-head"><span class="label label--accent">Schnellzugriff</span><span class="section-head__rule"></span></div>' +
      '<div class="grid grid--cards">' +
      linkCard(LINKS[0].items[0]) +
      linkCard(LINKS[1].items[1]) +
      linkCard(LINKS[0].items[1]) +
      "</div>";

    killMap("dash");
    $("#view-dashboard").innerHTML = out;
    renderPreflight();
  }

  /* ---------------------------------------------------------- Vor dem Flug --
     Standort per Geolokalisierung, Zonenvorschau und aktuelles Wetter.
     Läuft nur auf Knopfdruck: das ist der einzige Teil der App, der etwas
     nach draussen schickt, nämlich die Koordinaten an den Wetterdienst. */

  let preflight = { lat: null, lon: null, wx: null, error: null, busy: "" };

  function renderPreflight() {
    const el = $("#preflight");
    if (!el) return;
    killMap("dash");

    let out =
      '<div class="section-head" style="margin-top:0"><span class="label label--accent">Vor dem Flug</span>' +
      '<span class="section-head__rule"></span></div><div class="card">';

    if (preflight.busy) {
      out += '<div class="row__meta">' + h(preflight.busy) + "</div>";
    } else if (preflight.lat == null) {
      out +=
        "<p style=\"font-size:.8rem;color:var(--muted);margin:0 0 11px\">Standort ermitteln, Einschränkungszonen anzeigen und das aktuelle Wetter dazu holen. " +
        "Dabei gehen deine Koordinaten an den Wetterdienst Open-Meteo. Das ist der einzige Vorgang in dieser App, bei dem Daten dein Gerät verlassen, " +
        "deshalb passiert er nur auf Knopfdruck.</p>" +
        // Ohne Standort gibt es keinen Wetterteil, der Fehler muss also hier stehen.
        (preflight.error ? '<div class="banner" style="margin:0 0 11px">' + h(preflight.error) + "</div>" : "") +
        '<button class="btn btn--primary" data-act="pf-go">' + (preflight.error ? "Nochmals versuchen" : "Standort und Wetter prüfen") + "</button>";
    } else {
      out += '<div class="map map--sm" id="dash-map" style="margin-bottom:12px"></div>';
      out += weatherHtml();
      out +=
        '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:13px">' +
        '<a class="btn btn--sm" href="' + h(FPVMap.droneMapUrl(preflight.lat, preflight.lon)) +
        '" target="_blank" rel="noopener">Amtliche Drohnenkarte</a>' +
        '<a class="btn btn--sm" href="https://www.skybriefing.com/de/dabs" target="_blank" rel="noopener">DABS</a>' +
        '<button class="btn btn--sm" data-act="pf-go">Aktualisieren</button>' +
        "</div>" +
        '<div class="map-hint">Die eingeblendeten Zonen sind eine Vorschau desselben BAZL-Layers, den die amtliche Karte nutzt. ' +
        "Verbindlich ist die amtliche Karte, und sie ist vor jedem Flug zu konsultieren.</div>";
    }

    out += "</div>";
    el.innerHTML = out;

    if (preflight.lat != null && typeof L !== "undefined" && window.FPVMap) {
      const mel = $("#dash-map");
      if (mel) {
        maps.dash = FPVMap.overview(
          mel,
          [{ id: "me", name: "Dein Standort", lat: preflight.lat, lon: preflight.lon, radius: FPVMap.A3_DISTANCE }],
          null
        );
        setTimeout(function () {
          if (maps.dash) maps.dash.invalidate();
        }, 60);
      }
    }
  }

  function weatherHtml() {
    const w = preflight.wx;
    if (preflight.error) {
      return (
        '<div class="banner" style="margin:0">Wetter konnte nicht geladen werden: ' +
        h(preflight.error) +
        ". Standort und Karte funktionieren trotzdem.</div>"
      );
    }
    if (!w) return "";

    const cell = (label, val) =>
      '<div class="wx__cell"><div class="label">' + h(label) + '</div><div class="wx__val">' + val + "</div></div>";
    const n = (v, u) => (v == null ? "—" : Math.round(v) + (u ? '<span class="kpi__unit">' + u + "</span>" : ""));

    let out = '<div class="wx__head">';
    out += '<span class="wx__temp">' + (w.temp == null ? "—" : Math.round(w.temp) + "°") + "</span>";
    if (w.condition) out += '<span class="wx__cond">' + h(w.condition) + "</span>";
    if (w.time) out += '<span class="label" style="margin-left:auto">Stand ' + h(w.time) + " Uhr</span>";
    out += "</div>";

    out += '<div class="wx__grid">';
    out += cell("Wind", n(w.wind, "km/h"));
    out += cell("Böen", n(w.gust, "km/h"));
    out += cell("Richtung", w.dirText ? h(w.dirText) : "—");
    out += cell("Bewölkung", n(w.cloud, "%"));
    out += cell("Niederschlag", w.rain == null ? "—" : w.rain.toFixed(1) + '<span class="kpi__unit">mm</span>');
    if (w.daylight && w.daylight.sunset) out += cell("Sonnenuntergang", h(w.daylight.sunset));
    out += "</div>";

    const cls = w.level === "bad" ? "wx--bad" : w.level === "warn" ? "wx--warn" : "wx--ok";
    out += '<div class="' + cls + '" style="margin-top:11px">';
    w.notes.forEach((t) => (out += '<div class="wx__note">' + h(t) + "</div>"));
    out += "</div>";
    out +=
      '<div class="map-hint">Die Einschätzung ist eine Faustregel für eine leichte 3-Zoll-Maschine, keine amtliche Grenze. ' +
      "Was zählt, ist dein Können und der konkrete Platz.</div>";
    return out;
  }

  function preflightGo() {
    if (!navigator.geolocation) {
      preflight.error = "Dieses Gerät meldet keine Standortfunktion";
      preflight.busy = "";
      renderPreflight();
      return;
    }
    preflight.busy = "Standort wird ermittelt…";
    preflight.error = null;
    renderPreflight();

    function found(p) {
      preflight.lat = p.coords.latitude;
      preflight.lon = p.coords.longitude;
      preflight.busy = "Wetter wird geladen…";
      renderPreflight();

      FPVWeather.fetchAt(preflight.lat, preflight.lon)
        .then(function (w) {
          preflight.wx = w;
          preflight.error = null;
        })
        .catch(function (e) {
          preflight.wx = null;
          preflight.error = e && e.message ? e.message : "unbekannter Fehler";
        })
        .then(function () {
          preflight.busy = "";
          renderPreflight();
        });
    }

    function failed(e) {
      preflight.busy = "";
      preflight.error =
        e && e.code === 1
          ? "Standortfreigabe verweigert. In den Android-Einstellungen unter Apps → FPV OPS → Berechtigungen den Standort erlauben."
          : e && e.code === 3
          ? "Standort nicht rechtzeitig gefunden. Unter freiem Himmel nochmals versuchen."
          : "Standort nicht verfügbar. Ist der Standort am Gerät eingeschaltet?";
      renderPreflight();
    }

    // Erst genau (GPS). Braucht ein kaltes GPS zu lange, reicht für Zonen und
    // Wetter auch die schnellere Ortung über Netz.
    navigator.geolocation.getCurrentPosition(
      found,
      function (e) {
        if (e && e.code === 3) {
          preflight.busy = "GPS braucht lange, versuche ungefähre Ortung…";
          renderPreflight();
          navigator.geolocation.getCurrentPosition(found, failed, {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 600000,
          });
        } else failed(e);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function kpi(label, value, unit, cyan) {
    return (
      '<div class="kpi' + (cyan ? " kpi--cyan" : "") + '">' +
      '<div class="label">' + h(label) + "</div>" +
      '<div class="kpi__value">' + h(value) +
      (unit ? '<span class="kpi__unit">' + h(unit) + "</span>" : "") +
      "</div></div>"
    );
  }

  function linkCard(l) {
    return (
      '<a class="linkcard" href="' + h(l.url) + '" target="_blank" rel="noopener">' +
      '<div class="linkcard__title">' + h(l.title) + '<span class="linkcard__arrow">→</span></div>' +
      '<div class="linkcard__desc">' + h(l.desc) + "</div></a>"
    );
  }

  /* ------------------------------------------------------------- Akkus */

  function renderBatteries() {
    let out =
      '<div class="section-head"><span class="label label--accent">Akkubestand</span>' +
      '<span class="section-head__rule"></span>' +
      '<button class="btn btn--sm btn--primary" data-act="bat-new">Akku erfassen</button></div>';

    const life = Number(state.settings.lifespan) || 200;
    out +=
      '<div class="card" style="margin-bottom:12px"><label class="field" style="margin:0">' +
      '<span class="label">Erwartete Lebensdauer in Zyklen</span>' +
      '<input type="number" min="20" max="1000" id="lifespan" value="' + life + '">' +
      '<small style="display:block;margin-top:6px">Richtwert für High-C-Packs im Freestyle. Der Balken pro Akku rechnet gegen diesen Wert. Das ist eine Faustregel, kein Messwert.</small>' +
      "</label>" +
      '<label class="field" style="margin:14px 0 0">' +
      '<span class="label">' + h(workshop.activeDrone() ? workshop.activeDrone().name + " gewogen" : "Drohne gewogen") + ', ohne Akku (g)</span>' +
      '<input type="number" min="0" max="2000" step="1" id="drone-weight" inputmode="numeric" placeholder="z. B. 175" value="' +
      h((workshop.activeDrone() && workshop.activeDrone().weightDry) || "") + '"' + (workshop.activeDrone() ? "" : " disabled") + ">" +
      '<small style="display:block;margin-top:6px">Startklar mit Props, GPS und Kamera, nur ohne Akku, auf die Waage. Zusammen mit dem Akkugewicht ergibt das das Startgewicht pro Akku. Welche Regeln ab 250 g gelten, steht beim BAZL.</small>' +
      "</label></div>";

    if (!state.batteries.length) {
      out += '<div class="empty">Kein Akku erfasst.</div>';
    } else {
      out += '<div class="grid grid--cards">';
      state.batteries.forEach((b) => {
        const hp = batteryHealth(b);
        const st = BATTERY_STATUS[b.status] || BATTERY_STATUS.empty;
        const d = daysSince(b.statusSince);
        const warn = b.status === "charged" && d !== null && d >= STORAGE_WARN_DAYS;
        out +=
          '<div class="card">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:9px">' +
          "<div><h3>" + h(b.label) + "</h3>" +
          '<div class="row__meta">' + h(b.brand || "") + " · " + h(b.mah) + " mAh · " +
          h(b.cells) + "S" + (b.crate ? " · " + h(b.crate) + "C" : "") + "</div></div>" +
          '<span class="chip ' + st.chip + '">' + st.label + "</span></div>" +
          '<div style="margin:13px 0 5px;display:flex;justify-content:space-between">' +
          '<span class="label">Zyklen</span>' +
          '<span class="label mono">' + (b.cycles || 0) + " / " + life + "</span></div>" +
          '<div class="bar"><div class="bar__fill ' + hp.cls + '" style="width:' + hp.pct + '%"></div></div>' +
          (warn
            ? '<div class="row__meta" style="color:var(--warn);margin-top:8px">Seit ' + d +
              " Tagen voll geladen. Auf Lagerspannung bringen.</div>"
            : '<div class="row__meta" style="margin-top:8px">Status seit ' + deDate(b.statusSince) + "</div>") +
          (takeoffWeight(b) != null
            ? '<div style="margin-top:8px">' + weightChip(takeoffWeight(b)) + "</div>"
            : "") +
          (b.notes ? '<div class="row__meta">' + h(b.notes) + "</div>" : "") +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:11px">' +
          '<button class="btn btn--sm" data-act="bat-cycle" data-id="' + b.id + '">+1 Zyklus</button>' +
          '<select data-act="bat-status" data-id="' + b.id + '" style="width:auto;flex:1;min-width:110px;font-size:.72rem;padding:5px 24px 5px 8px">' +
          Object.keys(BATTERY_STATUS)
            .map(
              (k) =>
                '<option value="' + k + '"' + (b.status === k ? " selected" : "") + ">" +
                BATTERY_STATUS[k].label + "</option>"
            )
            .join("") +
          "</select>" +
          '<button class="btn btn--sm" data-act="bat-edit" data-id="' + b.id + '">Bearbeiten</button>' +
          "</div></div>";
      });
      out += "</div>";
    }

    out +=
      '<div class="card" style="margin-top:16px"><div class="label label--accent" style="margin-bottom:7px">Warum das zählt</div>' +
      "<p style=\"font-size:.79rem;color:var(--muted);margin:0\">Ein Zyklus wird automatisch gebucht, sobald du einen Flug mit diesem Akku erfasst. " +
      "Der Status hilft dir vor allem bei der Lagerung: voll geladene LiPo altern deutlich schneller als solche auf Lagerspannung. " +
      "Nach " + STORAGE_WARN_DAYS + " Tagen im Zustand <em>Geladen</em> erscheint eine Warnung im Dashboard.</p></div>";

    $("#view-batteries").innerHTML = out;
  }

  /* ------------------------------------------------------------- Flüge */

  function renderFlights() {
    let out =
      '<div class="section-head"><span class="label label--accent">Flugbuch</span>' +
      '<span class="section-head__rule"></span>' +
      '<button class="btn btn--sm btn--primary" data-act="flight-new">Flug erfassen</button></div>';

    const list = state.flights.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    out += '<div class="card card--flush">';
    if (!list.length) {
      out += '<div class="empty">Noch keine Flüge erfasst.</div>';
    } else {
      list.forEach((f) => {
        const bats = (f.batteryIds || []).map(batteryLabel).join(", ");
        out +=
          '<div class="row"><div class="row__main">' +
          '<div class="row__title">' + deDate(f.date) + " · " + h(spotName(f.spotId)) + "</div>" +
          '<div class="row__meta">' + fmtMin(f.minutes) +
          (f.maxSpeed ? " · " + h(f.maxSpeed) + " km/h" : "") +
          (f.maxAlt ? " · " + h(f.maxAlt) + " m" : "") +
          (bats ? " · " + h(bats) : "") +
          (f.weather ? " · " + h(f.weather) : "") +
          (media.flightSummary(f.id) ? " · " + h(media.flightSummary(f.id)) : "") + "</div>" +
          (f.notes ? '<div class="row__meta">' + h(f.notes) + "</div>" : "") +
          (f.crash && f.repair
            ? '<div class="row__meta" style="color:var(--warn)">Reparatur: ' + h(f.repair) + "</div>"
            : "") +
          "</div>" +
          (f.crash ? '<span class="chip chip--bad">Crash</span>' : "") +
          '<div class="row__actions">' +
          '<button class="btn btn--sm" data-act="flight-edit" data-id="' + f.id + '">Bearbeiten</button>' +
          "</div></div>";
      });
    }
    out += "</div>";

    /* ---- Fluggebiete ---- */
    out +=
      '<div class="section-head"><span class="label label--accent">Fluggebiete</span>' +
      '<span class="section-head__rule"></span>' +
      '<button class="btn btn--sm" data-act="spot-new">Gebiet erfassen</button></div>';

    const mapped = state.spots.filter((s) => s.lat != null && s.lon != null);
    if (mapped.length) {
      out += '<div class="map map--sm" id="spots-map" style="margin-bottom:12px"></div>';
    }

    out += '<div class="card card--flush">';
    if (!state.spots.length) {
      out += '<div class="empty">Noch kein Fluggebiet erfasst.</div>';
    } else {
      state.spots.forEach((sp) => {
        const fl = state.flights.filter((f) => f.spotId === sp.id);
        const mins = fl.reduce((a, x) => a + (Number(x.minutes) || 0), 0);
        const map = FPVMap.droneMapUrl(sp.lat, sp.lon);
        out +=
          '<div class="row" id="spot-' + sp.id + '"><div class="row__main">' +
          '<div class="row__title">' + h(sp.name) +
          (sp.category ? ' <span class="chip chip--accent">' + h(sp.category) + "</span>" : "") +
          "</div>" +
          '<div class="row__meta">' + fl.length + (fl.length === 1 ? " Flug" : " Flüge") +
          " · " + fmtMin(mins) +
          (sp.coords ? " · " + h(sp.coords) : "") +
          (sp.radius ? " · Radius " + h(sp.radius) + " m" : "") + "</div>" +
          (sp.notes ? '<div class="row__meta">' + h(sp.notes) + "</div>" : "") +
          "</div><div class=\"row__actions\">" +
          '<a class="btn btn--sm" href="' + h(map) + '" target="_blank" rel="noopener">Drohnenkarte</a>' +
          '<button class="btn btn--sm" data-act="spot-edit" data-id="' + sp.id + '">Bearbeiten</button>' +
          "</div></div>";
      });
    }
    out += "</div>";

    killMap("overview");
    $("#view-flights").innerHTML = out;

    const mel = $("#spots-map");
    if (mel && typeof L !== "undefined" && window.FPVMap) {
      maps.overview = FPVMap.overview(mel, mapped, function (id) {
        const row = $("#spot-" + id);
        if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      setTimeout(function () {
        if (maps.overview) maps.overview.invalidate();
      }, 60);
    }
  }

  /* ---------------------------------------------------------- Training */

  let activeLevel = 0;

  function renderTraining() {
    const LV = content.levels();
    let out = '<div class="levels" role="tablist">';
    LV.forEach((l, i) => {
      const st = levelStats(l);
      out +=
        '<button class="level-tab" role="tab" data-level="' + i + '" aria-selected="' +
        (i === activeLevel) + '">' +
        '<span class="level-tab__n">0' + l.n + "</span>" + h(l.title) +
        '<span class="chip ' + (st.done === st.total ? "chip--ok" : "") + '">' +
        st.done + "/" + st.total + "</span></button>";
    });
    out += "</div>";

    const lv = LV[activeLevel] || LV[0];
    out +=
      '<div class="card" style="margin:14px 0"><div class="label label--accent" style="margin-bottom:6px">Stufe ' +
      lv.n + "</div><p style=\"font-size:.82rem;color:var(--muted);margin:0\">" + h(lv.intro) + "</p></div>";

    out += '<div class="grid grid--cards">';
    lv.maneuvers.forEach((m) => {
      const ms = mvState(m.id);
      const chip =
        ms.status === "done"
          ? '<span class="chip chip--ok">Sitzt</span>'
          : ms.status === "wip"
          ? '<span class="chip chip--warn">Am Üben</span>'
          : '<span class="chip">Offen</span>';
      out +=
        '<button class="mv" data-act="mv" data-id="' + m.id + '" data-status="' + ms.status + '">' +
        '<div class="mv__head"><div><div class="mv__title">' + h(m.title) + "</div>" +
        '<div class="mv__tag">' + h(m.tag) + "</div></div>" + chip + "</div>" +
        '<div class="mv__desc">' + h(m.desc) + "</div>" +
        (m.custom || m.edited
          ? '<div class="mv__tag" style="margin-top:6px">' + (m.custom ? "Eigenes Manöver" : "Angepasst") + "</div>"
          : "") +
        (ms.log && ms.log.length
          ? '<div class="mv__tag" style="margin-top:8px">' + ms.log.length +
            (ms.log.length === 1 ? " Lernschritt" : " Lernschritte") +
            " · " + (ms.attempts || 0) + " Versuche</div>"
          : "") +
        "</button>";
    });
    out += "</div>";

    const hid = content.hiddenManeuvers(lv.id);
    out +=
      '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:12px">' +
      '<button class="btn btn--sm" data-act="ct-mv-new" data-lv="' + h(lv.id) + '">Eigenes Manöver in Stufe ' + lv.n + "</button>" +
      (hid.length
        ? '<button class="btn btn--sm btn--ghost" data-act="ct-hidden-toggle" data-key="mv-' + h(lv.id) + '">' +
          hid.length + " ausgeblendet</button>"
        : "") +
      "</div>";
    if (hid.length && content.showHidden("mv-" + lv.id)) {
      out +=
        '<div class="card card--flush" style="margin-top:10px">' +
        hid
          .map(
            (m) =>
              '<div class="row"><div class="row__main"><div class="row__title">' + h(m.title) + "</div></div>" +
              '<div class="row__actions"><button class="btn btn--sm" data-act="ct-mv-show" data-id="' + m.id + '">Einblenden</button></div></div>'
          )
          .join("") +
        "</div>";
    }

    $("#view-training").innerHTML = out;
  }

  /* ------------------------------------------------------- Checklisten */

  function renderChecklists() {
    let out =
      '<div class="card" style="margin-bottom:14px"><p style="font-size:.8rem;color:var(--muted);margin:0">' +
      "Die Haken bleiben gespeichert, bis du die Liste zurücksetzt. Praktisch, wenn du zwischen Vorbereitung und Abfahrt unterbrochen wirst." +
      "</p></div>";

    content.checklists().forEach((cl) => {
      const st = state.checks[cl.id] || {};
      const done = cl.items.filter((_, i) => st[i]).length;
      const pct = cl.items.length ? Math.round((done / cl.items.length) * 100) : 0;
      out +=
        '<div class="section-head"><span class="label label--accent">' + h(cl.title) + "</span>" +
        '<span class="section-head__rule"></span>' +
        '<span class="label mono" data-count="' + cl.id + '">' + done + " / " + cl.items.length + "</span>" +
        '<button class="btn btn--sm" data-act="cl-reset" data-id="' + cl.id + '">Zurücksetzen</button>' +
        '<button class="btn btn--sm btn--ghost" data-act="ct-cl-edit" data-id="' + cl.id + '">Bearbeiten</button></div>';
      out += '<div class="bar" style="margin-bottom:9px"><div class="bar__fill' +
        (pct === 100 ? " bar__fill--ok" : "") + '" data-barfill="' + cl.id +
        '" style="width:' + pct + '%"></div></div>';
      out += '<div class="card card--flush">';
      cl.items.forEach((it, i) => {
        out +=
          '<label class="check"><input type="checkbox" data-act="cl-item" data-id="' + cl.id +
          '" data-i="' + i + '"' + (st[i] ? " checked" : "") + ">" +
          '<span class="check__box"></span>' +
          '<span class="check__text">' + h(it.t) +
          (it.h ? '<span class="check__hint">' + h(it.h) + "</span>" : "") +
          "</span></label>";
      });
      out += "</div>";
    });

    const hid = content.hiddenChecklists();
    out +=
      '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:16px">' +
      '<button class="btn btn--sm" data-act="ct-cl-new">Eigene Checkliste</button>' +
      hid
        .map((c) => '<button class="btn btn--sm btn--ghost" data-act="ct-cl-show" data-id="' + c.id + '">„' + h(c.title) + "“ einblenden</button>")
        .join("") +
      "</div>";

    $("#view-checklists").innerHTML = out;
  }

  /* Nur Zähler und Balken nachführen. Die Liste neu zu zeichnen würde den
     Haken unter dem Finger wegziehen und die Scrollposition verlieren. */
  function updateChecklistProgress(id) {
    const cl = content.checklist(id);
    if (!cl) return;
    const st = state.checks[id] || {};
    const done = cl.items.filter((_, i) => st[i]).length;
    const pct = cl.items.length ? Math.round((done / cl.items.length) * 100) : 0;
    const c = $('[data-count="' + id + '"]');
    const b = $('[data-barfill="' + id + '"]');
    if (c) c.textContent = done + " / " + cl.items.length;
    if (b) {
      b.style.width = pct + "%";
      b.classList.toggle("bar__fill--ok", pct === 100);
    }
  }

  /* ------------------------------------------------------------- Links */

  function editableLinkCard(l) {
    return (
      '<div class="linkcard" style="cursor:default">' +
      '<div class="linkcard__title">' + h(l.title) + "</div>" +
      '<div class="linkcard__desc" style="word-break:break-all">' + h(l.url) + "</div>" +
      '<div style="display:flex;gap:6px;margin-top:9px">' +
      (l.builtin
        ? '<button class="btn btn--sm btn--danger" data-act="ct-link-hide" data-url="' + h(l.url) + '">Ausblenden</button>'
        : '<button class="btn btn--sm" data-act="ct-link-edit" data-id="' + l.id + '">Bearbeiten</button>' +
          '<button class="btn btn--sm btn--danger" data-act="ct-link-del" data-id="' + l.id + '">Löschen</button>') +
      "</div></div>"
    );
  }

  function renderLinks() {
    const edit = content.linkEditMode();
    let out =
      '<div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end">' +
      (edit ? '<button class="btn btn--sm btn--primary" data-act="ct-link-new">Link hinzufügen</button>' : "") +
      '<button class="btn btn--sm" data-act="ct-link-mode">' + (edit ? "Fertig" : "Links bearbeiten") + "</button></div>";
    content.linkGroups().forEach((g) => {
      out +=
        '<div class="section-head"><span class="label label--accent">' + h(g.group) +
        '</span><span class="section-head__rule"></span></div><div class="grid grid--cards">';
      g.items.forEach((l) => (out += edit ? editableLinkCard(l) : linkCard(l)));
      out += "</div>";
    });
    const hid = content.hiddenLinks();
    if (edit && hid.length) {
      out +=
        '<div class="section-head"><span class="label">Ausgeblendet</span><span class="section-head__rule"></span></div>' +
        '<div class="card card--flush">' +
        hid
          .map(
            (l) =>
              '<div class="row"><div class="row__main"><div class="row__title">' + h(l.title) + "</div></div>" +
              '<div class="row__actions"><button class="btn btn--sm" data-act="ct-link-show" data-url="' + h(l.url) + '">Einblenden</button></div></div>'
          )
          .join("") +
        "</div>";
    }

    out +=
      '<div class="section-head"><span class="label label--accent">Meine Nachweise</span>' +
      '<span class="section-head__rule"></span></div><div class="card"><div class="grid grid--2">' +
      idBlock("Fernpilot-Nummer", PILOT.certId, "Gültig bis " + deDate(PILOT.certValid)) +
      idBlock("UAS-Betreibernummer", PILOT.operatorId, "Sichtbarer Teil. Die drei Zeichen nach dem Bindestrich gehören nicht auf die Drohne.") +
      idBlock("Haftpflicht", PILOT.insurer, "Police " + PILOT.policy) +
      idBlock("Drohne", PILOT.craft, "Legacy, ohne C-Klassenlabel, daher Kategorie A3.") +
      "</div></div>";

    $("#view-links").innerHTML = out;
  }

  function idBlock(label, value, note) {
    return (
      '<div><div class="label">' + h(label) + "</div>" +
      '<div class="mono" style="font-size:.9rem;font-weight:700;margin:4px 0 3px;word-break:break-all">' +
      h(value) + "</div>" +
      '<div class="row__meta">' + h(note) + "</div></div>"
    );
  }

  /* -------------------------------------------------------- Kartenleben ---
     Leaflet-Instanzen überleben ein innerHTML-Überschreiben als verwaiste
     Objekte mit aktiven Listenern. Deshalb werden sie hier verwaltet und
     vor jedem Neuzeichnen sauber abgeräumt. */

  const maps = { picker: null, overview: null, dash: null };

  function killMap(k) {
    if (maps[k]) {
      try { maps[k].destroy(); } catch (e) {}
      maps[k] = null;
    }
  }

  /* ------------------------------------------------------------ Dialoge */

  const dlg = $("#dlg");

  function openDialog(title, bodyHtml, footHtml) {
    $("#dlg-title").textContent = title;
    $("#dlg-body").innerHTML = bodyHtml;
    $("#dlg-foot").innerHTML =
      (footHtml || "") + '<button type="button" class="btn" data-act="dlg-close">Schliessen</button>';
    $("#dlg-body").scrollTop = 0;
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }

  function closeDialog() {
    killMap("picker");
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  }

  /* ---- Akku ---- */

  function batteryDialog(id) {
    const b = id ? state.batteries.find((x) => x.id === id) : null;
    const v = b || { label: "", brand: "", mah: 750, cells: 4, crate: 95, cycles: 0, weight: "", notes: "" };
    openDialog(
      b ? "Akku bearbeiten" : "Akku erfassen",
      '<label class="field"><span class="label">Bezeichnung</span><input type="text" id="f-label" value="' +
        h(v.label) + '" placeholder="R-Line #5"></label>' +
        '<label class="field"><span class="label">Hersteller / Typ</span><input type="text" id="f-brand" value="' +
        h(v.brand) + '" placeholder="Tattu R-Line"></label>' +
        '<div class="form-row">' +
        '<label class="field"><span class="label">Kapazität mAh</span><input type="number" id="f-mah" value="' + h(v.mah) + '"></label>' +
        '<label class="field"><span class="label">Zellen</span><input type="number" id="f-cells" value="' + h(v.cells) + '"></label>' +
        '<label class="field"><span class="label">C-Rate</span><input type="number" id="f-crate" value="' + h(v.crate) + '"></label>' +
        '<label class="field"><span class="label">Zyklen</span><input type="number" id="f-cycles" value="' + h(v.cycles) + '"></label>' +
        '<label class="field"><span class="label">Gewicht g</span><input type="number" id="f-weight" min="0" step="1" inputmode="numeric" value="' + h(v.weight || "") + '"></label>' +
        "</div>" +
        '<label class="field"><span class="label">Notizen</span><textarea id="f-notes" placeholder="Auffälligkeiten, Puffing, Innenwiderstand">' +
        h(v.notes) + "</textarea></label>",
      (b ? '<button type="button" class="btn btn--danger" data-act="bat-del" data-id="' + b.id + '">Löschen</button>' : "") +
        '<button type="button" class="btn btn--primary" data-act="bat-save" data-id="' + (b ? b.id : "") + '">Speichern</button>'
    );
  }

  function batterySave(id) {
    const rec = {
      label: $("#f-label").value.trim() || "Ohne Namen",
      brand: $("#f-brand").value.trim(),
      mah: Number($("#f-mah").value) || 0,
      cells: Number($("#f-cells").value) || 0,
      crate: Number($("#f-crate").value) || 0,
      weight: Math.max(0, Number($("#f-weight").value) || 0) || "",
      notes: $("#f-notes").value.trim(),
    };
    // Eingegeben wird der Gesamtstand, gespeichert der Anteil, der nicht aus
    // Flügen und einzeln gebuchten Zyklen kommt.
    const total = Math.max(0, Number($("#f-cycles").value) || 0);
    rec.cyclesBase = Math.max(0, total - (id ? store.autoCycles(state, id) : 0));
    if (id) {
      const b = state.batteries.find((x) => x.id === id);
      Object.assign(b, rec);
    } else {
      state.batteries.push(
        Object.assign({ id: uid(), status: "storage", statusSince: today(), added: today() }, rec)
      );
    }
    save();
    closeDialog();
    renderBatteries();
    renderDashboard();
    toast("Akku gespeichert");
  }

  /* ---- Flug ---- */

  function flightDialog(id) {
    const f = id ? state.flights.find((x) => x.id === id) : null;
    const v = f || {
      date: today(), spotId: "", minutes: "", batteryIds: [],
      maxSpeed: "", maxAlt: "", weather: "", crash: false, repair: "", notes: "", partsUsed: [],
    };
    const droneId = f ? workshop.flightDrone(f) : (workshop.activeDrone() || {}).id || "";
    const droneSel = state.drones.length > 1
      ? '<label class="field"><span class="label">Drohne</span><select id="f-drone">' +
        state.drones.map((d) => '<option value="' + d.id + '"' + (d.id === droneId ? " selected" : "") + ">" + h(d.name) + "</option>").join("") +
        "</select></label>"
      : "";
    const spotOpts =
      '<option value="">— Gebiet wählen —</option>' +
      state.spots.map((s) => '<option value="' + s.id + '"' + (v.spotId === s.id ? " selected" : "") + ">" + h(s.name) + "</option>").join("");

    const batBoxes = state.batteries.length
      ? state.batteries
          .map(
            (b) =>
              '<label class="check check--pick" style="padding:8px 0;border:0"><input type="checkbox" class="f-bat" value="' +
              b.id + '"' + ((v.batteryIds || []).indexOf(b.id) > -1 ? " checked" : "") + ">" +
              '<span class="check__box"></span><span class="check__text">' + h(b.label) +
              '<span class="check__hint">' + (b.cycles || 0) + " Zyklen</span></span></label>"
          )
          .join("")
      : '<div class="row__meta">Keine Akkus erfasst.</div>';

    openDialog(
      f ? "Flug bearbeiten" : "Flug erfassen",
      '<div class="form-row">' +
        '<label class="field"><span class="label">Datum</span><input type="date" id="f-date" value="' + h(v.date) + '"></label>' +
        '<label class="field"><span class="label">Dauer in Minuten</span><input type="number" id="f-min" step="0.5" value="' + h(v.minutes) + '"></label>' +
        "</div>" +
        droneSel +
        '<label class="field"><span class="label">Fluggebiet</span><select id="f-spot">' + spotOpts + "</select>" +
        '<small style="display:block;margin-top:5px">Neue Gebiete legst du im Reiter Flüge unten an.</small></label>' +
        '<div class="form-row">' +
        '<label class="field"><span class="label">Max. Speed km/h</span><input type="number" id="f-speed" value="' + h(v.maxSpeed) + '"></label>' +
        '<label class="field"><span class="label">Max. Höhe m</span><input type="number" id="f-alt" value="' + h(v.maxAlt) + '"></label>' +
        "</div>" +
        '<label class="field"><span class="label">Wetter</span><input type="text" id="f-weather" value="' + h(v.weather) +
        '" placeholder="Sonnig, 12 °C, Wind 8 km/h aus West"></label>' +
        '<div class="field"><span class="label">Verwendete Akkus</span>' +
        '<div style="border:1px solid var(--line);border-radius:6px;padding:4px 11px">' + batBoxes + "</div>" +
        '<small style="display:block;margin-top:5px">Jeder angehakte Akku bekommt beim Speichern einen Zyklus gutgeschrieben.</small></div>' +
        '<label class="check" style="border:1px solid var(--line);border-radius:6px;margin-bottom:11px">' +
        '<input type="checkbox" id="f-crash"' + (v.crash ? " checked" : "") + '><span class="check__box"></span>' +
        '<span class="check__text">Crash oder Schaden</span></label>' +
        '<div id="f-crashbox"' + (v.crash ? "" : " hidden") + ">" +
        '<label class="field"><span class="label">Reparatur / Schaden</span><input type="text" id="f-repair" value="' +
        h(v.repair) + '" placeholder="Arm vorne rechts, 2 Props"></label>' +
        '<div class="label" style="margin:4px 0 7px">Verbrauchte Teile (werden vom Lager abgebucht)</div>' +
        '<div id="f-parts">' + workshop.partsUsedHtml(v.partsUsed || [], droneId) + "</div></div>" +
        '<label class="field"><span class="label">Notizen</span><textarea id="f-fnotes" placeholder="Was lief, was nicht">' +
        h(v.notes) + "</textarea></label>",
      (f ? '<button type="button" class="btn btn--danger" data-act="flight-del" data-id="' + f.id + '">Löschen</button>' : "") +
        '<button type="button" class="btn btn--primary" data-act="flight-save" data-id="' + (f ? f.id : "") + '">Speichern</button>'
    );
  }

  function flightSave(id) {
    const picked = $$(".f-bat").filter((c) => c.checked).map((c) => c.value);
    const rec = {
      date: $("#f-date").value || today(),
      spotId: $("#f-spot").value,
      minutes: Number($("#f-min").value) || 0,
      batteryIds: picked,
      maxSpeed: Number($("#f-speed").value) || 0,
      maxAlt: Number($("#f-alt").value) || 0,
      weather: $("#f-weather").value.trim(),
      crash: $("#f-crash").checked,
      repair: $("#f-crash").checked ? $("#f-repair").value.trim() : "",
      partsUsed: $("#f-crash").checked ? workshop.readPartsUsed($("#f-parts")) : [],
      notes: $("#f-fnotes").value.trim(),
    };

    const dsel = $("#f-drone");
    rec.droneId = dsel ? dsel.value : (workshop.activeDrone() || {}).id || "";
    // Zyklen und Teileverbrauch zählt der Speicher aus den Flügen selbst.
    if (id) {
      Object.assign(state.flights.find((x) => x.id === id), rec);
    } else {
      state.flights.push(Object.assign({ id: uid() }, rec));
    }

    picked.forEach((bid) => {
      const b = state.batteries.find((x) => x.id === bid);
      if (b) {
        b.status = "empty";
        b.statusSince = rec.date;
      }
    });

    save();
    closeDialog();
    renderFlights();
    renderBatteries();
    renderDashboard();
    workshop.render();
    toast(rec.partsUsed.length ? "Flug gespeichert, Teile abgebucht" : "Flug gespeichert");
  }

  /* ---- Fluggebiet ---- */

  function spotDialog(id) {
    const s = id ? state.spots.find((x) => x.id === id) : null;
    const v = s || { name: "", coords: "", category: "A3", notes: "", lat: null, lon: null, radius: 250 };

    openDialog(
      s ? "Fluggebiet bearbeiten" : "Fluggebiet erfassen",
      '<label class="field"><span class="label">Name</span><input type="text" id="f-sname" value="' +
        h(v.name) + '" placeholder="Kiesgrube Pieterlen"></label>' +
        '<div class="field"><span class="label">Lage und Radius</span>' +
        '<div class="map map--pick" id="spot-map"></div>' +
        '<div class="map-legend">' +
        '<span><i class="lg-op"></i>Betriebsradius, am cyanfarbenen Griff ziehbar</span>' +
        '<span><i class="lg-a3"></i>150 m, Abstand nach A3</span>' +
        "</div>" +
        '<div class="map-hint">Tippe auf die Karte, um den Startpunkt zu setzen. Den orangen Punkt kannst du verschieben, am eckigen Griff ziehst du den Radius auf. Der eingeblendete BAZL-Layer ist eine Vorschau, verbindlich bleibt die amtliche Drohnenkarte am Flugtag.</div>' +
        "</div>" +
        '<div class="form-row">' +
        '<label class="field"><span class="label">Koordinaten</span><input type="text" id="f-scoords" value="' +
        h(v.coords) + '" placeholder="47.12345, 7.23456"></label>' +
        '<label class="field"><span class="label">Radius in Meter</span><input type="number" id="f-sradius" min="' +
        FPVMap.MIN_RADIUS + '" max="' + FPVMap.MAX_RADIUS + '" value="' + h(v.radius || 250) + '"></label>' +
        "</div>" +
        '<label class="field"><span class="label">Einstufung</span><select id="f-scat">' +
        ["A3", "A1", "Bewilligung nötig", "Zu prüfen"]
          .map((c) => '<option' + (v.category === c ? " selected" : "") + ">" + c + "</option>")
          .join("") +
        "</select></label>" +
        '<label class="field"><span class="label">Notizen</span><textarea id="f-snotes" placeholder="Zufahrt, Grundeigentümer, Hindernisse, Empfangslage">' +
        h(v.notes) + "</textarea></label>" +
        '<div class="row__meta">Die Einstufung ist deine eigene Notiz. Massgeblich bleibt die Drohnenkarte am Flugtag.</div>',
      (s ? '<button type="button" class="btn btn--danger" data-act="spot-del" data-id="' + s.id + '">Löschen</button>' : "") +
        '<button type="button" class="btn btn--primary" data-act="spot-save" data-id="' + (s ? s.id : "") + '">Speichern</button>'
    );

    killMap("picker");
    const el = $("#spot-map");
    if (!el || typeof L === "undefined" || !window.FPVMap) return;

    const coordsIn = $("#f-scoords");
    const radiusIn = $("#f-sradius");

    maps.picker = FPVMap.picker(el, {
      lat: v.lat,
      lon: v.lon,
      radius: v.radius,
      onChange: function (p) {
        coordsIn.value = FPVMap.fmtCoords(p.lat, p.lon);
        radiusIn.value = p.radius;
      },
      onLive: function (r) {
        radiusIn.value = r;
      },
    });

    // Tippt er die Koordinaten von Hand, folgt die Karte.
    coordsIn.addEventListener("change", function () {
      const c = FPVMap.parseCoords(coordsIn.value);
      if (c && maps.picker) maps.picker.setCenter(c.lat, c.lon);
    });
    radiusIn.addEventListener("change", function () {
      if (maps.picker) maps.picker.setRadius(radiusIn.value);
    });

    // Der Dialog ist beim Anlegen der Karte noch nicht ausgemessen.
    setTimeout(function () {
      if (maps.picker) maps.picker.invalidate();
    }, 60);
  }

  function spotSave(id) {
    const c = FPVMap.parseCoords($("#f-scoords").value);
    const rec = {
      name: $("#f-sname").value.trim() || "Ohne Namen",
      coords: $("#f-scoords").value.trim(),
      lat: c ? c.lat : null,
      lon: c ? c.lon : null,
      radius: Math.min(
        FPVMap.MAX_RADIUS,
        Math.max(FPVMap.MIN_RADIUS, Number($("#f-sradius").value) || 250)
      ),
      category: $("#f-scat").value,
      notes: $("#f-snotes").value.trim(),
    };
    if (id) Object.assign(state.spots.find((x) => x.id === id), rec);
    else state.spots.push(Object.assign({ id: uid() }, rec));
    save();
    closeDialog();
    renderFlights();
    renderDashboard();
    toast("Fluggebiet gespeichert");
  }

  /* ---- Manöver ---- */

  function maneuverDialog(id) {
    const m = content.maneuver(id);
    if (!m) return;
    const ms = mvState(id);
    const logs = (ms.log || [])
      .slice()
      .reverse()
      .map(
        (e) =>
          '<div class="note-entry"><div class="note-entry__date">' + deDate(e.date) + "</div>" +
          (e.ok ? '<div class="note-entry__ok">Gelungen: ' + h(e.ok) + "</div>" : "") +
          (e.issue ? '<div class="note-entry__issue">Schwierig: ' + h(e.issue) + "</div>" : "") +
          "</div>"
      )
      .join("");

    openDialog(
      m.title,
      '<div class="label label--accent" style="margin-bottom:9px">' + h(m.tag) + "</div>" +
        '<p style="font-size:.85rem">' + h(m.goal) + "</p>" +
        '<div class="label" style="margin:16px 0 7px">Ausführung</div>' +
        '<ol class="steps">' + (m.steps || []).map((s) => "<li>" + h(s) + "</li>").join("") + "</ol>" +
        '<div class="label" style="margin:16px 0 7px">Typische Fehler</div>' +
        '<ul class="steps">' + (m.errors || []).map((s) => "<li>" + h(s) + "</li>").join("") + "</ul>" +
        '<div class="card" style="margin:16px 0;border-color:var(--accent-line);background:var(--accent-soft)">' +
        '<div class="label label--accent" style="margin-bottom:5px">Erfolgskriterium</div>' +
        '<div style="font-size:.83rem">' + h(m.success) + "</div></div>" +
        '<div class="label" style="margin:18px 0 7px">Mein Stand</div>' +
        '<div class="form-row">' +
        '<label class="field"><span class="label">Status</span><select id="m-status">' +
        [["todo", "Offen"], ["wip", "Am Üben"], ["done", "Sitzt"]]
          .map((o) => '<option value="' + o[0] + '"' + (ms.status === o[0] ? " selected" : "") + ">" + o[1] + "</option>")
          .join("") +
        "</select></label>" +
        '<label class="field"><span class="label">Versuche gesamt</span><input type="number" id="m-attempts" min="0" value="' +
        (ms.attempts || 0) + '"></label></div>' +
        '<div class="label" style="margin:14px 0 7px">Lernschritt festhalten</div>' +
        '<label class="field"><span class="label">Was ist gelungen</span><textarea id="m-ok" placeholder="Konkret: was hat funktioniert und woran hast du es gemerkt"></textarea></label>' +
        '<label class="field"><span class="label">Wo war die Schwierigkeit</span><textarea id="m-issue" placeholder="Konkret: an welcher Stelle, mit welcher Folge"></textarea></label>' +
        (logs ? '<div class="label" style="margin:16px 0 9px">Verlauf</div>' + logs : ""),
      '<button type="button" class="btn" data-act="ct-mv-edit" data-id="' + m.id + '">Inhalt bearbeiten</button>' +
        '<button type="button" class="btn btn--primary" data-act="mv-save" data-id="' + m.id + '">Speichern</button>'
    );
  }

  function maneuverSave(id) {
    const cur = mvState(id);
    const ok = $("#m-ok").value.trim();
    const issue = $("#m-issue").value.trim();
    const rec = {
      status: $("#m-status").value,
      attempts: Math.max(0, Number($("#m-attempts").value) || 0),
      log: (cur.log || []).slice(),
    };
    if (ok || issue) rec.log.push({ date: today(), ok: ok, issue: issue });
    state.training[id] = rec;
    save();
    closeDialog();
    renderTraining();
    renderDashboard();
    toast(ok || issue ? "Lernschritt erfasst" : "Stand gespeichert");
  }

  /* ---------------------------------------------------- Export / Import */

  function applyBackup(p) {
    return store.merge(p).then(function (res) {
      state = res.state;
      renderAll();
      return res.changed;
    });
  }

  function mergedToast(n) {
    toast(n ? n + (n === 1 ? " Eintrag" : " Einträge") + " übernommen" : "Nichts Neues, alles schon da");
  }

  function backupDialog() {
    openDialog(
      "Backup",
      sync.section() +
      '<p style="margin-bottom:12px">Gespeichert wird automatisch in diesem Browser. Das Backup ist für den Fall, ' +
        "dass die Browserdaten weg sind, oder für den Umzug auf ein anderes Gerät.</p>" +
        '<p style="margin-bottom:12px"><strong>Backup-Code</strong>: eine Textzeile statt einer Datei. ' +
        "In Notizen oder einem Chat an dich selbst ablegen, zum Wiederherstellen unten einfügen.</p>" +
        '<p style="margin-bottom:12px">Einlesen führt zusammen: Neues kommt dazu, bei Einträgen, die es auf ' +
        "beiden Seiten gibt, gewinnt die neuere Fassung. Nichts wird pauschal überschrieben.</p>" +
        '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px">' +
        '<button type="button" class="btn btn--primary" data-act="code-share">Code teilen</button>' +
        '<button type="button" class="btn" data-act="code-copy">Code kopieren</button>' +
        "</div>" +
        '<label class="field"><span class="label">Code einfügen</span>' +
        '<textarea id="f-code" rows="4" autocomplete="off" autocapitalize="off" spellcheck="false" ' +
        'placeholder="FPV1.…"></textarea></label>' +
        '<button type="button" class="btn" data-act="code-restore" style="margin-bottom:18px">Aus Code wiederherstellen</button>' +
        '<p style="margin-bottom:8px"><strong>Als Datei</strong> — für den Laptop oder ein Archiv.</p>' +
        '<div style="display:flex;gap:7px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn--sm" data-act="export">Datei exportieren</button>' +
        '<button type="button" class="btn btn--sm" data-act="import">Datei importieren</button>' +
        "</div>"
    );
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Rückfall für ältere Browser: Code ins Feld schreiben und markieren.
    return Promise.reject(new Error("keine Zwischenablage"));
  }

  function showCodeInField(code) {
    const f = $("#f-code");
    if (!f) return;
    f.value = code;
    f.focus();
    f.select();
  }

  function codeCopy() {
    encodeBackup(store.exportPayload())
      .then((code) =>
        copyText(code).then(
          () => toast("Backup-Code kopiert"),
          () => {
            showCodeInField(code);
            toast("Code steht im Feld, bitte selbst kopieren");
          }
        )
      )
      .catch(() => toast("Code konnte nicht erzeugt werden"));
  }

  function codeShare() {
    encodeBackup(store.exportPayload())
      .then(function (code) {
        if (!navigator.share) return codeCopy();
        return navigator
          .share({ title: "FPV OPS Backup " + deDate(today()), text: code })
          .catch(function (e) {
            // Abbrechen im Teilen-Menü ist kein Fehler.
            if (e && e.name === "AbortError") return;
            return codeCopy();
          });
      })
      .catch(() => toast("Code konnte nicht erzeugt werden"));
  }

  function codeRestore() {
    const f = $("#f-code");
    const text = f ? f.value.trim() : "";
    if (!text) return toast("Zuerst einen Backup-Code einfügen");
    decodeBackup(text)
      .then(function (p) {
        return applyBackup(p).then(
          function (n) {
            closeDialog();
            mergedToast(n);
          },
          () => toast("Speichern fehlgeschlagen — Browserspeicher blockiert?")
        );
      })
      .catch(() => toast("Code nicht lesbar — vollständig eingefügt?"));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(store.exportPayload())], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fpv-ops-backup-" + today() + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
    toast("Backup heruntergeladen");
  }

  function importJson(file) {
    const r = new FileReader();
    r.onload = function () {
      decodeBackup(r.result)
        .then(function (p) {
          return applyBackup(p).then(function (n) {
            closeDialog();
            mergedToast(n);
          });
        })
        .catch(() => toast("Datei nicht lesbar"));
    };
    r.readAsText(file);
  }

  /* ------------------------------------------------------- Textgrösse */

  // Pro Gerät, deshalb im localStorage und nicht in den abgeglichenen Daten.
  const SCALE_KEY = KEY + ":scale";
  let uiScale = 1;

  function applyScale(v, announce) {
    uiScale = Math.round(Math.min(2, Math.max(0.7, v)) * 10) / 10;
    document.documentElement.style.setProperty("--ui-scale", String(uiScale));
    try {
      localStorage.setItem(SCALE_KEY, String(uiScale));
    } catch (e) {}
    if (announce) toast("Textgrösse " + Math.round(uiScale * 100) + " %");
  }

  try {
    applyScale(Number(localStorage.getItem(SCALE_KEY)) || 1, false);
  } catch (e) {}

  // Strg + / Strg − / Strg 0 und Strg + Mausrad. Auf deutschen Tastaturen liegt
  // "+" auf einer eigenen Taste, deshalb auf das Zeichen und den Tastencode achten.
  document.addEventListener("keydown", function (ev) {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    const k = ev.key;
    if (k === "+" || k === "=" || ev.code === "NumpadAdd") applyScale(uiScale + 0.1, true);
    else if (k === "-" || ev.code === "NumpadSubtract") applyScale(uiScale - 0.1, true);
    else if (k === "0" || ev.code === "Numpad0") applyScale(1, true);
    else return;
    ev.preventDefault();
  });
  window.addEventListener(
    "wheel",
    function (ev) {
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      applyScale(uiScale + (ev.deltaY < 0 ? 0.1 : -0.1), true);
    },
    { passive: false }
  );

  /* -------------------------------------------------------------- Views */

  const VIEWS = ["dashboard", "batteries", "workshop", "flights", "media", "training", "checklists", "links"];

  function showView(name) {
    if (VIEWS.indexOf(name) === -1) name = "dashboard";
    VIEWS.forEach((v) => {
      $("#view-" + v).classList.toggle("is-active", v === name);
      const t = $('.tab[data-view="' + v + '"]');
      if (t) t.setAttribute("aria-selected", String(v === name));
    });
    try {
      localStorage.setItem(KEY + ":tab", name);
    } catch (e) {}
    window.scrollTo(0, 0);
  }

  function renderAll() {
    const d = workshop.activeDrone();
    $(".brand__sub").textContent = (d ? d.name : "Keine Drohne") + " · A1/A3";
    workshop.render();
    media.render();
    renderDashboard();
    renderBatteries();
    renderFlights();
    renderTraining();
    renderChecklists();
    renderLinks();
  }

  /* -------------------------------------------------------------- Events */

  document.addEventListener("click", function (ev) {
    const tab = ev.target.closest(".tab");
    if (tab) return showView(tab.dataset.view);

    const goto = ev.target.closest("[data-goto]");
    if (goto) return showView(goto.dataset.goto);

    const lvl = ev.target.closest("[data-level]");
    if (lvl) {
      activeLevel = Number(lvl.dataset.level);
      return renderTraining();
    }

    const el = ev.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    const id = el.dataset.id;
    if (act.indexOf("ws-") === 0 && workshop.click(act, el)) return;
    if (act.indexOf("ct-") === 0 && content.click(act, el)) return;
    if (act.indexOf("sync-") === 0 && sync.click(act, el)) return;
    if (act.indexOf("md-") === 0 && media.click(act, el)) return;

    switch (act) {
      case "dlg-close":
        return closeDialog();

      case "bat-new":
        return batteryDialog(null);
      case "bat-edit":
        return batteryDialog(id);
      case "bat-save":
        return batterySave(id);
      case "bat-del":
        if (window.confirm("Diesen Akku löschen? Erfasste Flüge bleiben bestehen.")) {
          state.batteries = state.batteries.filter((x) => x.id !== id);
          save();
          closeDialog();
          renderBatteries();
          renderDashboard();
          toast("Akku gelöscht");
        }
        return;
      case "bat-cycle": {
        if (state.batteries.some((x) => x.id === id)) {
          state.cycleLog.push({ id: uid(), batteryId: id, date: today() });
          save();
          renderBatteries();
          renderDashboard();
        }
        return;
      }

      case "flight-new":
        return flightDialog(null);
      case "flight-edit":
        return flightDialog(id);
      case "flight-save":
        return flightSave(id);
      case "flight-del":
        if (window.confirm("Diesen Flug löschen?")) {
          state.flights = state.flights.filter((x) => x.id !== id);
          save();
          workshop.render();
          closeDialog();
          renderFlights();
          renderBatteries();
          renderDashboard();
          toast("Flug gelöscht");
        }
        return;

      case "spot-new":
        return spotDialog(null);
      case "spot-edit":
        return spotDialog(id);
      case "spot-save":
        return spotSave(id);
      case "spot-del":
        if (window.confirm("Dieses Fluggebiet löschen? Flüge behalten den Eintrag als leer.")) {
          state.spots = state.spots.filter((x) => x.id !== id);
          save();
          closeDialog();
          renderFlights();
          toast("Fluggebiet gelöscht");
        }
        return;

      case "mv":
        return maneuverDialog(id);
      case "mv-save":
        return maneuverSave(id);

      case "cl-reset":
        state.checks[id] = {};
        save();
        renderChecklists();
        toast("Liste zurückgesetzt");
        return;

      case "pf-go":
        return preflightGo();

      case "backup":
        return backupDialog();
      case "ui-bigger":
        return applyScale(uiScale + 0.1, true);
      case "ui-smaller":
        return applyScale(uiScale - 0.1, true);
      case "code-share":
        return codeShare();
      case "code-copy":
        return codeCopy();
      case "code-restore":
        return codeRestore();
      case "export":
        return exportJson();
      case "import":
        return $("#file").click();
      case "wipe":
        if (
          window.confirm(
            "Wirklich alle Daten auf diesem Gerät löschen? Zurück holst du sie nur über ein Backup."
          )
        ) {
          store.reset().then(function (s2) {
            state = s2;
            renderAll();
            toast("Alles zurückgesetzt");
          });
        }
        return;
    }
  });

  document.addEventListener("change", function (ev) {
    if (workshop.change(ev)) return;
    if (media.change(ev)) return;
    if (ev.target.id === "f-crash") {
      $("#f-crashbox").hidden = !ev.target.checked;
      return;
    }
    const el = ev.target.closest("[data-act]");
    if (el && el.dataset.act === "bat-status") {
      const b = state.batteries.find((x) => x.id === el.dataset.id);
      if (b) {
        b.status = el.value;
        b.statusSince = today();
        save();
        renderBatteries();
        renderDashboard();
      }
      return;
    }
    if (el && el.dataset.act === "cl-item") {
      const cid = el.dataset.id;
      state.checks[cid] = state.checks[cid] || {};
      state.checks[cid][el.dataset.i] = el.checked;
      save();
      updateChecklistProgress(cid);
      return;
    }
    if (ev.target.id === "drone-weight") {
      const d = workshop.activeDrone();
      if (d) {
        d.weightDry = Math.max(0, Math.round(Number(ev.target.value) || 0)) || "";
        save();
        renderBatteries();
        workshop.render();
      }
      return;
    }
    if (ev.target.id === "lifespan") {
      state.settings.lifespan = Math.max(20, Number(ev.target.value) || 200);
      save();
      renderBatteries();
      return;
    }
    if (ev.target.id === "file" && ev.target.files && ev.target.files[0]) {
      importJson(ev.target.files[0]);
      ev.target.value = "";
    }
  });

  dlg.addEventListener("click", function (ev) {
    if (ev.target === dlg) closeDialog();
  });

  /* ---------------------------------------------------------------- Start */

  store
    .open()
    .then(function (s0) {
      state = s0;
      // Das Drohnengewicht stand kurz in den Einstellungen, jetzt gehört es zur Drohne.
      if (state.settings.droneWeight) {
        const d = workshop.activeDrone();
        if (d && !d.weightDry) d.weightDry = state.settings.droneWeight;
        delete state.settings.droneWeight;
        save();
      }
      renderAll();

      let startTab = "dashboard";
      try {
        startTab = localStorage.getItem(KEY + ":tab") || "dashboard";
      } catch (e) {}
      showView(startTab);

      // Warnung, falls der Browser gar nichts behält.
      if (store.storageKind() === "memory") {
        const b = document.createElement("div");
        b.className = "banner";
        b.textContent =
          "Dieser Browser erlaubt keinen lokalen Speicher. Eingaben gehen beim Neuladen verloren. Im privaten Modus oder in einer Vorschau ist das normal.";
        $("#view-dashboard").prepend(b);
      }
    })
    .catch(function (e) {
      console.error(e);
      $("#view-dashboard").innerHTML =
        '<div class="banner">Der Speicher liess sich nicht öffnen. Bitte die Seite neu laden.</div>';
    });

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then(function (yes) {
      if (!yes) return navigator.storage.persist();
    }).catch(function () {});
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    });
  }
})();
