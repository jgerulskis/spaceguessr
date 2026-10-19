#!/usr/bin/env node
// Resolve every catalog entry's `source` into a local JPEG at img/rounds/<id>.jpg.
// Usage: node scripts/fetch-images.mjs [--force] [id ...]
// Needs macOS `sips` for JPEG conversion / downscaling (max 1600 px).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter(a => !a.startsWith('--'));
const MAX_PX = 1600;
const UA = 'SpaceGuessr-asset-fetch/1.0 (game jam; contact via repo)';

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/locations.js'), 'utf8'), ctx);
const LOCATIONS = ctx.window.LOCATIONS;

async function get(url) {
  return fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'image/*,application/json;q=0.9,*/*;q=0.5' }, redirect: 'follow' });
}

async function candidatesFor(src) {
  const out = [];
  if (src.url) out.push(src.url);
  if (src.nasaId) {
    try {
      const r = await get('https://images-api.nasa.gov/asset/' + encodeURIComponent(src.nasaId));
      if (r.ok) {
        const j = await r.json();
        const hrefs = (j.collection?.items || []).map(i => i.href).filter(h => /\.(jpe?g|png)$/i.test(h));
        for (const tag of ['~medium', '~large', '~orig', '~small']) {
          for (const h of hrefs) if (h.includes(tag)) out.push(h.replace(/^http:/, 'https:'));
        }
      }
    } catch (e) { /* fall through to other candidates */ }
    if (/^PIA\d+$/i.test(src.nasaId)) {
      const id = src.nasaId.toUpperCase(), lo = id.toLowerCase();
      out.push(`https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/${lo.slice(0, 5)}/${lo}/${id}.jpg?w=${MAX_PX}`);
      out.push(`https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/${lo.slice(0, 5)}/${lo}/${id}.jpg`);
    }
  }
  return [...new Set(out)];
}

async function download(url) {
  const r = await get(url);
  if (!r.ok) return null;
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  if (!ct.startsWith('image/')) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 8000) return null;
  return { buf, ext: ct.includes('png') ? 'png' : 'jpg' };
}

function toJpeg(tmp, dest) {
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', '-Z', String(MAX_PX), tmp, '--out', dest], { stdio: 'ignore' });
}

const failures = [];
let okCount = 0, skipCount = 0;
const queue = LOCATIONS.filter(l => !only.length || only.includes(l.id));

async function work(loc) {
  const dest = path.join(ROOT, loc.img);
  if (!force && fs.existsSync(dest)) { skipCount++; return; }
  const cands = await candidatesFor(loc.source || {});
  for (const url of cands) {
    try {
      const got = await download(url);
      if (!got) continue;
      const tmp = dest + '.tmp.' + got.ext;
      fs.writeFileSync(tmp, got.buf);
      try { toJpeg(tmp, dest); } finally { fs.rmSync(tmp, { force: true }); }
      const kb = Math.round(fs.statSync(dest).size / 1024);
      console.log(`ok    ${loc.id.padEnd(14)} ${kb} KB  <- ${url}`);
      okCount++;
      return;
    } catch (e) { /* try next candidate */ }
  }
  failures.push(loc.id);
  console.log(`FAIL  ${loc.id.padEnd(14)} tried ${cands.length} url(s): ${cands.join(' | ') || '(none)'}`);
}

const CONCURRENCY = 4;
let i = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (i < queue.length) await work(queue[i++]); }));

console.log(`\n${okCount} downloaded, ${skipCount} already present, ${failures.length} failed${failures.length ? ': ' + failures.join(', ') : ''}`);
process.exit(failures.length ? 1 : 0);
