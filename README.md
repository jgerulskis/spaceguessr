# SpaceGuessr

GeoGuessr for the solar system. Five real photos per game; name the world, drop the pin on its map, score by distance. Built for a game jam as a plain static site: no backend, no build step, no API keys, no network requests at runtime.

## Play

Open `index.html` in a browser (double-click works), or serve the folder:

```sh
python3 -m http.server 8000   # then http://localhost:8000
```

- **Play** – random five rounds. **Daily challenge** – same five rounds for everyone on a given date.
- `index.html?seed=anything` – reproducible game you can share.
- `index.html?debug=1` – plots every catalog pin on the selected body's map, to check coordinates.
- `index.html?fx=0` – skip the rocket reveal animation (also skipped automatically for `prefers-reduced-motion` or without WebGL).
- Keys: `Enter` = guess / next, `H` = hint, `M` = mute.

## Look, sound and the reveal

- **Reveal animation** (`js/fx.js`, Three.js r149 classic build): on Guess, a tin-toy rocket built from primitives (lathe body, cone nose, extruded fins, additive flame, particle trail) launches from your pin, arcs over the map in screen space (orthographic camera = viewport pixels, so Leaflet pin positions are used directly) and lands on the answer with a starburst and ring; the red answer pin drops as it lands. Wrong world = it tumbles and sputters off-screen. Whole-body rounds fly across the photo.
- **Music and SFX** (`js/audio.js`): synthesised live with the Web Audio API — an 8-bar retro-arcade loop in A minor (square arpeggio, detuned saw pads, vibrato lead with echo, soft kick/hat, convolution reverb) plus launch, landing, miss, hint, tick and fanfare sounds. No audio files and nothing to license; the music is original. Starts on the first click, toggle with the 🔊 button or `M`, remembered in localStorage.
- **Mid-century arcade styling** (`css/style.css`, `img/ui/*.svg`): cream/teal/mustard/orange atomic-age palette on deep navy, Righteous display type with layered Googie shadows, Press Start 2P for scores and "PRESS START", starburst/atom/boomerang/rocket decorations, scanline + vignette overlay on the title and results, pill buttons with hard offset shadows, a cream reveal card with a rotating rubber stamp (Bullseye! / Nice shot! / Lost in space), and ranks from Space Cadet to Galactic Legend.

Scoring: 5,000 max per round. Pin rounds score `5000·exp(−d/k)` with `k = πR/12` for that body's radius (within 0.5 % of the antipodal distance counts as perfect). Whole-body rounds (gas giants, Sun, spacecraft, small bodies) give 5,000 for naming the target. Wrong world = 0, except 500 for a sibling moon in the same system. Hints cost 25 % of the round.

## Layout

```
index.html          the whole UI (title / round / results screens)
css/style.css
js/bodies.js        every pickable target: radius, map image, map left-edge longitude, group, colour
js/locations.js     the round catalog (coords, photo source, hint, fact, credit)
js/geo.js           longitude normalisation + haversine
js/score.js         the curve and the outcome rules
js/map.js           Leaflet (CRS.Simple) wrapper: one equirectangular image overlay per body
js/game.js          state machine, seeded round picking, localStorage best, share text
js/main.js          DOM wiring
img/maps/           equirectangular textures (4096×2048 Moon/Mars/Earth, 2048×1024 the rest)
img/rounds/         one JPEG per catalog entry, ≤1600 px
img/thumbs/         picker thumbnails
js/fx.js            Three.js rocket reveal animation (screen-space, transparent full-screen canvas)
js/audio.js         procedural music + SFX (Web Audio, no files)
img/ui/             starburst / atom / rocket / boomerang SVG decorations
vendor/leaflet/     Leaflet 1.9.4, vendored
vendor/three/       Three.js r149 classic build (MIT), vendored
vendor/fonts/       Righteous + Press Start 2P (SIL OFL 1.1), vendored
scripts/            asset pipeline (below)
```

Scripts are classic `<script>` tags on purpose: Chrome blocks ES modules and `fetch()` on `file://`, and the game has to work from a double-click.

## Coordinates (the one rule that matters)

Every coordinate inside the game is **east-positive degrees**. The catalog stores Gazetteer values verbatim with `lonDir: 'E' | 'W'`, and `Geo.toEast()` is the only place that converts. Every map image must be drawn **east-positive, north-up**; `BODIES[x].leftEdgeLonE` is the east longitude of the image's left edge (−180 for maps centred on 0°, 0 for maps centred on 180° such as Pluto, Titan and the Galilean moons). All thirteen shipped maps were checked against known features with `?debug=1`; none needed mirroring.

## Asset pipeline (one-time, macOS `sips` + Node 18+)

1. **Map textures** – download the sources listed in `scripts/make-maps.sh` (NASA SVS, USGS Astrogeology, Planetary Society, NASA Earth Observatory; all public domain) into one folder, then

   ```sh
   scripts/make-maps.sh /path/to/raw-maps            # all bodies
   scripts/make-maps.sh /path/to/raw-maps moon mars  # a subset
   ```

   Set `flip=yes` in the table for a source drawn with longitude increasing to the left.

2. **Round photos** – resolved from the NASA Image and Video Library (`images-api.nasa.gov/asset/<id>`) with a Photojournal fallback, converted to ≤1600 px JPEG:

   ```sh
   node scripts/fetch-images.mjs            # everything missing
   node scripts/fetch-images.mjs --force id # re-fetch one entry
   ```

3. **Check** – `node scripts/check-assets.mjs` lists missing photos/maps and totals the asset size.

## Adding a round

Append an entry to `js/locations.js`:

```js
{ id: 'kingscrater', body: 'moon', name: 'King Crater', lat: 5.0, lon: 120.5, lonDir: 'E',
  kind: 'feature', difficulty: 'hard', source: { nasaId: 'PIA13518' },
  credit: 'NASA/GSFC/Arizona State University', hint: '…', fact: '…' }
```

Then `node scripts/fetch-images.mjs kingscrater` and eyeball it with `?debug=1`. Use `kind: 'whole'` with `lat: null` for identify-only rounds. A body with `map: null` in `bodies.js` makes all of its rounds identify-only automatically.

## Shipping

Zip the folder with `index.html` at the root (relative paths only) and upload to itch.io as an HTML5 game with "embed in page" + fullscreen, or push to GitHub Pages / Netlify. Total asset size is about 34 MB.

## Credits

Imagery: NASA, NASA/JPL-Caltech, NASA/GSFC/Arizona State University (LRO), NASA/JHUAPL/CIW (MESSENGER), NASA/JHUAPL/SwRI (New Horizons), NASA/JPL/USGS, NASA/JPL/Space Science Institute (Cassini), NASA/JPL-Caltech/UCLA/MPS/DLR/IDA (Dawn), NASA SVS, NASA Earth Observatory, USGS Astrogeology Science Center, ESA/Rosetta/NAVCAM (CC BY-SA 3.0 IGO), ESA/NASA/JPL/University of Arizona (Huygens). Mars base map via The Planetary Society's public-domain downscale of USGS MDIM 2.1. Leaflet © Vladimir Agafonkin (BSD-2). Three.js © Three.js Authors (MIT). Fonts: Righteous by Brian J. Bonislawsky and Press Start 2P by CodeMan38, both SIL Open Font License 1.1. Music and sound effects are original, generated at runtime. Not affiliated with GeoGuessr.
