const { chromium, devices } = require('./pw');
const URL = 'http://localhost:8765/';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function device(b, name) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block', permissions: ['clipboard-read','clipboard-write'] });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  p.name = name;
  return p;
}
const snap = p => p.evaluate(() => new Promise(r => {
  const q = indexedDB.open('fpv-ops'); q.onsuccess = () => { const t = q.result.transaction('records').objectStore('records').getAll(); t.onsuccess = () => r(t.result); };
}));
const live = recs => recs.filter(r => !r.d);
async function ready(p) { await p.waitForSelector('#view-dashboard .card', { state: 'attached' }); await p.waitForTimeout(200); }
async function addFlight(p, min, batIdx) {
  await p.click('.tab[data-view=flights]');
  await p.click('[data-act=flight-new]');
  await p.fill('#f-min', String(min));
  await p.locator('.f-bat').nth(batIdx).check({ force: true });
  await p.click('[data-act=flight-save]');
  await p.waitForTimeout(200);
}
async function cycles(p, i) {
  await p.click('.tab[data-view=batteries]');
  return (await p.locator('#view-batteries .card .label.mono').nth(i).textContent()).split('/')[0].trim();
}
async function trainNote(p, text) {
  await p.click('.tab[data-view=training]');
  await p.locator('[data-act=mv]').first().click();
  await p.fill('#m-ok', text);
  await p.click('[data-act=mv-save]');
  await p.waitForTimeout(200);
}
async function getCode(p) {
  await p.click('.topbar [data-act=backup]');
  await p.click('[data-act=code-copy]');
  await p.waitForTimeout(400);
  const c = await p.evaluate(() => navigator.clipboard.readText());
  await p.click('#dlg-foot [data-act=dlg-close]');
  return c;
}
async function putCode(p, code) {
  await p.click('.topbar [data-act=backup]');
  await p.fill('#f-code', code);
  await p.click('[data-act=code-restore]');
  await p.waitForTimeout(500);
  return p.textContent('#toast');
}
const norm = recs => JSON.stringify(live(recs).map(r => [r.k, r.data]).sort());

(async () => {
  const b = await chromium.launch();

  // ---------- Umzug alter Daten
  const m = await device(b, 'M');
  await m.goto(URL + 'manifest.webmanifest');
  await m.evaluate(() => localStorage.setItem('fpv-ops-v1', JSON.stringify({
    v: 1, batteries: [{ id: 'old1', label: 'Alt #1', brand: 'X', mah: 650, cells: 4, crate: 90, cycles: 7, status: 'charged', statusSince: '2026-09-01', added: '2026-01-01', notes: '' }],
    flights: [{ id: 'f1', date: '2026-09-10', spotId: '', minutes: 4, batteryIds: ['old1'], maxSpeed: 80, maxAlt: 40, weather: '', crash: false, repair: '', notes: '' }],
    spots: [], training: {}, checks: {}, settings: { lifespan: 150 } })));
  await m.goto(URL); await ready(m);
  ok(await cycles(m, 0) === '7', 'Umzug: Zyklen bleiben 7');
  let r = live(await snap(m));
  ok(r.find(x => x.k === 'batteries/old1').data.cyclesBase === 6, 'Umzug: Grundwert 6 + 1 Flug');
  await addFlight(m, 5, 0);
  ok(await cycles(m, 0) === '8', 'Neuer Flug zählt Zyklus');
  await m.click('[data-act=bat-cycle]'); await m.waitForTimeout(150);
  ok(await cycles(m, 0) === '9', '+1 Zyklus');
  await m.reload(); await ready(m);
  ok(await cycles(m, 0) === '9', 'Nach Neuladen weiter 9');
  ok(await m.evaluate(() => localStorage.getItem('fpv-ops-v1')) !== null, 'Alter Eintrag bleibt als Sicherheitskopie');
  // Flug löschen
  await m.click('.tab[data-view=flights]');
  await m.locator('[data-act=flight-edit]').first().click();
  await m.click('[data-act=flight-del]'); await m.waitForTimeout(200);
  ok(await cycles(m, 0) === '8', 'Flug löschen nimmt Zyklus zurück');

  // ---------- Zwei Geräte
  const A = await device(b, 'A'), B = await device(b, 'B');
  await A.goto(URL); await B.goto(URL); await ready(A); await ready(B);
  await addFlight(A, 3, 0);
  await trainNote(A, 'Notiz von A');
  await addFlight(B, 6, 0);
  await addFlight(B, 7, 1);
  await trainNote(B, 'Notiz von B');
  await B.click('.tab[data-view=batteries]'); await B.locator('[data-act=bat-cycle]').first().click(); await B.waitForTimeout(150);

  let t = await putCode(B, await getCode(A));
  console.log('  B toast:', t);
  t = await putCode(A, await getCode(B));
  console.log('  A toast:', t);
  const ra = await snap(A), rb = await snap(B);
  ok(norm(ra) === norm(rb), 'Nach Abgleich identisch');
  const la = live(ra);
  ok(la.filter(x => x.c === 'batteries').length === (await A.evaluate(() => DEFAULT_BATTERIES.length)), 'Startakkus nicht doppelt');
  ok(la.filter(x => x.c === 'flights').length === 3, 'Alle 3 Flüge da');
  const tr = la.find(x => x.c === 'training');
  ok(tr && tr.data.log.length === 2, 'Beide Trainingsnotizen erhalten');
  { const ca = await cycles(A, 0), cb = await cycles(B, 0); ok(ca === '3' && cb === '3', 'Akku 1: 2 Flüge + 1 Einzelzyklus = 3 auf beiden (A=' + ca + ', B=' + cb + ')'); }

  // Löschen wandert mit
  await A.click('.tab[data-view=flights]');
  await A.locator('[data-act=flight-edit]').first().click();
  await A.click('[data-act=flight-del]'); await A.waitForTimeout(200);
  await putCode(B, await getCode(A));
  ok(live(await snap(B)).filter(x => x.c === 'flights').length === 2, 'Löschung kommt auf B an');
  t = await putCode(B, await getCode(A));
  ok(/Nichts Neues/.test(t), 'Zweiter Abgleich: nichts Neues (' + t + ')');

  // Zurücksetzen + Wiederherstellen
  const codeB = await getCode(B);
  await B.click('footer [data-act=wipe]'); await B.waitForTimeout(300);
  ok(live(await snap(B)).filter(x => x.c === 'flights').length === 0, 'Zurücksetzen leert');
  await putCode(B, codeB);
  ok(norm(await snap(B)) === norm(await snap(A)), 'Wiederherstellen nach Zurücksetzen');

  // Altes Backup-Format einlesen (Datei)
  const C = await device(b, 'C'); await C.goto(URL); await ready(C);
  const legacy = JSON.stringify({ v: 1, batteries: [{ id: 'L1', label: 'Legacy', mah: 1, cells: 4, cycles: 3, status: 'storage' }], flights: [], spots: [], training: {}, checks: {}, settings: {} });
  require('fs').writeFileSync(require('path').join(require('os').tmpdir(), 'legacy.json'), legacy);
  await C.setInputFiles('#file', require('path').join(require('os').tmpdir(), 'legacy.json')); await C.waitForTimeout(500);
  ok((await C.textContent('#view-batteries')).includes('Legacy'), 'Alte Backup-Datei wird übernommen');

  for (const p of [m, A, B, C]) ok(p.errs.length === 0, 'Keine JS-Fehler ' + p.name + ' ' + p.errs.join(' | '));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'ALLES GRÜN');
})();
