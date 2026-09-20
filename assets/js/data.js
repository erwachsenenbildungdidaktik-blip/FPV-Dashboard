/* ==========================================================================
   FPV OPS — Inhalte: Trainingscurriculum, Checklisten, Links, Startdaten
   Reine Daten. Keine Logik.
   ========================================================================== */

const PILOT = {
  name: "Hugo Rohrbacher",
  certId: "CHE-RP-8m7uwcmvuhkn",
  certValid: "2031-09-20",
  operatorId: "CHE8nvilkeoi2ctu",
  insurer: "AXA, Winterthur",
  policy: "18.277.175",
  craft: "DeepSpace Seeker 3 · 3\" · 4S · O4 Pro",
};

/* --------------------------------------------------------------- Akkus ---
   Startbestand. Zyklenrichtwert für LiPo-Renn-/Freestyle-Packs:
   Tattu R-Line und vergleichbare High-C-Packs gelten je nach Belastung
   ab etwa 150 bis 250 Zyklen als am Lebensende. Der Wert ist konfigurierbar.
--------------------------------------------------------------------------- */
const DEFAULT_BATTERIES = [
  { label: "R-Line #1", brand: "Tattu R-Line", mah: 750, cells: 4, crate: 95 },
  { label: "R-Line #2", brand: "Tattu R-Line", mah: 750, cells: 4, crate: 95 },
  { label: "R-Line #3", brand: "Tattu R-Line", mah: 750, cells: 4, crate: 95 },
  { label: "R-Line #4", brand: "Tattu R-Line", mah: 750, cells: 4, crate: 95 },
];

const BATTERY_STATUS = {
  charged: { label: "Geladen", chip: "chip--ok" },
  storage: { label: "Lagerung", chip: "chip--cyan" },
  empty: { label: "Leer", chip: "chip--warn" },
  dead: { label: "Defekt", chip: "chip--bad" },
};

/* Nach wie vielen Tagen ein voll geladener Pack als Problem gilt.
   LiPo sollte für die Lagerung auf rund 3,8 V pro Zelle gebracht werden. */
const STORAGE_WARN_DAYS = 3;

