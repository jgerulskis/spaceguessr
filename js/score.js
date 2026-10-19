// Scoring. 5000 max per round, GeoGuessr-style exponential falloff with distance.
window.Score = (function () {
  const MAX = 5000;
  const SIBLING = 500;        // right planetary system, wrong moon
  const HINT_FACTOR = 0.75;   // multiplier when a hint was used
  const PERFECT_FRAC = 0.005; // within 0.5% of the max possible distance -> full marks
  const K_DIV = 12;           // k = pi*R / K_DIV  (GeoGuessr's Earth constant is ~pi*R/13.4)

  function curve(body, dKm) {
    const maxD = Math.PI * body.radiusKm;
    if (dKm < PERFECT_FRAC * maxD) return MAX;
    const k = maxD / K_DIV;
    return Math.round(MAX * Math.exp(-dKm / k));
  }

  // guessBody: id or null. guessLatLon: {lat, lon} east-positive or null. loc: catalog entry.
  function scoreFor({ guessBody, guessLatLon, loc, hintUsed }) {
    const body = BODIES[loc.body];
    let points = 0, distanceKm = null, outcome;
    if (guessBody !== loc.body) {
      const gb = guessBody ? BODIES[guessBody] : null;
      if (gb && gb.system && gb.system === body.system) { points = SIBLING; outcome = 'sibling'; }
      else outcome = 'wrong';
    } else if (!body.map || loc.lat == null) {
      points = MAX; outcome = 'whole';
    } else if (!guessLatLon) {
      outcome = 'nopin';
    } else {
      distanceKm = Geo.haversineKm(body.radiusKm, guessLatLon, Geo.locLatLon(loc));
      points = curve(body, distanceKm);
      outcome = 'pinned';
    }
    if (hintUsed) points = Math.round(points * HINT_FACTOR);
    return { points, distanceKm, outcome };
  }

  return { MAX, SIBLING, HINT_FACTOR, curve, scoreFor };
})();
