/* ==========================================================================
   FPV OPS — Startkatalog für die Werkstatt
   Quelle der Angaben: docs/teilekatalog.md (Konfigurator auf der Seeker-3-Seite
   von fpvracing.ch, Herstellerangaben, eigene Bestellung). Preise sind ein
   Stand vom 23.09.2026, kein Angebot.

   Feste IDs: Der Speicher legt jeden Eintrag nur an, wenn es ihn auf dem Gerät
   noch nie gab. Eigene Änderungen und Löschungen bleiben dadurch bestehen.
   ========================================================================== */

const STAND = "2026-09-23";
const SHOP = "fpvracing.ch";

export const PART_CATEGORIES = [
  "Props",
  "Flugakkus",
  "Rahmen",
  "Elektronik",
  "Funke",
  "Brille",
  "Werkzeug & Kleinteile",
  "Sonstiges",
];

export const SEED_DRONES = [
  {
    id: "default-drone-1",
    _order: 1,
    name: "Seeker 3",
    model: "DeepSpace Seeker 3 DJI O4 Pro 4S (ELRS) mit GPS",
    weightDry: "",
    url: "https://fpvracing.ch/en/bnf-receiver-included/4178-deepspace-seeker-3-dji-o4-pro-4s-elrs.html",
    specs: [
      { k: "Flugcontroller", v: "F722, Gyro ICM42688P, Barometer DPS310, 16 MB Blackbox" },
      { k: "ESC", v: "40 A, BLHeli_32" },
      { k: "Motoren", v: "DeepSpace Aether 1505, 4000 KV" },
      { k: "Video", v: "DJI O4 Air Unit Pro, microSD bis 512 GB" },
      { k: "Empfänger", v: "ELRS 2.4 GHz" },
      { k: "GPS", v: "Chip der 10. Generation, vorne montiert" },
      { k: "Rahmen", v: "3 Zoll Deadcat, Carbon, CNC-Alu-Seitenteile, Arme einzeln tauschbar" },
      { k: "Props ab Werk", v: "HQProp T3x3x3" },
      { k: "Akku", v: "4S, XT30" },
    ],
    notes: "Herstellerangabe 175 g ohne Akku. Selbst wiegen und unter „Bearbeiten“ eintragen, das ergibt das Startgewicht pro Akku.",
  },
  {
    // Angaben vom 20.10.2026 aus Händlerseiten (getfpv, racedayquads, rotorama,
    // dronex.gr) und der BETAFPV-Seite zum Matrix-1S-Board. betafpv.com selbst
    // war aus der Arbeitsumgebung nicht erreichbar. Widersprüche stehen dabei.
    id: "seed-meteor65-pro2-o4",
    _order: 2,
    name: "Meteor65 Pro II",
    model: "BETAFPV Meteor65 Pro II O4, 1S Brushless Whoop, DJI O4 Wide, ELRS 2.4 GHz",
    weightDry: "",
    url: "https://betafpv.com/products/meteor65-pro-ii-o4-brushless-whoop-quadcopter",
    specs: [
      { k: "Rahmen", v: "1S Whoop mit Schutzringen, Radstand 70 mm" },
      { k: "Flugcontroller", v: "Matrix 1S 3IN1 HD: FC, ESC und ELRS-Empfänger auf einer Platine, MCU STM32G473 (Händlerangabe)" },
      { k: "Gyro", v: "Je nach Quelle BMI270 oder ICM42688P – im Betaflight-Reiter Setup nachsehen" },
      { k: "ESC", v: "12 A (Händlerangabe), Bluejay" },
      { k: "Motoren", v: "0802 Freestyle (2026), KV-Angaben widersprechen sich: 22000 oder 25000 KV" },
      { k: "Props ab Werk", v: "GF 1409, 3-Blatt" },
      { k: "Video", v: "DJI O4 Wide Air Unit, 159° Blickwinkel, Aufnahme bis 4K/60" },
      { k: "Empfänger", v: "ELRS 2.4 GHz onboard (seriell, CRSF)" },
      { k: "Akku", v: "1S, BT2.0, empfohlen LAVA II 1S 480 mAh" },
      { k: "Flugzeit", v: "ca. 4:05 mit LAVA II 480 mAh, ca. 2:40 mit LAVA 300 mAh (Herstellerangabe)" },
    ],
    notes: "Händler nennen 36,2 g ohne Akku (eine Amazon-Seite 18,3 g, wohl falsch). Selbst wiegen und eintragen. Akku-Sorte auf dem Etikett prüfen: Mehrere Händler führen die LAVA II als LiHV (4,35 V). Steht 4,35 V oder HV drauf, im Reiter Akkus auf LiHV stellen; als LiPo laden ist sicher, nur nicht ganz voll.",
  },
];

