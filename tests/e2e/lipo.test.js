const { chromium, devices } = require('./pw');
const URL = 'http://localhost:8765/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function device(b, name, dev) {
  const ctx = await b.newContext({ ...(dev || devices['Pixel 7']), serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); p.errs = []; p.name = name;
  p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
  p.on('dialog', d => d.accept()); await p.addInitScript(() => { delete Navigator.prototype.share; });
  return p;
}
const ready = async p => { await p.waitForSelector('#view-workshop .card', { state: 'attached' }); await p.waitForTimeout(200); };
const txt = (p, s) => p.textContent(s).then(t => t.trim());
async function getCode(p) { await p.click('.topbar [data-act=backup]'); await p.click('[data-act=code-copy]'); await p.waitForTimeout(400); const c = await p.evaluate(() => navigator.clipboard.readText()); await p.click('#dlg-foot [data-act=dlg-close]'); return c; }
async function putCode(p, code) { await p.click('.topbar [data-act=backup]'); await p.fill('#f-code', code); await p.click('[data-act=code-restore]'); await p.waitForTimeout(500); }

(async () => {
  const b = await chromium.launch();
  const A = await device(b, 'A'); await A.goto(URL); await ready(A);
  await A.click('.tab[data-view=batteries]');
  ok(await A.locator('#view-batteries [data-act=lp-tab]').count() === 3, 'Unterreiter Bestand / LiPo / LiHV');
  ok((await A.textContent('#view-batteries')).includes('R-Line #1'), 'Bestand bleibt Startseite');

  // LiPo-Seite und Rechner mit dem Beispiel 750 mAh, 4S, 40 W
  await A.click('#view-batteries [data-act=lp-tab][data-tab=lipo]');
  const row4 = await txt(A, '.lp-table tr.is-mine');
  ok(/4S/.test(row4) && row4.includes('16,80') && row4.includes('15,20') && row4.includes('14,0–14,4') && !row4.includes('13,20'), '4S-Zeile: voll 16,80 / lagern 15,20 / landen 14,0–14,4 (' + row4 + ')');
  const tiles = await txt(A, '.lp-volts');
  ok(tiles.includes('4,20 V') && tiles.includes('3,80 V') && tiles.includes('3,5–3,6 V') && !tiles.includes('3,30'), 'Kacheln: Voll, Lagern, Landen, kein 3,30 V');
  ok(await A.locator('.lp-table tbody tr').count() === 6, 'Tabelle 1S bis 6S');
  ok(await txt(A, '#lp-r-1c') === '0,75 A', '1C = 0,75 A');

  ok(await txt(A, '#lp-r-full') === '16,80 V' && await txt(A, '#lp-r-storage') === '15,20 V', 'Voll 16,80 V, Lager 15,20 V');
  ok(await txt(A, '#lp-r-80') === '600 mAh', '80 % = 600 mAh');
  const lim = await txt(A, '#lp-r-limit');
  ok(lim.includes('2,38 A') && lim.includes('3,2C') && lim.includes('mehr als 1C'), 'Limit 40 W → 2,38 A ≈ 3,2C mit Warnung');
  ok(await A.locator('#lp-r-limit.lp-msg--warn').count() === 1, 'Warnung gelb');
  ok((await txt(A, '#lp-r-preset')).includes('0,93C') && (await txt(A, '#lp-r-preset')).includes('nicht über 1C'), 'Preset 0,7 A = 0,93C ok');

  await A.fill('#lp-watts', '10');
  ok((await txt(A, '#lp-r-limit')).includes('0,60 A') && await A.locator('#lp-r-limit.lp-msg--ok').count() === 1, '10 W → 0,60 A, keine Warnung');
  await A.fill('#lp-preset', '1');
  ok((await txt(A, '#lp-r-preset')).includes('1,33C') && (await txt(A, '#lp-r-preset')).includes('über 1C'), 'Preset 1 A = 1,33C warnt');
  await A.fill('#lp-watts', '200'); await A.fill('#lp-maxa', '5');
  ok((await txt(A, '#lp-r-limit')).includes('5,00 A'), 'Gerätemaximum 5 A begrenzt');
  await A.fill('#lp-watts', '40'); await A.fill('#lp-preset', '0,7');

  // Eingaben und Unterreiter bleiben nach Neuladen
  await A.reload(); await ready(A); await A.click('.tab[data-view=batteries]');
  ok(await A.locator('.lp-table').count() === 1 && await A.inputValue('#lp-preset') === '0,7', 'Unterreiter und Eingaben gemerkt');

  // LiHV-Seite
  await A.click('#view-batteries [data-act=lp-tab][data-tab=lihv]');
  ok((await txt(A, '.lp-table tr.is-mine')).includes('17,40') && (await txt(A, '#lp-r-full')) === '17,40 V', 'LiHV 4S voll 17,40 V');
  ok((await A.textContent('#view-batteries')).includes('Nie einen normalen LiPo im LiHV-Modus laden'), 'LiHV-Warnung');
  ok(await A.locator('#view-batteries a[href*="isdt.co"]').count() >= 2 && await A.locator('#view-batteries a[href*="oscarliang.com"]').count() === 1, 'Quellen verlinkt');

  // Logbuch
  await A.click('#view-batteries [data-act=lp-tab][data-tab=stock]');
  const card1 = A.locator('#view-batteries .card', { hasText: 'R-Line #1' });
  const chg = (await card1.locator('.lp-charger').textContent()).replace(/\s+/g, ' ');
  ok(chg.includes('LiPo') && chg.includes('4S') && chg.includes('0,7 A') && chg.includes('16,80 V') && chg.includes('15,20 V'), 'Ladegerät-Block: LiPo 4S 0,7 A 16,80 V 15,20 V (' + chg + ')');
  await card1.locator('[data-act=lp-log]').click();
  ok((await A.textContent('#dlg')).includes('Noch keine Messung'), 'Logbuch leer');
  await A.click('#dlg [data-act=lp-log-new]');
  ok(await A.locator('.lp-ir').count() === 4, '4 IR-Felder für 4S');
  await A.fill('#lp-restv', '14,78'); await A.fill('#lp-delta', '5'); await A.fill('#lp-recharged', '650');
  const irs = A.locator('.lp-ir'); for (let i = 0; i < 4; i++) await irs.nth(i).fill(String(8 + i));
  await A.fill('#lp-note', 'mit 0,7 A geladen');
  await A.click('#dlg [data-act=lp-log-save]'); await A.waitForTimeout(200);
  ok((await A.textContent('#dlg')).includes('14,78 V (3,695 V/Zelle)') && (await A.textContent('#dlg')).includes('IR 8 / 9 / 10 / 11 mΩ'), 'Messung im Logbuch');
  await A.click('#dlg-foot [data-act=dlg-close]');
  let c1 = await card1.textContent();
  ok(c1.includes('Letzte Messung') && c1.includes('Tiefer als 80 %'), 'Karte zeigt Messung und 80-%-Warnung');

  // Zweite Messung, IR-Vergleich
  await card1.locator('[data-act=lp-log]').click(); await A.click('#dlg [data-act=lp-log-new]');
  await A.fill('#lp-date', '2099-01-01'); await A.fill('#lp-recharged', '500');
  for (let i = 0; i < 4; i++) await A.locator('.lp-ir').nth(i).fill('12');
  await A.click('#dlg [data-act=lp-log-save]'); await A.waitForTimeout(200); await A.click('#dlg-foot [data-act=dlg-close]');
  c1 = await card1.textContent();
  ok(c1.includes('IR Ø 9,5 → 12,0 mΩ') && !c1.includes('Tiefer als 80 %'), 'IR-Vergleich, 500 mAh ohne Warnung');

  // Akkutyp und Kaufdatum
  await A.locator('#view-batteries .card', { hasText: 'R-Line #4' }).locator('[data-act=bat-edit]').click();
  await A.selectOption('#f-chem', 'lihv'); await A.fill('#f-bought', '2026-03-01');
  await A.click('[data-act=bat-save]'); await A.waitForTimeout(200);
  const c4 = await A.locator('#view-batteries .card', { hasText: 'R-Line #4' }).textContent();
  ok(c4.includes('LiHV') && c4.includes('17,40 V') && c4.includes('15,40 V'), 'Akku als LiHV markiert, Ladegerät-Block mit LiHV-Werten');

  // Abgleich: Messungen kommen auf Gerät B an
  const B = await device(b, 'B'); await B.goto(URL); await ready(B);
  await putCode(B, await getCode(A));
  await B.click('.tab[data-view=batteries]');
  ok((await B.locator('#view-batteries .card', { hasText: 'R-Line #1' }).textContent()).includes('IR Ø 9,5 → 12,0 mΩ'), 'Logbuch auf Gerät B');
  ok((await B.locator('#view-batteries .card', { hasText: 'R-Line #4' }).textContent()).includes('LiHV'), 'Akkutyp auf Gerät B');

  // Messung löschen wandert mit
  await A.locator('#view-batteries .card', { hasText: 'R-Line #1' }).locator('[data-act=lp-log]').click();
  await A.locator('#dlg [data-act=lp-log-edit]').first().click(); await A.click('#dlg [data-act=lp-log-del]'); await A.waitForTimeout(200);
  await A.click('#dlg-foot [data-act=dlg-close]');
  await putCode(B, await getCode(A));
  await B.click('.tab[data-view=batteries]');
  ok(!(await B.locator('#view-batteries .card', { hasText: 'R-Line #1' }).textContent()).includes('IR Ø'), 'Löschung auf Gerät B');

  // Layout: Handy quer und Laptop, kein seitliches Scrollen
  for (const [n, vp] of [['quer', { width: 915, height: 412 }], ['breit', { width: 1280, height: 800 }]]) {
    await A.setViewportSize(vp);
    for (const t of ['lipo', 'lihv']) {
      await A.click('#view-batteries [data-act=lp-tab][data-tab=' + t + ']');
      const w = await A.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(w <= 1, n + ' ' + t + ': kein seitliches Scrollen');
    }
  }
  await A.setViewportSize({ width: 412, height: 915 });
  const w = await A.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(w <= 1, 'hoch: kein seitliches Scrollen');

  ok(A.errs.length === 0 && B.errs.length === 0, 'keine JS-Fehler ' + JSON.stringify(A.errs.concat(B.errs)));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'ALLES GRÜN');
  process.exit(fails ? 1 : 0);
})();
