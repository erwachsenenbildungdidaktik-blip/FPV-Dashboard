/* ==========================================================================
   FPV OPS — Betaflight: Meine Rates, Modes, Stände
   Rates werden wie in Betaflight gespeichert (rc_rate, srate, expo als die
   Zahlen aus dem CLI), damit nichts durch Umrechnen verloren geht.
   Formel und Standardwerte: Betaflight-Quellcode, src/main/fc/rc.c
   (applyActualRates) und fc/controlrate_profile.c, gleich in 4.3 bis master.
   ========================================================================== */

import { $, $$, uid, h, today, deDate } from "../core/util.js";

const AXES = [
  { k: "roll", label: "Roll", color: "#d9530c", dash: "" },
  { k: "pitch", label: "Pitch", color: "#1b9fc4", dash: "" },
  { k: "yaw", label: "Yaw", color: "#9a6ae6", dash: "5 4" },
];

// Betaflight-Standard ab 4.3: ACTUAL, Center 70 °/s, Max 670 °/s, Expo 0.
const DEFAULT = { rc: 7, srate: 67, expo: 0 };
const TYPES = ["BETAFLIGHT", "RACEFLIGHT", "KISS", "ACTUAL", "QUICK"];

// permanentId -> Name, aus src/main/msp/msp_box.c
const BOXES = {
  0: "ARM", 1: "ANGLE", 2: "HORIZON", 3: "ALTHOLD", 4: "ANTI GRAVITY", 5: "MAG", 6: "HEADFREE",
  7: "HEADADJ", 8: "CAMSTAB", 11: "POS HOLD", 12: "PASSTHRU", 13: "BEEPER", 15: "LEDLOW", 17: "CALIB",
  19: "OSD DISABLE", 20: "TELEMETRY", 23: "SERVO1", 24: "SERVO2", 25: "SERVO3", 26: "BLACKBOX",
  27: "FAILSAFE", 28: "AIR MODE", 29: "3D DISABLE", 30: "FPV ANGLE MIX", 31: "BLACKBOX ERASE",
  32: "CAMERA CONTROL 1", 33: "CAMERA CONTROL 2", 34: "CAMERA CONTROL 3", 35: "FLIP OVER AFTER CRASH",
  36: "PREARM", 37: "GPS BEEP SATELLITE COUNT", 39: "VTX PIT MODE", 40: "USER1", 41: "USER2",
  42: "USER3", 43: "USER4", 44: "PID AUDIO", 45: "PARALYZE", 46: "GPS RESCUE", 47: "ACRO TRAINER",
  48: "VTX CONTROL DISABLE", 49: "LAUNCH CONTROL", 50: "MSP OVERRIDE", 51: "STICK COMMANDS DISABLE",
  52: "BEEPER MUTE", 53: "READY", 54: "LAP TIMER RESET", 55: "CHIRP", 56: "AUTOPILOT", 57: "WP CAPTURE", 58: "LAUNCH",
};

const SRC = [
  ["Betaflight-Quellcode: Actual Rates (applyActualRates in rc.c)", "https://github.com/betaflight/betaflight/blob/master/src/main/fc/rc.c"],
  ["Betaflight-Quellcode: Standard-Rates (controlrate_profile.c)", "https://github.com/betaflight/betaflight/blob/master/src/main/fc/controlrate_profile.c"],
  ["Betaflight-Quellcode: Mode-Nummern (msp_box.c)", "https://github.com/betaflight/betaflight/blob/master/src/main/msp/msp_box.c"],
  ["Betaflight Wiki", "https://betaflight.com/docs/wiki"],
];

/* ------------------------------------------------------------ Rechnen */

// Drehrate in °/s bei Knüppelausschlag x (-1 … 1), wie applyActualRates.
export function actualRate(x, a) {
  const ax = Math.abs(x);
  const e = (Number(a.expo) || 0) / 100;
  const expof = ax * (Math.pow(x, 5) * e + x * (1 - e));
  const center = (Number(a.rc) || 0) * 10;
  const move = Math.max(0, (Number(a.srate) || 0) * 10 - center);
  return x * center + move * expof;
}

export function maxRate(a) {
  return actualRate(1, a);
}

/* ------------------------------------------------------- diff all lesen */

