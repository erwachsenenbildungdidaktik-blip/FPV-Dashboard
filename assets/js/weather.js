/* ==========================================================================
   FPV OPS — Wetter am Standort
   Quelle: Open-Meteo, frei nutzbar ohne Schlüssel.
   Wichtig: Dieser Teil ist der einzige, der Daten nach draussen schickt,
   nämlich deine ungefähren Koordinaten an api.open-meteo.com. Deshalb wird
   nichts automatisch geladen, sondern erst wenn du den Knopf drückst.
   ========================================================================== */

window.FPVWeather = (function () {
  "use strict";

  const URL =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude={lat}&longitude={lon}" +
    "&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m," +
    "wind_direction_10m,precipitation,cloud_cover,weather_code" +
    "&daily=sunrise,sunset" +
    "&wind_speed_unit=kmh&timezone=auto&forecast_days=1";

  /* Faustregeln für eine leichte 3-Zoll-Maschine, nicht mehr.
     Keine amtliche Grenze. Entscheidend bleiben dein Können, die Maschine
     und was du dir am konkreten Platz zutraust. */
  const GUST_BANDS = [
    { max: 15, level: "ok", text: "Ruhig. Gute Bedingungen zum Üben." },
    { max: 25, level: "ok", text: "Spürbar, aber machbar. Gegen den Wind starten." },
    { max: 35, level: "warn", text: "Grenzwertig für eine leichte 3-Zoll-Maschine. Nur wenn du dich sicher fühlst." },
    { max: 1e9, level: "bad", text: "Zu böig für dieses Setup. Simulator ist heute die bessere Wahl." },
  ];

  const CODES = {
    0: "Klar", 1: "Überwiegend klar", 2: "Teils bewölkt", 3: "Bedeckt",
    45: "Nebel", 48: "Reifnebel",
    51: "Leichter Niesel", 53: "Niesel", 55: "Starker Niesel",
    61: "Leichter Regen", 63: "Regen", 65: "Starker Regen",
    66: "Gefrierender Regen", 67: "Starker gefrierender Regen",
    71: "Leichter Schneefall", 73: "Schneefall", 75: "Starker Schneefall",
    77: "Schneegriesel",
    80: "Leichte Schauer", 81: "Schauer", 82: "Heftige Schauer",
    85: "Schneeschauer", 86: "Starke Schneeschauer",
    95: "Gewitter", 96: "Gewitter mit Hagel", 99: "Gewitter mit starkem Hagel",
  };

  const DIRS = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO",
                "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

  function compass(deg) {
    if (deg == null || !isFinite(deg)) return "";
    return DIRS[Math.round(((deg % 360) / 22.5)) % 16];
  }

  function num(v) {
    return typeof v === "number" && isFinite(v) ? v : null;
  }

  function hhmm(iso) {
    const m = String(iso || "").match(/T(\d{2}:\d{2})/);
    return m ? m[1] : null;
  }

  /* Wertet die Rohdaten aus und gibt eine Einschätzung zurück.
     Gibt null zurück, wenn die Antwort nicht die erwartete Form hat. */
  function assess(data) {
    if (!data || typeof data !== "object") return null;
    const c = data.current;
    if (!c || typeof c !== "object") return null;

    const temp = num(c.temperature_2m);
    const feels = num(c.apparent_temperature);
    const wind = num(c.wind_speed_10m);
    const gust = num(c.wind_gusts_10m);
    const dir = num(c.wind_direction_10m);
    const rain = num(c.precipitation);
    const cloud = num(c.cloud_cover);
    const code = num(c.weather_code);

    if (temp === null && wind === null && gust === null) return null;

    const notes = [];
    let level = "ok";

    const g = gust !== null ? gust : wind;
    if (g !== null) {
      const band = GUST_BANDS.find((b) => g <= b.max);
      notes.push(band.text);
      if (band.level !== "ok") level = band.level;
    }

    if (rain !== null && rain > 0) {
      notes.push("Niederschlag gemeldet. Nässe und Elektronik vertragen sich nicht.");
      level = "bad";
    }

    if (temp !== null && temp <= 0) {
      notes.push("Frost. LiPo verlieren bei Kälte deutlich an Leistung, Akkus vorgewärmt halten und Flugzeit kürzer ansetzen.");
      if (level === "ok") level = "warn";
    } else if (temp !== null && temp < 5) {
      notes.push("Kalt. Rechne mit spürbar kürzerer Flugzeit.");
    }

    if (code !== null && code >= 95) {
      notes.push("Gewitter in der Meldung. Nicht fliegen.");
      level = "bad";
    }

    let daylight = null;
    if (data.daily && Array.isArray(data.daily.sunset)) {
      const ss = hhmm(data.daily.sunset[0]);
      const sr = hhmm(data.daily.sunrise && data.daily.sunrise[0]);
      if (ss) daylight = { sunrise: sr, sunset: ss };
    }

    return {
      temp: temp, feels: feels, wind: wind, gust: gust,
      dir: dir, dirText: compass(dir),
      rain: rain, cloud: cloud,
      condition: code !== null && CODES[code] ? CODES[code] : null,
      level: level,
      notes: notes,
      daylight: daylight,
      time: hhmm(c.time),
    };
  }

  function fetchAt(lat, lon) {
    const url = URL.replace("{lat}", encodeURIComponent(lat)).replace("{lon}", encodeURIComponent(lon));
    return fetch(url, { mode: "cors" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        const a = assess(j);
        if (!a) throw new Error("Antwort in unerwartetem Format");
        return a;
      });
  }

  return { fetchAt: fetchAt, assess: assess, compass: compass };
})();
