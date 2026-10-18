/* ==========================================================================
   FPV OPS — Funke: Schalter, Tasten und Regler belegen
   Eine Funke ist ein Datensatz in state.radios: Vorlage (z. B. TX16S Mk3)
   plus eigene Anpassungen (ctlEdit), zusätzliche Elemente (extra) und die
   Belegung pro Element (map). Die Vorlage selbst wird nie gespeichert, damit
   Korrekturen an der Zeichnung alle Funken erreichen.
   ========================================================================== */

import { $, $$, uid, h } from "../core/util.js";
import { putFile, getFile, delFile } from "../core/files.js";

const KINDS = {
  sw2: { label: "Schalter, 2 Stellungen", pos: ["oben", "unten"] },
  sw3: { label: "Schalter, 3 Stellungen", pos: ["oben", "Mitte", "unten"] },
  btn: { label: "Taster", pos: ["gedrückt"] },
  pot: { label: "Drehregler", pos: ["Bereich"] },
  slider: { label: "Schieber", pos: ["Bereich"] },
  trim: { label: "Trimmtaste", pos: ["Funktion"] },
};

// Vorschläge, frei überschreibbar. Namen wie im Betaflight-Reiter "Modes".
const FUNCTIONS = [
  "Arm", "Angle", "Horizon", "Air Mode", "Flip over after crash (Turtle)", "Beeper",
  "Prearm", "GPS Rescue", "Blackbox", "OSD aus", "Rate-Profil", "Ansage / Timer", "Sonstiges",
];

const CHANNELS = [];
for (let c = 5; c <= 16; c++) CHANNELS.push({ v: c, label: "CH" + c + " (AUX" + (c - 4) + ")" });

/* TX16S Mk3, Mode 2, schematisch nach dem offiziellen Handbuch (Quick Start
   Guide v1.8, Seite 1 und 4): vorne SA, SB, SC, SD, SE, SG mit 3 Stellungen,
   S1/S2 als Drehregler, Trimmung T1–T6, 6 Pos Buttons unter den Knüppeln;
   hinten SF mit 2 Stellungen, SH als Taster, Schieber LS und RS. */
const W = 34, H = 22;
const TEMPLATES = {
  "tx16s-mk3": {
    name: "RadioMaster TX16S Mk3",
    // Offizielles Handbuch auf dem Server von RadioMaster (Version 1.8), von Hugo geliefert.
    manualUrl: "https://cdn.shopify.com/s/files/1/0701/8066/7584/files/TX16SMK3_manual_1.8.pdf?v=1789608956",
    controls: [
      { key: "SE", kind: "sw3", x: 40, y: 8, w: W, h: H, zone: "Schulter" },
      { key: "SF", kind: "sw2", x: 80, y: 8, w: W, h: H, zone: "Schulter" },
      { key: "SG", kind: "sw3", x: 286, y: 8, w: W, h: H, zone: "Schulter" },
      { key: "SH", kind: "btn", x: 326, y: 8, w: W, h: H, zone: "Schulter" },
      { key: "SA", kind: "sw3", x: 40, y: 50, w: W, h: H },
      { key: "SB", kind: "sw3", x: 80, y: 50, w: W, h: H },
      { key: "SC", kind: "sw3", x: 286, y: 50, w: W, h: H },
      { key: "SD", kind: "sw3", x: 326, y: 50, w: W, h: H },
      { key: "S1", kind: "pot", x: 140, y: 50, w: 28, h: 22 },
      { key: "S2", kind: "pot", x: 232, y: 50, w: 28, h: 22 },
      { key: "T5", kind: "trim", x: 148, y: 82, w: 36, h: 11 },
      { key: "T6", kind: "trim", x: 216, y: 82, w: 36, h: 11 },
      { key: "T3", kind: "trim", x: 168, y: 110, w: 12, h: 48 },
      { key: "T2", kind: "trim", x: 220, y: 110, w: 12, h: 48 },
      { key: "T4", kind: "trim", x: 64, y: 196, w: 60, h: 12 },
      { key: "T1", kind: "trim", x: 276, y: 196, w: 60, h: 12 },
      { key: "B1", label: "6-Pos 1", kind: "btn", x: 134, y: 212, w: 18, h: 14 },
      { key: "B2", label: "6-Pos 2", kind: "btn", x: 156, y: 212, w: 18, h: 14 },
      { key: "B3", label: "6-Pos 3", kind: "btn", x: 178, y: 212, w: 18, h: 14 },
      { key: "B4", label: "6-Pos 4", kind: "btn", x: 204, y: 212, w: 18, h: 14 },
      { key: "B5", label: "6-Pos 5", kind: "btn", x: 226, y: 212, w: 18, h: 14 },
      { key: "B6", label: "6-Pos 6", kind: "btn", x: 248, y: 212, w: 18, h: 14 },
      { key: "LS", kind: "slider", x: 60, y: 330, w: 80, h: 20, zone: "Rückseite" },
      { key: "RS", kind: "slider", x: 260, y: 330, w: 80, h: 20, zone: "Rückseite" },
    ],
  },
};

