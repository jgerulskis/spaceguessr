// Every target the player can pick.
//
// Coordinates everywhere in the game are east-positive degrees. Each shipped
// map image must be drawn east-positive, north-up; `leftEdgeLonE` is the east
// longitude at the image's left edge (most maps: -180; maps centred on 180°: 0).
// `map` is null for identify-only targets, and for bodies whose texture has not
// been prepared yet — rounds on such bodies degrade to identify-only on their own.
// `system` groups siblings for partial credit (guess Io when it was Europa).

window.BODY_GROUPS = [
  'Sun & inner planets',
  'Earth & Moon',
  'Mars',
  'Asteroid belt',
  'Jupiter system',
  'Saturn system',
  'Ice giants & beyond',
  'Small bodies',
  'Spacecraft'
];

window.BODIES = {
  sun:       { name: 'Sun',          group: 'Sun & inner planets', color: '#ffb347', emoji: '☀️', map: null },
  mercury:   { name: 'Mercury',      group: 'Sun & inner planets', color: '#9a9a9a', emoji: '🪨', radiusKm: 2439.7, map: 'img/maps/mercury.jpg', thumb: 'img/thumbs/mercury.jpg', leftEdgeLonE: -180, mapCredit: 'NASA/JHUAPL/CIW/USGS (MESSENGER MDIS)' },
  venus:     { name: 'Venus',        group: 'Sun & inner planets', color: '#e8c37a', emoji: '🟡', radiusKm: 6051.8, map: 'img/maps/venus.jpg', thumb: 'img/thumbs/venus.jpg', leftEdgeLonE: -180, mapCredit: 'NASA/JPL/USGS (Magellan C3-MDIR)' },

  earth:     { name: 'Earth',        group: 'Earth & Moon', color: '#4f8fe0', emoji: '🌍', radiusKm: 6371,   map: 'img/maps/earth.jpg', thumb: 'img/thumbs/earth.jpg', leftEdgeLonE: -180, mapCredit: 'NASA Earth Observatory (Blue Marble)' },
  moon:      { name: 'Moon',         group: 'Earth & Moon', color: '#c9c9c9', emoji: '🌕', radiusKm: 1737.4, map: 'img/maps/moon.jpg', thumb: 'img/thumbs/moon.jpg', leftEdgeLonE: -180, mapCredit: 'NASA SVS / LRO LROC' },

  mars:      { name: 'Mars',         group: 'Mars', color: '#d1603d', emoji: '🔴', radiusKm: 3396.2, map: 'img/maps/mars.jpg', thumb: 'img/thumbs/mars.jpg', leftEdgeLonE: -180, mapCredit: 'NASA/JPL/USGS (Viking MDIM 2.1)' },

  ceres:     { name: 'Ceres',        group: 'Asteroid belt', color: '#8d8d8d', emoji: '🪨', radiusKm: 470,  map: null, leftEdgeLonE: -180, mapCredit: 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA (Dawn)' },
  vesta:     { name: 'Vesta',        group: 'Asteroid belt', color: '#a89f91', emoji: '🪨', radiusKm: 262.7, map: 'img/maps/vesta.jpg', thumb: 'img/thumbs/vesta.jpg', leftEdgeLonE: -180, mapCredit: 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA/USGS (Dawn HAMO)' },

  jupiter:   { name: 'Jupiter',      group: 'Jupiter system', color: '#d9a66c', emoji: '🟠', system: 'jupiter', map: null },
  io:        { name: 'Io',           group: 'Jupiter system', color: '#e5d04a', emoji: '🌋', system: 'jupiter', radiusKm: 1821.6, map: 'img/maps/io.jpg', thumb: 'img/thumbs/io.jpg', leftEdgeLonE: -180, mapCredit: 'NASA/JPL/USGS (Galileo SSI / Voyager)' },
  europa:    { name: 'Europa',       group: 'Jupiter system', color: '#cbbba0', emoji: '🧊', system: 'jupiter', radiusKm: 1560.8, map: 'img/maps/europa.jpg', thumb: 'img/thumbs/europa.jpg', leftEdgeLonE: 0,    mapCredit: 'NASA/JPL/USGS (Galileo SSI / Voyager)' },
  ganymede:  { name: 'Ganymede',     group: 'Jupiter system', color: '#9c9484', emoji: '🪨', system: 'jupiter', radiusKm: 2634.1, map: 'img/maps/ganymede.jpg', thumb: 'img/thumbs/ganymede.jpg', leftEdgeLonE: 0,    mapCredit: 'NASA/JPL/USGS (Galileo SSI / Voyager)' },
  callisto:  { name: 'Callisto',     group: 'Jupiter system', color: '#6e6559', emoji: '🪨', system: 'jupiter', radiusKm: 2410.3, map: 'img/maps/callisto.jpg', thumb: 'img/thumbs/callisto.jpg', leftEdgeLonE: 0,    mapCredit: 'NASA/JPL/USGS (Galileo SSI / Voyager)' },

  saturn:    { name: 'Saturn',       group: 'Saturn system', color: '#e6cf9a', emoji: '🪐', system: 'saturn', map: null },
  enceladus: { name: 'Enceladus',    group: 'Saturn system', color: '#eef3ff', emoji: '❄️', system: 'saturn', radiusKm: 252.1, map: 'img/maps/enceladus.jpg', thumb: 'img/thumbs/enceladus.jpg', leftEdgeLonE: -180, mapCredit: 'NASA/JPL-Caltech/SSI/USGS (Cassini)' },
  titan:     { name: 'Titan',        group: 'Saturn system', color: '#d9a441', emoji: '🟤', system: 'saturn', radiusKm: 2574.7, map: 'img/maps/titan.jpg', thumb: 'img/thumbs/titan.jpg', leftEdgeLonE: 0,    mapCredit: 'NASA/JPL-Caltech/SSI/USGS (Cassini ISS)' },

  uranus:    { name: 'Uranus',       group: 'Ice giants & beyond', color: '#9fd8e2', emoji: '🔵', map: null },
  neptune:   { name: 'Neptune',      group: 'Ice giants & beyond', color: '#3f5fd0', emoji: '🔵', map: null },
  pluto:     { name: 'Pluto',        group: 'Ice giants & beyond', color: '#c7a78f', emoji: '🤍', radiusKm: 1188.3, map: 'img/maps/pluto.jpg', thumb: 'img/thumbs/pluto.jpg', leftEdgeLonE: 0, mapCredit: 'NASA/JHUAPL/SwRI/USGS (New Horizons)' },

  comet67p:  { name: 'Comet 67P',    group: 'Small bodies', color: '#777777', emoji: '☄️', map: null },
  bennu:     { name: 'Bennu',        group: 'Small bodies', color: '#555555', emoji: '🪨', map: null },

  iss:       { name: 'ISS',          group: 'Spacecraft', color: '#bcd3e6', emoji: '🛰️', map: null },
  hubble:    { name: 'Hubble',       group: 'Spacecraft', color: '#aab4c8', emoji: '🔭', map: null }
};
