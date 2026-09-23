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
const stockOf = async (p, name) => { await p.click('.tab[data-view=workshop]'); const row = p.locator('#view-workshop .row', { hasText: name }).first(); return (await row.locator('strong.mono').textContent()).trim(); };
const snap = p => p.evaluate(() => new Promise(r => { const q = indexedDB.open('fpv-ops'); q.onsuccess = () => { const t = q.result.transaction('records').objectStore('records').getAll(); t.onsuccess = () => r(t.result); }; }));
async function getCode(p) { await p.click('.topbar [data-act=backup]'); await p.click('[data-act=code-copy]'); await p.waitForTimeout(400); const c = await p.evaluate(() => navigator.clipboard.readText()); await p.click('#dlg-foot [data-act=dlg-close]'); return c; }
async function putCode(p, code) { await p.click('.topbar [data-act=backup]'); await p.fill('#f-code', code); await p.click('[data-act=code-restore]'); await p.waitForTimeout(500); return p.textContent('#toast'); }

(async () => {
  const b = await chromium.launch();
  const A = await device(b, 'A'); await A.goto(URL); await ready(A);
  await A.click('.tab[data-view=workshop]');
  const txt = await A.textContent('#view-workshop');
  ok(txt.includes('Seeker 3') && txt.includes('HQProp T3x3x3 Durable') && txt.includes('TX16S Mk3') && txt.includes('Goggles 3'), 'Startkatalog und Drohne da');
  ok(await A.textContent('.brand__sub') === 'Seeker 3 · A1/A3', 'Kopfzeile zeigt aktive Drohne');
  ok(await stockOf(A, 'Tattu R-Line 750') === '4', 'Bestand R-Line 750 = 4');
  ok(/Nichts zu bestellen/.test(txt), 'Bestellliste anfangs leer');

  // Minimum setzen -> Bestellliste
  await A.locator('#view-workshop .row', { hasText: 'HQProp T3x3x3' }).locator('[data-act=ws-part-edit]').click();
  await A.fill('#p-min', '8'); await A.click('[data-act=ws-part-save]'); await A.waitForTimeout(200);
  await A.locator('#view-workshop .row', { hasText: 'Samsung INR18650-30Q' }).locator('[data-act=ws-list-add]').click(); await A.waitForTimeout(150);
  let order = await A.locator('#view-workshop').textContent();
  ok(/8× HQProp T3x3x3 Durable/.test(order) && /23.20 CHF/.test(order), 'Minimum 8 -> 8 Props à 2.90 = 23.20');
  ok(/1× Samsung INR18650-30Q/.test(order) && /35.10 CHF/.test(order), 'Vorgemerkte Zelle, Total 35.10');
  await A.click('[data-act=ws-order-share]'); await A.waitForTimeout(300);
  const shared = await A.evaluate(() => navigator.clipboard.readText());
  ok(shared.includes('fpvracing.ch') && shared.includes('8× HQProp T3x3x3 Durable à 2.90 CHF = 23.20 CHF'), 'Teilen-Text korrekt');
  const [dl] = await Promise.all([A.waitForEvent('download'), A.click('[data-act=ws-order-csv]')]);
  const csv = require('fs').readFileSync(await dl.path(), 'utf8');
  ok(csv.startsWith('﻿Shop;Teil;Menge') && csv.includes('fpvracing.ch;HQProp T3x3x3 Durable;8;2.90;23.20'), 'CSV korrekt');
  await A.locator('#view-workshop .row', { hasText: '8× HQProp' }).locator('[data-act=ws-bought]').click(); await A.waitForTimeout(200);
  ok(await stockOf(A, 'HQProp T3x3x3') === '8', 'Gekauft bucht 8 ins Lager');
  ok(!/HQProp T3x3x3 Durable<\/a>|8× HQProp/.test(await A.locator('#view-workshop').textContent()), 'Props weg von der Liste');

  // Gewicht via Akkus-Tab landet bei Drohne
  await A.click('.tab[data-view=batteries]'); await A.fill('#drone-weight', '178'); await A.press('#drone-weight', 'Tab'); await A.waitForTimeout(200);
  await A.click('.tab[data-view=workshop]');
  ok((await A.textContent('#view-workshop')).includes('Gewogen ohne Akku: 178 g'), 'Gewicht bei der Drohne');

  // Zwei Geräte: Bestand parallel ändern
  const B = await device(b, 'B'); await B.goto(URL); await ready(B);
  await B.click('.tab[data-view=workshop]');
  await B.locator('#view-workshop .row', { hasText: 'HQProp T3x3x3' }).locator('[data-act=ws-stock][data-delta="1"]').click(); await B.waitForTimeout(150);
  await B.locator('#view-workshop .row', { hasText: 'HQProp T3x3x3' }).locator('[data-act=ws-stock][data-delta="1"]').click(); await B.waitForTimeout(150);
  await A.locator('#view-workshop .row', { hasText: 'HQProp T3x3x3' }).locator('[data-act=ws-stock][data-delta="-1"]').click(); await A.waitForTimeout(150);
  await putCode(B, await getCode(A)); await putCode(A, await getCode(B));
  ok(await stockOf(A, 'HQProp T3x3x3') === '9' && await stockOf(B, 'HQProp T3x3x3') === '9', 'Bestand 8 - 1 (A) + 2 (B) = 9 auf beiden');
  const pa = (await snap(A)).filter(r => r.c === 'parts' && !r.d).length, pb = (await snap(B)).filter(r => r.c === 'parts' && !r.d).length;
  ok(pa === pb && pa === 14, 'Katalog nicht doppelt (' + pa + '/' + pb + ')');

  // Bestehender Nutzer aus Etappe 0 (IDB ohne Werkstatt) bekommt Katalog
  const C = await device(b, 'C'); await C.goto(URL + 'manifest.webmanifest');
  await C.evaluate(() => new Promise(r => { const q = indexedDB.open('fpv-ops', 1); q.onupgradeneeded = () => { q.result.createObjectStore('records', { keyPath: 'k' }); q.result.createObjectStore('meta', { keyPath: 'key' }); };
    q.onsuccess = () => { const t = q.result.transaction(['records','meta'], 'readwrite'); t.objectStore('records').put({ k: 'settings/main', c: 'settings', id: 'main', u: 5, dev: 'x', data: { lifespan: 200, droneWeight: 172 } }); t.objectStore('meta').put({ key: 'migrated', value: 1 }); t.oncomplete = r; }; }));
  await C.goto(URL); await ready(C); await C.click('.tab[data-view=workshop]');
  const ct = await C.textContent('#view-workshop');
  ok(ct.includes('HQProp T3x3x3') && ct.includes('Gewogen ohne Akku: 172 g'), 'Bestehender Stand: Katalog ergänzt, Gewicht übernommen');

  await A.click('.tab[data-view=workshop]'); await A.screenshot({ path: require('path').join(require('os').tmpdir(), 'ws.png'), fullPage: true });
  for (const p of [A, B, C]) ok(p.errs.length === 0, 'Keine JS-Fehler ' + p.name + ' ' + p.errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FEHLER' : 'ALLES GRÜN');
})();
