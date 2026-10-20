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
const view = p => p.textContent('#view-betaflight');
const sub = (p, t) => p.click('#view-betaflight [data-act=bf-tab][data-tab=' + t + ']');

const DIFF = `# diff all

# version
# Betaflight / STM32F7X2 (S7X2) 4.5.1 Nov 12 2024 / 10:01:21 (77d01ba3b) MSP API: 1.46

# aux
aux 0 0 0 1700 2100 0 0
aux 1 1 1 1300 1700 0 0
aux 2 35 2 1700 2100 0 0

# rateprofile
rateprofile 0

set rateprofile_name = FREE
set roll_rc_rate = 10
set pitch_rc_rate = 10
set roll_srate = 80
set pitch_srate = 80
set roll_expo = 20

rateprofile 1

set rates_type = BETAFLIGHT

battery_profile 0

set vbat_warning_cell_voltage = 345

# restore original rateprofile selection
rateprofile 0

# save configuration
save`;

(async () => {
  const b = await chromium.launch();
  const A = await device(b, 'A'); await A.goto(URL); await ready(A);

  // Formel direkt prüfen (Betaflight applyActualRates)
  const f = await A.evaluate(async () => {
    const m = await import('./assets/js/views/betaflight.js');
    return {
      def: m.maxRate({ rc: 7, srate: 67, expo: 0 }),
      half: m.actualRate(0.5, { rc: 10, srate: 80, expo: 20 }),
      neg: m.actualRate(-0.5, { rc: 10, srate: 80, expo: 20 }),
      low: m.maxRate({ rc: 20, srate: 10, expo: 0 }),
      bp: Object.keys(m.parseDiff('rateprofile 1\nset roll_srate = 80\nbattery_profile 0\nset vbat_warning_cell_voltage = 345\n').profiles['1'].set),
    };
  });
  ok(f.bp.join() === 'roll_srate', 'battery_profile beendet den Rate-Profil-Block');
  ok(Math.abs(f.def - 670) < 1e-6, 'Standard 70/670/0 → max 670 °/s');
  ok(Math.abs(f.half - 192.1875) < 1e-6 && Math.abs(f.neg + 192.1875) < 1e-6, 'Knüppel 50 %, 100/800/0,20 → 192,19 °/s, symmetrisch');
  ok(Math.abs(f.low - 200) < 1e-6, 'Max unter Center → Center gilt (200 °/s)');

  ok(await A.locator('.tab[data-view=betaflight]').count() === 1, 'Reiter Betaflight vorhanden');
  await A.click('.tab[data-view=betaflight]');
  ok((await view(A)).includes('Noch keine Rates'), 'leer am Anfang');

  // diff all über Stände speichern
  await sub(A, 'configs');
  await A.click('#view-betaflight [data-act=ws-bf]');
  await A.fill('#bf-label', 'Werkszustand'); await A.fill('#bf-text', DIFF);
  await A.click('[data-act=ws-bf-save]'); await A.waitForTimeout(200); await A.click('#dlg-foot [data-act=dlg-close]');
  const st = await view(A);
  ok(st.includes('Betaflight 4.5.1') && st.includes('2 Rate-Profile') && st.includes('3 Modes'), 'Stand erkannt: 4.5.1, 2 Rate-Profile, 3 Modes');

  // Rates übernehmen
  await sub(A, 'rates');
  await A.click('[data-act=bf-import]');
  const dlg = await A.textContent('#dlg');
  ok(dlg.includes('FREE') && dlg.includes('aktiv') && dlg.includes('Roll max 800') && dlg.includes('Typ BETAFLIGHT'), 'Import-Dialog: FREE aktiv 800 °/s, Profil 2 Typ BETAFLIGHT');
  ok(await A.locator('.bf-pick[disabled]').count() === 1, 'Nicht-Actual-Profil nicht wählbar');
  await A.click('[data-act=bf-import-go]'); await A.waitForTimeout(200);
  const card = A.locator('#view-betaflight .bf-rate').first();
  const rowsT = await card.locator('.lp-table tbody tr').evaluateAll(rs => rs.map(r => [...r.cells].map(c => c.textContent).join(' ')));
  ok((await card.textContent()).includes('FREE') && rowsT[0] === 'Roll 100 800 0,20' && rowsT[1] === 'Pitch 100 800 0,00' && rowsT[2] === 'Yaw 70 670 0,00', 'Karte: Roll 100/800/0,20, Pitch 100/800/0, Yaw Standard 70/670/0 (' + rowsT.join(' | ') + ')');
  ok(await card.locator('.bf-line').count() === 3, '3 Kurven');

  // Ablesen
  const svg = card.locator('.bf-svg'); const bb = await svg.boundingBox();
  await A.mouse.move(bb.x + bb.width * (38 + 0.5 * 218) / 300, bb.y + bb.height / 2); await A.waitForTimeout(80);
  const ro = await card.locator('.bf-readout').textContent();
  ok(ro.includes('Knüppel 50 %') && ro.includes('Roll 192'), 'Ablesen bei 50 %: ' + ro);

  // CLI
  await card.locator('[data-act=bf-cli]').click(); await A.waitForTimeout(300);
  const cli = await A.evaluate(() => navigator.clipboard.readText());
  ok(cli.includes('rateprofile 0') && cli.includes('set rates_type = ACTUAL') && cli.includes('set roll_rc_rate = 10') && cli.includes('set roll_expo = 20') && cli.includes('set yaw_srate = 67') && cli.trim().endsWith('save'), 'CLI-Befehle korrekt');

  // Bearbeiten
  await card.locator('[data-act=bf-rate-edit]').click();
  await A.fill('.bf-in[data-ax=roll][data-key=srate]', '1000'); await A.waitForTimeout(80);
  ok(await A.locator('#bf-preview .bf-line').count() === 3, 'Vorschau im Dialog');
  await A.click('[data-act=bf-rate-save]'); await A.waitForTimeout(150);
  ok((await card.locator('.bf-max strong').textContent()).trim() === '1000', 'Roll max 1000 nach Bearbeiten');

  // Neues Profil mit Standard
  await A.click('[data-act=bf-rate-new]'); await A.fill('#bf-name', 'Cine'); await A.click('[data-act=bf-rate-save]'); await A.waitForTimeout(150);
  ok(await A.locator('#view-betaflight .bf-rate').count() === 2 && (await A.locator('#view-betaflight .bf-rate').nth(1).textContent()).includes('670'), 'neues Profil mit Standard 670');

  // Modes ohne Funke
  await sub(A, 'modes');
  let mv = await view(A);
  ok(mv.includes('ARM') && mv.includes('CH5 · AUX1') && mv.includes('ANGLE') && mv.includes('FLIP OVER AFTER CRASH') && mv.includes('1700–2100'), 'Modes-Tabelle');
  ok(mv.includes('Erfasse unter Funke'), 'Hinweis ohne Funke');

  // Mit Funke
  await A.click('.tab[data-view=radio]'); await A.click('[data-act=rd-quick]');
  await A.click('#view-radio .rd-ctl[data-key=SF]'); await A.fill('#rc-fn', 'Arm'); await A.selectOption('#rc-ch', '5'); await A.click('[data-act=rd-ctl-save]');
  await A.click('#view-radio .rd-ctl[data-key=SB]'); await A.fill('#rc-fn', 'Angle'); await A.selectOption('#rc-ch', '6'); await A.click('[data-act=rd-ctl-save]');
  await A.click('.tab[data-view=betaflight]');
  mv = await view(A);
  ok(mv.includes('ARM passt: Betaflight und Funke auf CH5'), 'ARM passt');
  ok(mv.includes('SF (Arm)') && mv.includes('SB (Angle)'), 'Funke-Spalte zeigt Schalter');
  ok(mv.includes('FLIP OVER AFTER CRASH hängt in Betaflight an CH7'), 'Warnung: CH7 an der Funke nicht belegt');
  await A.click('.tab[data-view=radio]');
  await A.click('#view-radio .rd-ctl[data-key=SF]'); await A.selectOption('#rc-ch', '8'); await A.click('[data-act=rd-ctl-save]');
  await A.click('.tab[data-view=betaflight]');
  ok((await view(A)).includes('ARM: Betaflight erwartet CH5, an der Funke liegt Arm auf CH8.'), 'Warnung ARM-Kanal verschieden');

  // Abgleich
  const B = await device(b, 'B'); await B.goto(URL); await ready(B);
  await putCode(B, await getCode(A));
  await B.click('.tab[data-view=betaflight]');
  ok(await B.locator('#view-betaflight .bf-rate').count() === 2, 'Rates auf Gerät B');

  // Layout
  await sub(A, 'rates');
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
