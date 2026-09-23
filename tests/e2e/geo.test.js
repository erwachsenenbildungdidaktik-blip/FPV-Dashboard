const { chromium, devices } = require('./pw');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const WX = { current: { time: '2026-09-23T18:00', temperature_2m: 14, wind_speed_10m: 8, wind_gusts_10m: 15, wind_direction_10m: 270, precipitation: 0, cloud_cover: 20, visibility: 20000, weather_code: 1, is_day: 1 }, hourly: { time: [], wind_gusts_10m: [], precipitation_probability: [] }, daily: { sunset: ['2026-09-23T19:20'], sunrise: ['2026-09-23T07:10'] } };
async function run(b, mode) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://api.open-meteo.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WX) }));
  await p.route('https://wmts.geo.admin.ch/**', r => r.fulfill({ status: 404 }));
  await p.route('https://api3.geo.admin.ch/**', r => r.fulfill({ status: 404 }));
  await p.addInitScript((mode) => {
    let calls = 0;
    const geo = { getCurrentPosition(ok, fail, opt) { calls++; window.__geoCalls = calls; window.__geoOpts = (window.__geoOpts || []).concat([opt]);
      setTimeout(() => { if (mode === 'denied') fail({ code: 1 }); else if (mode === 'slow' && calls === 1) fail({ code: 3 }); else if (mode === 'off') fail({ code: 2 }); else ok({ coords: { latitude: 47.5, longitude: 7.6, accuracy: 20 } }); }, 50); } };
    Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  }, mode);
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(700);
  await p.click('.tab[data-view=dashboard]'); await p.click('[data-act=pf-go]'); await p.waitForTimeout(1500);
  const t = await p.textContent('#preflight'); const calls = await p.evaluate(() => window.__geoCalls); const opts = await p.evaluate(() => window.__geoOpts);
  await ctx.close(); return { t, calls, opts, errs };
}
(async () => {
  const b = await chromium.launch();
  let r = await run(b, 'ok'); ok(/14/.test(r.t) && !/verweigert|nicht verfügbar/.test(r.t), 'Standort ok → Wetter da');
  r = await run(b, 'slow'); ok(r.calls === 2 && r.opts[1].enableHighAccuracy === false && /14/.test(r.t), 'Zu langsam → zweiter Versuch ungenau, Wetter da');
  r = await run(b, 'denied'); ok(/Berechtigungen den Standort erlauben/.test(r.t) && r.calls === 1, 'Verweigert → klare Anleitung');
  r = await run(b, 'off'); ok(/Standort am Gerät eingeschaltet/.test(r.t), 'Aus → Hinweis');
  console.log(fails ? fails + ' FEHLER' : 'ALLES GRÜN'); await b.close();
})();
