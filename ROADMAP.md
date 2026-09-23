# FPV OPS — Ausbauplan

Stand: 23.09.2026. Jede Etappe kommt als eigener Pull Request.

## Ziel

Aus dem persönlichen Cockpit wird eine Werkstatt-App für FPV mit Betaflight und DJI O4: als
Web-App, als Android-App (APK) und als Windows-Programm (.exe), aus einem gemeinsamen Code. Handy
und Laptop gleichen sich ohne Cloud ab. Die Daten verlassen die eigenen Geräte nie.

## Ausgangslage

- Drohne: DeepSpace Seeker 3 mit DJI O4 Air Unit Pro (microSD in der Air Unit) und GPS-Modul
  (10. Generation) am Betaflight-Flugcontroller.
- Brille: DJI Goggles 3. Funke: RadioMaster TX16S Mk3 MAX (ELRS).
- Handy: Android (OPPO). Laptop: Windows, auf längeren Touren dabei.

## Etappen

| # | Inhalt | Status |
|---|--------|--------|
| 0 | Umbau: Module, Datenbank (IndexedDB), Datensätze mit Zeitstempel, Zusammenführen statt Überschreiben, Umzug der bestehenden Daten | erledigt (PR #2) |
| 1 | APK (Capacitor) und .exe (Electron), gebaut über GitHub Actions. Abgleich per WLAN mit QR-Code: der Laptop zeigt den Code, das Handy scannt, beide gleichen ab. Unterwegs über den Hotspot des Handys. Datei und Backup-Code bleiben als Notfallweg. | offen |
| 2a | Reiter Werkstatt: Drohnen statt fest eingetragenem Seeker 3, Teilelager mit Mindestbestand, Startkatalog aus `docs/teilekatalog.md`, Bestellliste (Teilen, CSV, Drucken/PDF) | in Arbeit |
| 2b | Wartungs- und Reparaturlog, Betaflight-Konfiguration (`diff all`) pro Drohne, verbrauchte Teile beim Crash abbuchen, eigene Trainingseinheiten, bearbeitbare Checklisten und Links | offen |
| 3 | Reiter "Aufnahmen": microSD auslesen, Videos in Galerie (APK) bzw. Ordner (.exe) speichern, Flug zuordnen, Hinweise und Links zu Schnittprogrammen (DaVinci Resolve, CapCut, Gyroflow, Shotcut, Kdenlive). Kein eigener Videoschnitt. | wartet auf `.srt`-Befund |
| 4 | GPS-Flugweg auf der Karte, Höchstgeschwindigkeit und Höhe automatisch ins Flugbuch | wartet auf `.srt`-Befund |
| später | Version für andere Piloten, Shop | offen |

## Offene Fragen

- **Schreibt die O4 die GPS-Position des Flugcontrollers in eine Datei?** Belegt ist nur, dass
  das OSD Koordinaten anzeigen kann. Klärung: kurzer Flug mit GPS-Fix und Koordinaten im OSD,
  dann Dateiliste der Air-Unit-Karte und die ersten Zeilen einer `.srt` ansehen.
  - Koordinaten in der `.srt`: Etappe 4 ist einfach.
  - Keine Koordinaten: nur über OSD-Aufzeichnung der Brille oder Blackbox-Log, beides deutlich
    aufwendiger.
- **Was liegt auf der Karte der Goggles 3?** Zweite Quelle für Aufnahmen und womöglich für die
  OSD-Aufzeichnung. Klärung zusammen mit der Air-Unit-Karte.
- **Shop:** Nutzungsbedingungen von swisstopo und BAZL für kommerzielle Nutzung,
  Google-Play-Entwicklerkonto, Datenschutzerklärung, Haftung für Regelhinweise.

## Grenzen, bewusst entschieden

- Die Web-App kann die Karte nicht selbst auslesen und nicht direkt in die Galerie schreiben.
  Das können erst APK und .exe.
- Der WLAN-Abgleich funktioniert nur zwischen APK und .exe, nicht aus dem Browser.
- Keine Cloud-Synchronisation in Echtzeit. Die bräuchte einen Server mit Konto und Kosten.
- Preise und Teiledaten werden nicht automatisch aus Shops gelesen. Als Nachschlagewerk für
  Teilekombinationen dient RotorBuilds, verlinkt statt eingelesen.

## Wissensquellen

Im Reiter "Links" unter "Wissen und Technik": Oscar Liang (Grundlagen, Hardware), RotorBuilds
(echte Builds und Teilelisten), Betaflight Wiki (massgeblich für die Konfiguration). Empfohlene
Reihenfolge: verstehen bei Oscar Liang, vergleichen auf RotorBuilds, konfigurieren nach dem Wiki.
