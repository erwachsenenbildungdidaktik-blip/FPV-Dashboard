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
| 1 | APK (Capacitor), gebaut über GitHub Actions; .exe (Electron) nur lokal gebaut, nicht veröffentlicht. Abgleich per WLAN mit QR-Code: der Laptop zeigt den Code, das Handy scannt, beide gleichen ab. Unterwegs über den Hotspot des Handys. Datei und Backup-Code bleiben als Notfallweg. | erledigt (PR #6–#11), von Hugo getestet |
| 2a | Reiter Werkstatt: Drohnen statt fest eingetragenem Seeker 3, Teilelager mit Mindestbestand, Startkatalog aus `docs/teilekatalog.md`, Bestellliste (Teilen, CSV, Drucken/PDF) | erledigt (PR #3) |
| 2b | Wartungs- und Reparaturlog, Betaflight-Konfiguration (`diff all`) pro Drohne, verbrauchte Teile beim Crash abbuchen, eigene Trainingseinheiten, bearbeitbare Checklisten und Links | erledigt |
| 3a | Reiter "Aufnahmen": Videos und .srt von der Karte wählen, Angaben (Zeit, Länge, Grösse, Quelle) speichern, automatisch dem Flug zuordnen, .srt auf GPS prüfen, Sichern über Teilen-Menü bzw. Download, Anleitung, Links zu Schnittprogrammen | erledigt (PR #8) |
| 3b | Direkt in die Galerie speichern in der Android-App (natives Modul, braucht Test auf dem Gerät) | offen |
| 4 | GPS-Flugweg auf der Karte, Höchstgeschwindigkeit und Höhe automatisch ins Flugbuch | wartet auf `.srt`-Befund |
| 4b | **Persönliche Angaben raus aus dem Code** (vor Etappe 5, Details unten) | nächster Schritt |
| 5 | **Eigenbau** nach Zoll-Klasse, mit Bauvorlagen, Verträglichkeitsprüfung und Import einzelner RotorBuilds-Builds (Details unten) | nächster Schritt |
| später | Version für andere Piloten, Shop | offen |

## Etappe 4b: Persönliche Angaben raus aus dem Code (Entscheid Hugo, 25.09.2026)

Anlass: Hugo will die APK weitergeben. Heute stehen Name, Fernpilot-Nummer, Betreibernummer,
Versicherung und Policennummer fest in `assets/js/data.js` (`PILOT`) und damit im öffentlichen
Repo, in der Web-App und in jeder APK.

- `PILOT` aus `data.js` entfernen, ebenso andere fest eingetragene Angaben zu Hugo (Kopfzeile,
  `craft`, Texte, die "Seeker 3" als Hugos Drohne voraussetzen).
- **Beim ersten Start** fragt die App diese Angaben ab (Name, Fernpilot-Nummer mit Gültigkeit,
  Betreibernummer, Versicherung, Police), alles optional und überspringbar. Danach jederzeit
  unter "Meine Nachweise" bearbeitbar.
- **Nur lokal speichern**, auf dem Gerät, nicht im Backup-Code und nicht im WLAN-Abgleich
  (Hugos Vorgabe). Auf jedem Gerät also einmal eingeben.
- Hugos bestehende Installationen: Beim ersten Start nach dem Update erscheint die Abfrage
  ebenfalls; seine übrigen Daten bleiben unberührt.
- Neue Nutzer starten ohne Hugos Gear: Startdrohne, Akkus, Katalog mit Hugos Bestand nicht mehr
  automatisch anlegen. Stattdessen im Einstieg anbieten: "leer starten" oder "Beispiel
  Seeker 3 laden". Bestehende Daten (feste IDs) nicht anfassen.
- Tests: Ersteinrichtung, Überspringen, Bearbeiten, Angaben landen nicht im Backup-Code.
- Die Angaben bleiben in der Git-Historie sichtbar. Sie daraus zu löschen hiesse, die Historie
  umzuschreiben (Force-Push auf main) — nur auf ausdrücklichen Wunsch von Hugo.

## Etappe 5: Eigenbau (Umfang, festgelegt am 23.09.2026)

Ziel: In der Werkstatt einen eigenen Build planen, von der Zoll-Klasse bis zur fertigen Drohne,
mit allen nötigen Teilen, Gewicht, Kosten und Bestellliste.

**Ablauf in der App**
1. *Neuer Eigenbau* → Zoll-Klasse wählen (1.6", 2", 2.5", 3", 3.5", 4", 5", 6", 7", 10").
2. Die App zeigt die Bauvorlage der Klasse: übliche Motorgrösse und KV je Zellenzahl, Propgrösse,
   Akku (Zellen, Kapazität), Stack-Lochabstand (20×20 / 25.5 / 30.5), grobes Gewicht, typische
   Flugzeit. Als Faustregel gekennzeichnet, mit Quelle.
3. Pro Baugruppe ein Teil wählen (aus dem Lager/Katalog oder neu): Rahmen, 4 Motoren, ESC bzw.
   AIO, FC, Videosystem (Air Unit / analog VTX + Kamera), Empfänger, GPS, Antennen, Props, Akku,
   Kleinteile (Schrauben, Kabel, XT30, Kondensator, Akkustrap).
4. **Verträglichkeitsprüfung** mit Warnungen, nie Verboten: Prop passt zum Rahmen, Motor-KV zur
   Zellenzahl, ESC-Strom zum Motor, Stack-Lochabstand zu Rahmen und FC, Air Unit passt in den
   Rahmen, Gewicht → 250-g-Grenze, Stecker Akku ↔ Pigtail.
5. Summen: Gewicht (aus Teilgewichten), Kosten, was fehlt → direkt auf die Bestellliste.
6. Status *geplant → bestellt → im Bau → fliegt*. Bei *fliegt* wird der Build zur Drohne (mit
   Wartungsplan, Logbuch, Betaflight). Dazu eine Bau-Checkliste (Rauchstopper, Motorrichtung,
   Failsafe, Props zuletzt).

**RotorBuilds**
- Kein Massenimport: Die Builds sind Inhalte der jeweiligen Erbauer, und ein Komplett-Abzug bei
  10 s Pause pro Abruf (robots.txt) wäre ohnehin ein Tagesprojekt. Die Zahl von rund 4500 Builds
  ist nicht bestätigt.
- Stattdessen: *Build übernehmen* mit einem einzelnen RotorBuilds-Link, den Hugo einfügt. Die App
  liest die Teileliste dieses einen Builds und legt Eigenbau und Teile an. Geht nur in APK und
  .exe (der Browser darf fremde Seiten nicht auslesen), deshalb in der Web-App als Link mit
  Anleitung zum Abtippen.
- Für die Bauvorlagen einmalig pro Klasse eine Handvoll Builds auswerten (von Hand, mit Quelle).
- Vor dem Bau des Imports die Nutzungsbedingungen von RotorBuilds lesen; verbieten sie das
  automatische Auslesen, bleibt es beim Link.

**Datenmodell**
- Neue Liste `builds`: `{id, name, sizeClass, status, slots: {rahmen: partId, motor: partId, …},
  qty, source, notes}`. Beim Übergang zu *fliegt* entsteht eine Drohne mit `buildId`.
- Teile bekommen optionale Felder für die Prüfung: `weight` (g), `mount` (Lochabstand), `kv`,
  `stator` (z. B. 1505), `cells`, `propSize` (Zoll), `amps`, `connector`.
- Bauvorlagen als feste Daten in `core/buildTemplates.js`, pro Klasse mit Quelle.

**Offen vor dem Bau**
- **Erster Eigenbau: 5 Zoll** (Entscheid Hugo, 23.09.2026). Diese Vorlage zuerst sauber
  recherchieren (Oscar Liang, Betaflight Wiki, einige 5"-Builds auf RotorBuilds), die übrigen
  Klassen danach.
- Ein 5-Zöller liegt mit Akku klar über 250 g: Bauvorlage und Startgewicht-Anzeige brauchen einen
  Hinweis auf die dann geltenden Regeln (A3-Abstände). Genaue Regeln für Eigenbauten beim BAZL
  nachlesen, nicht aus dem Gedächtnis.

## Offene Fragen

- **Schreibt die O4 die GPS-Position des Flugcontrollers in eine Datei?** Belegt ist nur, dass
  das OSD Koordinaten anzeigen kann. Klärung: kurzer Flug mit GPS-Fix und Koordinaten im OSD,
  dann im Reiter "Aufnahmen" Videos samt `.srt` einlesen. Die App meldet pro Datei, ob sie
  Koordinaten enthält.
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
- Preise und Teiledaten werden nicht automatisch aus Shops gelesen. RotorBuilds: einzelne Builds
  auf Wunsch übernehmen (Etappe 5), kein Massenimport.
- Die .exe wird nie auf GitHub gebaut oder veröffentlicht.

## Wissensquellen

Im Reiter "Links" unter "Wissen und Technik": Oscar Liang (Grundlagen, Hardware), RotorBuilds
(echte Builds und Teilelisten), Betaflight Wiki (massgeblich für die Konfiguration). Empfohlene
Reihenfolge: verstehen bei Oscar Liang, vergleichen auf RotorBuilds, konfigurieren nach dem Wiki.
