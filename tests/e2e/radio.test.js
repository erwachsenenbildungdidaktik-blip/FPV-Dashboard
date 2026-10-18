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
  await p.click('#view-radio .rd-ctl[data-key=' + key + ']');
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
  ok(await A.locator('#view-radio .rd-ctl').count() === 22, '22 Elemente in der Zeichnung (SA–SH, S1/S2, 6 Tasten, T1–T4, LS/RS)');
  ok((await view(A)).includes('Noch kein Element mit der Funktion Arm'), 'Hinweis: kein Arm');

  // SF als Arm auf CH5
  await A.click('#view-radio .rd-ctl[data-key=SF]');
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
  await A.click('#view-radio .rd-ctl[data-key=SE]');
  await A.fill('#rc-fn', 'Beeper');
  await A.selectOption('#rc-kind', 'sw2'); await A.waitForTimeout(100);
  ok(await A.locator('.rc-pos').count() === 2 && await A.inputValue('#rc-fn') === 'Beeper', 'Art umgestellt, Eingabe bleibt');
  await A.selectOption('#rc-ch', '8'); await A.click('[data-act=rd-ctl-save]'); await A.waitForTimeout(150);

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

  // Abgleich mit Gerät B
  const B = await device(b, 'B'); await B.goto(URL); await ready(B);
  await putCode(B, await getCode(A));
  await B.click('.tab[data-view=radio]');
  ok(await B.locator('#view-radio .rd-ctl.is-on').count() === 3 && (await view(B)).includes('SI hinten'), 'Belegung auf Gerät B');

  // Zweite Funke, Umschalten
  await A.click('[data-act=rd-new]'); await A.fill('#rd-name', 'Zorro'); await A.selectOption('#rd-tpl', 'custom');
  await A.click('[data-act=rd-save]'); await A.waitForTimeout(150);
  ok(await A.locator('#view-radio [data-act=rd-pick]').count() === 2 && await A.locator('#view-radio .rd-svg').count() === 0, 'eigene Funke ohne Zeichnung, Umschalter da');
  await A.click('#view-radio [data-act=rd-pick]:has-text("TX16S")');
  ok(await A.locator('#view-radio .rd-svg').count() === 1, 'zurück zur TX16S');

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