const SRC = [
  ["RadioMaster: TX16S Mk3 Quick Start Guide v1.8 (Schalter, Tasten, Regler)", "https://cdn.shopify.com/s/files/1/0701/8066/7584/files/TX16SMK3_manual_1.8.pdf?v=1789608956"],
  ["ExpressLRS: Switch Configs (Arm auf CH5 / AUX1)", "https://expresslrs.org/software/switch-config/"],
  ["Oscar Liang: Schalter in EdgeTX einrichten (Mixes)", "https://oscarliang.com/setup-switch-mixes/"],
];

export function createRadio(ctx) {
  const S = () => ctx.state();
  const LS = "fpv-ops-v1:radio";
  let current = null;
  try {
    current = localStorage.getItem(LS);
  } catch (e) {}

  function remember() {
    try {
      localStorage.setItem(LS, current || "");
    } catch (e) {}
  }

  // Bild oder Zeichnung, pro Gerät gemerkt.
  let viewMode = "photo";
  try {
    viewMode = localStorage.getItem(LS + ":view") || "photo";
  } catch (e) {}
  let placing = false;
  let placeKey = null;

  /* --------------------------------------- Dateien (nur auf dem Gerät) */

  const urls = {}; // id -> Objekt-URL, oder false wenn hier nicht vorhanden
  const loading = {};

  function fileUrl(id) {
    if (id in urls) return urls[id];
    if (!loading[id]) {
      loading[id] = getFile(id)
        .then((blob) => {
          urls[id] = blob ? URL.createObjectURL(blob) : false;
        })
        .catch(() => {
          urls[id] = false;
        })
        .then(render);
    }
    return null;
  }

  function addFiles(r, list, reuseId) {
    const files = Array.prototype.slice.call(list || []);
    if (!files.length) return Promise.resolve();
    r.docs = r.docs || [];
    return Promise.all(
      files.map((f, i) => {
        const id = (i === 0 && reuseId) || uid();
        return putFile(id, f).then(() => {
          if (urls[id]) URL.revokeObjectURL(urls[id]);
          delete urls[id];
          delete loading[id];
          const meta = { id: id, name: f.name, type: f.type || "", size: f.size };
          const at = r.docs.findIndex((d) => d.id === id);
          if (at === -1) r.docs.push(meta);
          else r.docs[at] = meta;
          // Das erste Bild wird automatisch zum Bild der Funke.
          if (!r.photoId && /^image\//.test(meta.type)) r.photoId = id;
        });
      })
    ).then(() => {
      ctx.save();
      render();
      ctx.toast(files.length === 1 ? "Datei gespeichert" : files.length + " Dateien gespeichert");
    }, () => ctx.toast("Datei liess sich nicht speichern"));
  }

  function openDoc(d) {
    getFile(d.id).then((blob) => {
      if (!blob) return ctx.toast("Datei liegt nicht auf diesem Gerät");
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) {
        const a = document.createElement("a");
        a.href = url;
        a.download = d.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }

  function size(n) {
    n = Number(n) || 0;
    return n > 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " kB";
  }

  /* ------------------------------------------------------------ Modell */

  function radios() {
    return S().radios;
  }

  function active() {
    const list = radios();
    return list.find((r) => r.id === current) || list[0] || null;
  }

  // Alle Elemente einer Funke: Vorlage + Anpassungen + eigene.
  function controls(r) {
    const tpl = TEMPLATES[r.template];
    const edit = r.ctlEdit || {};
    const base = tpl
      ? tpl.controls.map((c) => Object.assign({}, c, { label: c.label || c.key }, edit[c.key] || {}))
      : [];
    const extra = (r.extra || []).map((c) => Object.assign({ custom: true }, c));
    return base.concat(extra).filter((c) => !c.hidden);
  }

  // Ein neues Element existiert erst nach "Speichern", bis dahin nur hier.
  let pending = null;

  function ctlOf(r, key) {
    if (pending && pending.key === key) return Object.assign({ custom: true }, pending);
    return controls(r).find((c) => c.key === key) || null;
  }

  function mapOf(r, key) {
    return (r.map || {})[key] || null;
  }

  function isMapped(m) {
    return !!(m && (m.fn || m.ch || (m.pos || []).some(Boolean) || m.note));
  }

  function chLabel(ch) {
    const c = CHANNELS.find((x) => x.v === Number(ch));
    return c ? c.label : "";
  }

  // Hinweise, die beim Einrichten Ärger sparen. Nur, was eine Quelle hat.
  function checks(r) {
    const out = [];
    const list = controls(r);
    const byCh = {};
    let arm = null;
    list.forEach((c) => {
      const m = mapOf(r, c.key);
      if (!m) return;
      if (m.ch) (byCh[m.ch] = byCh[m.ch] || []).push(c.label);
      if (/^arm$/i.test((m.fn || "").trim())) arm = { c: c, m: m };
    });
    Object.keys(byCh).forEach((ch) => {
      if (byCh[ch].length > 1)
        out.push({ lvl: "warn", t: chLabel(ch) + " doppelt belegt: " + byCh[ch].join(", ") + "." });
    });
    if (!arm) out.push({ lvl: "info", t: "Noch kein Element mit der Funktion Arm." });
    else if (Number(arm.m.ch) !== 5)
      out.push({ lvl: "warn", t: "Arm liegt auf " + (chLabel(arm.m.ch) || "keinem Kanal") + ". ExpressLRS will Arm auf CH5 (AUX1)." });
    list.forEach((c) => {
      const m = mapOf(r, c.key);
      if (m && Number(m.ch) === 5 && c.kind !== "sw2" && c.kind !== "btn")
        out.push({ lvl: "warn", t: c.label + " ist ein " + KINDS[c.kind].label + " auf CH5. ExpressLRS überträgt CH5 (ausser in den Full-Res-Modi) nur mit 2 Stellungen." });
    });
    return out;
  }

  /* ----------------------------------------------------------- Ansicht */

  function svg(r) {
    const tpl = TEMPLATES[r.template];
    if (!tpl) return "";
    const els = controls(r).filter((c) => c.x != null);
    const node = (c) => {
      const m = mapOf(r, c.key);
      const on = isMapped(m);
      const round = c.kind === "pot" ? 11 : c.kind === "btn" ? 4 : 3;
      const vertical = c.h > c.w;
      return (
        '<g class="rd-ctl' + (on ? " is-on" : "") + '" data-act="rd-ctl" data-key="' + h(c.key) + '" role="button" tabindex="0" aria-label="' + h(c.label) + '">' +
        '<rect x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" rx="' + round + '"></rect>' +
        '<text x="' + (c.x + c.w / 2) + '" y="' + (c.y + c.h / 2) + '"' +
        (vertical ? ' transform="rotate(-90 ' + (c.x + c.w / 2) + " " + (c.y + c.h / 2) + ')"' : "") + ">" +
        h(c.key.length > 3 ? c.key.slice(0, 3) : c.key.replace(/^B/, "")) + "</text>" +
        (on && m.ch ? '<text class="rd-ch" x="' + (c.x + c.w / 2) + '" y="' + (c.y + c.h + (c.zone ? 9 : 9)) + '">' + m.ch + "</text>" : "") +
        "</g>"
      );
    };
    return (
      '<svg class="rd-svg" viewBox="0 0 400 360" role="group" aria-label="' + h(tpl.name) + ' schematisch">' +
      '<text class="rd-zone" x="200" y="15">Schulter vorne: SE, SG</text><text class="rd-zone" x="200" y="27">hinten: SF, SH</text>' +
      '<rect class="rd-body" x="20" y="40" width="360" height="270" rx="34"></rect>' +
      '<circle class="rd-stick" cx="100" cy="140" r="42"></circle><circle class="rd-stick" cx="300" cy="140" r="42"></circle>' +
      '<text class="rd-zone" x="100" y="136">Gas / Gier</text><text class="rd-zone" x="100" y="148">CH3 / CH4</text>' +
      '<text class="rd-zone" x="300" y="136">Nick / Roll</text><text class="rd-zone" x="300" y="148">CH2 / CH1</text>' +
      '<circle class="rd-fixed" cx="200" cy="134" r="9"></circle><text class="rd-zone" x="200" y="152">Power</text>' +
      '<circle class="rd-fixed" cx="44" cy="216" r="8"></circle><text class="rd-zone" x="44" y="232">SYS</text>' +
      '<circle class="rd-fixed" cx="356" cy="216" r="8"></circle><text class="rd-zone" x="356" y="232">MDL</text>' +
      ["RTN", "PAGE>", "PAGE<", "TELE"].map((t, i) => '<rect class="rd-fixed" x="80" y="' + (240 + i * 15) + '" width="34" height="11" rx="5"></rect><text class="rd-zone" x="97" y="' + (246 + i * 15) + '">' + t + "</text>").join("") +
      '<rect class="rd-screen" x="128" y="238" width="144" height="62" rx="6"></rect>' +
      '<text class="rd-zone" x="200" y="269">Touchscreen</text>' +
      '<rect class="rd-fixed" x="292" y="240" width="12" height="56" rx="5"></rect><text class="rd-zone" x="322" y="268">Rad</text>' +
      '<text class="rd-zone" x="200" y="322">Rückseite</text>' +
      els.map(node).join("") +
      "</svg>"
    );
  }

  function tile(r, c) {
    const m = mapOf(r, c.key);
    const on = isMapped(m);
    return (
      '<button class="rd-tile' + (on ? " is-on" : "") + '" data-act="rd-ctl" data-key="' + h(c.key) + '">' +
      "<strong>" + h(c.label) + "</strong>" +
      "<span>" + (on ? h([m.ch ? "CH" + m.ch : "", m.fn || ""].filter(Boolean).join(" · ")) : KINDS[c.kind].label) + "</span>" +
      "</button>"
    );
  }

  function table(r) {
    const rows = controls(r)
      .map((c) => ({ c: c, m: mapOf(r, c.key) }))
      .filter((x) => isMapped(x.m))
      .sort((a, b) => (Number(a.m.ch) || 99) - (Number(b.m.ch) || 99) || a.c.label.localeCompare(b.c.label));
    if (!rows.length) return '<div class="empty">Noch nichts belegt. Tipp ein Element in der Zeichnung an.</div>';
    return (
      '<div class="lp-scroll"><table class="lp-table rd-table"><thead><tr><th>Kanal</th><th>Element</th><th>Funktion</th><th>Stellungen</th></tr></thead><tbody>' +
      rows
        .map((x) => {
          const pos = KINDS[x.c.kind].pos
            .map((p, i) => ((x.m.pos || [])[i] ? p + ": " + (x.m.pos || [])[i] : ""))
            .filter(Boolean)
            .join(" · ");
          return (
            '<tr data-act="rd-ctl" data-key="' + h(x.c.key) + '"><td>' + (x.m.ch ? "CH" + x.m.ch : "—") + "</td><td>" + h(x.c.label) +
            "</td><td>" + h(x.m.fn || "—") + "</td><td>" + h(pos || x.m.note || "") + "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>"
    );
  }

  function photoBlock(r) {
    const url = fileUrl(r.photoId);
    if (url === null) return '<div class="rd-photo rd-photo--loading">Bild wird geladen …</div>';
    if (url === false)
      return '<div class="lp-msg">Das Bild der Funke liegt auf einem anderen Gerät. Unten bei <em>Unterlagen</em> hier nochmals wählen, die Positionen bleiben erhalten.</div>';
    const pins = r.pins || {};
    const all = controls(r);
    let out =
      '<div class="rd-photo' + (placing ? " is-placing" : "") + '">' +
      '<img src="' + url + '" alt="' + h(r.name) + '" data-act="rd-photo-tap" draggable="false">' +
      all
        .filter((c) => pins[c.key])
        .map((c) => {
          const m = mapOf(r, c.key);
          const on = isMapped(m);
          return (
            '<button class="rd-pin' + (on ? " is-on" : "") + (placing && placeKey === c.key ? " is-sel" : "") +
            '" style="left:' + pins[c.key].x + "%;top:" + pins[c.key].y + '%" data-act="rd-pin" data-key="' + h(c.key) + '" title="' + h(c.label) + '">' +
            h(c.key.length > 3 ? c.label.slice(0, 3) : c.key.replace(/^B(\d)$/, "$1")) +
            (on && m.ch ? "<small>" + m.ch + "</small>" : "") +
            "</button>"
          );
        })
        .join("") +
      "</div>";
    if (placing) {
      out +=
        '<div class="lp-msg rd-placebar">' + (placeKey ? "Tipp aufs Bild, wo <strong>" + h((ctlOf(r, placeKey) || {}).label || placeKey) + "</strong> sitzt." : "Element wählen, dann aufs Bild tippen.") + "</div>" +
        '<div class="rd-chips">' +
        all.map((c) => '<button class="rd-chip' + (pins[c.key] ? " is-done" : "") + (placeKey === c.key ? " is-sel" : "") + '" data-act="rd-place-pick" data-key="' + h(c.key) + '">' + h(c.label) + "</button>").join("") +
        "</div>" +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' +
        (placeKey && pins[placeKey] ? '<button class="btn btn--sm" data-act="rd-pin-del" data-key="' + h(placeKey) + '">Position entfernen</button>' : "") +
        '<button class="btn btn--sm btn--primary" data-act="rd-place">Fertig</button></div>';
    } else {
      const open = all.filter((c) => !pins[c.key]).length;
      out +=
        '<small class="lp-small">Punkte antippen zum Belegen.' + (open ? " " + open + " Elemente sind noch nicht auf dem Bild platziert." : "") + "</small>" +
        '<div style="margin-top:6px"><button class="btn btn--sm" data-act="rd-place">Elemente platzieren</button></div>';
    }
    return out;
  }

  function docsCard(r) {
    const docs = r.docs || [];
    return (
      '<div class="card" style="margin-top:12px"><div class="label label--accent" style="margin-bottom:8px">Unterlagen</div>' +
      (r.manualUrl
        ? '<a class="btn btn--sm rd-manual" href="' + h(r.manualUrl) + '" target="_blank" rel="noopener">Bedienungsanleitung online öffnen</a>'
        : '<div class="row__meta">Kein Link zur Bedienungsanleitung. Unter <em>Bearbeiten</em> eintragen.</div>') +
      (docs.length
        ? '<div class="rd-docs">' +
          docs
            .map((d) => {
              const here = fileUrl(d.id);
              const img = /^image\//.test(d.type);
              return (
                '<div class="row"><div class="row__main"><div class="row__title">' + h(d.name) + (r.photoId === d.id ? ' <span class="chip chip--accent">Bild der Funke</span>' : "") + "</div>" +
                '<div class="row__meta">' + (img ? "Bild" : /pdf/.test(d.type) ? "PDF" : "Datei") + " · " + size(d.size) +
                (here === false ? ' · <span style="color:var(--warn)">nicht auf diesem Gerät</span>' : "") + "</div></div>" +
                '<div class="row__actions">' +
                (here === false
                  ? '<label class="btn btn--sm">Hier wählen<input type="file" hidden data-act="rd-relink" data-id="' + d.id + '" accept="' + (img ? "image/*" : "application/pdf,image/*") + '"></label>'
                  : '<button class="btn btn--sm" data-act="rd-doc-open" data-id="' + d.id + '">Öffnen</button>' +
                    (img && r.photoId !== d.id ? '<button class="btn btn--sm" data-act="rd-doc-photo" data-id="' + d.id + '">Als Bild</button>' : "")) +
                '<button class="btn btn--sm btn--ghost" data-act="rd-doc-del" data-id="' + d.id + '">Entfernen</button></div></div>'
              );
            })
            .join("") +
          "</div>"
        : "") +
      '<label class="btn btn--sm" style="margin-top:10px">Datei hinzufügen (PDF oder Bild)<input type="file" hidden multiple data-act="rd-file" accept="application/pdf,image/*"></label>' +
      '<small class="lp-small">Dateien bleiben auf diesem Gerät und gehen nicht in den Backup-Code oder den WLAN-Abgleich, nur der Link und die Positionen auf dem Bild. Auf dem zweiten Gerät die Datei einmal nochmals wählen.</small>' +
      "</div>"
    );
  }

  function render() {
    const list = radios();
    const r = active();
    let out =
      '<div class="section-head"><span class="label label--accent">Funke</span>' +
      '<span class="section-head__rule"></span>' +
      '<button class="btn btn--sm btn--primary" data-act="rd-new">Funke erfassen</button></div>';

    if (!r) {
      out +=
        '<div class="card"><p class="lp-small" style="margin:0 0 12px;font-size:.8rem">Noch keine Funke erfasst. Leg deine an und tipp dann jeden Schalter an, um festzuhalten, was er tut.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn--primary" data-act="rd-quick" data-tpl="tx16s-mk3">RadioMaster TX16S Mk3 anlegen</button>' +
        '<button class="btn" data-act="rd-new">Andere Funke</button></div></div>';
      $("#view-radio").innerHTML = out;
      return;
    }

    if (list.length > 1) {
      out +=
        '<div class="levels" role="tablist" style="margin-bottom:12px">' +
        list.map((x) => '<button class="level-tab" role="tab" data-act="rd-pick" data-id="' + x.id + '" aria-selected="' + (x.id === r.id) + '">' + h(x.name) + "</button>").join("") +
        "</div>";
    }

    const drones = S().drones.filter((d) => (r.droneIds || []).indexOf(d.id) !== -1);
    const hints = checks(r);
    const showPhoto = !!r.photoId && (viewMode === "photo" || !TEMPLATES[r.template]);
    // Auf dem Bild sind alle Elemente platzierbar, darunter nur die ohne Platz.
    const extras = controls(r).filter((c) => (showPhoto ? !(r.pins || {})[c.key] : c.x == null));

    out +=
      '<div class="card" style="margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;gap:9px;align-items:flex-start;flex-wrap:wrap">' +
      "<div><h3>" + h(r.name) + "</h3>" +
      '<div class="row__meta">' + (TEMPLATES[r.template] ? h(TEMPLATES[r.template].name) + " · Mode 2" : "Eigene Funke") +
      (drones.length ? " · für " + drones.map((d) => h(d.name)).join(", ") : "") + "</div></div>" +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button class="btn btn--sm" data-act="rd-copy">Als Text kopieren</button>' +
      '<button class="btn btn--sm" data-act="rd-edit" data-id="' + r.id + '">Bearbeiten</button></div></div>' +
      (r.note ? '<div class="row__meta">' + h(r.note) + "</div>" : "") +
      (r.photoId && TEMPLATES[r.template]
        ? '<div class="levels" role="tablist" style="margin-top:10px">' +
          '<button class="level-tab" role="tab" data-act="rd-view" data-mode="photo" aria-selected="' + (showPhoto) + '">Bild</button>' +
          '<button class="level-tab" role="tab" data-act="rd-view" data-mode="sketch" aria-selected="' + (!showPhoto) + '">Zeichnung</button></div>'
        : "") +
      (showPhoto ? photoBlock(r) : "") +
      (!showPhoto && TEMPLATES[r.template]
        ? '<div class="rd-wrap">' + svg(r) + "</div>" +
          '<small class="lp-small">Schematisch, nicht massstabsgetreu. Belegte Elemente leuchten, die Zahl darunter ist der Kanal. Antippen zum Belegen.' +
          (r.photoId ? "" : " Eigenes Bild (z. B. aus der Bedienungsanleitung) unten bei <em>Unterlagen</em> hinzufügen.") + "</small>"
        : "") +
      (extras.length && !placing
        ? '<div class="label" style="margin:12px 0 6px">' + (showPhoto ? "Nicht auf dem Bild" : TEMPLATES[r.template] ? "Weitere Elemente" : "Elemente") + "</div>" +
          '<div class="rd-tiles">' + extras.map((c) => tile(r, c)).join("") + "</div>"
        : "") +
      '<div style="margin-top:10px"><button class="btn btn--sm" data-act="rd-add">Element hinzufügen</button></div>' +
      "</div>";

    if (hints.length) {
      out += hints.map((x) => '<div class="lp-msg ' + (x.lvl === "warn" ? "lp-msg--warn" : "") + ' rd-hint">' + h(x.t) + "</div>").join("");
    }

    out +=
      '<div class="card" style="margin-top:12px"><div class="label label--accent" style="margin-bottom:8px">Belegung nach Kanal</div>' +
      table(r) +
      '<small class="lp-small">Knüppel: CH1–CH4. Betaflight erwartet bei ExpressLRS meist die Reihenfolge AETR (Roll, Nick, Gas, Gier).</small></div>' +
      docsCard(r) +
      '<div class="card" style="margin-top:12px"><div class="label label--accent" style="margin-bottom:8px">Quellen</div><ul class="lp-list">' +
      SRC.map((s) => '<li><a href="' + s[1] + '" target="_blank" rel="noopener">' + h(s[0]) + "</a></li>").join("") +
      "</ul></div>";

    $("#view-radio").innerHTML = out;
  }

  /* ----------------------------------------------------------- Dialoge */

  function radioDialog(id) {
    const r = id ? radios().find((x) => x.id === id) : null;
    const v = r || { name: "", template: "tx16s-mk3", droneIds: S().drones.length === 1 ? [S().drones[0].id] : [], note: "" };
    const drones = S().drones;
    ctx.openDialog(
      r ? "Funke bearbeiten" : "Funke erfassen",
      '<label class="field"><span class="label">Name</span><input type="text" id="rd-name" value="' + h(v.name) + '" placeholder="z. B. TX16S Mk3 MAX"></label>' +
        (r
          ? ""
          : '<label class="field"><span class="label">Vorlage</span><select id="rd-tpl">' +
            Object.keys(TEMPLATES).map((k) => '<option value="' + k + '">' + h(TEMPLATES[k].name) + " (mit Zeichnung)</option>").join("") +
            '<option value="custom">Eigene Funke (Elemente selbst anlegen)</option></select></label>') +
        (drones.length
          ? '<div class="field"><span class="label">Für Drohnen</span>' +
            drones.map((d) => '<label class="lp-check"><input type="checkbox" class="rd-drone" value="' + d.id + '"' + ((v.droneIds || []).indexOf(d.id) !== -1 ? " checked" : "") + "> <span>" + h(d.name) + "</span></label>").join("") +
            "</div>"
          : "") +
        '<label class="field"><span class="label">Link zur Bedienungsanleitung</span><input type="url" id="rd-url" value="' + h(v.manualUrl || "") + '" placeholder="https://…" inputmode="url"></label>' +
        '<label class="field"><span class="label">Dateien (PDF oder Bild, z. B. die Seite mit allen Schaltern)</span><input type="file" id="rd-files" multiple accept="application/pdf,image/*"></label>' +
        '<label class="field"><span class="label">Notiz</span><textarea id="rd-note" placeholder="z. B. EdgeTX 2.11, ELRS-Modul intern">' + h(v.note) + "</textarea></label>",
      (r ? '<button type="button" class="btn btn--danger" data-act="rd-del" data-id="' + r.id + '">Löschen</button>' : "") +
        '<button type="button" class="btn btn--primary" data-act="rd-save" data-id="' + (r ? r.id : "") + '">Speichern</button>'
    );
  }

  function radioSave(id) {
    const rec = {
      name: $("#rd-name").value.trim(),
      droneIds: $$(".rd-drone").filter((x) => x.checked).map((x) => x.value),
      note: $("#rd-note").value.trim(),
      manualUrl: /^https?:\/\//i.test($("#rd-url").value.trim()) ? $("#rd-url").value.trim() : "",
    };
    if ($("#rd-url").value.trim() && !rec.manualUrl) return ctx.toast("Link muss mit http:// oder https:// beginnen");
    const files = $("#rd-files").files;
    let target;
    if (id) {
      target = radios().find((x) => x.id === id);
      Object.assign(target, rec, { name: rec.name || "Funke" });
    } else {
      const tpl = $("#rd-tpl").value;
      const nr = Object.assign({ id: uid(), template: tpl, ctlEdit: {}, extra: [], map: {} }, rec);
      if (!nr.name) nr.name = TEMPLATES[tpl] ? TEMPLATES[tpl].name : "Meine Funke";
      if (!nr.manualUrl && TEMPLATES[tpl] && TEMPLATES[tpl].manualUrl) nr.manualUrl = TEMPLATES[tpl].manualUrl;
      radios().push(nr);
      current = nr.id;
      remember();
      target = nr;
    }
    ctx.save();
    ctx.closeDialog();
    render();
    if (files && files.length) addFiles(target, files);
    else ctx.toast("Funke gespeichert");
  }

  function quick(tpl) {
    const nr = {
      id: uid(), template: tpl, name: TEMPLATES[tpl].name, ctlEdit: {}, extra: [], map: {},
      manualUrl: TEMPLATES[tpl].manualUrl || "",
      droneIds: S().drones.length === 1 ? [S().drones[0].id] : [], note: "",
    };
    radios().push(nr);
    current = nr.id;
    remember();
    ctx.save();
    render();
    ctx.toast("Funke angelegt");
  }

  function ctlDialog(key, kindOverride) {
    const r = active();
    const c = r && ctlOf(r, key);
    if (!c) return;
    const isNew = !!(pending && pending.key === key);
    const m = mapOf(r, key) || { fn: "", ch: "", pos: [], note: "" };
    const kind = kindOverride || c.kind;
    const pos = KINDS[kind].pos;
    ctx.openDialog(
      isNew ? "Neues Element" : c.label + (c.label !== c.key ? " (" + c.key + ")" : ""),
      '<div class="form-row">' +
        (c.custom ? '<label class="field"><span class="label">Name</span><input type="text" id="rc-label" value="' + h(c.label) + '" placeholder="z. B. SI hinten"></label>' : "") +
        '<label class="field"><span class="label">Art</span><select id="rc-kind" data-act="rd-kind" data-key="' + h(key) + '">' +
        Object.keys(KINDS).map((k) => '<option value="' + k + '"' + (k === kind ? " selected" : "") + ">" + KINDS[k].label + "</option>").join("") +
        "</select></label>" +
        '<label class="field"><span class="label">Kanal</span><select id="rc-ch"><option value="">—</option>' +
        CHANNELS.map((x) => '<option value="' + x.v + '"' + (Number(m.ch) === x.v ? " selected" : "") + ">" + x.label + "</option>").join("") +
        "</select></label></div>" +
        '<label class="field"><span class="label">Funktion</span><input type="text" id="rc-fn" list="rc-fns" value="' + h(m.fn) + '" placeholder="z. B. Arm">' +
        '<datalist id="rc-fns">' + FUNCTIONS.map((f) => '<option value="' + h(f) + '">').join("") + "</datalist></label>" +
        '<div class="rc-posrow" style="--n:' + pos.length + '">' +
        pos.map((p, i) => '<label class="field"><span class="label">' + h(p) + '</span><input type="text" class="rc-pos" value="' + h((m.pos || [])[i] || "") + '" placeholder="' + (kind === "sw2" ? (i ? "z. B. armed" : "z. B. disarmed") : "") + '"></label>').join("") +
        "</div>" +
        '<label class="field"><span class="label">Notiz</span><textarea id="rc-note">' + h(m.note || "") + "</textarea></label>",
      (c.custom && !isNew ? '<button type="button" class="btn btn--danger" data-act="rd-ctl-del" data-key="' + h(key) + '">Element entfernen</button>' : "") +
        (isMapped(mapOf(r, key)) ? '<button type="button" class="btn" data-act="rd-ctl-clear" data-key="' + h(key) + '">Leeren</button>' : "") +
        '<button type="button" class="btn btn--primary" data-act="rd-ctl-save" data-key="' + h(key) + '">Speichern</button>'
    );
  }

  function ctlSave(key) {
    const r = active();
    const c = r && ctlOf(r, key);
    if (!c) return;
    const kind = $("#rc-kind").value;
    if (c.custom) {
      r.extra = r.extra || [];
      let x = r.extra.find((e) => e.key === key);
      if (!x) {
        x = { key: key, label: "Neues Element", kind: kind };
        r.extra.push(x);
        pending = null;
      }
      x.kind = kind;
      if ($("#rc-label")) x.label = $("#rc-label").value.trim() || x.label;
    } else {
      r.ctlEdit = r.ctlEdit || {};
      const tplKind = TEMPLATES[r.template].controls.find((t) => t.key === key).kind;
      if (kind !== tplKind) r.ctlEdit[key] = Object.assign({}, r.ctlEdit[key], { kind: kind });
      else if (r.ctlEdit[key]) delete r.ctlEdit[key].kind;
    }
    r.map = r.map || {};
    r.map[key] = {
      fn: $("#rc-fn").value.trim(),
      ch: Number($("#rc-ch").value) || "",
      pos: $$(".rc-pos").map((x) => x.value.trim()),
      note: $("#rc-note").value.trim(),
    };
    if (!isMapped(r.map[key])) delete r.map[key];
    ctx.save();
    ctx.closeDialog();
    render();
    ctx.toast(c.label + " gespeichert");
  }

  function addControl() {
    const r = active();
    if (!r) return;
    pending = { key: "X" + uid().slice(-5), label: "", kind: "sw2" };
    ctlDialog(pending.key);
  }

  function copyText() {
    const r = active();
    if (!r) return;
    const lines = [r.name + " · Belegung"];
    controls(r)
      .map((c) => ({ c: c, m: mapOf(r, c.key) }))
      .filter((x) => isMapped(x.m))
      .sort((a, b) => (Number(a.m.ch) || 99) - (Number(b.m.ch) || 99))
      .forEach((x) => {
        const pos = KINDS[x.c.kind].pos.map((p, i) => ((x.m.pos || [])[i] ? p + ": " + x.m.pos[i] : "")).filter(Boolean).join(", ");
        lines.push((x.m.ch ? chLabel(x.m.ch) : "ohne Kanal") + " · " + x.c.label + " · " + (x.m.fn || "—") + (pos ? " (" + pos + ")" : ""));
      });
    const txt = lines.join("\n");
    const done = () => ctx.toast("Belegung kopiert");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => ctx.toast("Kopieren nicht erlaubt"));
    else ctx.toast("Kopieren nicht möglich");
  }

  /* -------------------------------------------------------------- API */

  function click(act, el, ev) {
    const r = active();
    switch (act) {
      case "rd-view":
        viewMode = el.dataset.mode;
        placing = false;
        try {
          localStorage.setItem(LS + ":view", viewMode);
        } catch (e) {}
        render();
        return true;
      case "rd-place":
        placing = !placing;
        placeKey = placing ? (controls(r).find((c) => !(r.pins || {})[c.key]) || {}).key || null : null;
        render();
        return true;
      case "rd-place-pick":
        placeKey = el.dataset.key;
        render();
        return true;
      case "rd-photo-tap": {
        if (!placing || !placeKey || !ev) return true;
        const box = el.getBoundingClientRect();
        const x = Math.round(((ev.clientX - box.left) / box.width) * 1000) / 10;
        const y = Math.round(((ev.clientY - box.top) / box.height) * 1000) / 10;
        r.pins = r.pins || {};
        r.pins[placeKey] = { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
        ctx.save();
        const next = controls(r).find((c) => !r.pins[c.key]);
        placeKey = next ? next.key : null;
        render();
        return true;
      }
      case "rd-pin":
        if (placing) {
          placeKey = el.dataset.key;
          render();
        } else ctlDialog(el.dataset.key);
        return true;
      case "rd-pin-del":
        if (r && r.pins) delete r.pins[el.dataset.key];
        ctx.save();
        render();
        return true;
      case "rd-doc-open": {
        const d = (r.docs || []).find((x) => x.id === el.dataset.id);
        if (d) openDoc(d);
        return true;
      }
      case "rd-doc-photo":
        r.photoId = el.dataset.id;
        viewMode = "photo";
        ctx.save();
        render();
        return true;
      case "rd-doc-del":
        if (window.confirm("Diese Datei entfernen?")) {
          const id = el.dataset.id;
          r.docs = (r.docs || []).filter((x) => x.id !== id);
          if (r.photoId === id) r.photoId = "";
          delFile(id).catch(() => {});
          if (urls[id]) URL.revokeObjectURL(urls[id]);
          delete urls[id];
          delete loading[id];
          ctx.save();
          render();
        }
        return true;
      case "rd-new":
        radioDialog(null);
        return true;
      case "rd-quick":
        quick(el.dataset.tpl);
        return true;
      case "rd-pick":
        current = el.dataset.id;
        remember();
        render();
        return true;
      case "rd-edit":
        radioDialog(el.dataset.id);
        return true;
      case "rd-save":
        radioSave(el.dataset.id);
        return true;
      case "rd-del":
        if (window.confirm("Diese Funke mit ihrer ganzen Belegung löschen?")) {
          const gone = radios().find((x) => x.id === el.dataset.id);
          ((gone && gone.docs) || []).forEach((d) => delFile(d.id).catch(() => {}));
          S().radios = radios().filter((x) => x.id !== el.dataset.id);
          current = null;
          remember();
          ctx.save();
          ctx.closeDialog();
          render();
          ctx.toast("Funke gelöscht");
        }
        return true;
      case "rd-ctl":
        ctlDialog(el.dataset.key);
        return true;
      case "rd-ctl-save":
        ctlSave(el.dataset.key);
        return true;
      case "rd-ctl-clear":
        if (r && r.map) delete r.map[el.dataset.key];
        ctx.save();
        ctx.closeDialog();
        render();
        return true;
      case "rd-ctl-del":
        if (r && window.confirm("Dieses Element entfernen?")) {
          r.extra = (r.extra || []).filter((x) => x.key !== el.dataset.key);
          if (r.map) delete r.map[el.dataset.key];
          ctx.save();
          ctx.closeDialog();
          render();
        }
        return true;
      case "rd-add":
        addControl();
        return true;
      case "rd-copy":
        copyText();
        return true;
    }
    return false;
  }

  // Art geändert: Dialog mit passenden Stellungen neu aufbauen, Eingaben behalten.
  function change(ev) {
    const t = ev.target;
    if (t && (t.dataset.act === "rd-file" || t.dataset.act === "rd-relink")) {
      const r = active();
      if (r) addFiles(r, t.files, t.dataset.act === "rd-relink" ? t.dataset.id : null);
      return true;
    }
    if (!t || t.dataset.act !== "rd-kind") return false;
    const keep = { fn: $("#rc-fn").value, ch: $("#rc-ch").value, note: $("#rc-note").value, pos: $$(".rc-pos").map((x) => x.value) };
    const label = $("#rc-label") ? $("#rc-label").value : null;
    ctlDialog(t.dataset.key, t.value);
    if (label != null && $("#rc-label")) $("#rc-label").value = label;
    $("#rc-fn").value = keep.fn;
    $("#rc-ch").value = keep.ch;
    $("#rc-note").value = keep.note;
    $$(".rc-pos").forEach((x, i) => (x.value = keep.pos[i] || ""));
    return true;
  }

  // Tastatur: Enter oder Leertaste auf einem Element der Zeichnung.
  function keydown(ev) {
    const g = ev.target && ev.target.closest && ev.target.closest(".rd-ctl");
    if (!g || (ev.key !== "Enter" && ev.key !== " ")) return false;
    ev.preventDefault();
    ctlDialog(g.dataset.key);
    return true;
  }

  return { render: render, click: click, change: change, keydown: keydown, checks: (r) => checks(r) };
}
