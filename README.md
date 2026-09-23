# FPV OPS

Persönliches FPV-Cockpit als statische Web-App: Akkuverwaltung mit Zyklenzählung, Flugbuch mit
Geschwindigkeit, Höhe, Wetter und Crashes, eine fünfstufige Trainingsprogression mit rund 30
Manövern, Start- und Landecheck­listen sowie die Links, die vor jedem Flug gebraucht werden.

Dazu eine Karte mit den Drohnen-Einschränkungszonen des BAZL, auf der Fluggebiete samt
Betriebsradius gesetzt werden, und ein Wetterabruf für den aktuellen Standort.

Läuft ohne Server, ohne Konto, ohne Datenbank. Auf dem Handy als App installierbar.

---

## Wichtig zuerst: wo die Daten liegen

Alle Eingaben liegen in der Datenbank (IndexedDB) des Browsers, in dem du die App geöffnet hast.
Das heisst:

- **Nichts wird übertragen.** Weder an GitHub noch sonst wohin. Das Repo enthält nur den Code.
- **Nichts wird automatisch synchronisiert.** Handy und Laptop führen getrennte Datenbestände, bis
  du sie über ein Backup abgleichst (siehe unten).
- **Browserdaten löschen heisst Daten weg.** Auch "Website-Daten entfernen" in den iOS-Einstellungen.

Zwei Ausnahmen, bei denen die App nach draussen spricht:

- **Kartenkacheln** werden von `wmts.geo.admin.ch` geladen, sobald eine Karte sichtbar ist.
  Der Bund sieht dabei die angefragten Kachelnummern, also grob den Ausschnitt.
- **Wetter** unter "Vor dem Flug" schickt deine Koordinaten an `api.open-meteo.com`.
  Das passiert ausschliesslich, wenn du den Knopf drückst, nie automatisch.

Beides lässt sich abschalten, indem du in `index.html` die Zeilen mit `map.js` und `weather.js`
entfernst. Die übrige App funktioniert dann unverändert weiter.

Deshalb ist **Backup** im Kopf der App keine Spielerei, sondern die Backup-Strategie. Es gibt zwei Wege:

- **Backup-Code** (fürs Handy gedacht): Der ganze Datenstand wird zu einer einzigen, komprimierten
  Textzeile (`FPV1.…`). *Code teilen* öffnet das Teilen-Menü, der Code landet etwa in Notizen oder
  in einem Chat an dich selbst. Zum Wiederherstellen den Code ins Feld einfügen. Keine Datei, kein
  Dateimanager. Wie lang der Code wird, hängt von der Datenmenge ab; mit vielen Flügen und
  Fluggebieten werden es einige Kilobyte Text.
- **Datei** als JSON, für den Laptop oder ein Archiv. Das Dateifeld nimmt auch einen Backup-Code
  als Textdatei an.

**Einlesen führt zusammen, statt zu überschreiben.** Jeder Eintrag trägt einen Zeitstempel. Neues
kommt dazu, bei Einträgen, die es auf beiden Seiten gibt, gewinnt die neuere Fassung, Gelöschtes
wird auch auf der anderen Seite gelöscht. Trainingsnotizen zum selben Manöver bleiben von beiden
Seiten erhalten. Damit eignen sich beide Wege auch zum Abgleich zwischen Handy und Laptop: Code
von A in B einlesen, dann Code von B in A.

Akkuzyklen werden dafür nicht mehr als Zahl gespeichert, sondern gezählt: der im Akku-Dialog
eingetragene Grundwert, plus jeder Flug mit diesem Akku, plus jeder einzeln gebuchte Zyklus.
Der Lagerbestand in der Werkstatt genauso: Grundwert plus alle Zu- und Abgänge (+/−, "Gekauft"),
minus die Teile, die bei Crash-Flügen oder im Logbuch als verbraucht eingetragen sind.

Beim ersten Start nach dem Update übernimmt die App den bisherigen Stand aus `localStorage`
automatisch. Der alte Eintrag bleibt dort als Sicherheitskopie liegen. Alte Backup-Dateien und
-Codes lassen sich weiterhin einlesen.

"Alles zurücksetzen" löscht nur die Daten auf diesem Gerät, ohne Löschmarkierungen. Ein späterer
Abgleich holt sie also vom anderen Gerät zurück, statt sie dort auch zu löschen.

Zusätzlich bittet die App den Browser beim Start, ihren Speicher als dauerhaft zu behandeln
(`navigator.storage.persist()`), damit er ihn nicht bei Platzmangel aufräumt. Ob der Browser
zustimmt, entscheidet er selbst. Auf dem iPhone hilft vor allem die Installation auf dem
Home-Bildschirm.

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

## Android-App und Windows-Programm

Beide werden bei jeder Änderung auf GitHub automatisch gebaut und liegen hier zum Download:
<https://github.com/erwachsenenbildungdidaktik-blip/FPV-Dashboard/releases/tag/apps-latest>

- **Android:** `FPV-OPS-Android.apk` auf dem Handy öffnen und installieren. Android fragt beim
  ersten Mal, ob der Browser Apps installieren darf. Neue Fassungen installieren sich über die alte,
  die Daten bleiben.
