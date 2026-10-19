#!/usr/bin/env node
// Report catalog entries whose photo is missing and bodies whose map file is missing.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['js/bodies.js', 'js/locations.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx);
const { BODIES, LOCATIONS } = ctx.window;
let problems = 0;
for (const l of LOCATIONS) {
  if (!fs.existsSync(path.join(ROOT, l.img))) { console.log(`missing photo  ${l.id} (${l.img})`); problems++; }
  if (!BODIES[l.body]) { console.log(`unknown body   ${l.id} -> ${l.body}`); problems++; }
  if (l.kind !== 'whole' && (l.lat == null || l.lon == null)) { console.log(`no coords      ${l.id}`); problems++; }
}
for (const [id, b] of Object.entries(BODIES)) {
  if (b.map && !fs.existsSync(path.join(ROOT, b.map))) { console.log(`missing map    ${id} (${b.map})`); problems++; }
  if (b.thumb && !fs.existsSync(path.join(ROOT, b.thumb))) { console.log(`missing thumb  ${id} (${b.thumb})`); problems++; }
  if (b.map && (b.radiusKm == null || b.leftEdgeLonE == null)) { console.log(`map config     ${id} needs radiusKm + leftEdgeLonE`); problems++; }
}
const mapped = Object.values(BODIES).filter(b => b.map).length;
let total = 0;
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else total += fs.statSync(p).size; } };
for (const d of ['img', 'js', 'css', 'vendor']) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
console.log(`${LOCATIONS.length} rounds, ${mapped} mapped bodies, ${(total / 1048576).toFixed(1)} MB of assets, ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
