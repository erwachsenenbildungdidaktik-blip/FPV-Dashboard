const { chromium, devices } = require('./pw');
const URL = 'http://localhost:8765/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ready = async p => { await p.waitForSelector('#view-workshop .card', { state: 'attached' }); await p.waitForTimeout(200); };
const tab = (p, t) => p.click('.tab[data-view=' + t + ']');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  const A = await ctx.newPage(); const errs = [];
  A.on('pageerror', e => errs.push(e.message)); A.on('dialog', d => d.accept());
  await A.goto(URL); await ready(A);

  // Werkstatt: Meteor65 mit Datenblatt
  await tab(A, 'workshop');
  const card = A.locator('#view-workshop .card', { hasText: 'Meteor65 Pro II' }).first();
  const ct = await card.textContent();
  ok(ct.includes('DJI O4 Wide') && ct.includes('Matrix 1S') && ct.includes('GF 1409') && ct.includes('25000 KV') && ct.includes('BETAFPVG473_V2'), 'Meteor65 mit Datenblatt (25000 KV, Target aus der Werks-CLI)');
  ok((await A.textContent('#view-workshop')).includes('BETAFPV Lava II 480 mAh 1S') && (await A.textContent('#view-workshop')).includes('Gemfan 1409'), 'Akkus und Props aus der Bestellung im Lager');

  // Vorlage beim Erfassen
  await A.click('[data-act=ws-drone-new]');
  await A.selectOption('#d-tpl', 'seed-meteor65-pro2-o4');
  ok(await A.inputValue('#d-name') === 'Meteor65 Pro II' && (await A.inputValue('#d-specs')).includes('Matrix 1S'), 'Vorlage füllt den Dialog');
  await A.click('#dlg-foot [data-act=dlg-close]');

  // Akkus: Filter nach Drohne
  await tab(A, 'batteries');
  ok(await A.locator('#bat-drone').count() === 1, 'Drohnen-Auswahl im Reiter Akkus');
  await A.selectOption('#bat-drone', 'seed-meteor65-pro2-o4'); await A.waitForTimeout(100);
  let v = await A.textContent('#view-batteries');
  ok(v.includes('LAVA #1') && v.includes('LAVA #4') && !v.includes('R-Line #1'), 'Meteor: nur LAVA-Akkus');
  ok(v.includes('Meteor65 Pro II gewogen'), 'Gewicht gilt für die gewählte Drohne');
  const lava = A.locator('#view-batteries .card', { hasText: 'LAVA #1' });
  const chg = (await lava.locator('.lp-charger').textContent()).replace(/\s+/g, ' ');
  ok(chg.includes('LiPo') && chg.includes('1S') && chg.includes('0,4 A') && chg.includes('4,20 V') && chg.includes('3,80 V'), 'LAVA: Ladegerät LiPo 1S 0,4 A (' + chg + ')');
  await A.selectOption('#bat-drone', 'default-drone-1'); await A.waitForTimeout(100);
  v = await A.textContent('#view-batteries');
  ok(v.includes('R-Line #1') && !v.includes('LAVA #1'), 'Seeker: nur R-Line');

  // Neuer Akku übernimmt die gewählte Drohne
  await A.click('[data-act=bat-new]');
  ok(await A.inputValue('#f-bdrone') === 'default-drone-1', 'Neuer Akku: Drohne vorgewählt');
  await A.click('#dlg-foot [data-act=dlg-close]');

  // Flug: Akkus passend zur Drohne
  await tab(A, 'flights'); await A.click('[data-act=flight-new]');
  await A.selectOption('#f-drone', 'seed-meteor65-pro2-o4'); await A.waitForTimeout(100);
  let box = await A.textContent('#f-batbox');
  ok(box.includes('LAVA #2') && !box.includes('R-Line'), 'Flug mit Meteor: nur LAVA zur Auswahl');
  await A.locator('#f-batbox label').first().click();
  await A.selectOption('#f-drone', 'default-drone-1'); await A.waitForTimeout(100);
  box = await A.textContent('#f-batbox');
  ok(box.includes('R-Line #1') && box.includes('LAVA #1'), 'Wechsel zu Seeker: R-Line, angehakter LAVA bleibt');
  await A.click('#dlg-foot [data-act=dlg-close]');

  // Aufnahmen: Drohne wählbar
  await tab(A, 'media');
  ok(await A.locator('#md-drone option').count() === 2, 'Aufnahmen: Drohnen-Auswahl');

  // Rechner: Akku aus dem Bestand
  await tab(A, 'batteries'); await A.click('[data-act=lp-tab][data-tab=lipo]');
  await A.selectOption('#lp-bat', 'seed-lava2-1'); await A.waitForTimeout(100);
  ok(await A.inputValue('#lp-mah') === '480' && await A.inputValue('#lp-cells') === '1' && (await A.textContent('#lp-r-1c')).trim() === '0,48 A', 'Rechner übernimmt LAVA: 480 mAh 1S → 1C 0,48 A');

  // Betaflight: Drohnen-Auswahl
  await tab(A, 'betaflight');
  ok(await A.locator('#view-betaflight select[data-act=bf-drone] option').count() === 2, 'Betaflight: Drohnen-Auswahl');

  ok(errs.length === 0, 'keine JS-Fehler ' + JSON.stringify(errs));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'ALLES GRÜN');
  process.exit(fails ? 1 : 0);
})();
