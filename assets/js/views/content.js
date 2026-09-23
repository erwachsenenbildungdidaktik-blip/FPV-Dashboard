/* ==========================================================================
   FPV OPS — Eigene Inhalte
   Trainingsmanöver, Checklisten und Links kommen als Vorlage aus data.js.
   Anpassungen liegen darüber: Änderungen an eingebauten Einträgen in
   mvEdit / clEdit / linkHidden (nach deren ID), eigene Einträge in
   mvCustom / clCustom / linkCustom. "Original wiederherstellen" löscht nur
   die Anpassung, die Vorlage bleibt unangetastet.
   ========================================================================== */

import { $, uid, h } from "../core/util.js";

const MV_FIELDS = ["title", "tag", "desc", "goal", "steps", "errors", "success"];

function lines(v) {
  return String(v || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function createContent(ctx) {
  const S = () => ctx.state();
  let linkEditMode = false;
  const showHidden = {};

  /* ------------------------------------------------------------ Training */

  function builtinManeuver(id) {
    for (const l of TRAINING) {
      const m = l.maneuvers.find((x) => x.id === id);
      if (m) return { m: m, level: l };
    }
    return null;
  }

  function applyEdit(m) {
    const e = S().mvEdit[m.id];
    if (!e) return m;
    const o = Object.assign({}, m);
    MV_FIELDS.forEach((f) => {
      if (e[f] != null) o[f] = e[f];
    });
    o.edited = true;
    return o;
  }

  function levels() {
    const s = S();
    return TRAINING.map((l) => {
      const builtin = l.maneuvers.filter((m) => !(s.mvEdit[m.id] && s.mvEdit[m.id].hidden)).map(applyEdit);
      const custom = s.mvCustom.filter((c) => c.level === l.id).map((c) => Object.assign({ custom: true }, c));
      return Object.assign({}, l, { maneuvers: builtin.concat(custom) });
    });
  }

  function hiddenManeuvers(levelId) {
    const l = TRAINING.find((x) => x.id === levelId);
    return l ? l.maneuvers.filter((m) => S().mvEdit[m.id] && S().mvEdit[m.id].hidden) : [];
  }

  function allManeuvers() {
    return levels().reduce((a, l) => a.concat(l.maneuvers), []);
  }

  function maneuver(id) {
    const c = S().mvCustom.find((x) => x.id === id);
    if (c) return Object.assign({ custom: true }, c);
    const b = builtinManeuver(id);
    return b ? applyEdit(b.m) : null;
  }

  function mvDialog(id, levelId) {
    const m = id ? maneuver(id) : null;
    const v = m || { title: "", tag: "", desc: "", goal: "", steps: [], errors: [], success: "" };
    const builtin = m && !m.custom;
    ctx.openDialog(
      m ? "Manöver bearbeiten" : "Eigenes Manöver",
      (builtin ? '<p class="row__meta" style="margin:0 0 12px">Eingebautes Manöver. Deine Änderungen lassen sich jederzeit auf das Original zurücksetzen.</p>' : "") +
        '<label class="field"><span class="label">Titel</span><input type="text" id="mv-title" value="' + h(v.title) + '"></label>' +
        '<label class="field"><span class="label">Stichwort</span><input type="text" id="mv-tag" value="' + h(v.tag) + '" placeholder="Kontrolle · Sim"></label>' +
        '<label class="field"><span class="label">Kurzbeschreibung</span><textarea id="mv-desc">' + h(v.desc) + "</textarea></label>" +
        '<label class="field"><span class="label">Ziel</span><textarea id="mv-goal">' + h(v.goal) + "</textarea></label>" +
        '<label class="field"><span class="label">Ausführung, ein Schritt pro Zeile</span><textarea id="mv-steps" rows="5">' + h((v.steps || []).join("\n")) + "</textarea></label>" +
        '<label class="field"><span class="label">Typische Fehler, einer pro Zeile</span><textarea id="mv-errors" rows="4">' + h((v.errors || []).join("\n")) + "</textarea></label>" +
        '<label class="field"><span class="label">Erfolgskriterium</span><textarea id="mv-success">' + h(v.success) + "</textarea></label>",
      (builtin
        ? '<button type="button" class="btn btn--danger" data-act="ct-mv-hide" data-id="' + m.id + '">Ausblenden</button>' +
          (m.edited ? '<button type="button" class="btn" data-act="ct-mv-reset" data-id="' + m.id + '">Original</button>' : "")
        : m
        ? '<button type="button" class="btn btn--danger" data-act="ct-mv-del" data-id="' + m.id + '">Löschen</button>'
        : "") +
        '<button type="button" class="btn btn--primary" data-act="ct-mv-save" data-id="' + (m ? m.id : "") +
        '" data-lv="' + h(levelId || (m && m.level) || "") + '">Speichern</button>'
    );
  }

  function mvSave(id, levelId) {
    const s = S();
    const rec = {
      title: $("#mv-title").value.trim() || "Ohne Titel",
      tag: $("#mv-tag").value.trim(),
      desc: $("#mv-desc").value.trim(),
      goal: $("#mv-goal").value.trim(),
      steps: lines($("#mv-steps").value),
      errors: lines($("#mv-errors").value),
      success: $("#mv-success").value.trim(),
    };
    const c = id && s.mvCustom.find((x) => x.id === id);
    if (c) Object.assign(c, rec);
    else if (id && builtinManeuver(id)) {
      const orig = builtinManeuver(id).m;
      const e = {};
      MV_FIELDS.forEach((f) => {
        if (JSON.stringify(rec[f]) !== JSON.stringify(orig[f])) e[f] = rec[f];
      });
      if (Object.keys(e).length) s.mvEdit[id] = e;
      else delete s.mvEdit[id];
    } else s.mvCustom.push(Object.assign({ id: uid(), level: levelId || TRAINING[0].id }, rec));
    ctx.save();
    ctx.closeDialog();
    ctx.rerender();
    ctx.toast("Manöver gespeichert");
  }

  /* ---------------------------------------------------------- Checklisten */

  function checklists() {
    const s = S();
    const builtin = CHECKLISTS.filter((c) => !(s.clEdit[c.id] && s.clEdit[c.id].hidden)).map((c) => {
      const e = s.clEdit[c.id];
      return e ? Object.assign({}, c, { title: e.title || c.title, items: e.items || c.items, edited: true }) : c;
    });
    return builtin.concat(s.clCustom.map((c) => Object.assign({ custom: true }, c)));
  }

  function hiddenChecklists() {
    return CHECKLISTS.filter((c) => S().clEdit[c.id] && S().clEdit[c.id].hidden);
  }

  function checklist(id) {
    const c = S().clCustom.find((x) => x.id === id);
    if (c) return Object.assign({ custom: true }, c);
    const b = CHECKLISTS.find((x) => x.id === id);
    if (!b) return null;
    const e = S().clEdit[id];
    return e ? Object.assign({}, b, { title: e.title || b.title, items: e.items || b.items, edited: true }) : b;
  }

  function clDialog(id) {
    const c = id ? checklist(id) : null;
    const v = c || { title: "", items: [] };
    const builtin = c && !c.custom;
    ctx.openDialog(
      c ? "Checkliste bearbeiten" : "Eigene Checkliste",
      '<label class="field"><span class="label">Titel</span><input type="text" id="cl-title" value="' + h(v.title) + '"></label>' +
        '<label class="field"><span class="label">Punkte, einer pro Zeile. Optional mit Hinweis nach einem senkrechten Strich</span>' +
        '<textarea id="cl-items" rows="10" placeholder="Props geprüft | Risse, Kerben, Unwucht">' +
        h((v.items || []).map((it) => it.t + (it.h ? " | " + it.h : "")).join("\n")) + "</textarea></label>" +
        '<p class="row__meta" style="margin:0">Beim Ändern der Punkte werden die Haken dieser Liste zurückgesetzt.</p>',
      (builtin
        ? '<button type="button" class="btn btn--danger" data-act="ct-cl-hide" data-id="' + c.id + '">Ausblenden</button>' +
          (c.edited ? '<button type="button" class="btn" data-act="ct-cl-reset" data-id="' + c.id + '">Original</button>' : "")
        : c
        ? '<button type="button" class="btn btn--danger" data-act="ct-cl-del" data-id="' + c.id + '">Löschen</button>'
        : "") +
        '<button type="button" class="btn btn--primary" data-act="ct-cl-save" data-id="' + (c ? c.id : "") + '">Speichern</button>'
    );
  }

  function clSave(id) {
    const s = S();
    const title = $("#cl-title").value.trim() || "Ohne Titel";
    const items = lines($("#cl-items").value).map((l) => {
      const i = l.indexOf("|");
      return i > -1 ? { t: l.slice(0, i).trim(), h: l.slice(i + 1).trim() } : { t: l };
    });
    const before = id ? JSON.stringify(checklist(id).items) : "";
    const c = id && s.clCustom.find((x) => x.id === id);
    if (c) Object.assign(c, { title: title, items: items });
    else if (id) {
      const b = CHECKLISTS.find((x) => x.id === id);
      const same = title === b.title && JSON.stringify(items) === JSON.stringify(b.items);
      if (same) delete s.clEdit[id];
      else s.clEdit[id] = { title: title, items: items };
    } else s.clCustom.push({ id: uid(), title: title, items: items });
    // Haken hängen an der Position; nach einer Änderung passen sie nicht mehr.
    if (id && before !== JSON.stringify(items)) s.checks[id] = {};
    ctx.save();
    ctx.closeDialog();
    ctx.rerender();
    ctx.toast("Checkliste gespeichert");
  }

  /* ---------------------------------------------------------------- Links */

  function linkGroups() {
    const s = S();
    const groups = LINKS.map((g) => ({
      group: g.group,
      items: g.items.filter((l) => !s.linkHidden[l.url]).map((l) => Object.assign({ builtin: true }, l)),
    }));
    s.linkCustom.forEach((l) => {
      let g = groups.find((x) => x.group === l.group);
      if (!g) groups.push((g = { group: l.group, items: [] }));
      g.items.push(l);
    });
    return groups.filter((g) => g.items.length);
  }

  function hiddenLinks() {
    const s = S();
    return LINKS.reduce((a, g) => a.concat(g.items.filter((l) => s.linkHidden[l.url])), []);
  }

  function linkDialog(id) {
    const l = id ? S().linkCustom.find((x) => x.id === id) : null;
    const v = l || { group: "Eigene Links", title: "", url: "", desc: "" };
    const groups = linkGroups().map((g) => g.group);
    ctx.openDialog(
      l ? "Link bearbeiten" : "Link hinzufügen",
      '<label class="field"><span class="label">Gruppe</span><input type="text" id="ln-group" list="ln-groups" value="' + h(v.group) + '">' +
        '<datalist id="ln-groups">' + groups.map((g) => '<option value="' + h(g) + '">').join("") + "</datalist></label>" +
        '<label class="field"><span class="label">Titel</span><input type="text" id="ln-title" value="' + h(v.title) + '"></label>' +
        '<label class="field"><span class="label">Adresse</span><input type="url" id="ln-url" value="' + h(v.url) + '" placeholder="https://"></label>' +
        '<label class="field"><span class="label">Beschreibung</span><textarea id="ln-desc">' + h(v.desc) + "</textarea></label>",
      (l ? '<button type="button" class="btn btn--danger" data-act="ct-link-del" data-id="' + l.id + '">Löschen</button>' : "") +
        '<button type="button" class="btn btn--primary" data-act="ct-link-save" data-id="' + (l ? l.id : "") + '">Speichern</button>'
    );
  }

  function linkSave(id) {
    const url = $("#ln-url").value.trim();
    if (!/^https?:\/\//i.test(url)) return ctx.toast("Adresse muss mit http:// oder https:// beginnen");
    const rec = {
      group: $("#ln-group").value.trim() || "Eigene Links",
      title: $("#ln-title").value.trim() || url,
      url: url,
      desc: $("#ln-desc").value.trim(),
    };
    const s = S();
    const l = id && s.linkCustom.find((x) => x.id === id);
    if (l) Object.assign(l, rec);
    else s.linkCustom.push(Object.assign({ id: uid() }, rec));
    ctx.save();
    ctx.closeDialog();
    ctx.rerender();
    ctx.toast("Link gespeichert");
  }

  /* ------------------------------------------------------------ Aktionen */

  function done(msg) {
    ctx.save();
    ctx.closeDialog();
    ctx.rerender();
    if (msg) ctx.toast(msg);
    return true;
  }

  function click(act, el) {
    const s = S();
    const id = el.dataset.id;
    switch (act) {
      case "ct-mv-new":
        return mvDialog(null, el.dataset.lv), true;
      case "ct-mv-edit":
        return mvDialog(id), true;
      case "ct-mv-save":
        return mvSave(id, el.dataset.lv), true;
      case "ct-mv-hide":
        s.mvEdit[id] = Object.assign({}, s.mvEdit[id], { hidden: true });
        return done("Manöver ausgeblendet");
      case "ct-mv-show": {
        const e = Object.assign({}, s.mvEdit[id]);
        delete e.hidden;
        if (Object.keys(e).length) s.mvEdit[id] = e;
        else delete s.mvEdit[id];
        return done("Manöver wieder eingeblendet");
      }
      case "ct-mv-reset":
        delete s.mvEdit[id];
        return done("Original wiederhergestellt");
      case "ct-mv-del":
        if (!window.confirm("Dieses Manöver löschen? Dein Übungsstand dazu geht mit.")) return true;
        s.mvCustom = s.mvCustom.filter((x) => x.id !== id);
        delete s.training[id];
        return done("Manöver gelöscht");
      case "ct-hidden-toggle":
        showHidden[el.dataset.key] = !showHidden[el.dataset.key];
        ctx.rerender();
        return true;

      case "ct-cl-new":
        return clDialog(null), true;
      case "ct-cl-edit":
        return clDialog(id), true;
      case "ct-cl-save":
        return clSave(id), true;
      case "ct-cl-hide":
        s.clEdit[id] = Object.assign({}, s.clEdit[id], { hidden: true });
        return done("Checkliste ausgeblendet");
      case "ct-cl-show": {
        const e = Object.assign({}, s.clEdit[id]);
        delete e.hidden;
        if (e.title || e.items) s.clEdit[id] = e;
        else delete s.clEdit[id];
        return done("Checkliste wieder eingeblendet");
      }
      case "ct-cl-reset":
        delete s.clEdit[id];
        s.checks[id] = {};
        return done("Original wiederhergestellt");
      case "ct-cl-del":
        if (!window.confirm("Diese Checkliste löschen?")) return true;
        s.clCustom = s.clCustom.filter((x) => x.id !== id);
        delete s.checks[id];
        return done("Checkliste gelöscht");

      case "ct-link-mode":
        linkEditMode = !linkEditMode;
        ctx.rerender();
        return true;
      case "ct-link-new":
        return linkDialog(null), true;
      case "ct-link-edit":
        return linkDialog(id), true;
      case "ct-link-save":
        return linkSave(id), true;
      case "ct-link-del":
        s.linkCustom = s.linkCustom.filter((x) => x.id !== id);
        return done("Link gelöscht");
      case "ct-link-hide":
        s.linkHidden[el.dataset.url] = { hidden: true };
        return done();
      case "ct-link-show":
        delete s.linkHidden[el.dataset.url];
        return done();
    }
    return false;
  }

  return {
    levels: levels,
    allManeuvers: allManeuvers,
    maneuver: maneuver,
    hiddenManeuvers: hiddenManeuvers,
    checklists: checklists,
    checklist: checklist,
    hiddenChecklists: hiddenChecklists,
    linkGroups: linkGroups,
    hiddenLinks: hiddenLinks,
    linkEditMode: () => linkEditMode,
    showHidden: (k) => !!showHidden[k],
    click: click,
  };
}
