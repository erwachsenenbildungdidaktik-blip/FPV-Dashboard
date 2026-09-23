/* ==========================================================================
   FPV OPS — Werkstatt
   Drohnen, Teilelager mit Mindestbestand und die Bestellliste daraus.
   Bestand wird nicht als Zahl gespeichert, sondern als Grundwert plus Zu- und
   Abgänge (stockLog), damit Handy und Laptop sich sauber abgleichen.
   ========================================================================== */

import { $, $$, uid, h, today, deDate } from "../core/util.js";
import { stockMoves } from "../core/store.js";
import { PART_CATEGORIES } from "../core/catalog.js";

export function createWorkshop(ctx) {
  let filter = "";

  const S = () => ctx.state();

  /* ------------------------------------------------------------ Hilfen */

  function chf(n) {
    return n === "" || n == null || isNaN(Number(n)) ? "—" : Number(n).toFixed(2) + " CHF";
  }

  function activeDrone() {
    const s = S();
    return s.drones.find((d) => d.id === s.settings.activeDrone) || s.drones[0] || null;
  }

  function need(p) {
    const min = Number(p.minStock) || 0;
    return Math.max(0, min - (p.stock || 0)) + (Number(p.onList) || 0);
  }

  function orderRows() {
    return S()
      .parts.filter((p) => need(p) > 0)
      .map((p) => ({ p: p, qty: need(p), sum: Number(p.price) ? need(p) * Number(p.price) : null }));
  }

  function byShop(rows) {
    const g = {};
    rows.forEach((r) => {
      const k = r.p.shop || "Ohne Shop";
      (g[k] = g[k] || []).push(r);
    });
    return g;
  }

  function orderText() {
    const rows = orderRows();
    if (!rows.length) return "";
    const g = byShop(rows);
    let t = "Bestellliste FPV OPS, " + deDate(today()) + "\n";
    let total = 0;
    Object.keys(g).forEach((shop) => {
      t += "\n" + shop + "\n";
      g[shop].forEach((r) => {
        t += "- " + r.qty + "× " + r.p.name + (Number(r.p.price) ? " à " + chf(r.p.price) + " = " + chf(r.sum) : "") + "\n";
        if (r.p.url) t += "  " + r.p.url + "\n";
        total += r.sum || 0;
      });
    });
    t += "\nTotal ca. " + chf(total) + " (Preise laut letzter Erfassung)\n";
    return t;
  }

  function csvCell(v) {
    const s = String(v == null ? "" : v);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function orderCsv() {
    // Semikolon und BOM, damit Excel mit Schweizer Einstellungen die Spalten erkennt.
    const lines = [["Shop", "Teil", "Menge", "Einzelpreis CHF", "Total CHF", "Link"].join(";")];
    orderRows().forEach((r) => {
      lines.push(
        [
          r.p.shop || "",
          r.p.name,
          r.qty,
          Number(r.p.price) ? Number(r.p.price).toFixed(2) : "",
          r.sum != null ? r.sum.toFixed(2) : "",
          r.p.url || "",
        ]
          .map(csvCell)
          .join(";")
      );
    });
    return "﻿" + lines.join("\r\n");
  }

  /* ------------------------------------------------------------ Ansicht */

  function droneCard(d, active) {
    const specs = (d.specs || [])
      .map((x) => '<div class="row__meta"><strong>' + h(x.k) + ":</strong> " + h(x.v) + "</div>")
      .join("");
    return (
      '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:9px">' +
      "<div><h3>" + h(d.name) + "</h3>" +
      '<div class="row__meta">' + h(d.model || "") + "</div></div>" +
      (active ? '<span class="chip chip--accent">Aktiv</span>' : "") +
      "</div>" +
      '<div class="row__meta" style="margin-top:8px">Gewogen ohne Akku: ' +
      (d.weightDry ? h(d.weightDry) + " g" : "noch nicht eingetragen") + "</div>" +
      '<div style="margin-top:8px">' + specs + "</div>" +
      (d.notes ? '<div class="row__meta" style="margin-top:8px">' + h(d.notes) + "</div>" : "") +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:11px">' +
      (active ? "" : '<button class="btn btn--sm" data-act="ws-drone-active" data-id="' + d.id + '">Als aktiv setzen</button>') +
      (d.url ? '<a class="btn btn--sm" href="' + h(d.url) + '" target="_blank" rel="noopener">Produktseite</a>' : "") +
      '<button class="btn btn--sm" data-act="ws-drone-edit" data-id="' + d.id + '">Bearbeiten</button>' +
      "</div></div>"
    );
  }

  function partRow(p) {
    const low = (Number(p.minStock) || 0) > 0 && p.stock < Number(p.minStock);
    return (
      '<div class="row"><div class="row__main">' +
      '<div class="row__title">' + h(p.name) +
      (low ? ' <span class="chip chip--warn">unter Minimum</span>' : "") + "</div>" +
      '<div class="row__meta">' +
      [p.spec, Number(p.price) ? chf(p.price) : "", p.shop].filter(Boolean).map(h).join(" · ") +
      "</div>" +
      '<div class="row__meta">Bestand <strong class="mono">' + p.stock + "</strong>" +
      ((Number(p.minStock) || 0) > 0 ? " · Minimum " + h(p.minStock) : "") +
      ((Number(p.onList) || 0) > 0 ? " · " + h(p.onList) + " auf der Bestellliste" : "") +
      "</div></div>" +
      '<div class="row__actions">' +
      '<button class="btn btn--sm" data-act="ws-stock" data-id="' + p.id + '" data-delta="-1" aria-label="Eins weniger">−</button>' +
      '<button class="btn btn--sm" data-act="ws-stock" data-id="' + p.id + '" data-delta="1" aria-label="Eins mehr">+</button>' +
      '<button class="btn btn--sm" data-act="ws-list-add" data-id="' + p.id + '">Bestellen</button>' +
      '<button class="btn btn--sm" data-act="ws-part-edit" data-id="' + p.id + '">Bearbeiten</button>' +
      "</div></div>"
    );
  }

  function render() {
    const s = S();
    const act = activeDrone();
    let out = "";

    /* ---- Drohnen ---- */
    out +=
      '<div class="ws-noprint"><div class="section-head"><span class="label label--accent">Drohnen</span>' +
      '<span class="section-head__rule"></span>' +
      '<button class="btn btn--sm btn--primary" data-act="ws-drone-new">Drohne erfassen</button></div>';
    out += s.drones.length
      ? '<div class="grid grid--cards">' + s.drones.map((d) => droneCard(d, act && d.id === act.id)).join("") + "</div>"
      : '<div class="empty">Noch keine Drohne erfasst.</div>';

    /* ---- Lager ---- */
    out +=
      '<div class="section-head"><span class="label label--accent">Teilelager</span>' +
      '<span class="section-head__rule"></span>' +
      '<button class="btn btn--sm btn--primary" data-act="ws-part-new">Teil erfassen</button></div>';
    out +=
      '<div style="margin-bottom:10px"><select id="ws-filter" style="width:auto">' +
      '<option value="">Alle Kategorien</option>' +
      PART_CATEGORIES.map((c) => '<option' + (filter === c ? " selected" : "") + ">" + h(c) + "</option>").join("") +
      "</select></div>";

    const cats = PART_CATEGORIES.filter((c) => !filter || c === filter);
    let any = false;
    cats.forEach((c) => {
      const list = s.parts.filter((p) => (p.cat || "Sonstiges") === c);
      if (!list.length) return;
      any = true;
      out += '<div class="label" style="margin:14px 0 7px">' + h(c) + "</div>";
      out += '<div class="card card--flush">' + list.map(partRow).join("") + "</div>";
    });
    if (!any) out += '<div class="empty">Keine Teile in dieser Auswahl.</div>';
    out += "</div>";

    /* ---- Bestellliste ---- */
    const rows = orderRows();
    out +=
      '<div class="section-head"><span class="label label--accent">Bestellliste</span>' +
      '<span class="section-head__rule"></span></div>';
    if (!rows.length) {
      out +=
        '<div class="card"><div class="empty" style="padding:6px 0">Nichts zu bestellen.</div>' +
        '<p class="row__meta" style="margin:0">Hier landet automatisch, was unter den Mindestbestand fällt, und alles, was du im Lager mit „Bestellen“ vormerkst.</p></div>';
    } else {
      const g = byShop(rows);
      let total = 0;
      Object.keys(g).forEach((shop) => {
        out += '<div class="label" style="margin:14px 0 7px">' + h(shop) + "</div>";
        out += '<div class="card card--flush">';
        g[shop].forEach((r) => {
          total += r.sum || 0;
          out +=
            '<div class="row"><div class="row__main">' +
            '<div class="row__title">' + r.qty + "× " +
            (r.p.url ? '<a href="' + h(r.p.url) + '" target="_blank" rel="noopener">' + h(r.p.name) + "</a>" : h(r.p.name)) +
            "</div>" +
            '<div class="row__meta">' +
            (Number(r.p.price) ? chf(r.p.price) + " pro Stück · " + chf(r.sum) : "Preis offen") +
            "</div></div>" +
            '<div class="row__actions">' +
            '<button class="btn btn--sm" data-act="ws-bought" data-id="' + r.p.id + '">Gekauft</button>' +
            ((Number(r.p.onList) || 0) > 0
              ? '<button class="btn btn--sm" data-act="ws-list-clear" data-id="' + r.p.id + '">Entfernen</button>'
              : "") +
            "</div></div>";
        });
        out += "</div>";
      });
      out +=
        '<div class="card" style="margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:9px;flex-wrap:wrap">' +
        '<div><div class="label">Total ca.</div><div class="mono" style="font-size:1.1rem;font-weight:700">' + chf(total) + "</div></div>" +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="btn btn--sm btn--primary" data-act="ws-order-share">Teilen</button>' +
        '<button class="btn btn--sm" data-act="ws-order-csv">CSV</button>' +
        '<button class="btn btn--sm" data-act="ws-order-print">Drucken / PDF</button>' +
        "</div></div>" +
        '<p class="row__meta" style="margin:10px 0 0">„Gekauft“ bucht die Menge ins Lager und nimmt den Posten von der Liste. Preise sind der Stand deiner letzten Erfassung.</p></div>';
    }

    $("#view-workshop").innerHTML = out;
  }

  /* ------------------------------------------------------------ Dialoge */

  function droneDialog(id) {
    const d = id ? S().drones.find((x) => x.id === id) : null;
    const v = d || { name: "", model: "", weightDry: "", url: "", specs: [], notes: "" };
    const specs = (v.specs || []).map((x) => x.k + ": " + x.v).join("\n");
    ctx.openDialog(
      d ? "Drohne bearbeiten" : "Drohne erfassen",
      '<label class="field"><span class="label">Name</span><input type="text" id="d-name" value="' + h(v.name) + '" placeholder="Seeker 3"></label>' +
        '<label class="field"><span class="label">Modell</span><input type="text" id="d-model" value="' + h(v.model) + '"></label>' +
        '<label class="field"><span class="label">Gewogen ohne Akku (g)</span><input type="number" id="d-weight" min="0" step="1" inputmode="numeric" value="' + h(v.weightDry || "") + '"></label>' +
        '<label class="field"><span class="label">Komponenten, eine pro Zeile als „Teil: Angabe“</span><textarea id="d-specs" rows="7" placeholder="Motoren: Aether 1505 4000 KV">' + h(specs) + "</textarea></label>" +
        '<label class="field"><span class="label">Produktseite</span><input type="url" id="d-url" value="' + h(v.url || "") + '" placeholder="https://"></label>' +
        '<label class="field"><span class="label">Notizen</span><textarea id="d-notes">' + h(v.notes || "") + "</textarea></label>",
      (d ? '<button type="button" class="btn btn--danger" data-act="ws-drone-del" data-id="' + d.id + '">Löschen</button>' : "") +
        '<button type="button" class="btn btn--primary" data-act="ws-drone-save" data-id="' + (d ? d.id : "") + '">Speichern</button>'
    );
  }

  function droneSave(id) {
    const specs = $("#d-specs")
      .value.split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const i = l.indexOf(":");
        return i > 0 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : { k: l, v: "" };
      });
    const rec = {
      name: $("#d-name").value.trim() || "Ohne Namen",
      model: $("#d-model").value.trim(),
      weightDry: Math.max(0, Math.round(Number($("#d-weight").value) || 0)) || "",
      specs: specs,
      url: $("#d-url").value.trim(),
      notes: $("#d-notes").value.trim(),
    };
    const s = S();
    if (id) Object.assign(s.drones.find((x) => x.id === id), rec);
    else {
      const nd = Object.assign({ id: uid() }, rec);
      s.drones.push(nd);
      if (!activeDrone() || s.drones.length === 1) s.settings.activeDrone = nd.id;
    }
    ctx.save();
    ctx.closeDialog();
    ctx.rerender();
    ctx.toast("Drohne gespeichert");
  }

  function partDialog(id) {
    const s = S();
    const p = id ? s.parts.find((x) => x.id === id) : null;
    const v = p || {
      cat: filter || "Props", name: "", spec: "", shop: "", url: "", price: "", stock: 0, minStock: 0, onList: 0,
      droneIds: activeDrone() ? [activeDrone().id] : [], source: "", note: "",
    };
    const drones = s.drones
      .map(
        (d) =>
          '<label class="check check--pick" style="padding:8px 0;border:0"><input type="checkbox" class="p-drone" value="' + d.id + '"' +
          ((v.droneIds || []).indexOf(d.id) !== -1 ? " checked" : "") +
          '><span class="check__box"></span><span class="check__text">' + h(d.name) + "</span></label>"
      )
      .join("");
    ctx.openDialog(
      p ? "Teil bearbeiten" : "Teil erfassen",
      '<label class="field"><span class="label">Bezeichnung</span><input type="text" id="p-name" value="' + h(v.name) + '" placeholder="HQProp T3x3x3 Durable"></label>' +
        '<label class="field"><span class="label">Kategorie</span><select id="p-cat">' +
        PART_CATEGORIES.map((c) => "<option" + (v.cat === c ? " selected" : "") + ">" + h(c) + "</option>").join("") +
        "</select></label>" +
        '<label class="field"><span class="label">Technische Angaben</span><input type="text" id="p-spec" value="' + h(v.spec || "") + '"></label>' +
        '<div class="form-row">' +
        '<label class="field"><span class="label">Bestand</span><input type="number" id="p-stock" min="0" step="1" value="' + h(v.stock || 0) + '"></label>' +
        '<label class="field"><span class="label">Minimum</span><input type="number" id="p-min" min="0" step="1" value="' + h(v.minStock || 0) + '"></label>' +
        '<label class="field"><span class="label">Vorgemerkt</span><input type="number" id="p-list" min="0" step="1" value="' + h(v.onList || 0) + '"></label>' +
        '<label class="field"><span class="label">Preis CHF</span><input type="number" id="p-price" min="0" step="0.05" value="' + h(v.price) + '"></label>' +
        "</div>" +
        '<label class="field"><span class="label">Shop</span><input type="text" id="p-shop" value="' + h(v.shop || "") + '" placeholder="fpvracing.ch"></label>' +
        '<label class="field"><span class="label">Link zum Teil</span><input type="url" id="p-url" value="' + h(v.url || "") + '" placeholder="https://"></label>' +
        (drones ? '<div class="label" style="margin:4px 0 7px">Passt zu</div><div style="margin-bottom:11px">' + drones + "</div>" : "") +
        '<label class="field"><span class="label">Quelle der Angaben</span><input type="text" id="p-source" value="' + h(v.source || "") + '" placeholder="Shop, Hersteller, Artikel"></label>' +
        '<label class="field"><span class="label">Notizen</span><textarea id="p-note">' + h(v.note || "") + "</textarea></label>" +
        (p && p.sourceDate ? '<div class="row__meta">Angaben Stand ' + deDate(p.sourceDate) + "</div>" : ""),
      (p ? '<button type="button" class="btn btn--danger" data-act="ws-part-del" data-id="' + p.id + '">Löschen</button>' : "") +
        '<button type="button" class="btn btn--primary" data-act="ws-part-save" data-id="' + (p ? p.id : "") + '">Speichern</button>'
    );
  }

  function partSave(id) {
    const s = S();
    const num = (sel) => Math.max(0, Math.round(Number($(sel).value) || 0));
    const priceRaw = $("#p-price").value.trim();
    const rec = {
      name: $("#p-name").value.trim() || "Ohne Namen",
      cat: $("#p-cat").value,
      spec: $("#p-spec").value.trim(),
      minStock: num("#p-min"),
      onList: num("#p-list"),
      price: priceRaw === "" ? "" : Math.max(0, Number(priceRaw) || 0),
      shop: $("#p-shop").value.trim(),
      url: $("#p-url").value.trim(),
      droneIds: $$(".p-drone").filter((c) => c.checked).map((c) => c.value),
      source: $("#p-source").value.trim(),
      note: $("#p-note").value.trim(),
    };
    // Eingegeben wird der Bestand, gespeichert der Grundwert ohne Zu- und Abgänge.
    const total = num("#p-stock");
    if (id) {
      const p = s.parts.find((x) => x.id === id);
      rec.stockBase = total - stockMoves(s, id);
      if (p.price !== rec.price) rec.sourceDate = today();
      Object.assign(p, rec);
    } else {
      s.parts.push(Object.assign({ id: uid(), stockBase: total, sourceDate: today() }, rec));
    }
    ctx.save();
    ctx.closeDialog();
    render();
    ctx.toast("Teil gespeichert");
  }

  /* ------------------------------------------------------------ Teilen */

  function shareOrder() {
    const text = orderText();
    if (!text) return;
    const copy = () =>
      navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(text).then(() => ctx.toast("Bestellliste kopiert"))
        : Promise.reject(new Error("keine Zwischenablage"));
    const fallback = () =>
      copy().catch(() => ctx.openDialog("Bestellliste", '<textarea rows="14" readonly>' + h(text) + "</textarea>"));
    if (!navigator.share) return fallback();
    navigator.share({ title: "Bestellliste FPV OPS", text: text }).catch((e) => {
      if (e && e.name === "AbortError") return;
      fallback();
    });
  }

  function downloadCsv() {
    const blob = new Blob([orderCsv()], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fpv-ops-bestellliste-" + today() + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
    ctx.toast("CSV heruntergeladen");
  }

  function printOrder() {
    document.body.classList.add("print-order");
    const done = () => {
      document.body.classList.remove("print-order");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  }

  /* ------------------------------------------------------------ Aktionen */

  function click(act, el) {
    const s = S();
    const id = el.dataset.id;
    switch (act) {
      case "ws-drone-new":
        return droneDialog(null), true;
      case "ws-drone-edit":
        return droneDialog(id), true;
      case "ws-drone-save":
        return droneSave(id), true;
      case "ws-drone-del":
        if (window.confirm("Diese Drohne löschen? Teile und Flüge bleiben bestehen.")) {
          s.drones = s.drones.filter((x) => x.id !== id);
          s.parts.forEach((p) => {
            if ((p.droneIds || []).indexOf(id) !== -1) p.droneIds = p.droneIds.filter((x) => x !== id);
          });
          if (s.settings.activeDrone === id) delete s.settings.activeDrone;
          ctx.save();
          ctx.closeDialog();
          ctx.rerender();
          ctx.toast("Drohne gelöscht");
        }
        return true;
      case "ws-drone-active":
        s.settings.activeDrone = id;
        ctx.save();
        ctx.rerender();
        return true;

      case "ws-part-new":
        return partDialog(null), true;
      case "ws-part-edit":
        return partDialog(id), true;
      case "ws-part-save":
        return partSave(id), true;
      case "ws-part-del":
        if (window.confirm("Dieses Teil löschen?")) {
          s.parts = s.parts.filter((x) => x.id !== id);
          s.stockLog = s.stockLog.filter((m) => m.partId !== id);
          ctx.save();
          ctx.closeDialog();
          render();
          ctx.toast("Teil gelöscht");
        }
        return true;

      case "ws-stock": {
        const p = s.parts.find((x) => x.id === id);
        const d = Number(el.dataset.delta) || 0;
        if (!p || (d < 0 && p.stock <= 0)) return true;
        s.stockLog.push({ id: uid(), partId: id, delta: d, date: today() });
        ctx.save();
        render();
        return true;
      }
      case "ws-list-add": {
        const p = s.parts.find((x) => x.id === id);
        if (p) {
          p.onList = (Number(p.onList) || 0) + 1;
          ctx.save();
          render();
          ctx.toast("Auf die Bestellliste gesetzt");
        }
        return true;
      }
      case "ws-list-clear": {
        const p = s.parts.find((x) => x.id === id);
        if (p) {
          p.onList = 0;
          ctx.save();
          render();
        }
        return true;
      }
      case "ws-bought": {
        const p = s.parts.find((x) => x.id === id);
        if (p) {
          const qty = need(p);
          s.stockLog.push({ id: uid(), partId: id, delta: qty, date: today(), note: "gekauft" });
          p.onList = 0;
          ctx.save();
          render();
          ctx.toast(qty + "× " + p.name + " ins Lager gebucht");
        }
        return true;
      }
      case "ws-order-share":
        return shareOrder(), true;
      case "ws-order-csv":
        return downloadCsv(), true;
      case "ws-order-print":
        return printOrder(), true;
    }
    return false;
  }

  function change(ev) {
    if (ev.target.id === "ws-filter") {
      filter = ev.target.value;
      render();
      return true;
    }
    return false;
  }

  return { render: render, click: click, change: change, activeDrone: activeDrone };
}
