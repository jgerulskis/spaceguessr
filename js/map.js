// Leaflet wrapper around one equirectangular image per body.
// CRS.Simple with bounds [[-90, left], [90, left+360]] means Leaflet's latlng IS
// (lat, east-longitude) in degrees — no pixel math anywhere.
window.GameMap = (function () {
  let map = null, overlay = null, bodyId = null;
  let guessMarker = null, actualMarker = null, line = null, debugLayer = null;
  let locked = false, onGuessChange = null;
  const overlayCache = {};

  const guessIcon = L.divIcon({ className: 'pin pin-guess', iconSize: [18, 18], iconAnchor: [9, 9] });
  const actualIcon = L.divIcon({ className: 'pin pin-actual', iconSize: [18, 18], iconAnchor: [9, 9] });

  function init(el, opts) {
    onGuessChange = opts && opts.onGuessChange;
    map = L.map(el, {
      crs: L.CRS.Simple,
      minZoom: -2, maxZoom: 5,
      zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 80,
      attributionControl: false, zoomControl: false,
      maxBoundsViscosity: 1
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.on('click', function (e) {
      if (!overlay || locked) return;
      setGuessPin(e.latlng);
    });
    return map;
  }

  function boundsFor(body) {
    const l = body.leftEdgeLonE;
    return L.latLngBounds([[-90, l], [90, l + 360]]);
  }

  // East-longitude -> x within this body's image span.
  function toMapLatLng(body, p) {
    const l = body.leftEdgeLonE;
    let x = p.lon;
    while (x < l) x += 360;
    while (x >= l + 360) x -= 360;
    return L.latLng(p.lat, x);
  }

  function clearPins() {
    [guessMarker, actualMarker, line, debugLayer].forEach(function (x) { if (x) map.removeLayer(x); });
    guessMarker = actualMarker = line = debugLayer = null;
  }

  // Returns true if the body has a map (pin stage applies).
  function showBody(id) {
    clearPins();
    if (overlay) { map.removeLayer(overlay); overlay = null; }
    bodyId = id;
    const body = id ? BODIES[id] : null;
    if (!body || !body.map) { map.setMaxBounds(null); return false; }
    const b = boundsFor(body);
    overlay = overlayCache[id] || (overlayCache[id] = L.imageOverlay(body.map, b, { interactive: false }));
    overlay.addTo(map);
    map.setMaxBounds(b.pad(0.02));
    fit();
    return true;
  }

  function fit() {
    if (!overlay || !bodyId) return;
    map.invalidateSize();
    map.fitBounds(boundsFor(BODIES[bodyId]), { animate: false });
  }

  function setGuessPin(latlng) {
    const ll = L.latLng(Math.max(-90, Math.min(90, latlng.lat)), latlng.lng);
    if (!guessMarker) {
      guessMarker = L.marker(ll, { icon: guessIcon, draggable: true, zIndexOffset: 1000 }).addTo(map);
      guessMarker.on('dragend', function () { if (onGuessChange) onGuessChange(getGuess()); });
    } else {
      guessMarker.setLatLng(ll);
    }
    if (onGuessChange) onGuessChange(getGuess());
  }

  function getGuess() {
    if (!guessMarker) return null;
    const p = guessMarker.getLatLng();
    return { lat: p.lat, lon: Geo.normLon(p.lng) };
  }

  // Screen position (viewport px) of a map latlng — used to aim the reveal rocket.
  function toScreen(ll) {
    const p = map.latLngToContainerPoint(ll), r = map.getContainer().getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }

  // Frame the answer. Map must already display loc.body. keepGuess=true keeps the
  // player's pin (same body). Returns viewport positions of both pins. With
  // deferAnswer the red pin + line wait for dropAnswer() (the rocket lands first).
  let pendingAnswer = null;
  function reveal(loc, keepGuess, opts) {
    locked = true;
    pendingAnswer = null;
    const body = BODIES[bodyId];
    if (!body || !body.map || loc.lat == null) return { guess: null, actual: null };
    const a = toMapLatLng(body, Geo.locLatLon(loc));
    map.invalidateSize();
    let g = null;
    if (guessMarker && keepGuess) {
      guessMarker.dragging.disable();
      g = guessMarker.getLatLng();
      map.fitBounds(L.latLngBounds([g, a]).pad(0.5), { maxZoom: 3, animate: false });
    } else {
      if (guessMarker) { map.removeLayer(guessMarker); guessMarker = null; }
      map.setView(a, 2, { animate: false });
    }
    pendingAnswer = { a: a, g: g };
    if (!(opts && opts.deferAnswer)) dropAnswer();
    return { guess: g ? toScreen(g) : null, actual: toScreen(a) };
  }

  function dropAnswer() {
    if (!pendingAnswer) return;
    const a = pendingAnswer.a, g = pendingAnswer.g;
    pendingAnswer = null;
    actualMarker = L.marker(a, { icon: actualIcon, interactive: false, zIndexOffset: 900 }).addTo(map);
    if (g) line = L.polyline([g, a], { color: '#f6ecd4', weight: 2, dashArray: '6 6', opacity: 0.85 }).addTo(map);
  }

  function reset() {
    locked = false;
    pendingAnswer = null;
    showBody(null);
  }

  function invalidate() { if (map) map.invalidateSize(); }

  // Plot every catalog pin for a body, to eyeball coordinate conventions. ?debug=1
  function debugOverlay(id) {
    if (debugLayer) { map.removeLayer(debugLayer); debugLayer = null; }
    const body = BODIES[id];
    if (!body || !body.map) return;
    debugLayer = L.layerGroup().addTo(map);
    LOCATIONS.filter(function (l) { return l.body === id && l.lat != null; }).forEach(function (l) {
      const p = toMapLatLng(body, Geo.locLatLon(l));
      L.circleMarker(p, { radius: 6, color: '#00ff88', weight: 2, fillOpacity: 0.3 })
        .bindTooltip(l.name, { permanent: true, direction: 'top', className: 'dbg-tip' })
        .addTo(debugLayer);
    });
  }

  return { init, showBody, fit, setGuessPin, getGuess, reveal, dropAnswer, reset, invalidate, debugOverlay, hasMap: function () { return !!overlay; } };
})();