export function parseDiff(text) {
  const out = { version: null, profiles: {}, active: null, aux: [] };
  const vm = /#\s*Betaflight\s*\/\s*\S+(?:\s*\([^)]*\))?\s+(\d+)\.(\d+)(?:\.(\d+))?/i.exec(text);
  if (vm) out.version = [Number(vm[1]), Number(vm[2]), Number(vm[3] || 0)];
  let cur = null;
  let restore = false;
  String(text).split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (/^#\s*restore original rateprofile selection/i.test(line)) {
      restore = true;
      return;
    }
    let m;
    if ((m = /^rateprofile\s+(\d+)$/i.exec(line))) {
      if (restore) {
        out.active = Number(m[1]);
        restore = false;
        cur = null;
        return;
      }
      cur = out.profiles[m[1]] = out.profiles[m[1]] || { slot: Number(m[1]), set: {} };
      return;
    }
    if (/^(profile|battery_profile)\s+\d+$/i.test(line) || /^(save|batch end)$/i.test(line)) {
      cur = null;
      return;
    }
    if (cur && (m = /^set\s+(\S+)\s*=\s*(.*)$/i.exec(line))) {
      cur.set[m[1].toLowerCase()] = m[2].trim();
      return;
    }
    if ((m = /^aux\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+(\d+))?$/i.exec(line))) {
      const a = { idx: +m[1], box: +m[2], aux: +m[3], start: +m[4], end: +m[5], logic: +m[6], linked: +(m[7] || 0) };
      if (a.start < a.end) out.aux.push(a);
    }
  });
  return out;
}

// Ein Rate-Profil aus dem diff in unser Format. Fehlende Werte = Standard,
// aber nur, wenn die Firmware 4.3 oder neuer ist (davor andere Standards).
export function profileFromDiff(p, version) {
  const modern = !version || version[0] > 4 || (version[0] === 4 && version[1] >= 3);
  const s = p.set;
  const type = (s.rates_type || (modern ? "ACTUAL" : "BETAFLIGHT")).toUpperCase();
  const r = { slot: p.slot, type: type, name: s.rateprofile_name || "" };
  AXES.forEach((ax) => {
    r[ax.k] = {
      rc: s[ax.k + "_rc_rate"] != null ? Number(s[ax.k + "_rc_rate"]) : DEFAULT.rc,
      srate: s[ax.k + "_srate"] != null ? Number(s[ax.k + "_srate"]) : DEFAULT.srate,
      expo: s[ax.k + "_expo"] != null ? Number(s[ax.k + "_expo"]) : DEFAULT.expo,
    };
  });
  return r;
}

export function cliText(r) {
  const lines = ["# FPV OPS · Rates „" + r.name + "“", "rateprofile " + (Number(r.slot) || 0), "set rates_type = ACTUAL"];
  AXES.forEach((ax) => {
    const a = r[ax.k];
    lines.push("set " + ax.k + "_rc_rate = " + a.rc, "set " + ax.k + "_expo = " + a.expo, "set " + ax.k + "_srate = " + a.srate);
  });
  lines.push("save");
  return lines.join("\n");
}