/* ------------------------------------------------------- Trainingsplan ---
   Fünf Stufen. Jede Stufe baut auf der vorherigen auf.
   Erfolgskriterium ist bewusst beobachtbar formuliert, nicht als Gefühl.
--------------------------------------------------------------------------- */
const TRAINING = [
  {
    id: "l1",
    n: 1,
    title: "Simulator: Stickgefühl",
    intro:
      "Alles hier gehört in den Simulator, nicht in die Luft. Ziel ist, dass die Sticks aufhören, ein Rätsel zu sein. Rechne mit zehn bis zwanzig Stunden, bevor Stufe 2 Sinn ergibt. Jede Stunde hier spart dir später Armbrüche.",
    maneuvers: [
      {
        id: "m101",
        title: "Hover auf Augenhöhe",
        tag: "Acro-Modus · Grundlage für alles",
        desc: "Die Drohne auf einer Höhe halten, ohne dass sie wegdriftet.",
        goal: "Du lernst, dass Acro keine Selbstnivellierung hat: Jede Lage, die du einnimmst, bleibt, bis du sie aktiv korrigierst.",
        steps: [
          "Simulator auf Acro stellen, Rates zunächst niedrig lassen.",
          "Vorsichtig Gas geben, bis die Drohne knapp abhebt.",
          "Mit kleinen Roll- und Pitch-Korrekturen gegensteuern, bevor die Drift sichtbar wird.",
          "Nicht auf die Drohne starren, sondern auf den Horizont im Bild.",
          "Bewusst mit kleinsten Stickbewegungen arbeiten. Grosse Ausschläge sind hier immer ein Fehler.",
        ],
        errors: [
          "Zu spät korrigieren und dann übersteuern, was zum Schaukeln führt.",
          "Gas als Ein-Aus-Schalter behandeln statt als Dosierung.",
          "Den Blick auf das Zentrum des Bildes nageln statt den Horizont zu nutzen.",
        ],
        success: "60 Sekunden am Stück auf konstanter Höhe, Drift unter etwa einer Drohnenlänge.",
      },
      {
        id: "m102",
        title: "Yaw-Drehung im Hover",
        tag: "Rudder-Turn",
        desc: "Im Schwebeflug 360 Grad um die eigene Hochachse drehen.",
        goal: "Yaw von Roll trennen lernen. Das ist die Bewegung, die Anfänger am häufigsten verwechseln.",
        steps: [
          "Stabilen Hover herstellen.",
          "Yaw langsam und konstant geben, nicht ruckartig.",
          "Mit Pitch und Roll gegenhalten, damit die Position gehalten wird.",
          "Nach 360 Grad sauber stoppen, ohne Nachdrehen.",
          "In beide Richtungen üben. Die ungewohnte Richtung ist die wichtigere.",
        ],
        errors: [
          "Yaw und Roll gleichzeitig geben und sich wundern, warum die Drohne wegwandert.",
          "Zu schnell drehen und dabei die Orientierung verlieren.",
        ],
        success: "Volle Drehung in beide Richtungen, Position hält sich im Rahmen von zwei Drohnenlängen.",
      },
      {
        id: "m103",
        title: "Vorwärtsflug und kontrolliertes Stoppen",
        tag: "Beschleunigen · Abbremsen",
        desc: "Geradeaus beschleunigen und an einem gewählten Punkt zum Stehen kommen.",
        goal: "Verstehen, dass Bremsen im Acro aktives Zurücklehnen ist und kein Loslassen.",
        steps: [
          "Aus dem Hover nach vorne kippen und Gas nachschieben.",
          "Einen Zielpunkt festlegen, an dem du stehen willst.",
          "Rechtzeitig nach hinten kippen und Gas reduzieren.",
          "Im Moment des Stillstands wieder in die Waagrechte.",
          "Distanz schrittweise erhöhen.",
        ],
        errors: [
          "Beim Bremsen das Gas ganz wegnehmen, worauf die Drohne absackt.",
          "Zu spät bremsen und über das Ziel hinausschiessen.",
        ],
        success: "Aus etwa 30 Metern Anlauf innerhalb von fünf Metern um den Zielpunkt stehen.",
      },
      {
        id: "m104",
        title: "Rechteck abfliegen",
        tag: "Box · Kombination Yaw und Pitch",
        desc: "Ein sauberes Rechteck mit vier 90-Grad-Ecken fliegen.",
        goal: "Erste Kombination aus Strecke, Bremsen und Richtungswechsel.",
        steps: [
          "Vier Orientierungspunkte als Ecken wählen.",
          "Seite anfliegen, vor der Ecke abbremsen.",
          "Mit Yaw um 90 Grad drehen.",
          "Nächste Seite anfliegen.",
          "Anschliessend dieselbe Runde rückwärts fliegen.",
        ],
        errors: [
          "Ecken ausrunden, weil zu spät gebremst wird.",
          "Höhe über die Runde verlieren.",
        ],
        success: "Zwei Runden in beide Richtungen, Höhenabweichung bleibt gering, Ecken sind erkennbar Ecken.",
      },
      {
        id: "m105",
        title: "Liegende Acht",
        tag: "Figure 8 · koordinierte Kurve",
        desc: "Eine Acht um zwei Punkte fliegen, mit koordiniertem Roll und Yaw.",
        goal: "Die eigentliche Kurventechnik im FPV: Roll legt die Drohne, Yaw zieht die Nase nach.",
        steps: [
          "Zwei Objekte mit etwa 20 Metern Abstand wählen.",
          "Das erste im Bogen umfliegen, dabei rollen und gleichzeitig Yaw nachziehen.",
          "Im Kreuzungspunkt die Drohne kurz waagrecht stellen.",
          "Gegenrichtung um das zweite Objekt.",
          "Geschwindigkeit möglichst konstant halten.",
        ],
        errors: [
          "Nur Yaw verwenden, was flach und träge aussieht.",
          "Nur Roll verwenden, wodurch die Drohne seitlich wegrutscht.",
          "Im Kreuzungspunkt die Höhe verlieren.",
        ],
        success: "Fünf durchgehende Achten ohne Stopp, Kreuzungspunkt bleibt ungefähr an derselben Stelle.",
      },
      {
        id: "m106",
        title: "Punktlandung",
        tag: "Sinkflug · Dosierung",
        desc: "Aus dem Hover kontrolliert auf einem markierten Punkt landen.",
        goal: "Gasdosierung im unteren Bereich und Umgang mit dem eigenen Abwind.",
        steps: [
          "Über dem Zielpunkt stabil schweben.",
          "Gas leicht reduzieren, Sinken einleiten.",
          "Seitliche Drift laufend korrigieren.",
          "Kurz über Boden Gas minimal erhöhen, um den Aufsetzer abzufangen.",
          "Aufsetzen und sofort disarmen.",
        ],
        errors: [
          "Zu schnell sinken und im eigenen Abwind instabil werden.",
          "Erst beim Aufsetzen merken, dass die Drohne seitlich driftet.",
        ],
        success: "Fünf Landungen in Folge innerhalb eines Radius von etwa zwei Metern, ohne Umkippen.",
      },
    ],
  },
  {
    id: "l2",
    n: 2,
    title: "Erste Flüge draussen",
    intro:
      "Ab hier fliegst du echt. Alles in Kategorie A3: 150 Meter Abstand zu Wohn-, Gewerbe-, Industrie- und Erholungsgebieten, keine Unbeteiligten, maximal 120 Meter über Grund, und mit der Brille immer ein Spotter dabei. Die ersten Flüge sind bewusst langweilig. Das ist Absicht.",
    maneuvers: [
      {
        id: "m201",
        title: "Spot-Beurteilung vor dem ersten Start",
        tag: "Vorbereitung · kein Flugmanöver",
        desc: "Den Platz systematisch prüfen, bevor die Drohne überhaupt ausgepackt wird.",
        goal: "Die meisten Probleme entstehen, bevor der erste Motor dreht. Ein bewusster Blick ersetzt später viel Ärger.",
        steps: [
          "Drohnenkarte prüfen, ob der Platz überhaupt zulässig ist.",
          "Abstand zu Gebäuden und Strassen grob abschätzen und abschreiten.",
          "Wind beurteilen: Böen sind schlimmer als konstanter Wind.",
          "Fluchtrichtung festlegen, also wohin die Drohne im Zweifel geht.",
          "Spotter einweisen: worauf schaut er, wie meldet er sich.",
        ],
        errors: [
          "Sich auf das Gefühl verlassen statt auf die Karte.",
          "Den Spotter erst am Platz fragen, ob er mitmacht.",
        ],
        success: "Du kannst den Platz in drei Sätzen begründen, inklusive Abstand und Fluchtrichtung.",
      },
      {
        id: "m202",
        title: "Sichtflug ohne Brille",
        tag: "Line of Sight · Orientierung",
        desc: "Hover und einfache Bewegungen mit blossem Auge, ohne Brille.",
        goal: "Du musst die Drohne auch dann steuern können, wenn das Bild ausfällt. Das ist die Rettungsfähigkeit.",
        steps: [
          "Brille bleibt unten, Drohne etwa 15 Meter entfernt.",
          "Hover halten, dann nach links und rechts versetzen.",
          "Die Drohne auf dich zudrehen und bewusst mit vertauschtem Roll umgehen.",
          "Kontrolliert zurück auf den Startpunkt landen.",
        ],
        errors: [
          "Panik, sobald die Drohne auf einen zufliegt und Roll spiegelverkehrt wirkt.",
          "Die Übung überspringen, weil sie unspektakulär ist.",
        ],
        success: "Du kannst die Drohne aus jeder Ausrichtung ohne Brille sicher zurückholen und landen.",
      },
      {
        id: "m203",
        title: "Failsafe und Reichweite prüfen",
        tag: "Sicherheit · ELRS",
        desc: "Bewusst testen, was passiert, wenn die Verbindung abreisst.",
        goal: "Du willst wissen, wie sich die Drohne im Ernstfall verhält, und zwar bevor der Ernstfall eintritt.",
        steps: [
          "Failsafe in Betaflight auf Motoren-Stopp prüfen.",
          "Am Boden mit angebauten, aber entfernten Propellern den Sender ausschalten und Reaktion beobachten.",
          "Im Flug in kontrollierter Entfernung die Linkqualität im OSD beobachten.",
          "Die Entfernung notieren, ab der die Werte einbrechen.",
        ],
        errors: [
          "Failsafe nie getestet haben und im Ernstfall raten.",
          "Reichweitentest über fremdem Grund oder in Richtung Siedlung.",
        ],
        success: "Du kennst das Failsafe-Verhalten und die Entfernung, ab der dein Link schwächer wird.",
      },
      {
        id: "m204",
        title: "Gerade Strecke mit Brille",
        tag: "Erster echter FPV-Flug",
        desc: "Hinfliegen, drehen, zurückfliegen, landen. Mehr nicht.",
        goal: "Den Unterschied zwischen Simulator und echtem Wind, echtem Gewicht, echter Konsequenz erleben.",
        steps: [
          "Start, Hover auf etwa 5 Metern, kurz sammeln.",
          "Langsam geradeaus auf eine Distanz von etwa 50 Metern.",
          "Kontrolliert stoppen, mit Yaw um 180 Grad drehen.",
          "Zurückfliegen und landen.",
          "Erst nach mehreren sauberen Durchgängen die Distanz erhöhen.",
        ],
        errors: [
          "Beim ersten Flug gleich Vollgas geben.",
          "Die Akkuspannung ignorieren und bis zum Einbruch fliegen.",
        ],
        success: "Drei Durchgänge in Folge ohne Schreckmoment und ohne Bodenkontakt ausserhalb der Landung.",
      },
      {
        id: "m205",
        title: "Cruisen mit weichen Kurven",
        tag: "Flow · Rhythmus",
        desc: "Über eine freie Fläche fliegen, mit langen, weichen Kurven.",
        goal: "Flüssigkeit statt Einzelmanöver. Hier entsteht das, was später Freestyle trägt.",
        steps: [
          "Konstante mittlere Geschwindigkeit wählen.",
          "Grosse Bögen fliegen, ohne zu stoppen.",
          "Höhe bewusst variieren, aber sanft.",
          "Auf gleichmässige Stickbewegungen achten, nicht auf Tempo.",
        ],
        errors: [
          "Stakkato fliegen, also ständig beschleunigen und bremsen.",
          "Zu tief fliegen, bevor die Kontrolle sitzt.",
        ],
        success: "Zwei Minuten durchgehender Flug ohne vollständigen Stopp und ohne Korrekturzucken.",
      },
      {
        id: "m206",
        title: "Akkudisziplin",
        tag: "Timer · Spannungsgrenze",
        desc: "Konsequent landen, wenn die Spannungsgrenze erreicht ist, nicht wenn es gerade passt.",
        goal: "Tiefentladene Packs sterben früh, und ein leerer Akku in der Kurve ist ein Totalschaden.",
        steps: [
          "Im OSD die Spannung pro Zelle einblenden.",
          "Harte Landegrenze festlegen, üblich sind etwa 3,5 Volt pro Zelle unter Last.",
          "Timer zusätzlich als Backup stellen.",
          "Beim Erreichen der Grenze den Rückflug einleiten, nicht noch eine Runde.",
          "Nach dem Flug Akku in den Lagerzustand bringen, wenn er länger liegt.",
        ],
        errors: [
          "Noch ein Manöver nach dem Warnsignal.",
          "Volle Packs tagelang geladen liegen lassen.",
        ],
        success: "Zehn Flüge in Folge, bei denen die Landung durch dich ausgelöst wurde und nicht durch den Akku.",
      },
    ],
  },
  {
    id: "l3",
    n: 3,
    title: "Kontrolle und Präzision",
    intro:
      "Jetzt geht es um Genauigkeit statt Tempo. Wer diese Stufe überspringt, fliegt später Freestyle mit gebrochenen Linien und wundert sich, warum die Videos unruhig aussehen.",
    maneuvers: [
      {
        id: "m301",
        title: "Orbit um ein Objekt",
        tag: "Kreis · beide Richtungen",
        desc: "Einen konstanten Kreis um einen Baum, Mast oder Pfosten fliegen, Nase immer zum Objekt.",
        goal: "Koordination von Roll, Yaw und Pitch in Dauerbelastung.",
        steps: [
          "Radius von etwa 10 Metern wählen.",
          "Seitlich anfliegen, Nase auf das Objekt ausrichten.",
          "Mit Roll die Kurve legen, mit Yaw die Nase am Objekt halten.",
          "Pitch nutzt du, um den Radius konstant zu halten.",
          "Beide Richtungen üben, die ungewohnte länger.",
        ],
        errors: [
          "Radius wird zur Spirale, weil Yaw und Roll nicht zusammenpassen.",
          "Höhe wandert über die Runden nach oben oder unten.",
        ],
        success: "Drei volle Runden in beide Richtungen, Radius und Höhe bleiben erkennbar konstant.",
      },
      {
        id: "m302",
        title: "Rückwärtsflug",
        tag: "Orientierung · unangenehm",
        desc: "Kontrolliert rückwärts fliegen und dabei die Richtung halten.",
        goal: "Die Drohne verhält sich rückwärts anders, und du siehst nicht, wohin du fliegst. Genau darum.",
        steps: [
          "Aus dem Hover leicht nach hinten kippen.",
          "Gas nachführen, weil die Drohne rückwärts ineffizienter fliegt.",
          "Die Strecke vorher visuell prüfen, bevor du rückwärts hineinfliegst.",
          "Kontrolliert wieder stoppen.",
        ],
        errors: [
          "Rückwärts in unbekanntes Gelände fliegen.",
          "Zu stark nach hinten kippen und an Höhe verlieren.",
        ],
        success: "30 Meter rückwärts auf konstanter Höhe, mit sauberem Stopp.",
      },
      {
        id: "m303",
        title: "Power Slide",
        tag: "Drift · Richtungswechsel",
        desc: "Aus der Fahrt seitlich wegdriften und in die neue Richtung beschleunigen.",
        goal: "Trägheit als Werkzeug nutzen statt gegen sie zu arbeiten.",
        steps: [
          "Mit mittlerem Tempo geradeaus fliegen.",
          "Kräftig in die Zielrichtung rollen, Gas kurz halten.",
          "Die Drohne rutscht seitlich weiter, während die Nase sich dreht.",
          "Mit Yaw die Nase nachziehen und mit Pitch wieder beschleunigen.",
        ],
        errors: [
          "Zu wenig Gas, worauf die Drohne im Slide absackt.",
          "Yaw zu früh, was den Slide abwürgt.",
        ],
        success: "Richtungswechsel um 90 Grad im Slide, ohne Höhenverlust von mehr als ein paar Metern.",
      },
      {
        id: "m304",
        title: "Sanfter Dive und Climb",
        tag: "Höhenwechsel in Fahrt",
        desc: "Aus Höhe kontrolliert absteigen und wieder aufsteigen, ohne die Linie zu brechen.",
        goal: "Vorbereitung auf echte Dives. Wer hier absackt, stürzt später in den Bando.",
        steps: [
          "Auf etwa 30 Metern Höhe Fahrt aufnehmen.",
          "Nase nach unten nehmen, Gas reduzieren, aber nicht auf null.",
          "Den Abfangpunkt vorher festlegen.",
          "Sauber abfangen, indem du die Nase hebst und Gas gibst.",
          "In einem Zug wieder steigen.",
        ],
        errors: [
          "Gas ganz wegnehmen und in den eigenen Abwind fallen.",
          "Zu spät abfangen.",
        ],
        success: "Fünf Dives mit Abfangpunkt, jeweils mit mindestens zehn Metern Reserve zum Boden.",
      },
      {
        id: "m305",
        title: "Punktlandung aus Fahrt",
        tag: "Anflug · Dosierung",
        desc: "Aus dem Vorwärtsflug direkt auf einen Punkt anfliegen und landen.",
        goal: "Landung als Manöver begreifen, nicht als Abbruch des Flugs.",
        steps: [
          "Mit mittlerem Tempo auf den Punkt zufliegen.",
          "Rechtzeitig bremsen und gleichzeitig sinken.",
          "Über dem Punkt kurz stabilisieren.",
          "Aufsetzen und disarmen.",
        ],
        errors: [
          "Bremsen und Sinken nacheinander statt gleichzeitig.",
          "Zu hoch stabilisieren und dann fallen lassen.",
        ],
        success: "Fünf Anflüge in Folge mit Aufsetzpunkt innerhalb von etwa zwei Metern.",
      },
      {
        id: "m306",
        title: "Langsamer Proximity-Flug",
        tag: "Abstand halten · Konzentration",
        desc: "Dicht an Objekten entlangfliegen, bewusst langsam.",
        goal: "Abstandsgefühl durch die Kamera aufbauen. Die Linse lügt über Distanzen.",
        steps: [
          "Ein harmloses Objekt wählen, etwa eine Baumreihe oder Hecke.",
          "Mit Schrittgeschwindigkeit entlangfliegen, Abstand bewusst gross lassen.",
          "Den Abstand über mehrere Durchgänge schrittweise verringern.",
          "Immer einen Ausweg nach oben oder aussen offen halten.",
        ],
        errors: [
          "Den Abstand zu schnell verringern.",
          "Ohne Fluchtweg in eine Lücke fliegen.",
        ],
        success: "Kontrollierte Durchgänge auf konstantem Abstand, ohne Zucken und ohne Beinahe-Kontakt.",
      },
    ],
  },
  {
    id: "l4",
    n: 4,
    title: "Freestyle-Einstieg",
    intro:
      "Erst ab hier lohnt sich Akrobatik, und zwar in Höhe. Alles auf dieser Stufe wird mit mindestens 30 Metern Luft unter der Drohne geübt, bis es sitzt. Höhe ist die einzige Versicherung, die sofort auszahlt.",
    maneuvers: [
      {
        id: "m401",
        title: "Roll",
        tag: "Aileron Roll · erstes Kunstflugmanöver",
        desc: "Die Drohne um die Längsachse einmal komplett drehen.",
        goal: "Erstes Manöver, bei dem die Drohne kurz kopfüber ist. Der Kopf muss lernen, dass das normal ist.",
        steps: [
          "Mit mittlerem Tempo und ausreichend Höhe geradeaus fliegen.",
          "Kurz Gas geben, um Höhe für den Roll zu gewinnen.",
          "Gas zurücknehmen und den Roll-Stick voll in eine Richtung.",
          "Während der Drehung kein Gas geben.",
          "Nach der vollen Drehung Roll zentrieren und Gas wieder aufnehmen.",
        ],
        errors: [
          "Während des Rolls Gas geben, was die Drohne seitlich wegschiesst.",
          "Den Roll halb ausführen und dann korrigieren.",
        ],
        success: "Zehn Rolls in Folge, danach jeweils wieder waagrecht und auf Linie.",
      },
      {
        id: "m402",
        title: "Flip",
        tag: "Backflip · Frontflip",
        desc: "Die Drohne um die Querachse überschlagen.",
        goal: "Dasselbe wie der Roll, aber in der Achse, in der die Orientierung schneller verloren geht.",
        steps: [
          "Höhe aufbauen, Drohne waagrecht.",
          "Kurz Gas für Höhenreserve.",
          "Gas raus, Pitch-Stick voll nach hinten für den Backflip.",
          "Ausdrehen lassen, nicht bremsen.",
          "Nach der Drehung zentrieren und Gas aufnehmen.",
        ],
        errors: [
          "Zu wenig Höhe, sodass der Flip im Boden endet.",
          "Mitten im Flip korrigieren wollen.",
        ],
        success: "Backflip und Frontflip je zehnmal sauber, mit weniger als etwa zehn Metern Höhenverlust.",
      },
      {
        id: "m403",
        title: "Split-S",
        tag: "Richtungsumkehr nach unten",
        desc: "Halber Roll in die Rückenlage, dann halber Looping nach unten heraus.",
        goal: "Erste echte Kombination aus zwei Achsen. Baustein für viele spätere Linien.",
        steps: [
          "Mit Fahrt und Höhe geradeaus fliegen.",
          "Halben Roll bis in die Rückenlage.",
          "Pitch ziehen, bis die Nase nach unten und dann in die Gegenrichtung zeigt.",
          "Beim Herauskommen abfangen und Gas geben.",
        ],
        errors: [
          "In der Rückenlage zögern und dabei fallen.",
          "Zu spät abfangen, was viel Höhe kostet.",
        ],
        success: "Fünf Split-S in Folge, Austrittsrichtung liegt ungefähr 180 Grad zur Eintrittsrichtung.",
      },
      {
        id: "m404",
        title: "Immelmann",
        tag: "Richtungsumkehr nach oben",
        desc: "Halber Looping nach oben, dann halber Roll in die Normallage.",
        goal: "Das Gegenstück zum Split-S. Zusammen ergeben sie eine vollständige Wende in beide Höhenrichtungen.",
        steps: [
          "Mit Tempo anfliegen.",
          "Pitch ziehen bis in die Rückenlage am Scheitelpunkt.",
          "Am Scheitel halben Roll in die Normallage.",
          "Gas aufnehmen und ausfliegen.",
        ],
        errors: [
          "Zu wenig Eintrittsgeschwindigkeit, worauf die Drohne am Scheitel hängt.",
          "Roll zu früh, also noch im Steigflug.",
        ],
        success: "Fünf Immelmanns, am Scheitel keine sichtbare Hängepartie.",
      },
      {
        id: "m405",
        title: "Power Loop",
        tag: "Looping um ein Objekt",
        desc: "Ein Looping, bei dem die Drohne über ein Objekt steigt und dahinter wieder herunterkommt.",
        goal: "Das Signaturmanöver des Freestyle. Verlangt Timing, Höhenreserve und Nerven.",
        steps: [
          "Zuerst ohne Objekt in freier Höhe üben.",
          "Mit Tempo anfliegen, Pitch ziehen, dabei Gas halten.",
          "Über dem Scheitelpunkt Gas reduzieren.",
          "Im Herunterkommen Gas gezielt wieder aufnehmen, um abzufangen.",
          "Erst wenn das sitzt, ein Objekt einbeziehen, zuerst ein niedriges.",
        ],
        errors: [
          "Zu nah am Objekt einleiten.",
          "Gas im Scheitel stehen lassen, was den Loop viel zu weit macht.",
        ],
        success: "Power Loop über ein niedriges Objekt, mit Abfangen deutlich vor dem Boden.",
      },
      {
        id: "m406",
        title: "Dive aus Höhe",
        tag: "Abfangen · Nervensache",
        desc: "Aus deutlicher Höhe senkrecht abtauchen und kontrolliert abfangen.",
        goal: "Höhenabbau als kontrolliertes Manöver, nicht als Sturz.",
        steps: [
          "Auf 60 bis 100 Meter steigen, im Rahmen der 120-Meter-Grenze.",
          "Nase senkrecht nach unten, Gas fast raus.",
          "Abfangpunkt vorher festlegen, grosszügig.",
          "Gleichmässig abfangen, nicht ruckartig.",
        ],
        errors: [
          "Ohne vorher festgelegten Abfangpunkt starten.",
          "Im Dive die Orientierung verlieren und die Nase verreissen.",
        ],
        success: "Fünf Dives mit sauberem Abfangen und mindestens 20 Metern Restreserve.",
      },
    ],
  },
  {
    id: "l5",
    n: 5,
    title: "Freestyle und Linien",
    intro:
      "Ab hier geht es nicht mehr um einzelne Tricks, sondern um Verbindungen. Ein guter Freestyle-Flug hat keine Pausen. Erwarte nicht, dass diese Stufe in einer Saison abgeschlossen ist.",
    maneuvers: [
      {
        id: "m501",
        title: "Matty Flip",
        tag: "Inverted Yaw Spin",
        desc: "In der Rückenlage um die Hochachse drehen und wieder herausrollen.",
        goal: "Das erste Manöver, bei dem Yaw in umgekehrter Lage kontrolliert wird. Fühlt sich zuerst völlig falsch an.",
        steps: [
          "Halber Roll in die Rückenlage.",
          "In der Rückenlage Gas leicht reduzieren, aber nicht auf null.",
          "Yaw geben, die Drohne dreht sich flach.",
          "Nach der gewünschten Drehung halber Roll zurück in die Normallage.",
        ],
        errors: [
          "In der Rückenlage Gas ganz wegnehmen und fallen.",
          "Den Rückroll in die falsche Richtung, was die Linie bricht.",
        ],
        success: "Matty Flip mit mindestens 180 Grad Drehung, Höhenverlust bleibt überschaubar.",
      },
      {
        id: "m502",
        title: "Juicy Flick",
        tag: "Flip mit Yaw-Versatz",
        desc: "Flip, bei dem die Drohne gleichzeitig um die Hochachse versetzt wird.",
        goal: "Zwei Achsen gleichzeitig kontrollieren. Der Übergang von Trick zu Stil.",
        steps: [
          "Flip einleiten wie gewohnt.",
          "Während der Drehung zusätzlich Yaw geben.",
          "Die Menge an Yaw bestimmt, wie stark die Drohne versetzt herauskommt.",
          "Beim Austritt sofort stabilisieren und weiterfliegen.",
        ],
        errors: [
          "Zu viel Yaw, worauf die Orientierung verloren geht.",
          "Nach dem Austritt stehenbleiben statt weiterzufliegen.",
        ],
        success: "Juicy Flick mit kontrolliertem Austritt in eine bewusst gewählte neue Richtung.",
      },
      {
        id: "m503",
        title: "Rolling Orbit",
        tag: "Orbit mit Rolls",
        desc: "Einen Orbit fliegen und dabei fortlaufend rollen.",
        goal: "Kombination aus Dauerkoordination und Einzelmanöver. Fordert vollständige Automatisierung des Rolls.",
        steps: [
          "Stabilen Orbit herstellen.",
          "Am weitesten Punkt einen Roll einstreuen.",
          "Nach dem Roll den Orbit sofort wieder aufnehmen.",
          "Anzahl der Rolls pro Runde schrittweise erhöhen.",
        ],
        errors: [
          "Nach jedem Roll den Orbit neu suchen müssen.",
          "Radius wächst mit jedem Roll.",
        ],
        success: "Eine volle Orbitrunde mit mindestens drei eingestreuten Rolls, Radius bleibt ungefähr erhalten.",
      },
      {
        id: "m504",
        title: "Gap-Durchflug",
        tag: "Proximity · Präzision",
        desc: "Durch eine definierte Lücke fliegen, etwa zwischen zwei Bäumen.",
        goal: "Absolute Genauigkeit unter Zeitdruck. Hier zahlt sich Stufe 3 aus.",
        steps: [
          "Lücke zuerst langsam und mit grossem Sicherheitsabstand durchfliegen.",
          "Anflugwinkel festlegen und immer gleich anfliegen.",
          "Geschwindigkeit erst erhöhen, wenn die Linie reproduzierbar ist.",
          "Immer einen Abbruchpunkt definieren, an dem du hochziehst.",
        ],
        errors: [
          "Die Lücke beim ersten Versuch mit Tempo nehmen.",
          "Keinen Abbruchpunkt haben.",
        ],
        success: "Zehn Durchflüge in Folge ohne Berührung und ohne Korrekturzucken kurz vor der Lücke.",
      },
      {
        id: "m505",
        title: "Flow-Linie aus drei Manövern",
        tag: "Verkettung · Rhythmus",
        desc: "Drei Manöver ohne Pause zu einer durchgehenden Linie verbinden.",
        goal: "Der eigentliche Freestyle. Einzelne Tricks kann jeder, die Verbindung ist die Kunst.",
        steps: [
          "Drei beherrschte Manöver auswählen, etwa Dive, Power Loop, Split-S.",
          "Die Reihenfolge vorher am Boden durchdenken.",
          "Die Linie mehrfach fliegen, ohne zwischendurch zu stoppen.",
          "Erst wenn sie sitzt, ein viertes Manöver ergänzen.",
        ],
        errors: [
          "Zwischen den Manövern stabilisieren, wodurch die Linie zerfällt.",
          "Zu schwere Manöver kombinieren, bevor die einzelnen sitzen.",
        ],
        success: "Drei Manöver in Folge ohne erkennbaren Stopp, dreimal reproduzierbar.",
      },
      {
        id: "m506",
        title: "Spot-Line filmen",
        tag: "Abschluss · eigener Massstab",
        desc: "Eine durchdachte Linie an einem festen Spot fliegen und aufzeichnen.",
        goal: "Selbstbeurteilung. Im Video siehst du alles, was du im Flug nicht gemerkt hast.",
        steps: [
          "Einen Spot wählen und die Linie vorher planen.",
          "Mehrere Durchgänge aufzeichnen.",
          "Das Material anschauen und drei konkrete Fehler notieren.",
          "Diese drei Fehler gezielt üben und die Linie erneut fliegen.",
        ],
        errors: [
          "Das Material nie anschauen.",
          "Nur die gelungenen Stellen anschauen.",
        ],
        success: "Eine Linie, die du zweimal im Abstand von Wochen geflogen bist, mit sichtbarem Unterschied.",
      },
    ],
  },
];