// Akkus aus der Bestellung vom 20.10.2026 (fpvracing.ch, Artikel 174009).
// Sorte LiPo, bis Hugo das Etikett geprüft hat: als LiPo laden ist die sichere Seite.
export const SEED_BATTERIES = [1, 2, 3, 4].map((n) => ({
  id: "seed-lava2-" + n,
  _order: 100 + n,
  label: "LAVA #" + n,
  brand: "BETAFPV LAVA II",
  mah: 480,
  cells: 1,
  crate: 95,
  chem: "lipo",
  droneId: "seed-meteor65-pro2-o4",
  cyclesBase: 0,
  status: "storage",
  statusSince: "",
  added: "",
  bought: "2026-10-20",
  notes: "BT2.0. Etikett prüfen: 4,35 V oder HV → unter Bearbeiten auf LiHV stellen.",
}));

// Vorlagen für "Drohne erfassen": dieselben Datenblätter wie die Startdrohnen.
export const DRONE_TEMPLATES = SEED_DRONES;

function part(id, order, cat, name, spec, price, extra) {
  return Object.assign(
    {
      id: id,
      _order: order,
      cat: cat,
      name: name,
      spec: spec,
      shop: SHOP,
      url: "",
      price: price,
      stockBase: 0,
      minStock: 0,
      onList: 0,
      droneIds: ["default-drone-1"],
      source: "Konfigurator " + SHOP,
      sourceDate: STAND,
      note: "",
    },
    extra || {}
  );
}

