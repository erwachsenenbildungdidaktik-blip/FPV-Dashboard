const { chromium, devices } = require('./pw');
const URL = 'http://localhost:8765/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function device(b, name) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); p.errs = []; p.name = name;
  p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
  p.on('dialog', d => d.accept()); await p.addInitScript(() => { delete Navigator.prototype.share; });
  return p;
}
const ready = async p => { await p.waitForSelector('#view-workshop .card', { state: 'attached' }); await p.waitForTimeout(200); };
async function getCode(p) { await p.click('.topbar [data-act=backup]'); await p.click('[data-act=code-copy]'); await p.waitForTimeout(400); const c = await p.evaluate(() => navigator.clipboard.readText()); await p.click('#dlg-foot [data-act=dlg-close]'); return c; }
async function putCode(p, code) { await p.click('.topbar [data-act=backup]'); await p.fill('#f-code', code); await p.click('[data-act=code-restore]'); await p.waitForTimeout(500); }
const view = p => p.textContent('#view-radio');
async function map(p, key, fn, ch, pos) {
  await p.click('#view-radio .rd-ctl[data-key=' + key + ']', { button: 'right' });
  await p.fill('#rc-fn', fn);
  if (ch) await p.selectOption('#rc-ch', String(ch));
  const f = p.locator('.rc-pos'); for (let i = 0; i < (pos || []).length; i++) await f.nth(i).fill(pos[i]);
  await p.click('[data-act=rd-ctl-save]'); await p.waitForTimeout(150);
}

