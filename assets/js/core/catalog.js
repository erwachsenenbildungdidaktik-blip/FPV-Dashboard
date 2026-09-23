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
];

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
  part("cat-tattu-rline-650-4s", 5, "Flugakkus", "Tattu R-Line 650 mAh 4S 95C (XT30)", "ca. 80–82 g", 18.9),
  part("cat-geprc-660-4s", 6, "Flugakkus", "GEPRC 660 mAh 4S 90C (XT30)", "", 21.9),
  part("cat-tattu-rline-850-4s-150c", 7, "Flugakkus", "Tattu R-Line 850 mAh 4S 150C V5.0 (XT30)", "", 21.9),
  part("cat-tattu-850-4s-75c", 8, "Flugakkus", "Tattu 850 mAh 4S 75C (XT30)", "", 23.9),

  part("cat-seeker3-arm-rear", 9, "Rahmen", "DeepSpace Seeker 3 Ersatzarm hinten", "", "", {
    url: "https://fpvracing.ch/en/zubehoer/4163-deepspace-seeker-3-spare-arm-rear.html",
    source: SHOP,
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
