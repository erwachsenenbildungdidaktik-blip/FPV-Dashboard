# FPV OPS

Persönliches FPV-Cockpit als statische Web-App: Akkuverwaltung mit Zyklenzählung, Flugbuch mit
Geschwindigkeit, Höhe, Wetter und Crashes, eine fünfstufige Trainingsprogression mit rund 30
Manövern, Start- und Landecheck­listen sowie die Links, die vor jedem Flug gebraucht werden.

Dazu eine Karte mit den Drohnen-Einschränkungszonen des BAZL, auf der Fluggebiete samt
Betriebsradius gesetzt werden, und ein Wetterabruf für den aktuellen Standort.

Läuft ohne Server, ohne Konto, ohne Datenbank. Auf dem Handy als App installierbar.

---

## Wichtig zuerst: wo die Daten liegen

Alle Eingaben liegen im `localStorage` des Browsers, in dem du die App geöffnet hast. Das heisst:

- **Nichts wird übertragen.** Weder an GitHub noch sonst wohin. Das Repo enthält nur den Code.
- **Nichts wird synchronisiert.** Handy und Laptop führen getrennte Datenbestände.
- **Browserdaten löschen heisst Daten weg.** Auch "Website-Daten entfernen" in den iOS-Einstellungen.

Zwei Ausnahmen, bei denen die App nach draussen spricht:

- **Kartenkacheln** werden von `wmts.geo.admin.ch` geladen, sobald eine Karte sichtbar ist.
  Der Bund sieht dabei die angefragten Kachelnummern, also grob den Ausschnitt.
- **Wetter** unter "Vor dem Flug" schickt deine Koordinaten an `api.open-meteo.com`.
  Das passiert ausschliesslich, wenn du den Knopf drückst, nie automatisch.

Beides lässt sich abschalten, indem du in `index.html` die Zeilen mit `map.js` und `weather.js`
entfernst. Die übrige App funktioniert dann unverändert weiter.

Deshalb ist **Export** im Kopf der App keine Spielerei, sondern die Backup-Strategie. Die Datei
lässt sich über **Import** auf jedem Gerät wieder einlesen, auch um Handy und Laptop abzugleichen.

Im privaten Modus und in manchen In-App-Browsern funktioniert der Speicher nicht. Die App zeigt in
dem Fall oben eine Warnung an.

---

## Auf GitHub Pages veröffentlichen

1. Auf GitHub ein neues Repository anlegen, zum Beispiel `fpv-ops`. Öffentlich oder privat spielt
   für die Funktion keine Rolle, für GitHub Pages im Gratisplan braucht es allerdings ein
   öffentliches Repo.
2. Den Inhalt dieses Ordners ins Repo laden. Entweder über **Add file → Upload files** im Browser
   oder per Kommandozeile:

   ```bash
   cd fpv-ops
   git init
   git add .
   git commit -m "FPV OPS"
   git branch -M main
   git remote add origin https://github.com/DEIN-NAME/fpv-ops.git
   git push -u origin main
   ```

3. Im Repo auf **Settings → Pages** gehen. Unter *Source* **Deploy from a branch** wählen, Branch
   `main`, Ordner `/ (root)`, speichern.
4. Nach ein bis zwei Minuten ist die App erreichbar unter
   `https://DEIN-NAME.github.io/fpv-ops/`.

Die Datei `.nojekyll` sorgt dafür, dass GitHub die Dateien unverändert ausliefert.

---

## Auf dem Handy als App installieren

**iPhone, Safari:** Seite öffnen → Teilen-Symbol → *Zum Home-Bildschirm*. Das muss Safari sein,
Chrome auf iOS kann das nicht.

**Android, Chrome:** Seite öffnen → Menü → *App installieren* oder *Zum Startbildschirm hinzufügen*.

Danach startet sie im Vollbild ohne Browserleiste. Der Service Worker legt die App-Dateien lokal ab,
damit sie auch ohne Empfang startet. Die Links nach draussen, etwa die Drohnenkarte, brauchen
selbstverständlich weiterhin Netz.

---

## Aufbau

```
index.html                    Struktur und Reiter
manifest.webmanifest          Installierbarkeit als App
sw.js                         Service Worker für den Offline-Start
.nojekyll                     GitHub Pages liefert unverändert aus
assets/css/style.css          Designsystem
assets/js/data.js             Inhalte: Curriculum, Checklisten, Links, Startdaten
assets/js/map.js              Karten: swisstopo-Kacheln, BAZL-Zonen, Radiusauswahl
assets/js/weather.js          Wetterabruf und Einschätzung
assets/js/app.js              Logik, Speicher, Rendern
assets/vendor/leaflet/        Leaflet 1.9.4, lokal eingebunden (BSD-2, siehe LICENSE)
assets/icons/                 App-Icons
```

### Was wo geändert wird

- **Trainingsmanöver, Checklisten, Links, Akku-Startbestand** stehen in `assets/js/data.js`.
  Das ist reiner Text, dort kannst du gefahrlos ergänzen und umformulieren.
- **Aussehen** in `assets/css/style.css`, ganz oben unter `:root` stehen alle Farben.
- **Nach jeder Änderung** in `sw.js` die Zeile `const VERSION = "fpv-ops-v2"` hochzählen, sonst
  liefert der Service Worker auf schon installierten Geräten hartnäckig die alte Fassung aus.

---

## Fachliche Hinweise

Die Regelangaben in den Checklisten und im Trainingsteil beziehen sich auf die Kategorie A3 mit
einer Drohne ohne C-Klassenlabel, also den DeepSpace Seeker 3.

Die App ersetzt nichts davon:

- Die **BAZL-Drohnenkarte** ist vor jedem Flug zu konsultieren, ihr Inhalt ändert laufend.
- Das **Fernpilotenzeugnis** gilt als PDF aus dem dLIS, nicht als Eintrag in dieser App.
- Die Angabe **150 m Abstand**, **120 m über Grund**, **keine Unbeteiligten** und **FPV nur mit
  Spotter** sind aus den Flugregeln des BAZL übernommen, ersetzen aber nicht deren Lektüre.

Die Zonen auf der eingebauten Karte stammen aus demselben BAZL-Layer, den die amtliche
Drohnenkarte verwendet. Sie sind trotzdem nur eine Vorschau: verbindlich ist die amtliche Karte
am Flugtag. Die Karten- und Zonendaten stehen unter den Nutzungsbedingungen des Bundes, die
Quellenangabe "© Data: swisstopo" ist in jeder Karte eingeblendet und muss dort bleiben.

Die Wettereinschätzung ist eine Faustregel für eine leichte 3-Zoll-Maschine, keine amtliche
Grenze und keine Freigabe. Die Schwellen stehen in `assets/js/weather.js` unter `GUST_BANDS`
und lassen sich anpassen, sobald du deine eigenen Erfahrungswerte hast.

Die Lebensdauer-Faustregel für LiPo-Packs ist ein Richtwert, kein Messwert. Sie ist in der App
einstellbar und sagt nichts über den tatsächlichen Zustand einer einzelnen Zelle aus. Ein gebläht
wirkender Pack gehört unabhängig vom Zyklenstand aussortiert.

---

## Lizenz

Privates Werkzeug. Mach damit, was du willst.