export const SEED_PARTS = [
  part("cat-hq-t3x3x3", 1, "Props", "HQProp T3x3x3 Durable", "3 Zoll, Steigung 3.0, 3 Blätter. Serien-Prop.", 2.9),
  part("cat-hq-t3x25x3", 2, "Props", "HQProp T3x2.5x3 Durable, grau", "3 Zoll, Steigung 2.5, 3 Blätter.", 2.5),
  part("cat-hq-t3x2x3", 3, "Props", "HQProp T3x2x3 Durable", "3 Zoll, Steigung 2.0, 3 Blätter.", 2.5),

  part("cat-tattu-rline-750-4s", 4, "Flugakkus", "Tattu R-Line 750 mAh 4S 95C (XT30)", "ca. 84 g", 25.9, {
    stockBase: 4,
    note: "Eigener Bestand. Einzelne Packs werden unter Akkus geführt.",
  }),
  part("cat-betafpv-lava2-480-1s", 15, "Flugakkus", "BETAFPV Lava II 480 mAh 1S 95C (BT2.0), 4er-Pack", "Artikel 174009, ca. 12,6 g pro Akku (Händlerangabe)", 28.9, {
    stockBase: 1,
    droneIds: ["seed-meteor65-pro2-o4"],
    source: "Eigene Bestellung " + SHOP + ", 20.10.2026",
    sourceDate: "2026-10-20",
    note: "Eigener Bestand. Die vier Akkus werden einzeln unter Akkus geführt (LAVA #1–#4).",
  }),
  part("cat-gemfan-1409-3b", 16, "Props", "Gemfan 1409 3-Blatt Tiny Whoop (1,0 mm Welle)", "Artikel RD34. Serien-Prop der Meteor65 Pro II. Stückzahl der Packung prüfen.", 3.0, {
    stockBase: 1,
    droneIds: ["seed-meteor65-pro2-o4"],
    source: "Eigene Bestellung " + SHOP + ", 20.10.2026",
    sourceDate: "2026-10-20",
  }),
  part("cat-tattu-rline-650-4s", 5, "Flugakkus", "Tattu R-Line 650 mAh 4S 95C (XT30)", "ca. 80–82 g", 18.9),
  part("cat-geprc-660-4s", 6, "Flugakkus", "GEPRC 660 mAh 4S 90C (XT30)", "", 21.9),
  part("cat-tattu-rline-850-4s-150c", 7, "Flugakkus", "Tattu R-Line 850 mAh 4S 150C V5.0 (XT30)", "", 21.9),
  part("cat-tattu-850-4s-75c", 8, "Flugakkus", "Tattu 850 mAh 4S 75C (XT30)", "", 23.9),

  part("cat-seeker3-arm-rear", 9, "Rahmen", "DeepSpace Seeker 3 Ersatzarm hinten", "", "", {
    url: "https://fpvracing.ch/en/zubehoer/4163-deepspace-seeker-3-spare-arm-rear.html",
    source: SHOP,
  }),

  part("cat-seeker3-arm-front", 14, "Rahmen", "DeepSpace Seeker 3 Ersatzarm vorne", "T700-Carbon", "", {
    source: "Konfigurator " + SHOP + ", Preis offen",
    note: "Preis und Link im Shop nachtragen.",
  }),
  part("cat-tx16s-mk3-max", 10, "Funke", "RadioMaster TX16S Mk3 MAX (ELRS), Gold", "Artikel 191002", 319, {
    stockBase: 1,
    droneIds: [],
    source: "Eigene Bestellung " + SHOP,
  }),
  part("cat-samsung-18650-35e", 11, "Funke", "Samsung INR18650-35E 3500 mAh (Flat Top)", "Akku für die Funke. Artikel 021002", 11.9, {
    stockBase: 2,
    droneIds: [],
    source: "Eigene Bestellung " + SHOP,
  }),
  part("cat-samsung-18650-30q", 12, "Funke", "Samsung INR18650-30Q 3000 mAh (Button Top)", "Akku für die Funke, 18650", 11.9, {
    droneIds: [],
  }),

  part("cat-dji-goggles-3", 13, "Brille", "DJI Goggles 3", "Zur O4 Air Unit Pro kompatibel", 599, {
    stockBase: 1,
    droneIds: [],
    source: "Eigene Angabe, Listenpreis " + SHOP,
  }),
];

// Wartungsplan-Vorschläge. Die Intervalle sind Faustregeln für einen 3-Zöller im
// Freestyle, keine Herstellerangaben, und in der App anpassbar.
export const SEED_TASKS = [
  {
    id: "task-seeker3-screws",
    _order: 1,
    droneId: "default-drone-1",
    title: "Schrauben, Arme und Kamerahalter prüfen",
    everyFlights: 10,
    everyDays: 0,
    lastDate: "",
  },
  {
    id: "task-seeker3-motors",
    _order: 2,
    droneId: "default-drone-1",
    title: "Motoren: Lagerspiel, Geräusch, Wärme nach dem Flug",
    everyFlights: 25,
    everyDays: 0,
    lastDate: "",
  },
  {
    id: "task-seeker3-config",
    _order: 3,
    droneId: "default-drone-1",
    title: "Betaflight-Konfiguration sichern (diff all)",
    kind: "config",
    everyFlights: 0,
    everyDays: 90,
    lastDate: "",
  },
];
