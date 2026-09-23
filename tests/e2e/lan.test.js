const { chromium, devices } = require('./pw');
const { createSyncServer } = require('../../apps/desktop/sync-server.js');
const URL = 'http://localhost:8765/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function page(b, dev) { const p = await (await b.newContext({ ...dev, serviceWorkers: 'block' })).newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept()); return p; }
const tab = (p, v) => p.click('.tab[data-view=' + v + ']');
async function addFlight(p, min) { await tab(p, 'flights'); await p.click('[data-act=flight-new]'); await p.fill('#f-min', String(min)); await p.click('[data-act=flight-save]'); await p.waitForTimeout(150); }
const flights = p => p.evaluate(() => new Promise(r => { const q = indexedDB.open('fpv-ops'); q.onsuccess = () => { const t = q.result.transaction('records').objectStore('records').getAll(); t.onsuccess = () => r(t.result.filter(x => x.c === 'flights' && !x.d).map(x => x.data.minutes).sort()); }; }));

(async () => {
  const b = await chromium.launch();
  // Laptop mit nachgebauter Electron-Brücke um den echten Server
  const L = await page(b, { viewport: { width: 1280, height: 860 } });
  const server = createSyncServer({
    onRequest: (payload) => L.evaluate((p) => window.__fpvHandler(p), payload),
    onEvent: (e) => L.evaluate((e) => window.__fpvEvent && window.__fpvEvent(e), e).catch(() => {}),
  });
  await L.exposeFunction('__startSync', () => server.start());
  await L.exposeFunction('__stopSync', () => server.stop());
  await L.addInitScript(() => {
    window.fpvDesktop = {
      startSync: () => window.__startSync(), stopSync: () => window.__stopSync(),
      onSyncRequest: (fn) => { window.__fpvHandler = fn; }, onSyncEvent: (fn) => { window.__fpvEvent = fn; },
    };
  });
  const M = await page(b, devices['Pixel 7']);
  await M.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true }; });
  await L.goto(URL); await M.goto(URL); await L.waitForTimeout(800); await M.waitForTimeout(800);

  await addFlight(L, 3); await addFlight(M, 5); await addFlight(M, 6);

  // Web-Modus zeigt nur Hinweis
  const W = await page(b, devices['Pixel 7']); await W.goto(URL); await W.waitForTimeout(600);
  await W.click('.topbar [data-act=backup]');
  ok((await W.textContent('#dlg-body')).includes('geht nur zwischen Android-App und Windows-Programm'), 'Browser: nur Hinweis');

  await L.click('.topbar [data-act=backup]'); await L.click('[data-act=sync-open]');
  await L.waitForSelector('#sync-box svg'); 
  const code = (await L.locator('#sync-box .mono').textContent()).trim();
  const addr = await L.locator('#sync-box .row__meta').first().textContent();
  ok(/^\d{6}$/.test(code), 'Laptop zeigt QR und Code ' + code + ' · ' + addr.trim());

  // QR lesbar?
  const png = (await L.locator('#sync-box svg').screenshot()).toString('base64');
  const decoded = await M.evaluate(async (b64) => {
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = './assets/vendor/jsqr/jsQR.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height); const r = window.jsQR(d.data, d.width, d.height); return r && r.data;
  }, png);
  const q = decoded && JSON.parse(decoded);
  ok(q && q.fpv === 1 && q.t === code && q.p > 0, 'QR-Code lesbar: ' + decoded);

  // Falscher Code
  await M.click('.topbar [data-act=backup]'); await M.click('[data-act=sync-open]');
  await M.fill('#sync-host', '127.0.0.1:' + q.p); await M.fill('#sync-code', code === '000000' ? '111111' : '000000');
  await M.click('[data-act=sync-manual]'); await M.waitForTimeout(1500);
  ok(/Falscher Code/.test(await M.textContent('#sync-status')), 'Falscher Code abgewiesen');

  // Richtiger Code
  await M.fill('#sync-code', code); await M.click('[data-act=sync-manual]');
  await M.waitForFunction(() => /Fertig|nicht erreichbar/.test(document.querySelector('#sync-status').textContent), null, { timeout: 20000 });
  console.log('  Handy:', await M.textContent('#sync-status'));
  console.log('  Laptop:', await L.textContent('#sync-status'));
  const fl = await flights(L), fm = await flights(M);
  ok(JSON.stringify(fl) === '[3,5,6]' && JSON.stringify(fm) === '[3,5,6]', 'Beide haben alle 3 Flüge (L ' + fl + ' / M ' + fm + ')');

  await L.click('[data-act=sync-stop]'); await L.waitForTimeout(200);
  ok(!server.running(), 'Server nach Beenden gestoppt');

  for (const p of [L, M, W]) ok(p.errs.length === 0, 'Keine JS-Fehler ' + p.errs.join(' | '));
  server.stop(); await b.close(); console.log(fails ? fails + ' FEHLER' : 'ALLES GRÜN');
})();