/* --------------------------------------------------------- Checklisten ---
   Bewusst kurz gehalten. Eine Checkliste, die zu lang ist, wird nicht
   gelesen, sondern abgehakt.
--------------------------------------------------------------------------- */
const CHECKLISTS = [
  {
    id: "pre-home",
    title: "Zuhause, vor der Abfahrt",
    icon: "1",
    items: [
      { t: "Akkus geladen und Anzahl geprüft", h: "Auch den Senderakku und die Goggles nicht vergessen." },
      { t: "Propeller kontrolliert", h: "Risse, Kerben, Unwucht. Ein angeschlagener Prop ist Müll, kein Ersatzteil." },
      { t: "Schrauben und Arme nachgezogen", h: "Besonders nach dem letzten Crash." },
      { t: "Ersatzpropeller und Werkzeug eingepackt", h: "Inbus, Kabelbinder, Akkubeutel." },
      { t: "Zeugnis und Betreibernummer dabei", h: "PDF auf dem Handy reicht, Kennzeichnung muss auf der Drohne sein." },
      { t: "Drohnenkarte für den Zielort geprüft", h: "Der Inhalt ändert laufend, also am Flugtag prüfen." },
      { t: "Wetter und Wind geprüft", h: "Böen sind kritischer als konstanter Wind." },
      { t: "Spotter organisiert", h: "Pflicht, sobald du mit der Brille fliegst." },
    ],
  },
  {
    id: "pre-spot",
    title: "Am Platz, vor dem Start",
    icon: "2",
    items: [
      { t: "Abstände geprüft", h: "A3: 150 m zu Wohn-, Gewerbe-, Industrie- und Erholungsgebieten." },
      { t: "Keine Unbeteiligten im Flugbereich", h: "Auch Spaziergänger, die gleich ankommen." },
      { t: "Startplatz frei und eben", h: "Hohes Gras verschluckt Propeller." },
      { t: "Luftraum beobachtet", h: "Helikopter, Gleitschirme, Modellflug." },
      { t: "Spotter eingewiesen", h: "Was meldet er, mit welchen Worten, wo steht er." },
      { t: "Sender eingeschaltet, Modell korrekt gewählt", h: "Erst Sender, dann Drohne. Immer." },
      { t: "Goggles gekoppelt, Bild und Link geprüft", h: "Kanal, Linkqualität, Aufnahme bereit." },
      { t: "Akku gesichert eingesetzt", h: "Strap fest, Kabel nicht im Propellerkreis." },
      { t: "Armen mit Blick auf die Drohne", h: "Propeller drehen erst, wenn du hinschaust." },
    ],
  },
  {
    id: "post",
    title: "Nach dem Flug",
    icon: "3",
    items: [
      { t: "Disarmed und Akku getrennt", h: "Bevor irgendetwas anderes passiert." },
      { t: "Akku auf Temperatur und Aufblähung geprüft", h: "Heiss oder gebläht heisst: getrennt lagern und ersetzen." },
      { t: "Flug im Logbuch erfasst", h: "Dauer, Ort, Speed, Auffälligkeiten." },
      { t: "Drohne auf Schäden kontrolliert", h: "Arme, Propeller, Kamera, Antennen." },
      { t: "Akkus auf Lagerspannung gebracht", h: "Wenn du nicht innerhalb weniger Tage wieder fliegst." },
      { t: "Aufnahmen gesichert", h: "SD-Karte leeren, bevor sie voll ist." },
      { t: "Lernschritt im Training erfasst", h: "Was lief, was nicht. Solange es frisch ist." },
    ],
  },
];