(async () => {
  const b = await chromium.launch();
  const A = await device(b, 'A'); await A.goto(URL); await ready(A);
  ok(await A.locator('.tab[data-view=radio]').count() === 1, 'Reiter Funke vorhanden');
  await A.click('.tab[data-view=radio]');
  ok((await view(A)).includes('Noch keine Funke'), 'leer am Anfang');
  await A.click('[data-act=rd-quick][data-tpl=tx16s-mk3]'); await A.waitForTimeout(150);
  ok(await A.locator('#view-radio a.rd-manual[href*="TX16SMK3_manual"]').count() === 1, 'Vorlage bringt Link zum TX16S-Mk3-Handbuch mit');
  ok(await A.locator('#view-radio .rd-ctl').count() === 24, '24 Elemente wie im Handbuch (SA–SH, S1/S2, 6-Pos-Tasten, T1–T6, LS/RS)');
  ok((await view(A)).includes('Noch kein Element mit der Funktion Arm'), 'Hinweis: kein Arm');

  // SF als Arm auf CH5
  await A.click('#view-radio .rd-ctl[data-key=SF]', { button: 'right' });
  ok(await A.locator('.rc-pos').count() === 2, 'SF hat 2 Stellungen');
  await A.click('#dlg-foot [data-act=dlg-close]');
  await map(A, 'SF', 'Arm', 5, ['disarmed', 'armed']);
  ok(await A.locator('#view-radio .rd-ctl.is-on[data-key=SF]').count() === 1, 'SF leuchtet');
  let row = await A.locator('#view-radio .rd-table tbody tr').first().textContent();
  ok(row.includes('CH5') && row.includes('SF') && row.includes('Arm') && row.includes('unten: armed'), 'Tabelle: CH5 SF Arm (' + row + ')');
  ok(!(await view(A)).includes('Funktion Arm') && !(await view(A)).includes('ExpressLRS will'), 'keine Arm-Warnung bei CH5');

  // SB (3 Stellungen) auch auf CH5 -> zwei Warnungen
  await map(A, 'SB', 'Angle', 5, ['Acro', 'Horizon', 'Angle']);
  let v = await view(A);
  ok(v.includes('CH5 (AUX1) doppelt belegt: SF, SB') || v.includes('CH5 (AUX1) doppelt belegt: SB, SF'), 'Warnung doppelter Kanal');
  ok(v.includes('SB ist ein Schalter, 3 Stellungen auf CH5'), 'Warnung 3-Stellungs-Schalter auf CH5');
  await map(A, 'SB', 'Angle', 6, []);
  v = await view(A);
  ok(!v.includes('doppelt') && !v.includes('auf CH5. ExpressLRS'), 'Warnungen weg nach Umstellen auf CH6');

  // Arm auf falschem Kanal
  await map(A, 'SF', 'Arm', 7, []);
  ok((await view(A)).includes('Arm liegt auf CH7 (AUX3). ExpressLRS will Arm auf CH5 (AUX1).'), 'Warnung Arm nicht auf CH5');
  await map(A, 'SF', 'Arm', 5, []);

  // Art umstellen (SE -> 2 Stellungen), Eingaben bleiben
  await A.click('#view-radio .rd-ctl[data-key=SE]', { button: 'right' });
  await A.fill('#rc-fn', 'Beeper');
  await A.selectOption('#rc-kind', 'sw2'); await A.waitForTimeout(100);
  ok(await A.locator('.rc-pos').count() === 2 && await A.inputValue('#rc-fn') === 'Beeper', 'Art umgestellt, Eingabe bleibt');
  await A.selectOption('#rc-ch', '8'); await A.click('[data-act=rd-ctl-save]'); await A.waitForTimeout(150);

  // Abbrechen legt nichts an
  const tilesBefore = await A.locator('#view-radio .rd-tile').count();
  await A.click('[data-act=rd-add]');
  ok((await A.textContent('#dlg-title')) === 'Neues Element' && await A.locator('[data-act=rd-ctl-del]').count() === 0, 'Dialog für neues Element ohne Entfernen-Knopf');
  await A.click('#dlg-foot [data-act=dlg-close]'); await A.waitForTimeout(100);
  ok(await A.locator('#view-radio .rd-tile').count() === tilesBefore, 'Abbrechen legt kein Element an');

  // Eigenes Element
  await A.click('[data-act=rd-add]');
  await A.fill('#rc-label', 'SI hinten'); await A.selectOption('#rc-kind', 'btn'); await A.waitForTimeout(80);
  await A.fill('#rc-fn', 'Turtle'); await A.selectOption('#rc-ch', '9');
  await A.click('[data-act=rd-ctl-save]'); await A.waitForTimeout(150);
  ok((await A.locator('#view-radio .rd-tile.is-on').textContent()).includes('SI hinten'), 'eigenes Element als Kachel');

  // Kopieren
  await A.click('[data-act=rd-copy]'); await A.waitForTimeout(300);
  const txt = await A.evaluate(() => navigator.clipboard.readText());
  ok(txt.includes('CH5 (AUX1) · SF · Arm') && txt.includes('CH8 (AUX4) · SE · Beeper') && txt.includes('SI hinten'), 'Belegung als Text');

  // Kurz tippen zeigt die Belegung, lang drücken öffnet den Dialog
  await A.click('#view-radio .rd-ctl[data-key=SF]'); await A.waitForTimeout(100);
  ok(await A.locator('#rd-tip').isVisible() && (await A.textContent('#rd-tip')).includes('CH5 (AUX1)') && (await A.textContent('#rd-tip')).includes('Arm') && await A.locator('#dlg[open]').count() === 0, 'Tippen: Blase mit SF · CH5 · Arm, kein Dialog');
  await A.click('#view-radio .rd-ctl[data-key=SA]'); await A.waitForTimeout(100);
  ok((await A.textContent('#rd-tip')).includes('Noch nicht belegt'), 'Tippen auf leeres Element: noch nicht belegt');
  ok((await A.textContent('#rd-tip')).includes('Lang drücken zum Belegen') && !(await view(A)).includes('Rechtsklick'), 'Handy: Hinweise ohne Rechtsklick');
  const sa = await A.locator('#view-radio .rd-ctl[data-key=SA] rect').boundingBox();
  await A.mouse.move(sa.x + sa.width / 2, sa.y + sa.height / 2); await A.mouse.down(); await A.waitForTimeout(650); await A.mouse.up(); await A.waitForTimeout(150);
  ok(await A.locator('#dlg[open]').count() === 1 && (await A.textContent('#dlg-title')).includes('SA'), 'Lang drücken öffnet die Belegung und der Dialog bleibt offen');
  await A.click('#dlg-foot [data-act=dlg-close]');

  // Belegung pro Drohne
  ok(await A.locator('#rd-drone option').count() === 2 && (await view(A)).includes('Belegung für Seeker 3'), 'Drohnen-Auswahl über der Funke');
  await A.selectOption('#rd-drone', 'seed-meteor65-pro2-o4'); await A.waitForTimeout(150);
  ok(await A.locator('#view-radio .rd-ctl.is-on').count() === 0 && (await view(A)).includes('Belegung von Seeker 3 übernehmen'), 'Meteor: leer, Übernehmen angeboten');
  await A.click('[data-act=rd-copyfrom]'); await A.waitForTimeout(150);
  ok(await A.locator('#view-radio .rd-ctl.is-on[data-key=SF]').count() === 1, 'Belegung übernommen');
  await map(A, 'SF', 'Arm', 6, []);
  ok((await view(A)).includes('Arm liegt auf CH6'), 'Meteor eigene Belegung (Arm auf CH6)');
  await A.selectOption('#rd-drone', 'default-drone-1'); await A.waitForTimeout(150);
  ok(!(await view(A)).includes('Arm liegt auf CH6') && (await view(A)).includes('Belegung für Seeker 3'), 'Seeker unverändert');
  await A.selectOption('#rd-drone', 'seed-meteor65-pro2-o4'); await map(A, 'SF', 'Arm', 5, []); await A.selectOption('#rd-drone', 'default-drone-1'); await A.waitForTimeout(100);

  // Abgleich mit Gerät B
  const B = await device(b, 'B'); await B.goto(URL); await ready(B);
  await putCode(B, await getCode(A));
  await B.click('.tab[data-view=radio]');
  ok(await B.locator('#view-radio .rd-ctl.is-on').count() === 3 && (await view(B)).includes('SI hinten'), 'Belegung auf Gerät B');

  // Zweite Funke, Umschalten
  await A.click('[data-act=rd-new]'); await A.fill('#rd-name', 'Zorro'); await A.selectOption('#rd-tpl', 'custom');
  await A.click('[data-act=rd-save]'); await A.waitForTimeout(150);
  ok(await A.locator('#rd-radio option').count() === 2 && await A.locator('#view-radio .rd-svg').count() === 0, 'eigene Funke ohne Zeichnung, Umschalter da');
  await A.selectOption('#rd-radio', { label: 'RadioMaster TX16S Mk3' });
  ok(await A.locator('#view-radio .rd-svg').count() === 1, 'zurück zur TX16S');

  // Bild der Funke, Link, Unterlagen
  await A.selectOption('#rd-radio', { label: 'RadioMaster TX16S Mk3' });
  const png = Buffer.from(await A.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#ddd'; g.fillRect(0, 0, 400, 300); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
  await A.click('#view-radio [data-act=rd-edit]');
  await A.fill('#rd-url', 'https://radiomasterrc.com/products/tx16s-mk3-radio-controller');
  await A.setInputFiles('#rd-files', { name: 'tx16s-schalter.png', mimeType: 'image/png', buffer: png });
  await A.click('[data-act=rd-save]'); await A.waitForTimeout(600);
  ok(await A.locator('#view-radio .rd-photo img').count() === 1, 'Bild der Funke wird gezeigt');
  ok(await A.locator('#view-radio a.rd-manual[href="https://radiomasterrc.com/products/tx16s-mk3-radio-controller"]').count() === 1, 'Link zur Bedienungsanleitung unter der Funke');
  ok((await view(A)).includes('tx16s-schalter.png') && (await view(A)).includes('Bild der Funke'), 'Datei in den Unterlagen');
  ok(await A.locator('#view-radio .rd-pin').count() === 0 && (await view(A)).includes('noch nicht auf dem Bild platziert'), 'noch keine Punkte');

  // Platzieren: SE, dann SF
  await A.click('[data-act=rd-place]');
  const img = A.locator('#view-radio .rd-photo img'); let bb = await img.boundingBox();
  await A.mouse.click(bb.x + bb.width * 0.25, bb.y + bb.height * 0.10); await A.waitForTimeout(150);
  bb = await A.locator('#view-radio .rd-photo img').boundingBox();
  await A.mouse.click(bb.x + bb.width * 0.35, bb.y + bb.height * 0.10); await A.waitForTimeout(150);
  const pins = await A.evaluate(() => [...document.querySelectorAll('#view-radio .rd-pin')].map(p => [p.dataset.key, parseFloat(p.style.left), parseFloat(p.style.top)]));
  const near = (k, x, y) => pins.some(p => p[0] === k && Math.abs(p[1] - x) <= 1 && Math.abs(p[2] - y) <= 1);
  ok(pins.length === 2 && near('SE', 25, 10) && near('SF', 35, 10), 'SE und SF platziert: ' + JSON.stringify(pins));
  await A.click('[data-act=rd-place]'); await A.waitForTimeout(100);
  ok(await A.locator('#view-radio .rd-pin.is-on[data-key=SF]').count() === 1, 'SF (Arm) leuchtet auf dem Bild');
  await A.click('#view-radio .rd-pin[data-key=SE]', { button: 'right' });
  ok((await A.textContent('#dlg-title')).includes('SE'), 'Punkt öffnet Belegung');
  await A.click('#dlg-foot [data-act=dlg-close]');
  await A.click('#view-radio [data-act=rd-view][data-mode=sketch]');
  ok(await A.locator('#view-radio .rd-svg').count() === 1 && await A.locator('#view-radio .rd-photo').count() === 0, 'Umschalten auf Zeichnung');
  await A.click('#view-radio [data-act=rd-view][data-mode=photo]');

  // PDF dazu
  await A.setInputFiles('#view-radio input[data-act=rd-file]', { name: 'TX16S-MK3-Manual.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
  await A.waitForTimeout(500);
  ok((await view(A)).includes('TX16S-MK3-Manual.pdf') && (await view(A)).includes('PDF'), 'PDF in den Unterlagen');

  // Ungültiger Link
  await A.click('#view-radio [data-act=rd-edit]'); await A.fill('#rd-url', 'radiomaster'); await A.click('[data-act=rd-save]'); await A.waitForTimeout(150);
  ok((await A.textContent('#toast')).includes('http') && await A.locator('#dlg[open]').count() === 1, 'Link ohne http wird abgelehnt, Dialog bleibt offen');
  await A.click('#dlg-foot [data-act=dlg-close]');
  ok(await A.locator('#view-radio a.rd-manual').count() === 1, 'alter Link bleibt');

  // Gerät B: Positionen kommen an, Dateien nicht
  await putCode(B, await getCode(A));
  await B.click('.tab[data-view=radio]'); await B.selectOption('#rd-radio', { label: 'RadioMaster TX16S Mk3' }); await B.waitForTimeout(300);
  let bv = await view(B);
  ok(bv.includes('liegt auf einem anderen Gerät') && bv.includes('nicht auf diesem Gerät') && await B.locator('#view-radio a.rd-manual').count() === 1, 'B: Link da, Dateien fehlen mit Hinweis');
  await B.setInputFiles('#view-radio input[data-act=rd-relink][accept="image/*"]', { name: 'tx16s-schalter.png', mimeType: 'image/png', buffer: png });
  await B.waitForTimeout(600);
  ok(await B.locator('#view-radio .rd-photo img').count() === 1 && await B.locator('#view-radio .rd-pin').count() === 2, 'B: Bild nochmals gewählt, Punkte sitzen');

  // Layout
  for (const vp of [{ width: 412, height: 915 }, { width: 915, height: 412 }, { width: 1280, height: 800 }]) {
    await A.setViewportSize(vp); await A.waitForTimeout(100);
    const w = await A.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(w <= 1, vp.width + ' px: kein seitliches Scrollen');
  }

  ok(A.errs.length === 0 && B.errs.length === 0, 'keine JS-Fehler ' + JSON.stringify(A.errs.concat(B.errs)));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'ALLES GRÜN');
  process.exit(fails ? 1 : 0);
})();
