/* ==========================================================================
   FPV OPS — Akku-Wissen (LiPo / LiHV), Ladestrom-Rechner, Akku-Logbuch
   Alle Spannungen stammen aus den Ladegerät-Tabellen von ISDT (X16-Handbuch),
   die Faustregeln aus den unten verlinkten Quellen. Was keine Quelle hat,
   steht nicht drin. Messungen liegen in state.batLog, ein Datensatz pro
   Messung, damit der Abgleich zwischen Geräten nichts verliert.
   ========================================================================== */

import { $, $$, uid, h, today, deDate } from "../core/util.js";

// Pro Zelle, Presets aus dem ISDT-X16-Handbuch.
// Landen: Oscar Liang (im Flug, unter Last). Für LiHV gibt es dazu keine Quelle.
export const CHEM = {
  lipo: { label: "LiPo", nominal: 3.7, full: 4.2, storage: 3.8, cutoff: 3.3, land: [3.5, 3.6] },
  lihv: { label: "LiHV", nominal: 3.8, full: 4.35, storage: 3.85, cutoff: 3.4, land: null },
};

// ISDT F160: 40 W Ladeleistung und höchstens 5 A pro Kanal.
const CALC_DEFAULT = { mah: 750, cells: 4, watts: 40, maxA: 5, preset: 0.7 };

const SRC = [
  ["ISDT X16 Handbuch (Spannungstabelle, Balancer, nie unbeaufsichtigt)", "https://www.isdt.co/down/pdf/X16.pdf"],
  ["ISDT F160 Handbuch (40 W und 5 A pro Kanal, Entladen 1 A / 5 W)", "https://www.isdt.co/down/pdf/F160.pdf"],
  ["Oscar Liang: LiPo Battery Guide (1C, Lagerung, Landespannung, Innenwiderstand)", "https://oscarliang.com/lipo-battery-guide/"],
  ["Gens Ace / Tattu: LiPo-Bedienungsanleitung (nie über 1C laden)", "https://www.genstattu.com/content/instock/Lipo-Manual.pdf"],
  ["Flite Test: Beginner Series, Batteries and Safety (80-%-Regel)", "https://www.flitetest.com/articles/beginner-series-batteries"],
];

export function chemOf(b) {
  return CHEM[b && b.chem] || CHEM.lipo;
}

// Zahl mit Komma, wie in der Schweiz üblich.
export function num(v, d) {
  return Number(v).toFixed(d).replace(".", ",");
}

function parse(v) {
  const n = Number(String(v == null ? "" : v).replace(",", "."));
  return isFinite(n) ? n : 0;
}

/* Rechnet alles, was der Rechner anzeigt. Das Leistungslimit greift am
   stärksten gegen Ende des Ladens, darum mit der Vollspannung gerechnet. */
export function calc(inp, chemKey) {
  const c = CHEM[chemKey] || CHEM.lipo;
  const mah = Math.max(0, inp.mah || 0);
  const cells = Math.max(0, Math.round(inp.cells || 0));
  const ah = mah / 1000;
  const r = {
    oneC: ah,
    full: c.full * cells,
    storage: c.storage * cells,
    nominal: c.nominal * cells,
    cutoff: c.cutoff * cells,
    take80: mah * 0.8,
    limitA: null,
    limitC: null,
    overC: false,
    presetC: null,
  };
  if (inp.watts > 0 && r.full > 0) {
    r.limitA = inp.watts / r.full;
    if (inp.maxA > 0) r.limitA = Math.min(r.limitA, inp.maxA);
    r.limitC = ah > 0 ? r.limitA / ah : null;
    r.overC = r.limitC != null && r.limitC > 1;
  }
  if (inp.preset > 0 && ah > 0) r.presetC = inp.preset / ah;
  return r;
}