/* ---------------------------------------------------------------- Links ---
   Geprüft am 20.09.2026. Die Drohnenkarte ändert laufend ihren Inhalt,
   nicht aber ihre Adresse.
--------------------------------------------------------------------------- */
const LINKS = [
  {
    group: "Vor jedem Flug",
    items: [
      {
        title: "BAZL Drohnenkarte",
        url: "https://map.geo.admin.ch/#/map?lang=de&topic=aviation&layers=ch.bazl.einschraenkungen-drohnen&bgLayer=ch.swisstopo.pixelkarte-grau",
        desc: "Die offizielle Karte der geografischen Flugeinschränkungen. Das BAZL schreibt ausdrücklich, dass sie vor jedem Flug zu konsultieren ist, weil sich der Inhalt laufend ändert.",
      },
      {
        title: "DABS · Daily Airspace Bulletin",
        url: "https://www.skybriefing.com/de/dabs",
        desc: "Tagesaktuelle Meldungen zum Luftraum, mehrmals täglich aktualisiert. Die Ausgabe für den Folgetag erscheint um 16 Uhr.",
      },
      {
        title: "Geografische Flugeinschränkungen (BAZL)",
        url: "https://www.bazl.admin.ch/de/geografische-flugeinschraenkungen",
        desc: "Erklärung, was die Zonen auf der Karte bedeuten und wo Bewilligungen nötig sind.",
      },
    ],
  },
  {
    group: "Wetter und Wind",
    items: [
      {
        title: "MeteoSchweiz",
        url: "https://www.meteoschweiz.admin.ch/",
        desc: "Amtliche Prognose, Warnungen und Radar. Erste Anlaufstelle für die Tagesplanung.",
      },
      {
        title: "Windy",
        url: "https://www.windy.com/",
        desc: "Windrichtung, Böen und Höhenwind im Kartenverlauf. Besonders brauchbar für die Stundenplanung am Flugtag.",
      },
      {
        title: "meteoblue",
        url: "https://www.meteoblue.com/de/wetter/woche/basel_schweiz_2661604",
        desc: "Detailprognose mit Bewölkung und Niederschlagswahrscheinlichkeit. Ort in der Adresse anpassen.",
      },
      {
        title: "UAV Forecast",
        url: "https://www.uavforecast.com/",
        desc: "Aggregiert Wind, Sicht, Kp-Index und Satellitenzahl zu einer Flugtauglichkeits-Einschätzung. Bequem, aber prüfe die Windwerte gegen eine der Quellen oben.",
      },
    ],
  },
  {
    group: "Behörden und Nachweise",
    items: [
      {
        title: "BAZL Fernpiloten",
        url: "https://www.bazl.admin.ch/de/fernpiloten",
        desc: "Ausbildung, Zertifikate, Zugang zum dLIS. Hier liegt dein Zeugnis zum Download.",
      },
      {
        title: "Registrierung als Drohnenbetreiber",
        url: "https://www.bazl.admin.ch/de/registrierung-drohnenbetreiber",
        desc: "Betreibernummer, Kennzeichnungspflicht und was mit den drei geheimen Zeichen passiert.",
      },
      {
        title: "Flugregeln für Drohnen",
        url: "https://www.bazl.admin.ch/de/flugregeln-drohnen",
        desc: "Die Regeln für A1 und A3 im Original, inklusive Spotter-Pflicht bei FPV.",
      },
      {
        title: "Drohnen-FAQ des BAZL",
        url: "https://www.bazl.admin.ch/de/faq-drohnen",
        desc: "Einzelfragen zu Kennzeichnung, Klassen und Remote ID. Kontakt für Einzelfälle: rpas@bazl.admin.ch",
      },
    ],
  },
];