- **Windows:** `FPV-OPS-Windows.exe` starten, keine Installation. Das Programm ist nicht signiert,
  Windows SmartScreen warnt deshalb: *Weitere Informationen → Trotzdem ausführen*. Die Daten liegen
  unter `%APPDATA%\FPV OPS`.

Die Daten der Web-App im Browser ziehen nicht automatisch in die Apps um: einmal per Backup-Code
übertragen.

### Abgleich per WLAN

Am Laptop *Backup → Abgleich mit Handy*: Das Programm zeigt einen QR-Code mit seiner Adresse und
einem sechsstelligen Einmal-Code. In der Android-App *Backup → Mit Laptop abgleichen* und scannen,
oder Adresse und Code eintippen. Beide Seiten führen zusammen, danach sind sie gleich.

- Handy und Laptop müssen im selben Netz sein. Unterwegs den Laptop mit dem Hotspot des Handys
  verbinden, Internet braucht es nicht.
- Beim ersten Start fragt die Windows-Firewall nach dem Netzwerkzugriff: für private Netzwerke
  erlauben.
- Der Server läuft nur, solange das Abgleich-Fenster offen ist. Nach fünf falschen Codes stoppt er.
- Im Browser geht das nicht: Eine Seite von github.io darf keine Geräte im Heimnetz ansprechen.

### Signatur der APK

Die APK wird mit einem Schlüssel signiert, der bewusst im Repo liegt
(`apps/mobile/android/app/fpv-ops-sideload.jks`). Nur so installiert sich jede neue Fassung über die
alte, ohne dass die Daten verloren gehen. Der Preis: Wer das Repo kennt, könnte eine APK mit
derselben Signatur bauen. Deshalb APKs nur von der Release-Seite oben installieren. Für einen
Store-Eintrag braucht es einen eigenen, geheimen Schlüssel.

## Aufbau

Der geplante Ausbau (Android-App, Windows-Programm, Abgleich per WLAN, Werkstatt, Aufnahmen) steht
in [ROADMAP.md](ROADMAP.md).


```
index.html                    Struktur und Reiter
manifest.webmanifest          Installierbarkeit als App
sw.js                         Service Worker für den Offline-Start
.nojekyll                     GitHub Pages liefert unverändert aus
assets/css/style.css          Designsystem
assets/js/data.js             Inhalte: Curriculum, Checklisten, Links, Startdaten
assets/js/map.js              Karten: swisstopo-Kacheln, BAZL-Zonen, Radiusauswahl
assets/js/weather.js          Wetterabruf und Einschätzung
assets/js/app.js              Ansichten, Dialoge, Bedienung (ES-Modul)
assets/js/core/store.js       Datenbank, Datensätze mit Zeitstempel, Zusammenführen, Umzug
assets/js/core/backup.js      Backup-Code kodieren und dekodieren
assets/js/core/util.js        Kleine Hilfen
assets/js/core/catalog.js     Startkatalog der Werkstatt: Drohne, Teile, Preise mit Stand-Datum
assets/js/views/workshop.js   Reiter Werkstatt: Drohnen, Wartungsplan, Logbuch, Betaflight-Stände,
                              Teilelager, Bestellliste
assets/js/views/content.js    Eigene und angepasste Manöver, Checklisten und Links
assets/js/views/sync.js       Abgleich per WLAN: QR-Code am Laptop, Scanner am Handy
assets/vendor/leaflet/        Leaflet 1.9.4, lokal eingebunden (BSD-2, siehe LICENSE)
assets/vendor/qrcode/         qrcode-generator 2.0.4 (MIT, Hinweis in der Datei)
assets/vendor/jsqr/           jsQR 1.4.0 (Apache-2.0, siehe LICENSE)
apps/desktop/                 Windows-Programm (Electron) mit Abgleich-Server
apps/mobile/                  Android-App (Capacitor)
tools/build-web.mjs           Kopiert die Web-App für die Apps
.github/workflows/apps.yml    Baut APK und .exe, legt sie auf die Release-Seite
assets/icons/                 App-Icons
```

### Was wo geändert wird

- **Startkatalog der Werkstatt** (Teile, Preise, Startdrohne) steht in `assets/js/core/catalog.js`,
  die Herkunft der Angaben in `docs/teilekatalog.md`. Neue Einträge brauchen eine neue, feste ID;
  bestehende IDs nie umbenennen, sonst taucht das Teil doppelt auf.
- **Trainingsmanöver, Checklisten, Links, Akku-Startbestand** stehen als Vorlage in
  `assets/js/data.js`. In der App lassen sie sich anpassen, ausblenden und ergänzen; diese
  Anpassungen liegen in den eigenen Daten und überleben jede neue Fassung der Vorlage. IDs in
  `data.js` nicht umbenennen, sonst verlieren Anpassungen und Übungsstände ihren Bezug.
- **Neue JS-Dateien** zusätzlich in `sw.js` unter `ASSETS` eintragen, sonst fehlen sie offline.
- **Aussehen** in `assets/css/style.css`, ganz oben unter `:root` stehen alle Farben.
- **Nach jeder Änderung** in `sw.js` die Zeile `const VERSION = "fpv-ops-v8"` hochzählen, sonst
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