export function createBetaflight(ctx) {
  const S = () => ctx.state();
  const LS = "fpv-ops-v1:bf";
  let tab = "rates";
  let droneId = null;
  let diffId = null;
  try {
    const v = JSON.parse(localStorage.getItem(LS) || "null");
    if (v) {
      tab = v.tab || tab;
      droneId = v.droneId || null;
    }
  } catch (e) {}

  function remember() {
    try {
      localStorage.setItem(LS, JSON.stringify({ tab: tab, droneId: droneId }));
    } catch (e) {}
  }

  function drone() {
    const s = S();
    return s.drones.find((d) => d.id === droneId) || ctx.activeDrone() || s.drones[0] || null;
  }

  function configs(d) {
    return S()
      .bfConfigs.filter((c) => d && c.droneId === d.id)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  function rates(d) {
    return S().rates.filter((r) => d && r.droneId === d.id);
  }

  function radioFor(d) {
    const list = S().radios;
    return list.find((r) => d && (r.droneIds || []).indexOf(d.id) !== -1) || list[0] || null;
  }

  /* ----------------------------------------------------------- Kopf */

  function head(d) {
    const s = S();
    const t = [["rates", "Meine Rates"], ["modes", "Modes"], ["configs", "Stände"]];
    let out = "";
    if (s.drones.length > 1) {
      out +=
        '<label class="field" style="max-width:20rem"><span class="label">Drohne</span><select data-act="bf-drone">' +
        s.drones.map((x) => '<option value="' + x.id + '"' + (d && x.id === d.id ? " selected" : "") + ">" + h(x.name) + "</option>").join("") +
        "</select></label>";
    }
    out +=
      '<div class="levels" role="tablist" style="margin-bottom:14px">' +
      t.map((x) => '<button class="level-tab" role="tab" data-act="bf-tab" data-tab="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + "</button>").join("") +
      "</div>";
    return out;
  }

  /* ---------------------------------------------------------- Kurve */

  function chart(r, id) {
    const W = 300, H = 170, L = 38, B = 22, T = 10, R = 44;
    const top = Math.max(100, ...AXES.map((ax) => maxRate(r[ax.k])));
    const yMax = Math.ceil(top / 200) * 200;
    const X = (x) => L + x * (W - L - R);
    const Y = (v) => H - B - (v / yMax) * (H - B - T);
    let g = "";
    for (let v = 0; v <= yMax; v += yMax / 4) {
      g += '<line class="bf-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"></line>' +
        '<text class="bf-tick" x="' + (L - 5) + '" y="' + Y(v) + '" text-anchor="end">' + Math.round(v) + "</text>";
    }
    [0, 0.25, 0.5, 0.75, 1].forEach((x) => {
      g += '<text class="bf-tick" x="' + X(x) + '" y="' + (H - 6) + '" text-anchor="middle">' + Math.round(x * 100) + "%</text>";
    });
    // Beschriftung am Kurvenende, bei gleichen Werten untereinander versetzt.
    const ends = AXES.map((ax) => ({ ax: ax, y: Y(maxRate(r[ax.k])) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 11) ends[i].y = ends[i - 1].y + 11;
    AXES.forEach((ax) => {
      let d = "";
      for (let i = 0; i <= 50; i++) {
        const x = i / 50;
        d += (i ? "L" : "M") + X(x).toFixed(1) + " " + Y(actualRate(x, r[ax.k])).toFixed(1);
      }
      g += '<path class="bf-line" d="' + d + '" stroke="' + ax.color + '"' + (ax.dash ? ' stroke-dasharray="' + ax.dash + '"' : "") + "></path>";
    });
    ends.forEach((e) => {
      g += '<text class="bf-end" x="' + (W - R + 4) + '" y="' + e.y + '">' + e.ax.label + "</text>";
    });
    return (
      '<div class="bf-chart" data-rid="' + h(id) + '">' +
      '<svg viewBox="0 0 ' + W + " " + H + '" class="bf-svg" role="img" aria-label="Rate-Kurve Roll, Pitch, Yaw">' + g +
      '<line class="bf-cross" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" style="display:none"></line></svg>' +
      '<div class="bf-legend">' +
      AXES.map((ax) => '<span><i style="border-color:' + ax.color + (ax.dash ? ";border-top-style:dashed" : "") + '"></i>' + ax.label + "</span>").join("") +
      '<span class="bf-readout">Knüppel antippen oder darüberfahren</span></div></div>'
    );
  }

  /* --------------------------------------------------------- Seiten */

  function axisTable(r) {
    return (
      '<div class="lp-scroll"><table class="lp-table"><thead><tr><th>Achse</th><th>Center °/s</th><th>Max °/s</th><th>Expo</th></tr></thead><tbody>' +
      AXES.map((ax) => {
        const a = r[ax.k];
        return "<tr><td>" + ax.label + "</td><td>" + a.rc * 10 + "</td><td>" + Math.round(maxRate(a)) + "</td><td>" + (a.expo / 100).toFixed(2).replace(".", ",") + "</td></tr>";
      }).join("") +
      "</tbody></table></div>"
    );
  }

  function renderRates(d) {
    const list = rates(d);
    let out =
      '<div class="section-head"><span class="label label--accent">Meine Rates</span><span class="section-head__rule"></span>' +
      (configs(d).length ? '<button class="btn btn--sm" data-act="bf-import">Aus diff all</button>' : "") +
      '<button class="btn btn--sm btn--primary" data-act="bf-rate-new">Profil anlegen</button></div>';
    if (!list.length) {
      out +=
        '<div class="empty">Noch keine Rates für ' + h(d.name) + ". " +
        (configs(d).length ? "Übernimm sie aus deinem gespeicherten diff all oder leg ein Profil an." : "Leg ein Profil an oder speichere unter <em>Stände</em> zuerst ein diff all.") +
        "</div>";
      return out;
    }
    out += '<div class="grid grid--2">';
    list.forEach((r) => {
      out +=
        '<div class="card bf-rate">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">' +
        "<div><h3>" + h(r.name) + '</h3><div class="row__meta">Actual Rates · Rate-Profil ' + ((Number(r.slot) || 0) + 1) + "</div></div>" +
        '<div class="bf-max"><strong class="mono">' + Math.round(maxRate(r.roll)) + '</strong><span>°/s Roll max</span></div></div>' +
        chart(r, r.id) +
        axisTable(r) +
        (r.note ? '<div class="row__meta" style="margin-top:6px">' + h(r.note) + "</div>" : "") +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' +
        '<button class="btn btn--sm" data-act="bf-cli" data-id="' + r.id + '">CLI kopieren</button>' +
        '<button class="btn btn--sm" data-act="bf-rate-edit" data-id="' + r.id + '">Bearbeiten</button></div></div>';
    });
    out += "</div>";
    return out;
  }

  function modeRows(d, cfg) {
    const p = parseDiff(cfg.text);
    const radio = radioFor(d);
    const ctlOnCh = (ch) => {
      if (!radio) return [];
      const keys = Object.keys(radio.map || {}).filter((k) => Number(radio.map[k].ch) === ch);
      return keys.map((k) => {
        const extra = (radio.extra || []).find((x) => x.key === k);
        return (extra ? extra.label : k) + (radio.map[k].fn ? " (" + radio.map[k].fn + ")" : "");
      });
    };
    const hints = [];
    const rows = p.aux.map((a) => {
      const ch = a.aux + 5;
      const ctl = ctlOnCh(ch);
      const name = BOXES[a.box] || "Mode " + a.box;
      if (radio && !ctl.length) hints.push({ lvl: "warn", t: name + " hängt in Betaflight an CH" + ch + " (AUX" + (a.aux + 1) + "), an der Funke ist dieser Kanal nicht belegt." });
      return { name: name, ch: ch, aux: a.aux + 1, range: a.start + "–" + a.end, ctl: ctl };
    });
    if (radio) {
      const armBf = p.aux.find((a) => a.box === 0);
      const armKey = Object.keys(radio.map || {}).find((k) => /^arm$/i.test((radio.map[k].fn || "").trim()));
      const armRadio = armKey ? Number(radio.map[armKey].ch) : null;
      if (armBf && armRadio && armBf.aux + 5 !== armRadio)
        hints.unshift({ lvl: "warn", t: "ARM: Betaflight erwartet CH" + (armBf.aux + 5) + ", an der Funke liegt Arm auf CH" + armRadio + "." });
      else if (armBf && armRadio) hints.unshift({ lvl: "ok", t: "ARM passt: Betaflight und Funke auf CH" + armRadio + "." });
      if (armBf && armBf.aux + 5 !== 5) hints.push({ lvl: "warn", t: "ARM liegt in Betaflight nicht auf AUX1. ExpressLRS will Arm auf CH5 (AUX1)." });
      if (!armBf) hints.push({ lvl: "info", t: "Im diff all steht keine ARM-Zuordnung (aux … 0 …)." });
    }
    return { p: p, rows: rows, hints: hints, radio: radio };
  }

  function renderModes(d) {
    const list = configs(d);
    let out = '<div class="section-head"><span class="label label--accent">Modes</span><span class="section-head__rule"></span></div>';
    if (!list.length) return out + '<div class="empty">Kein diff all für ' + h(d.name) + " gespeichert. Unter <em>Stände</em> hinzufügen.</div>";
    const cfg = list.find((c) => c.id === diffId) || list[0];
    const m = modeRows(d, cfg);
    if (list.length > 1) {
      out +=
        '<label class="field" style="max-width:24rem"><span class="label">Stand</span><select data-act="bf-diff">' +
        list.map((c) => '<option value="' + c.id + '"' + (c.id === cfg.id ? " selected" : "") + ">" + deDate(c.date) + (c.label ? " · " + h(c.label) : "") + "</option>").join("") +
        "</select></label>";
    }
    out += m.hints.map((x) => '<div class="lp-msg ' + (x.lvl === "warn" ? "lp-msg--warn" : x.lvl === "ok" ? "lp-msg--ok" : "") + ' bf-hint">' + h(x.t) + "</div>").join("");
    out +=
      '<div class="card" style="margin-top:10px">' +
      (m.rows.length
        ? '<div class="lp-scroll"><table class="lp-table rd-table bf-modes"><thead><tr><th>Mode</th><th>Kanal</th><th>Bereich</th><th>Funke</th></tr></thead><tbody>' +
          m.rows.map((r) => "<tr><td>" + h(r.name) + "</td><td>CH" + r.ch + " · AUX" + r.aux + "</td><td>" + r.range + " µs</td><td>" + (r.ctl.length ? h(r.ctl.join(", ")) : "—") + "</td></tr>").join("") +
          "</tbody></table></div>"
        : '<div class="empty">Keine Modes im diff all gefunden.</div>') +
      '<small class="lp-small">Aus den <code>aux</code>-Zeilen des diff all vom ' + deDate(cfg.date) + ". " +
      (m.radio ? "Verglichen mit der Funke " + h(m.radio.name) + "." : "Erfasse unter <em>Funke</em> deine Belegung, dann vergleicht die App beides.") +
      "</small></div>";
    return out;
  }

  function renderConfigs(d) {
    const list = configs(d);
    return (
      '<div class="section-head"><span class="label label--accent">Stände (diff all)</span><span class="section-head__rule"></span>' +
      '<button class="btn btn--sm btn--primary" data-act="ws-bf" data-id="' + d.id + '">Verwalten</button></div>' +
      (list.length
        ? '<div class="card card--flush">' +
          list.map((c) => {
            const p = parseDiff(c.text);
            return '<div class="row"><div class="row__main"><div class="row__title">' + deDate(c.date) + (c.label ? " · " + h(c.label) : "") + "</div>" +
              '<div class="row__meta">' + (p.version ? "Betaflight " + p.version.join(".") + " · " : "") + Object.keys(p.profiles).length + " Rate-Profile · " + p.aux.length + " Modes</div></div>" +
              '<div class="row__actions"><button class="btn btn--sm" data-act="ws-bf-view" data-id="' + c.id + '">Ansehen</button></div></div>';
          }).join("") + "</div>"
        : '<div class="empty">Noch kein Stand. In Betaflight unter CLI <code>diff all</code> eingeben und die Ausgabe über <em>Verwalten</em> speichern.</div>')
    );
  }

  function render() {
    const d = drone();
    let out = "";
    if (!d) {
      out = '<div class="empty">Zuerst in der Werkstatt eine Drohne anlegen.</div>';
    } else {
      out = head(d);
      if (tab === "modes") out += renderModes(d);
      else if (tab === "configs") out += renderConfigs(d);
      else out += renderRates(d);
    }
    out +=
      '<div class="card" style="margin-top:16px"><div class="label label--accent" style="margin-bottom:8px">Quellen</div><ul class="lp-list">' +
      SRC.map((s) => '<li><a href="' + s[1] + '" target="_blank" rel="noopener">' + h(s[0]) + "</a></li>").join("") +
      "</ul></div>";
    $("#view-betaflight").innerHTML = out;
  }

  /* -------------------------------------------------------- Dialoge */

  function rateDialog(id) {
    const r = id ? S().rates.find((x) => x.id === id) : null;
    const v = r || { name: "", slot: 0, note: "", roll: Object.assign({}, DEFAULT), pitch: Object.assign({}, DEFAULT), yaw: Object.assign({}, DEFAULT) };
    const f = (ax, key, val, extra) =>
      '<td><input type="text" inputmode="decimal" class="bf-in" data-act="bf-live" data-ax="' + ax + '" data-key="' + key + '" value="' + h(val) + '"' + (extra || "") + "></td>";
    ctx.openDialog(
      r ? "Rates bearbeiten" : "Rates anlegen",
      '<div class="form-row">' +
        '<label class="field"><span class="label">Name</span><input type="text" id="bf-name" value="' + h(v.name) + '" placeholder="z. B. Freestyle"></label>' +
        '<label class="field"><span class="label">Rate-Profil in Betaflight</span><select id="bf-slot">' +
        // Betaflight hat standardmässig 4 Rate-Profile, manche Flugcontroller 6 (common_pre.h).
        [0, 1, 2, 3, 4, 5].map((i) => '<option value="' + i + '"' + (Number(v.slot) === i ? " selected" : "") + ">" + (i + 1) + (i > 3 ? " (nur bei 6 Profilen)" : "") + "</option>").join("") +
        "</select></label></div>" +
        '<div class="lp-scroll"><table class="lp-table bf-edit"><thead><tr><th>Achse</th><th>Center °/s</th><th>Max °/s</th><th>Expo</th></tr></thead><tbody>' +
        AXES.map((ax) => {
          const a = v[ax.k];
          return "<tr><td>" + ax.label + "</td>" + f(ax.k, "rc", a.rc * 10) + f(ax.k, "srate", a.srate * 10) + f(ax.k, "expo", (a.expo / 100).toFixed(2).replace(".", ",")) + "</tr>";
        }).join("") +
        "</tbody></table></div>" +
        '<small class="lp-small">Wie im Betaflight-Reiter Rates (Actual): Center und Max in °/s, Schritte zu 10. Expo 0 bis 1. Standard: 70 / 670 / 0.</small>' +
        '<div id="bf-preview" style="margin-top:8px">' + chart(v, "preview") + "</div>" +
        '<label class="field"><span class="label">Notiz</span><textarea id="bf-note" placeholder="z. B. im Sim gleich eingestellt">' + h(v.note) + "</textarea></label>",
      (r ? '<button type="button" class="btn btn--danger" data-act="bf-rate-del" data-id="' + r.id + '">Löschen</button>' : "") +
        '<button type="button" class="btn btn--primary" data-act="bf-rate-save" data-id="' + (r ? r.id : "") + '">Speichern</button>'
    );
  }

  // Liest die Eingaben im Dialog in Betaflight-Zahlen (gerundet wie im Configurator).
  function readDialog() {
    const num = (x) => Number(String(x).replace(",", "."));
    const v = { roll: {}, pitch: {}, yaw: {} };
    $$(".bf-in").forEach((el) => {
      const n = num(el.value);
      const a = v[el.dataset.ax];
      if (el.dataset.key === "rc") a.rc = Math.min(255, Math.max(1, Math.round((n || 10) / 10)));
      else if (el.dataset.key === "srate") a.srate = Math.min(255, Math.max(0, Math.round((n || 0) / 10)));
      else a.expo = Math.min(100, Math.max(0, Math.round((n || 0) * 100)));
    });
    return v;
  }

  function rateSave(id) {
    const v = readDialog();
    const rec = Object.assign(v, {
      name: $("#bf-name").value.trim() || "Rates",
      slot: Number($("#bf-slot").value) || 0,
      note: $("#bf-note").value.trim(),
    });
    if (id) Object.assign(S().rates.find((x) => x.id === id), rec);
    else S().rates.push(Object.assign({ id: uid(), droneId: drone().id, source: "", added: today() }, rec));
    ctx.save();
    ctx.closeDialog();
    render();
    ctx.toast("Rates gespeichert");
  }

  function importDialog() {
    const d = drone();
    const list = configs(d);
    const cfg = list[0];
    if (!cfg) return;
    const p = parseDiff(cfg.text);
    const found = Object.keys(p.profiles).map((k) => profileFromDiff(p.profiles[k], p.version));
    const old = p.version && (p.version[0] < 4 || (p.version[0] === 4 && p.version[1] < 3));
    ctx.openDialog(
      "Rates aus diff all",
      '<div class="row__meta" style="margin-bottom:10px">Stand vom ' + deDate(cfg.date) + (cfg.label ? " · " + h(cfg.label) : "") + (p.version ? " · Betaflight " + p.version.join(".") : "") + "</div>" +
        (old ? '<div class="lp-msg lp-msg--warn">Firmware älter als 4.3: Dort waren andere Rates Standard. Nur ausdrücklich gesetzte Werte sind sicher.</div>' : "") +
        (found.length
          ? found.map((r) => {
              const actual = r.type === "ACTUAL";
              return '<label class="lp-check" style="margin:8px 0"><input type="checkbox" class="bf-pick" value="' + r.slot + '"' + (actual ? " checked" : " disabled") + "> <span>Rate-Profil " + (r.slot + 1) + (r.name ? " „" + h(r.name) + "“" : "") +
                (p.active === r.slot ? " · aktiv" : "") + " · " + (actual ? "Roll max " + Math.round(maxRate(r.roll)) + " °/s" : "Typ " + h(r.type) + ": bitte in Betaflight auf Actual umstellen") + "</span></label>";
            }).join("")
          : '<div class="empty">Keine Rate-Profile im diff all gefunden. Steht dort <code>rateprofile 0</code>?</div>'),
      (found.length ? '<button type="button" class="btn btn--primary" data-act="bf-import-go" data-id="' + cfg.id + '">Übernehmen</button>' : "")
    );
  }

  function importGo(cfgId) {
    const d = drone();
    const cfg = S().bfConfigs.find((c) => c.id === cfgId);
    if (!cfg) return;
    const p = parseDiff(cfg.text);
    const picks = $$(".bf-pick").filter((x) => x.checked).map((x) => x.value);
    picks.forEach((slot) => {
      const r = profileFromDiff(p.profiles[slot], p.version);
      const prev = S().rates.find((x) => x.droneId === d.id && x.source === cfg.id && Number(x.slot) === r.slot);
      const rec = {
        name: r.name || "Rate-Profil " + (r.slot + 1), slot: r.slot, roll: r.roll, pitch: r.pitch, yaw: r.yaw,
        note: "Aus diff all vom " + deDate(cfg.date), source: cfg.id,
      };
      if (prev) Object.assign(prev, rec);
      else S().rates.push(Object.assign({ id: uid(), droneId: d.id, added: today() }, rec));
    });
    ctx.save();
    ctx.closeDialog();
    render();
    ctx.toast(picks.length + (picks.length === 1 ? " Profil übernommen" : " Profile übernommen"));
  }

  function copy(txt, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => ctx.toast(msg), () => ctx.toast("Kopieren nicht erlaubt"));
    else ctx.toast("Kopieren nicht möglich");
  }

  /* ----------------------------------------------------------- API */

  function click(act, el) {
    switch (act) {
      case "bf-tab":
        tab = el.dataset.tab;
        remember();
        render();
        return true;
      case "bf-rate-new":
        rateDialog(null);
        return true;
      case "bf-rate-edit":
        rateDialog(el.dataset.id);
        return true;
      case "bf-rate-save":
        rateSave(el.dataset.id);
        return true;
      case "bf-rate-del":
        if (window.confirm("Dieses Rate-Profil löschen?")) {
          S().rates = S().rates.filter((x) => x.id !== el.dataset.id);
          ctx.save();
          ctx.closeDialog();
          render();
          ctx.toast("Rates gelöscht");
        }
        return true;
      case "bf-cli": {
        const r = S().rates.find((x) => x.id === el.dataset.id);
        if (r) copy(cliText(r), "CLI-Befehle kopiert. In Betaflight unter CLI einfügen.");
        return true;
      }
      case "bf-import":
        importDialog();
        return true;
      case "bf-import-go":
        importGo(el.dataset.id);
        return true;
    }
    return false;
  }

  function change(ev) {
    const t = ev.target;
    if (!t || !t.dataset) return false;
    if (t.dataset.act === "bf-drone") {
      droneId = t.value;
      diffId = null;
      remember();
      render();
      return true;
    }
    if (t.dataset.act === "bf-diff") {
      diffId = t.value;
      render();
      return true;
    }
    return false;
  }

  // Vorschau im Dialog beim Tippen.
  function input(ev) {
    const t = ev.target;
    if (!t || !t.dataset || t.dataset.act !== "bf-live") return false;
    const box = $("#bf-preview");
    if (box) box.innerHTML = chart(readDialog(), "preview");
    return true;
  }

  // Ablesen: Knüppelstellung unter dem Finger oder der Maus.
  function pointer(ev) {
    const svg = ev.target && ev.target.closest && ev.target.closest(".bf-svg");
    if (!svg) return false;
    const wrap = svg.closest(".bf-chart");
    const id = wrap.dataset.rid;
    const r = id === "preview" ? readDialog() : S().rates.find((x) => x.id === id);
    if (!r) return false;
    const box = svg.getBoundingClientRect();
    const vx = ((ev.clientX - box.left) / box.width) * 300;
    const x = Math.min(1, Math.max(0, (vx - 38) / (300 - 38 - 44)));
    const line = svg.querySelector(".bf-cross");
    line.setAttribute("x1", 38 + x * 218);
    line.setAttribute("x2", 38 + x * 218);
    line.style.display = "";
    wrap.querySelector(".bf-readout").textContent =
      "Knüppel " + Math.round(x * 100) + " %: " + AXES.map((ax) => ax.label + " " + Math.round(actualRate(x, r[ax.k])) + " °/s").join(" · ");
    return true;
  }

  return { render: render, click: click, change: change, input: input, pointer: pointer };
}
