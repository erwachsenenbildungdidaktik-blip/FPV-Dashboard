/* ==========================================================================
   FPV OPS — Kartenmodul
   Basiskarten und Drohnen-Einschränkungszonen von swisstopo / BAZL über den
   WMTS-Dienst des Bundes. Nutzung ist kostenlos unter Fair Use, verlangt aber
   die Quellenangabe "© Data: swisstopo", die unten rechts eingeblendet wird.
   Leaflet liegt lokal im Repo, damit die Bedienung auch ohne Netz funktioniert.
   Die Kacheln selbst brauchen Verbindung.
   ========================================================================== */

window.FPVMap = (function () {
  "use strict";

  const TILE = "https://wmts.geo.admin.ch/1.0.0/{layer}/default/current/3857/{z}/{x}/{y}.{ext}";
  const ATTR = '© Data: swisstopo · Zonen: BAZL';

  const BASES = [
    { key: "farbe", label: "Karte", layer: "ch.swisstopo.pixelkarte-farbe", ext: "jpeg" },
    { key: "bild", label: "Luftbild", layer: "ch.swisstopo.swissimage", ext: "jpeg" },
    { key: "grau", label: "Grau", layer: "ch.swisstopo.pixelkarte-grau", ext: "jpeg" },
  ];

  const DRONE_LAYER = "ch.bazl.einschraenkungen-drohnen";

  const DEFAULT_CENTER = [47.1368, 7.2468]; // Biel/Bienne
  const DEFAULT_ZOOM = 13;
  const CH_BOUNDS = [[45.7, 5.8], [47.9, 10.6]];

  const MIN_RADIUS = 20;
  const MAX_RADIUS = 3000;
  const A3_DISTANCE = 150; // Meter, Abstand nach Kategorie A3

  function tileUrl(layer, ext) {
    return TILE.replace("{layer}", layer).replace("{ext}", ext);
  }

  function dot(cls) {
    return L.divIcon({ className: "", html: '<span class="mk ' + cls + '"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
  }

  /* ---------------------------------------------------- LV95-Umrechnung ---
     Näherungsformel von swisstopo, WGS84 nach LV95. Genauigkeit im
     Meterbereich, das reicht, um die amtliche Drohnenkarte zu zentrieren. */
  function toLV95(lat, lon) {
    const p = (lat * 3600 - 169028.66) / 10000;
    const l = (lon * 3600 - 26782.5) / 10000;
    const E =
      600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l * l * l;
    const N =
      200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p -
      194.56 * l * l * p + 119.79 * p * p * p;
    return { e: Math.round(E + 2000000), n: Math.round(N + 1000000) };
  }

  function droneMapUrl(lat, lon) {
    const base =
      "https://map.geo.admin.ch/#/map?lang=de&topic=aviation" +
      "&layers=ch.bazl.einschraenkungen-drohnen&bgLayer=ch.swisstopo.pixelkarte-farbe";
    if (lat == null || lon == null) return base;
    const c = toLV95(lat, lon);
    return base + "&center=" + c.e + "," + c.n + "&z=8";
  }

  function fmtCoords(lat, lon) {
    return Number(lat).toFixed(5) + ", " + Number(lon).toFixed(5);
  }

  function parseCoords(s) {
    const m = String(s || "").match(/(-?\d+[.,]?\d*)\s*[,; ]\s*(-?\d+[.,]?\d*)/);
    if (!m) return null;
    const lat = parseFloat(m[1].replace(",", "."));
    const lon = parseFloat(m[2].replace(",", "."));
    if (!isFinite(lat) || !isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat: lat, lon: lon };
  }

  /* ------------------------------------------------------- Grundgerüst --- */

  function baseSetup(el, opts) {
    opts = opts || {};
    const map = L.map(el, {
      center: opts.center || DEFAULT_CENTER,
      zoom: opts.zoom || DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: false,
      maxBounds: L.latLngBounds(CH_BOUNDS).pad(0.6),
      minZoom: 7,
      maxZoom: 18,
    });

    const layers = {};
    BASES.forEach((b) => {
      layers[b.key] = L.tileLayer(tileUrl(b.layer, b.ext), {
        maxZoom: 18,
        maxNativeZoom: 17,
        crossOrigin: true,
      });
    });
    let activeBase = "farbe";
    layers.farbe.addTo(map);

    const drone = L.tileLayer(tileUrl(DRONE_LAYER, "png"), {
      maxZoom: 18,
      maxNativeZoom: 17,
      opacity: 0.55,
      crossOrigin: true,
    }).addTo(map);

    /* Kachelfehler zählen. Ohne Netz meldet Leaflet je Kachel einen Fehler,
       ein einzelner Ausreisser ist aber kein Grund für eine Warnung. */
    let errCount = 0;
    let warned = false;
    const note = L.DomUtil.create("div", "map-note", el);
    note.style.display = "none";
    note.textContent =
      "Kartenkacheln nicht erreichbar. Ohne Verbindung kannst du die Koordinaten von Hand eintragen.";
    function onTileError() {
      if (warned) return;
      if (++errCount >= 4) {
        warned = true;
        note.style.display = "block";
      }
    }
    Object.keys(layers).forEach((k) => layers[k].on("tileerror", onTileError));
    drone.on("tileerror", onTileError);

    /* --- eigene Steuerleiste, damit sie zum Rest der App passt --- */
    const ctrl = L.DomUtil.create("div", "map-ctrl", el);
    L.DomEvent.disableClickPropagation(ctrl);
    L.DomEvent.disableScrollPropagation(ctrl);

    const baseRow = L.DomUtil.create("div", "map-ctrl__row", ctrl);
    BASES.forEach((b) => {
      const btn = L.DomUtil.create("button", "map-btn", baseRow);
      btn.type = "button";
      btn.textContent = b.label;
      btn.setAttribute("aria-pressed", String(b.key === activeBase));
      btn.addEventListener("click", function () {
        if (b.key === activeBase) return;
        map.removeLayer(layers[activeBase]);
        activeBase = b.key;
        layers[activeBase].addTo(map);
        if (map.hasLayer(drone)) drone.bringToFront();
        Array.prototype.forEach.call(baseRow.children, function (c, i) {
          c.setAttribute("aria-pressed", String(BASES[i].key === activeBase));
        });
      });
    });

    const row2 = L.DomUtil.create("div", "map-ctrl__row", ctrl);
    const zoneBtn = L.DomUtil.create("button", "map-btn", row2);
    zoneBtn.type = "button";
    zoneBtn.textContent = "Drohnenzonen";
    zoneBtn.setAttribute("aria-pressed", "true");
    zoneBtn.addEventListener("click", function () {
      if (map.hasLayer(drone)) {
        map.removeLayer(drone);
        zoneBtn.setAttribute("aria-pressed", "false");
      } else {
        drone.addTo(map);
        zoneBtn.setAttribute("aria-pressed", "true");
      }
    });

    const credit = L.DomUtil.create("div", "map-credit", el);
    credit.textContent = ATTR;

    return { map: map, layers: layers, drone: drone, ctrl: ctrl, row2: row2 };
  }

  /* --------------------------------------------------------- Auswahlkarte --
     Klick setzt den Mittelpunkt. Am Rand des orangen Kreises hängt ein Griff,
     den du ziehst, um den Betriebsradius zu ändern. Der cyanfarbene Ring
     zeigt fix 150 m, den Abstand nach Kategorie A3. */

  function picker(el, opts) {
    opts = opts || {};
    const start = opts.lat != null && opts.lon != null ? [opts.lat, opts.lon] : null;
    const setup = baseSetup(el, { center: start || DEFAULT_CENTER, zoom: start ? 15 : 12 });
    const map = setup.map;

    let center = start ? L.latLng(start[0], start[1]) : null;
    let radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Number(opts.radius) || 150));

    const opRing = L.circle([0, 0], {
      radius: radius,
      color: "#ff6a13",
      weight: 2,
      fillColor: "#ff6a13",
      fillOpacity: 0.1,
    });
    const a3Ring = L.circle([0, 0], {
      radius: A3_DISTANCE,
      color: "#2bd9ff",
      weight: 1.5,
      dashArray: "5 5",
      fill: false,
    });
    const centerMk = L.marker([0, 0], { icon: dot("mk--center"), draggable: true, zIndexOffset: 500 });
    const handleMk = L.marker([0, 0], { icon: dot("mk--handle"), draggable: true, zIndexOffset: 600 });

    function handlePos() {
      // Griff standardmässig östlich vom Mittelpunkt auf dem Kreisrand.
      const dLon = radius / (111320 * Math.cos((center.lat * Math.PI) / 180));
      return L.latLng(center.lat, center.lng + dLon);
    }

    function paint(moveHandle) {
      if (!center) return;
      opRing.setLatLng(center).setRadius(radius);
      a3Ring.setLatLng(center);
      centerMk.setLatLng(center);
      if (moveHandle !== false) handleMk.setLatLng(handlePos());
      if (!map.hasLayer(opRing)) {
        a3Ring.addTo(map);
        opRing.addTo(map);
        centerMk.addTo(map);
        handleMk.addTo(map);
      }
    }

    function emit() {
      if (opts.onChange && center) {
        opts.onChange({ lat: center.lat, lon: center.lng, radius: Math.round(radius) });
      }
    }

    /* Nach einem Marker-Drag setzt Leaflet noch einen Klick auf die Karte ab.
       Ohne diese Sperre springt der Mittelpunkt an die Griffposition. */
    let dragGuard = 0;
    function guard() { dragGuard = Date.now(); }
    centerMk.on("dragstart", guard).on("dragend", guard);
    handleMk.on("dragstart", guard).on("dragend", guard);

    map.on("click", function (e) {
      if (Date.now() - dragGuard < 400) return;
      const first = !center;
      center = e.latlng;
      paint();
      emit();
      // Beim ersten Setzen näher heranfahren, sonst zieht man Kilometerradien.
      if (first && map.getZoom() < 15) map.setView(center, 15);
    });

    centerMk.on("drag", function (e) {
      center = e.target.getLatLng();
      paint();
    });
    centerMk.on("dragend", emit);

    handleMk.on("drag", function (e) {
      if (!center) return;
      const d = center.distanceTo(e.target.getLatLng());
      radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, d));
      paint(false);
      if (opts.onLive) opts.onLive(Math.round(radius));
    });
    handleMk.on("dragend", function () {
      paint(false);
      emit();
    });

    if (center) paint();

    /* --- Mein Standort --- */
    const locBtn = L.DomUtil.create("button", "map-btn", setup.row2);
    locBtn.type = "button";
    locBtn.textContent = "Mein Standort";
    locBtn.addEventListener("click", function () {
      if (!navigator.geolocation) {
        locBtn.textContent = "Kein GPS";
        return;
      }
      locBtn.textContent = "Suche…";
      navigator.geolocation.getCurrentPosition(
        function (p) {
          locBtn.textContent = "Mein Standort";
          center = L.latLng(p.coords.latitude, p.coords.longitude);
          map.setView(center, 16);
          paint();
          emit();
        },
        function () {
          locBtn.textContent = "GPS verweigert";
          setTimeout(() => (locBtn.textContent = "Mein Standort"), 2500);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });

    return {
      map: map,
      invalidate: function () {
        map.invalidateSize();
        if (center) map.setView(center, map.getZoom());
      },
      setRadius: function (r) {
        radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Number(r) || MIN_RADIUS));
        paint();
        emit();
      },
      setCenter: function (lat, lon) {
        center = L.latLng(lat, lon);
        map.setView(center, Math.max(map.getZoom(), 15));
        paint();
        emit();
      },
      hasCenter: function () {
        return !!center;
      },
      destroy: function () {
        map.remove();
      },
    };
  }

  /* ------------------------------------------------------ Übersichtskarte -- */

  function overview(el, spots, onPick) {
    const setup = baseSetup(el, {});
    const map = setup.map;
    const pts = [];

    (spots || []).forEach(function (s) {
      if (s.lat == null || s.lon == null) return;
      const ll = L.latLng(s.lat, s.lon);
      pts.push(ll);
      if (s.radius) {
        L.circle(ll, {
          radius: Number(s.radius),
          color: "#ff6a13",
          weight: 1.5,
          fillColor: "#ff6a13",
          fillOpacity: 0.08,
        }).addTo(map);
      }
      const mk = L.marker(ll, { icon: dot("mk--center") }).addTo(map);
      mk.bindTooltip(s.name, { direction: "top", offset: [0, -8] });
      if (onPick) mk.on("click", function () { onPick(s.id); });
    });

    if (pts.length === 1) map.setView(pts[0], 14);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.25));

    return {
      map: map,
      count: pts.length,
      invalidate: function () { map.invalidateSize(); },
      destroy: function () { map.remove(); },
    };
  }

  return {
    picker: picker,
    overview: overview,
    toLV95: toLV95,
    droneMapUrl: droneMapUrl,
    fmtCoords: fmtCoords,
    parseCoords: parseCoords,
    A3_DISTANCE: A3_DISTANCE,
    MIN_RADIUS: MIN_RADIUS,
    MAX_RADIUS: MAX_RADIUS,
  };
})();
