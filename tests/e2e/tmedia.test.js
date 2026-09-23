const { chromium, devices } = require('./pw');
const URL = 'http://localhost:8765/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function device(b) { const ctx = await b.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block', permissions: ['clipboard-read','clipboard-write'] }); const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept()); return p; }
const tab = (p, v) => p.click('.tab[data-view=' + v + ']');
(async () => {
  const b = await chromium.launch(); const A = await device(b);
  await A.goto(URL); await A.waitForTimeout(800);
  await tab(A, 'flights'); await A.click('[data-act=flight-new]'); await A.fill('#f-min', '4'); await A.click('[data-act=flight-save]'); await A.waitForTimeout(150);
  await tab(A, 'media');
  ok((await A.textContent('#view-media')).includes('Gyroflow') && (await A.textContent('#view-media')).includes('DaVinci Resolve'), 'Schnitt-Links da');
  const srtGps = '1\n00:00:00,000 --> 00:00:01,000\n<font size="28">FrameCnt: 1 [iso: 100] [latitude: 47.3769] [longitude: 8.5417] [rel_alt: 12.0]</font>\n\n2\n00:00:01,000 --> 00:00:02,000\n[latitude: 47.3771] [longitude: 8.5420]\n';
  const srtNo = '1\n00:00:00,000 --> 00:00:01,000\nSignal:4 CH:3 FlightTime:12 SDR Bitrate:40.1Mbps Delay:28ms\n';
  await A.setInputFiles('#md-file', [
    { name: 'DJI_0001.MP4', mimeType: 'video/mp4', buffer: Buffer.alloc(2048) },
    { name: 'DJI_0001.SRT', mimeType: 'text/plain', buffer: Buffer.from(srtGps) },
    { name: 'DJI_0002.MP4', mimeType: 'video/mp4', buffer: Buffer.alloc(4096) },
    { name: 'DJI_0002.SRT', mimeType: 'text/plain', buffer: Buffer.from(srtNo) },
  ]);
  await A.waitForSelector('#dlg[open]', { timeout: 15000 });
  const rep = await A.textContent('#dlg-body');
  ok(/GPS in den Aufnahmen gefunden/.test(await A.textContent('#dlg-title')) && rep.includes('DJI_0001.SRT: 2 GPS-Punkte') && rep.includes('DJI_0002.SRT: keine Koordinaten'), 'GPS-Erkennung pro Datei');
  await A.click('#dlg-foot [data-act=dlg-close]');
  const v = await A.textContent('#view-media');
  ok(v.includes('DJI_0001.MP4') && v.includes('DJI_0002.MP4') && v.includes('SRT ohne GPS'), 'Zwei Aufnahmen mit Kennzeichnung');
  const sel = await A.locator('[data-md-flight]').first().inputValue();
  ok(sel !== '', 'Automatisch dem heutigen Flug zugeordnet');
  ok((await A.locator('[data-act=md-save]').count()) === 2, 'Sichern in dieser Sitzung möglich');
  // Doppelt einlesen -> nichts Neues
  await A.setInputFiles('#md-file', [{ name: 'DJI_0002.MP4', mimeType: 'video/mp4', buffer: Buffer.alloc(4096) }]); await A.waitForTimeout(600);
  ok((await A.locator('#view-media .row').count()) === 2, 'Kein Duplikat');
  await tab(A, 'flights');
  ok(/2 Clips/.test(await A.textContent('#view-flights')), 'Flugbuch zeigt 2 Clips');
  // Abgleich auf B
  await A.click('.topbar [data-act=backup]'); await A.click('[data-act=code-copy]'); await A.waitForTimeout(300); const code = await A.evaluate(() => navigator.clipboard.readText()); await A.click('#dlg-foot [data-act=dlg-close]');
  const B = await device(b); await B.goto(URL); await B.waitForTimeout(800);
  await B.click('.topbar [data-act=backup]'); await B.fill('#f-code', code); await B.click('[data-act=code-restore]'); await B.waitForTimeout(500);
  await tab(B, 'media'); const bv = await B.textContent('#view-media');
  ok(bv.includes('DJI_0001.MP4') && (await B.locator('[data-act=md-save]').count()) === 0, 'B: Angaben da, Sichern erst nach neuem Wählen');
  // Querformat-Check
  await A.setViewportSize({ width: 863, height: 360 }); await tab(A, 'media');
  ok(!(await A.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Quer kein Überlauf');
  for (const p of [A, B]) ok(p.errs.length === 0, 'Keine JS-Fehler ' + p.errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FEHLER' : 'ALLES GRÜN');
})();
