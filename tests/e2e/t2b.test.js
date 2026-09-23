const { chromium, devices } = require('./pw');
const URL = 'http://localhost:8765/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function device(b, name) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block', permissions: ['clipboard-read','clipboard-write'], acceptDownloads: true });
  const p = await ctx.newPage(); p.errs = []; p.name = name;
  p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
  p.on('dialog', d => d.accept()); await p.addInitScript(() => { delete Navigator.prototype.share; });
  return p;
}
const ready = async p => { await p.waitForSelector('#view-workshop .card', { state: 'attached' }); await p.waitForTimeout(200); };
const tab = (p, v) => p.click('.tab[data-view=' + v + ']');
const stockOf = async (p, name) => { await tab(p, 'workshop'); return (await p.locator('#view-workshop .row', { hasText: name }).first().locator('strong.mono').textContent()).trim(); };
async function getCode(p) { await p.click('.topbar [data-act=backup]'); await p.click('[data-act=code-copy]'); await p.waitForTimeout(400); const c = await p.evaluate(() => navigator.clipboard.readText()); await p.click('#dlg-foot [data-act=dlg-close]'); return c; }
async function putCode(p, code) { await p.click('.topbar [data-act=backup]'); await p.fill('#f-code', code); await p.click('[data-act=code-restore]'); await p.waitForTimeout(500); }
async function setStock(p, name, n) { await tab(p, 'workshop'); await p.locator('#view-workshop .row', { hasText: name }).locator('[data-act=ws-part-edit]').click(); await p.fill('#p-stock', String(n)); await p.click('[data-act=ws-part-save]'); await p.waitForTimeout(150); }