export function createLipo(ctx) {
  const S = () => ctx.state();
  const LS = "fpv-ops-v1:lp";
  let tab = "stock";
  let inp = Object.assign({}, CALC_DEFAULT);
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || "null");
    if (saved) {
      if (saved.tab) tab = saved.tab;
      if (saved.inp) inp = Object.assign(inp, saved.inp);
    }
  } catch (e) {}

  function remember() {
    try {
      localStorage.setItem(LS, JSON.stringify({ tab: tab, inp: inp }));
    } catch (e) {}
  }

  /* ------------------------------------------------------- Unterreiter */

  function tabs() {
    const t = [["stock", "Bestand"], ["lipo", "LiPo"], ["lihv", "LiHV"]];
    return (
      '<div class="levels" role="tablist" style="margin-bottom:14px">' +
      t.map((x) =>
        '<button class="level-tab" role="tab" data-act="lp-tab" data-tab="' + x[0] +
        '" aria-selected="' + (tab === x[0]) + '">' + x[1] + "</button>"
      ).join("") +
      "</div>"
    );
  }

  /* ------------------------------------------------------------ Bausteine */

  function card(title, body, style) {
    return (
      '<div class="card lp-card"' + (style ? ' style="' + style + '"' : "") + ">" +
      '<div class="label label--accent" style="margin-bottom:8px">' + title + "</div>" + body + "</div>"
    );
  }

  function voltTable(chemKey) {
    const c = CHEM[chemKey];
    const land = (n) => (c.land ? num(c.land[0] * n, 1) + "–" + num(c.land[1] * n, 1) : "—");
    let rows = "";
    for (let s = 1; s <= 6; s++) {
      rows +=
        "<tr" + (s === 4 ? ' class="is-mine"' : "") + "><td>" + s + "S</td>" +
        "<td>" + num(c.full * s, 2) + "</td><td>" + num(c.storage * s, 2) + "</td>" +
        (c.land ? "<td>" + land(s) + "</td>" : "") + "</tr>";
    }
    const tile = (cls, label, val, hint) =>
      '<div class="lp-volt ' + cls + '"><span class="label">' + label + '</span><strong class="mono">' + val +
      "</strong><small>" + hint + "</small></div>";
    return (
      '<div class="lp-volts">' +
      tile("lp-volt--full", "Voll", num(c.full, 2) + " V", "Ladegerät stoppt hier") +
      tile("lp-volt--store", "Lagern", num(c.storage, 2) + " V", "wenn er ein paar Tage liegt") +
      tile("lp-volt--land", "Landen", c.land ? num(c.land[0], 1) + "–" + num(c.land[1], 1) + " V" : "?", c.land ? "im Flug, Anzeige in der Brille" : "Herstellerangabe prüfen") +
      "</div>" +
      '<div class="lp-scroll"><table class="lp-table"><thead><tr><th>Akku</th><th>Voll</th><th>Lagern</th>' +
      (c.land ? "<th>Landen</th>" : "") + "</tr></thead><tbody>" +
      rows + "</tbody></table></div>" +
      '<small class="lp-small">Alle Werte in Volt, pro Zelle mal Zellenzahl (S). Nennspannung ' + num(c.nominal, 2) +
      " V pro Zelle steht auf dem Etikett (4S = " + num(c.nominal * 4, 1) + " V). Werte aus der ISDT-Tabelle (X16-Handbuch)" +
      (c.land ? ", Landen nach Oscar Liang" : "") + ".</small>"
    );
  }

  function calcForm(chemKey) {
    const f = (id, label, val, extra) =>
      '<label class="field"><span class="label">' + label + '</span><input type="text" inputmode="decimal" id="' + id +
      '" data-act="lp-calc" value="' + h(val === "" || val == null ? "" : String(val).replace(".", ",")) + '"' + (extra || "") + "></label>";
    return (
      '<div class="form-row">' +
      f("lp-mah", "Kapazität mAh", inp.mah) +
      f("lp-cells", "Zellen (S)", inp.cells) +
      f("lp-watts", "Ladegerät W pro Kanal", inp.watts, ' placeholder="optional"') +
      f("lp-maxa", "Ladegerät max. A", inp.maxA, ' placeholder="optional"') +
      f("lp-preset", "Mein Preset A", inp.preset, ' placeholder="optional"') +
      "</div>" +
      '<div id="lp-result" data-chem="' + chemKey + '">' + calcResult(chemKey) + "</div>"
    );
  }

  function calcResult(chemKey) {
    const r = calc(inp, chemKey);
    if (!(r.oneC > 0) || !(r.full > 0)) return '<div class="row__meta">Kapazität und Zellenzahl eingeben.</div>';
    let out =
      '<div class="lp-out">' +
      '<div><span class="label">Empfohlen 1C</span><strong class="mono" id="lp-r-1c">' + num(r.oneC, 2) + " A</strong></div>" +
      '<div><span class="label">Voll</span><strong class="mono" id="lp-r-full">' + num(r.full, 2) + " V</strong></div>" +
      '<div><span class="label">Lager</span><strong class="mono" id="lp-r-storage">' + num(r.storage, 2) + " V</strong></div>" +
      '<div><span class="label">Max. entnehmen (80 %)</span><strong class="mono" id="lp-r-80">' + Math.round(r.take80) + " mAh</strong></div>" +
      "</div>";
    if (r.limitA != null) {
      out +=
        '<div class="lp-msg ' + (r.overC ? "lp-msg--warn" : "lp-msg--ok") + '" id="lp-r-limit">' +
        "Das Ladegerät schafft bei diesem Akku bis <strong>" + num(r.limitA, 2) + " A</strong> (≈ " + num(r.limitC, 1) + "C). " +
        (r.overC
          ? "Das ist mehr als 1C. Strom im Ladegerät von Hand auf höchstens " + num(r.oneC, 2) + " A setzen."
          : "Das liegt nicht über 1C.") +
        "</div>";
    }
    if (r.presetC != null) {
      const ok = r.presetC <= 1;
      out +=
        '<div class="lp-msg ' + (ok ? "lp-msg--ok" : "lp-msg--warn") + '" id="lp-r-preset">' +
        "Dein Preset: " + num(inp.preset, 2) + " A = " + num(r.presetC, 2) + "C" +
        (ok ? ", nicht über 1C." : ", über 1C. Ausser der Hersteller erlaubt mehr: Preset senken.") +
        "</div>";
    }
    out += '<small class="lp-small">Gerechnet mit der Vollspannung, dort greift das Leistungslimit am stärksten. Herstellerangaben auf dem Akku haben immer Vorrang.</small>';
    return out;
  }

  function sources() {
    return card(
      "Quellen",
      '<ul class="lp-list">' +
        SRC.map((s) => '<li><a href="' + s[1] + '" target="_blank" rel="noopener">' + h(s[0]) + "</a></li>").join("") +
        "</ul>"
    );
  }

  /* ------------------------------------------------------------- Seiten */

  function renderLipo() {
    const c = CHEM.lipo;
    return (
      '<div class="grid grid--2">' +
      card(
        "1 · Die drei Zahlen, die du brauchst (pro Zelle)",
        voltTable("lipo") +
          '<div class="lp-msg lp-msg--ok">Entladen auf Lagerspannung ist gut. Tiefer bringt nichts. Unter 3,0 V pro Zelle unter Last nimmt der Akku Schaden.</div>' +
          '<small class="lp-small">Das Ladegerät kann bis ' + num(c.cutoff, 2) + " V pro Zelle entladen. Das brauchst du nur, um die Kapazität zu messen.</small>" +
          '<small class="lp-small">Akku mit „HV“ auf dem Etikett? Dann gilt der Reiter <a href="#" data-act="lp-tab" data-tab="lihv">LiHV</a>.</small>'
      ) +
      card(
        "2 · Ruhespannung oder Spannung unter Strom",
        "<p>Beim Laden zeigt das Ladegerät mehr an, als im Akku steckt. Unter Last (Fliegen, Entladen) sackt die Spannung ab. " +
          "Verlässlich ist nur die <strong>Ruhespannung</strong>: nach einer Ruhepause nach dem Laden oder Fliegen mit einem Checker gemessen.</p>" +
          '<div class="lp-example"><div><span class="label">Ladegerät, beim Laden</span><strong class="mono">15,10 V</strong><small>3,775 V/Zelle</small></div>' +
          '<div><span class="label">Checker, danach in Ruhe</span><strong class="mono">14,78 V</strong><small>3,695 V/Zelle</small></div></div>' +
          '<small class="lp-small">Praxisbeispiel 4S. Die Ruhespannung trägst du im Logbuch ein.</small>'
      ) +
      card("3 · Ladestrom-Rechner", calcForm("lipo"), "grid-column:1/-1") +
      card(
        "4 · Lagern",
        '<ul class="lp-list">' +
          "<li>Fliegst du ein paar Tage nicht, Akku auf Lagerspannung bringen: <strong>" + num(c.storage, 2) + " V</strong> pro Zelle (ISDT-Preset), Oscar Liang nennt 3,80 bis 3,85 V. Voll geladen gelagert altert er schneller und kann sich aufblähen.</li>" +
          "<li><strong>Weg A:</strong> Storage-Modus des Ladegeräts. Bei der F160 im Menü kontrollieren, welche Spannung eingestellt ist.</li>" +
          "<li><strong>Weg B</strong> (ohne Storage-Modus): Laden oder Entladen mit von Hand gesetzter Zielspannung 3,80 bis 3,85 V pro Zelle. Die F160 entlädt mit höchstens 5 W, das dauert.</li>" +
          "<li>Gelagert und geladen wird im LiPo-Safe-Bag.</li>" +
          "</ul>" +
          '<small class="lp-small">Nach 3 Tagen im Status <em>Geladen</em> erinnert dich das Dashboard.</small>'
      ) +
      card(
        "5 · Ladegerät-Fallen: vor jedem Start",
        '<div class="lp-checks">' +
          [
            "Preset geprüft: Strom passt zum Akku (die F160 kann bis 5 A, dein 750er 4S verträgt 1C = 0,75 A)",
            "Akkutyp stimmt: LiPo ist nicht LiHV",
            "Zellenzahl, Strom und Zielspannung kontrolliert",
            "Balancerstecker steckt",
            "Ich bleibe dabei, solange geladen wird",
          ]
            .map((t) => '<label class="lp-check"><input type="checkbox"> <span>' + t + "</span></label>")
            .join("") +
          "</div>" +
          '<small class="lp-small">Tipp: pro Akkutyp ein eigenes Preset speichern, z. B. 750 mAh 4S → 0,7 A. Die Häkchen merkt sich die App nicht, sie gelten fürs jetzige Laden.</small>'
      ) +
      card(
        "6 · Zustandscheck",
        '<ul class="lp-list">' +
          "<li><strong>Aufgebläht oder weich:</strong> ausmustern. Das geht nicht mehr zurück.</li>" +
          "<li><strong>Zelldifferenz (Delta):</strong> wenige mV sind gut. Einen festen Grenzwert mit belastbarer Quelle gibt es für normale LiPo-Packs nicht, darum zählt der Vergleich über die Zeit.</li>" +
          "<li><strong>Innenwiderstand</strong> pro Zelle notieren und vergleichen. Er steigt mit Alter und Nutzung und geht nicht mehr zurück.</li>" +
          "<li><strong>Akkus nummerieren</strong>, sonst weisst du nicht, welcher Pack schwächelt.</li>" +
          "</ul>"
      ) +
      card(
        "7 · Die 80-%-Regel",
        "<p>Faustregel aus der Hobbyszene, keine Herstellerangabe: höchstens <strong>80 %</strong> der aufgedruckten Kapazität entnehmen. " +
          "Beim 750er sind das 600 mAh. Prüfen kannst du es nach dem Laden: Das Ladegerät zeigt, wie viel es nachgeladen hat. Trag das im Logbuch ein, die App warnt über 80 %.</p>" +
          '<small class="lp-small">Gerechnet wird mit der aufgedruckten Kapazität. Alte Packs haben weniger, für sie ist die Regel zu grosszügig. Landen nach Spannung bleibt das Wichtigste.</small>'
      ) +
      sources() +
      "</div>"
    );
  }

  function renderLihv() {
    const c = CHEM.lihv;
    return (
      '<div class="banner"><strong>Nie einen normalen LiPo im LiHV-Modus laden.</strong> Er würde auf ' + num(c.full, 2) +
      " V pro Zelle geladen, das ist überladen. LiHV gilt nur für Akkus, die als LiHV / HV verkauft werden.</div>" +
      '<div class="grid grid--2">' +
      card("Die Zahlen für LiHV (pro Zelle)", voltTable("lihv")) +
      card(
        "Was anders ist",
        '<ul class="lp-list">' +
          "<li>Voll bei " + num(c.full, 2) + " V statt 4,20 V pro Zelle, Lager bei " + num(c.storage, 2) + " V.</li>" +
          "<li>Im Ladegerät den Akkutyp LiHV wählen, sonst wird er nicht ganz voll.</li>" +
          "<li>Laden mit höchstens 1C, Balancer, nie unbeaufsichtigt: wie beim LiPo.</li>" +
          "</ul>" +
          '<small class="lp-small">Werte aus der ISDT-Tabelle (X16-Handbuch). Herstellerangaben auf dem Akku haben Vorrang.</small>'
      ) +
      card("Ladestrom-Rechner LiHV", calcForm("lihv"), "grid-column:1/-1") +
      sources() +
      "</div>"
    );
  }

  /* ------------------------------------------------------------ Logbuch */

  function entries(batteryId) {
    return S()
      .batLog.filter((e) => e.batteryId === batteryId)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  function avgIr(e) {
    const v = (e.ir || []).map(Number).filter((x) => x > 0);
    return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null;
  }

  function over80(e, b) {
    const mah = Number(b && b.mah) || 0;
    return Number(e.recharged) > 0 && mah > 0 && Number(e.recharged) > mah * 0.8;
  }

  function entryLine(e, b) {
    const cells = Number(b.cells) || 0;
    const bits = [];
    if (e.restV) bits.push(num(e.restV, 2) + " V" + (cells ? " (" + num(e.restV / cells, 3) + " V/Zelle)" : ""));
    if (e.deltaMv !== "" && e.deltaMv != null) bits.push("Δ " + e.deltaMv + " mV");
    const ir = (e.ir || []).filter((x) => Number(x) > 0);
    if (ir.length) bits.push("IR " + ir.join(" / ") + " mΩ");
    if (e.recharged) bits.push("nachgeladen " + e.recharged + " mAh");
    return bits.join(" · ");
  }

  // "So stellst du das Ladegerät ein", fertig für diesen Akku.
  function chargerBlock(b) {
    const c = chemOf(b);
    const cells = Number(b.cells) || 0;
    const ah = (Number(b.mah) || 0) / 1000;
    if (!cells || !ah) return "";
    // Auf 0,1 A abgerundet, so lässt es sich am Ladegerät einstellen und bleibt unter 1C.
    const amps = Math.floor(ah * 10 + 1e-9) / 10 || ah;
    const item = (k, v) => '<div><span class="label">' + k + '</span><strong class="mono">' + v + "</strong></div>";
    return (
      '<div class="lp-charger">' +
      '<div class="label label--accent">Ladegerät einstellen</div>' +
      '<div class="lp-charger__grid">' +
      item("Typ", c.label) +
      item("Zellen", cells + "S") +
      item("Strom", num(amps, 1) + " A") +
      item("Voll", num(c.full * cells, 2) + " V") +
      item("Lagern", num(c.storage * cells, 2) + " V") +
      "</div>" +
      '<small class="lp-small" style="margin-top:4px">Strom = höchstens 1C (' + num(ah, 2) + " A). Immer mit Balancerstecker, nie unbeaufsichtigt. Steht auf dem Akku etwas anderes, gilt das.</small>" +
      "</div>"
    );
  }

  // Kurzinfo für die Akkukarte im Bestand.
  function cardInfo(b) {
    const list = entries(b.id);
    let out = "";
    if (list.length) {
      const last = list[list.length - 1];
      out +=
        '<div class="row__meta lp-last">Letzte Messung ' + deDate(last.date) + ": " + h(entryLine(last, b) || "—") + "</div>";
      if (over80(last, b)) {
        out += '<div class="row__meta" style="color:var(--warn)">Tiefer als 80 % entladen (' + h(last.recharged) + " von " + h(b.mah) + " mAh).</div>";
      }
      const withIr = list.filter((e) => avgIr(e) != null);
      if (withIr.length > 1) {
        const a = avgIr(withIr[0]), z = avgIr(withIr[withIr.length - 1]);
        out += '<div class="row__meta">IR Ø ' + num(a, 1) + " → " + num(z, 1) + " mΩ seit " + deDate(withIr[0].date) + "</div>";
      }
    }
    return out;
  }

  function logDialog(batteryId) {
    const b = S().batteries.find((x) => x.id === batteryId);
    if (!b) return;
    const list = entries(batteryId).slice().reverse();
    const body =
      '<div class="row__meta" style="margin-bottom:10px">' + h(b.brand || "") + " · " + h(b.mah) + " mAh · " + h(b.cells) + "S · " +
      chemOf(b).label + (b.bought ? " · gekauft " + deDate(b.bought) : "") + "</div>" +
      (list.length
        ? list
            .map(
              (e) =>
                '<div class="row"><div class="row__main"><div class="row__title">' + deDate(e.date) + "</div>" +
                '<div class="row__meta">' + h(entryLine(e, b) || "—") + "</div>" +
                (over80(e, b) ? '<div class="row__meta" style="color:var(--warn)">Tiefer als 80 % entladen.</div>' : "") +
                (e.note ? '<div class="row__meta">' + h(e.note) + "</div>" : "") +
                '</div><div class="row__actions"><button class="btn btn--sm" data-act="lp-log-edit" data-id="' + e.id + '">Bearbeiten</button></div></div>'
            )
            .join("")
        : '<div class="empty">Noch keine Messung.</div>');
    ctx.openDialog(
      "Logbuch " + b.label,
      body,
      '<button type="button" class="btn btn--primary" data-act="lp-log-new" data-id="' + b.id + '">Messung erfassen</button>'
    );
  }

  function entryDialog(batteryId, entryId) {
    const e = entryId ? S().batLog.find((x) => x.id === entryId) : null;
    const b = S().batteries.find((x) => x.id === (e ? e.batteryId : batteryId));
    if (!b) return;
    const v = e || { date: today(), restV: "", deltaMv: "", ir: [], recharged: "", note: "" };
    const cells = Math.max(1, Math.min(12, Number(b.cells) || 1));
    let irFields = "";
    for (let i = 0; i < cells; i++) {
      irFields +=
        '<label class="field"><span class="label">Zelle ' + (i + 1) + '</span><input type="text" inputmode="decimal" class="lp-ir" value="' +
        h((v.ir || [])[i] || "") + '"></label>';
    }
    ctx.openDialog(
      (e ? "Messung bearbeiten · " : "Messung · ") + b.label,
      '<div class="form-row">' +
        '<label class="field"><span class="label">Datum</span><input type="date" id="lp-date" value="' + h(v.date) + '"></label>' +
        '<label class="field"><span class="label">Ruhespannung gesamt V</span><input type="text" inputmode="decimal" id="lp-restv" value="' + h(v.restV === "" ? "" : num(v.restV, 2)) + '" placeholder="z. B. 14,78"></label>' +
        '<label class="field"><span class="label">Zelldelta mV</span><input type="text" inputmode="numeric" id="lp-delta" value="' + h(v.deltaMv) + '"></label>' +
        '<label class="field"><span class="label">Nachgeladen mAh</span><input type="text" inputmode="numeric" id="lp-recharged" value="' + h(v.recharged) + '" placeholder="vom Ladegerät"></label>' +
        "</div>" +
        '<div class="label" style="margin:4px 0 6px">Innenwiderstand pro Zelle (mΩ)</div>' +
        '<div class="form-row">' + irFields + "</div>" +
        '<label class="field"><span class="label">Notiz</span><textarea id="lp-note" placeholder="z. B. mit 0,7 A geladen">' + h(v.note) + "</textarea></label>",
      (e ? '<button type="button" class="btn btn--danger" data-act="lp-log-del" data-id="' + e.id + '">Löschen</button>' : "") +
        '<button type="button" class="btn btn--primary" data-act="lp-log-save" data-id="' + (e ? e.id : "") + '" data-bat="' + b.id + '">Speichern</button>'
    );
  }

  function entrySave(entryId, batteryId) {
    const rec = {
      date: $("#lp-date").value || today(),
      restV: parse($("#lp-restv").value) || "",
      deltaMv: $("#lp-delta").value.trim() === "" ? "" : Math.round(parse($("#lp-delta").value)),
      recharged: Math.round(parse($("#lp-recharged").value)) || "",
      ir: $$(".lp-ir").map((x) => parse(x.value) || ""),
      note: $("#lp-note").value.trim(),
    };
    if (!rec.ir.some(Boolean)) rec.ir = [];
    if (entryId) {
      const e = S().batLog.find((x) => x.id === entryId);
      if (e) {
        Object.assign(e, rec);
        batteryId = e.batteryId;
      }
    } else {
      S().batLog.push(Object.assign({ id: uid(), batteryId: batteryId }, rec));
    }
    ctx.save();
    ctx.rerender();
    logDialog(batteryId);
    ctx.toast("Messung gespeichert");
  }

  /* -------------------------------------------------------------- API */

  function render() {
    if (tab === "lipo") return tabs() + renderLipo();
    if (tab === "lihv") return tabs() + renderLihv();
    return "";
  }

  function click(act, el) {
    switch (act) {
      case "lp-tab":
        tab = el.dataset.tab || "stock";
        remember();
        ctx.rerender();
        window.scrollTo(0, 0);
        return true;
      case "lp-log":
        logDialog(el.dataset.id);
        return true;
      case "lp-log-new":
        entryDialog(el.dataset.id, null);
        return true;
      case "lp-log-edit":
        entryDialog(null, el.dataset.id);
        return true;
      case "lp-log-save":
        entrySave(el.dataset.id, el.dataset.bat);
        return true;
      case "lp-log-del": {
        const e = S().batLog.find((x) => x.id === el.dataset.id);
        if (e && window.confirm("Diese Messung löschen?")) {
          S().batLog = S().batLog.filter((x) => x.id !== e.id);
          ctx.save();
          ctx.rerender();
          logDialog(e.batteryId);
          ctx.toast("Messung gelöscht");
        }
        return true;
      }
    }
    return false;
  }

  // Rechner rechnet beim Tippen, ohne die Seite neu aufzubauen (Fokus bleibt).
  function input(ev) {
    const t = ev.target;
    if (!t || t.dataset.act !== "lp-calc") return false;
    inp = {
      mah: parse($("#lp-mah").value),
      cells: parse($("#lp-cells").value),
      watts: parse($("#lp-watts").value),
      maxA: parse($("#lp-maxa").value),
      preset: parse($("#lp-preset").value),
    };
    remember();
    const box = $("#lp-result");
    if (box) box.innerHTML = calcResult(box.dataset.chem);
    return true;
  }

  return {
    tab: () => tab,
    tabs: tabs,
    render: render,
    cardInfo: cardInfo,
    chargerBlock: chargerBlock,
    click: click,
    input: input,
  };
}
