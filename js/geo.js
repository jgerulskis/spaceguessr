// Coordinate helpers. Everything downstream of toEast() is east-positive degrees.
window.Geo = (function () {
  function toRad(d) { return d * Math.PI / 180; }

  // Gazetteer value + direction -> east-positive longitude.
  function toEast(lon, dir) { return dir === 'W' ? -lon : lon; }

  // Any longitude -> [-180, 180).
  function normLon(lon) { return ((((lon + 180) % 360) + 360) % 360) - 180; }

  // Great-circle distance on a sphere of radius R (km). a, b = {lat, lon} in degrees.
  function haversineKm(R, a, b) {
    const p1 = toRad(a.lat), p2 = toRad(b.lat);
    const dp = p2 - p1, dl = toRad(b.lon - a.lon);
    const s = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  // Catalog entry -> east-positive {lat, lon}.
  function locLatLon(loc) { return { lat: loc.lat, lon: normLon(toEast(loc.lon, loc.lonDir || 'E')) }; }

  return { toRad, toEast, normLon, haversineKm, locLatLon };
})();