(async () => {
  const b = await chromium.launch();
  const A = await device(b, 'A'); await A.goto(URL); await ready(A);
  await setStock(A, 'HQProp T3x3x3', 12);

  // Wartungsplan sichtbar, Konfig-Aufgabe fällig ("noch nie")
  await tab(A, 'workshop');
  let w = await A.textContent('#view-workshop');
  ok(w.includes('Wartungsplan') && w.includes('Schrauben, Arme') && /Fällig · noch nie erledigt/.test(w), 'Wartungsplan mit fälliger Konfig-Aufgabe');
  await tab(A, 'dashboard');
  ok((await A.textContent('#view-dashboard')).includes('Wartung fällig'), 'Dashboard zeigt fällige Wartung');

  // Crash-Flug mit Teilen
  await tab(A, 'flights'); await A.click('[data-act=flight-new]');
  ok(await A.locator('#f-crashbox').isHidden(), 'Teilefeld erst bei Crash sichtbar');
  await A.fill('#f-min', '4'); await A.check('#f-crash', { force: true });
  await A.fill('#f-repair', 'Props hin');
  await A.locator('#f-parts .pu-part').first().selectOption({ label: 'HQProp T3x3x3 Durable' });
  await A.locator('#f-parts .pu-qty').first().fill('2');
  await A.click('[data-act=flight-save]'); await A.waitForTimeout(200);
  ok(await stockOf(A, 'HQProp T3x3x3') === '10', 'Crash bucht 2 Props ab (12 -> 10)');
  // Flug bearbeiten: Menge ändern
  await tab(A, 'flights'); await A.locator('[data-act=flight-edit]').first().click();
  await A.locator('#f-parts .pu-qty').first().fill('3'); await A.click('[data-act=flight-save]'); await A.waitForTimeout(200);
  ok(await stockOf(A, 'HQProp T3x3x3') === '9', 'Menge geändert (3) -> 9');

  // Logbuch mit Teil
  await tab(A, 'workshop'); await A.locator('[data-act=ws-log]').first().click();
  await A.fill('#lg-text', 'Props getauscht'); await A.locator('#lg-parts .pu-part').first().selectOption({ label: 'HQProp T3x3x3 Durable' });
  await A.click('[data-act=ws-log-save]'); await A.waitForTimeout(200);
  const dlg = await A.textContent('#dlg-body');
  ok(dlg.includes('Props getauscht') && dlg.includes('Crashes aus dem Flugbuch') && dlg.includes('Props hin'), 'Logbuch zeigt Eintrag und Crash');
  await A.click('#dlg-foot [data-act=dlg-close]');
  ok(await stockOf(A, 'HQProp T3x3x3') === '8', 'Logbuch-Teil abgebucht -> 8');

  // Aufgabe erledigt
  const before = (await A.textContent('#view-workshop')).match(/Fällig/g).length;
  await A.locator('#view-workshop [data-act=ws-task-done].btn--primary').first().click(); await A.waitForTimeout(200);
  const after = ((await A.textContent('#view-workshop')).match(/Fällig/g) || []).length;
  ok(after === before - 1, 'Erledigt entfernt Fälligkeit (' + before + ' -> ' + after + ')');

  // Betaflight: zwei Stände, Vergleich
  await A.locator('[data-act=ws-bf]').first().click();
  await A.fill('#bf-label', 'Werkszustand'); await A.fill('#bf-text', '# diff all\nset gyro_lpf1_static_hz = 250\nset motor_pwm_protocol = DSHOT600\nfeature GPS');
  await A.click('[data-act=ws-bf-save]'); await A.waitForTimeout(200);
  await A.fill('#bf-label', 'Nach Tuning'); await A.fill('#bf-text', '# diff all\nset gyro_lpf1_static_hz = 200\nset motor_pwm_protocol = DSHOT600\nfeature GPS\nset gps_rescue_min_sats = 8');
  await A.click('[data-act=ws-bf-save]'); await A.waitForTimeout(200);
  await A.locator('[data-act=ws-bf-diff]').first().click(); await A.waitForTimeout(150);
  const diff = await A.textContent('#dlg-body');
  ok(diff.includes('− set gyro_lpf1_static_hz = 250') && diff.includes('+ set gyro_lpf1_static_hz = 200') && diff.includes('+ set gps_rescue_min_sats = 8') && !diff.includes('DSHOT600'), 'Vergleich zeigt nur Änderungen');
  await A.click('#dlg-foot [data-act=dlg-close]');

  // Training: eigenes Manöver, eingebautes bearbeiten, ausblenden
  await tab(A, 'training'); await A.click('[data-act=ct-mv-new]');
  await A.fill('#mv-title', 'Powerloop über Baum'); await A.fill('#mv-steps', 'Anflug\nHochziehen\nDurchziehen'); await A.click('[data-act=ct-mv-save]'); await A.waitForTimeout(150);
  ok((await A.textContent('#view-training')).includes('Powerloop über Baum'), 'Eigenes Manöver erscheint');
  const firstTitle = (await A.locator('#view-training .mv__title').first().textContent()).trim();
  await A.locator('#view-training .mv').first().click(); await A.click('[data-act=ct-mv-edit]');
  await A.fill('#mv-title', firstTitle + ' (angepasst)'); await A.click('[data-act=ct-mv-save]'); await A.waitForTimeout(150);
  ok((await A.textContent('#view-training')).includes(firstTitle + ' (angepasst)'), 'Eingebautes Manöver angepasst');
  await A.locator('#view-training .mv').first().click(); await A.click('[data-act=ct-mv-edit]'); await A.click('[data-act=ct-mv-reset]'); await A.waitForTimeout(150);
  ok(!(await A.textContent('#view-training')).includes('(angepasst)'), 'Original wiederhergestellt');
  await A.locator('#view-training .mv').first().click(); await A.click('[data-act=ct-mv-edit]'); await A.click('[data-act=ct-mv-hide]'); await A.waitForTimeout(150);
  ok(!(await A.locator('#view-training .mv__title').allTextContents()).includes(firstTitle) && (await A.textContent('#view-training')).includes('1 ausgeblendet'), 'Ausblenden');

  // Checkliste bearbeiten
  await tab(A, 'checklists');
  await A.locator('#view-checklists .check').first().click(); await A.waitForTimeout(100);
  await A.locator('[data-act=ct-cl-edit]').first().click();
  await A.fill('#cl-items', 'Props geprüft | Risse\nAkkus voll'); await A.click('[data-act=ct-cl-save]'); await A.waitForTimeout(150);
  const cl = await A.textContent('#view-checklists');
  ok(cl.includes('Props geprüft') && cl.includes('0 / 2'), 'Checkliste geändert, Haken zurückgesetzt');
  await A.click('[data-act=ct-cl-new]'); await A.fill('#cl-title', 'Nach dem Crash'); await A.fill('#cl-items', 'Arme prüfen\nKamera prüfen'); await A.click('[data-act=ct-cl-save]'); await A.waitForTimeout(150);
  ok((await A.textContent('#view-checklists')).includes('Nach dem Crash'), 'Eigene Checkliste');

  // Links
  await tab(A, 'links'); await A.click('[data-act=ct-link-mode]'); await A.click('[data-act=ct-link-new]');
  await A.fill('#ln-group', 'Shops'); await A.fill('#ln-title', 'fpvracing.ch'); await A.fill('#ln-url', 'https://fpvracing.ch/'); await A.click('[data-act=ct-link-save]'); await A.waitForTimeout(150);
  await A.locator('[data-act=ct-link-hide]').first().click(); await A.waitForTimeout(150);
  await A.click('[data-act=ct-link-mode]');
  const lk = await A.textContent('#view-links');
  ok(lk.includes('Shops') && lk.includes('fpvracing.ch') && !lk.includes('BAZL Drohnenkarte'), 'Link hinzugefügt, eingebauter ausgeblendet');

  // Abgleich auf Gerät B
  const B = await device(b, 'B'); await B.goto(URL); await ready(B);
  await putCode(B, await getCode(A));
  ok(await stockOf(B, 'HQProp T3x3x3') === '8', 'B: Bestand inkl. Verbrauch = 8');
  await tab(B, 'training'); ok((await B.textContent('#view-training')).includes('Powerloop über Baum'), 'B: eigenes Manöver da');
  await tab(B, 'links'); ok(!(await B.textContent('#view-links')).includes('BAZL Drohnenkarte'), 'B: Link ausgeblendet');
  await tab(B, 'workshop'); await B.locator('[data-act=ws-bf]').first().click();
  ok((await B.textContent('#dlg-body')).includes('Nach Tuning'), 'B: Betaflight-Stände da');

  for (const p of [A, B]) ok(p.errs.length === 0, 'Keine JS-Fehler ' + p.name + ' ' + p.errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FEHLER' : 'ALLES GRÜN');
})();
