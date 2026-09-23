# FPV OPS — Übergabe für Claude

Persönliches FPV-Cockpit von Hugo (Schweiz). Web-App (GitHub Pages) + Android-APK (Capacitor) +
Windows-Programm (Electron, nur lokal). Stand und Plan: `ROADMAP.md`. Nutzerdoku: `README.md`.

## Umgang mit Hugo
- Deutsch (Schweiz, "ss" statt "ß"), direkt, pragmatisch, mit Witz. Widersprechen, wenn eine
  Annahme falsch ist. Ohne Quelle: "Das weiss ich nicht".
- Hugo hat gesagt: nicht nachfragen, durcharbeiten. Bauen → testen → PR → grünen Build abwarten →
  selbst mergen. Nur bei echten Richtungsentscheiden fragen.
- **Die .exe kommt nie auf GitHub** (weder Repo, Release noch Actions). Lokal bauen und per Chat
  schicken: `tools/split-exe.sh` (Chat-Limit 30 MB, deshalb 4 Teile + .bat). Dateinamen tragen die
  Version, sonst mischt der Browser alte und neue Teile.

## Gear (Stand 23.09.2026)
DeepSpace Seeker 3, 3", 4S, DJI O4 Air Unit Pro (microSD), GPS (10. Gen.), ELRS · DJI Goggles 3 ·
RadioMaster TX16S Mk3 MAX (ELRS, 18650er) · 4× Tattu R-Line 750 mAh 4S · Handy OPPO (Android) ·
Laptop Windows. Einkauf meist bei fpvracing.ch.

## Aufbau
- `index.html`, `assets/js/app.js` (ES-Modul: Ansichten Dashboard/Akkus/Flüge/Training/Checklisten/
  Links, Dialoge, Events). Globale Vorlagen in `assets/js/data.js`, `map.js`, `weather.js`.
- `assets/js/core/`: `store.js` (Datenbank), `catalog.js` (Startkatalog), `backup.js`, `util.js`.
- `assets/js/views/`: `workshop.js` (Werkstatt), `content.js` (eigene Manöver/Checklisten/Links),
  `media.js` (Aufnahmen), `sync.js` (WLAN-Abgleich). Muster: `createX(ctx)` mit
  `{state, save, openDialog, closeDialog, toast, rerender}`, liefert `render/click/change`;
  Aktionen per `data-act` mit Präfix (`ws-`, `ct-`, `md-`, `sync-`), Routing in `app.js`.
- `apps/desktop` (Electron 44, `sync-server.js` = Abgleich-Server), `apps/mobile` (Capacitor 8,
  `android/` eingecheckt, Sideload-Keystore bewusst im Repo), `tools/build-web.mjs`.
- `.github/workflows/apps.yml`: baut APK bei PR (nur prüfen) und auf main (Release `apps-latest`,
  wird aktualisiert, nie gelöscht).

## Datenmodell (wichtig, sonst geht beim Abgleich etwas verloren)
- IndexedDB `fpv-ops`, jeder Eintrag ein Datensatz `{k, c, id, u, dev, d?, data}`. `commit()` diffed
  den `state` gegen den letzten Stand; `merge()` = neuere Fassung gewinnt pro Datensatz,
  Trainingsnotizen werden vereinigt, Löschmarkierungen wandern mit.
- Neue Sammlung: in `store.js` bei `LISTS` (Array mit `id`) oder `MAPS` (Objekt nach ID) **und** in
  `blankState()` eintragen. Einträge in Listen brauchen eine `id`.
- **Nie Zähler speichern**, die auf zwei Geräten wachsen können: Akkuzyklen = `cyclesBase` + Flüge +
  `cycleLog`; Lagerbestand = `stockBase` + `stockLog` − `partsUsed` (Flüge, Wartung). Abgeleitete
  Felder (`cycles`, `stock`) werden in `derive()` gesetzt und nie gespeichert.
- Startdaten (Katalog, Startdrohne, Wartungsvorschläge) mit **festen IDs** und `u: 1` in
  `catalog.js`; `seedCatalog()` legt nur Fehlendes an. IDs nie umbenennen.
- Pro Gerät (nicht abgeglichen) in `localStorage`: letzter Reiter, Textgrösse.

## Checkliste für jede Änderung
1. `sw.js`: `VERSION` hochzählen, neue Dateien in `ASSETS`. README-Zeile mit der Version nachziehen.
2. Tests: `tests/run.sh` (startet Server auf :8765, Playwright global mit Chromium). Neue Funktion →
   neuer Test in `tests/e2e/*.test.js`, letzte Zeile muss `ALLES GRÜN` sein.
3. Handy hoch/quer und ≥ 1000 px ansehen (Layout skaliert per `rem`, Grundschrift wächst ab 1000 px).
4. Branch `claude/mobile-storage-no-json-968hrs`, nach jedem Merge auf `origin/main` zurücksetzen.
   Commits und PRs auf Deutsch.

## Umgebung (Claude-Cloud-Sitzung)
- Netz frei für: oscarliang.com (Captcha, nicht umgehen), rotorbuilds.com (robots.txt: 10 s
  Pause), betaflight.com, fpvracing.ch (Cloudflare blockt Bots → Hugo kopiert Inhalte),
  deepspacefpv.com (leitet auf `www.` um, das ist gesperrt). Sonst über WebSearch.
- Android-SDK lokal gesperrt → APK nur über die Pipeline prüfen. Electron-Windows-Build lokal geht
  (`signAndEditExecutable=false`, darum ohne eingebettetes Icon).

## Offen
Siehe `ROADMAP.md`: Etappe 5 Eigenbau (nächster Schritt), 3b Galerie in der APK, 4 GPS-Flugweg
(wartet auf eine echte `.srt` von Hugos Karte), Shop-Version später.
