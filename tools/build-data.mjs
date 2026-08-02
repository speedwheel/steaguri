#!/usr/bin/env node
// Build-time data generator for the flag game.
// Fetches country metadata + names + flag PNGs + country outlines, and writes
// js/data.js, js/shapes.js and assets/flags/**. Run: node tools/build-data.mjs
// Everything it produces is committed, so the game itself has zero dependencies.

import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, 'tools', '.cache')

const SRC = {
  countries: 'https://cdn.jsdelivr.net/npm/world-countries@5/countries.json',
  namesEn: 'https://flagcdn.com/en/codes.json',
  namesRo: 'https://cdn.jsdelivr.net/npm/i18n-iso-countries@7/langs/ro.json',
  atlas: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
}

// Non-UN members worth including: a 7-year-old will meet these flags.
const EXTRA = ['TW', 'XK', 'PS', 'VA']

// Hand-pinned level-1 countries so the first level is never obscure.
const TIER1 = [
  'RO', 'FR', 'DE', 'IT', 'ES', 'GB', 'US', 'JP', 'CN', 'BR', 'CA', 'AU',
  'RU', 'IN', 'MX', 'AR', 'EG', 'GR', 'NL', 'PT', 'TR', 'SE', 'CH', 'PL',
]

// Countries whose official name is too long for a chunky tablet button.
const SHORT = {
  US: ['United States', 'Statele Unite'],
  GB: ['United Kingdom', 'Marea Britanie'],
  AE: ['United Arab Emirates', 'Emiratele Arabe Unite'],
  CD: ['DR Congo', 'R.D. Congo'],
  CG: ['Congo', 'Congo'],
  CF: ['Central African Rep.', 'Rep. Centrafricană'],
  KP: ['North Korea', 'Coreea de Nord'],
  KR: ['South Korea', 'Coreea de Sud'],
  LA: ['Laos', 'Laos'],
  SY: ['Syria', 'Siria'],
  TZ: ['Tanzania', 'Tanzania'],
  BO: ['Bolivia', 'Bolivia'],
  VE: ['Venezuela', 'Venezuela'],
  IR: ['Iran', 'Iran'],
  VA: ['Vatican', 'Vatican'],
  MD: ['Moldova', 'Moldova'],
  MK: ['North Macedonia', 'Macedonia de Nord'],
  BA: ['Bosnia & Herzegovina', 'Bosnia și Herțegovina'],
  ST: ['Sao Tome & Principe', 'São Tomé și Príncipe'],
  VC: ['St. Vincent & Gren.', 'Sf. Vincent și Gren.'],
  KN: ['St. Kitts & Nevis', 'Sf. Kitts și Nevis'],
  LC: ['Saint Lucia', 'Sfânta Lucia'],
  AG: ['Antigua & Barbuda', 'Antigua și Barbuda'],
  TT: ['Trinidad & Tobago', 'Trinidad și Tobago'],
  PG: ['Papua New Guinea', 'Papua Noua Guinee'],
  GW: ['Guinea-Bissau', 'Guineea-Bissau'],
  GQ: ['Equatorial Guinea', 'Guineea Ecuatorială'],
  SZ: ['Eswatini', 'Eswatini'],
  TL: ['Timor-Leste', 'Timorul de Est'],
  FM: ['Micronesia', 'Micronezia'],
  MM: ['Myanmar', 'Myanmar'],
  CI: ['Ivory Coast', 'Coasta de Fildeș'],
  CV: ['Cabo Verde', 'Capul Verde'],
  CZ: ['Czechia', 'Cehia'],
  NL: ['Netherlands', 'Țările de Jos'],
  PS: ['Palestine', 'Palestina'],
  XK: ['Kosovo', 'Kosovo'],
  TW: ['Taiwan', 'Taiwan'],
  BN: ['Brunei', 'Brunei'],
  SV: ['El Salvador', 'El Salvador'],
  DO: ['Dominican Republic', 'Rep. Dominicană'],
}

// Romanian names missing from i18n-iso-countries, or better phrased for a kid.
const RO_FIX = {
  XK: 'Kosovo',
  PS: 'Palestina',
  TW: 'Taiwan',
  VA: 'Vatican',
}

// ---------------------------------------------------------------- fetch utils

async function exists(p) {
  try { await access(p); return true } catch { return false }
}

async function cachedJson(name, url) {
  const file = path.join(CACHE, name)
  if (await exists(file)) return JSON.parse(await readFile(file, 'utf8'))
  process.stdout.write(`fetch ${url}\n`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  const text = await res.text()
  await writeFile(file, text)
  return JSON.parse(text)
}

async function pool(items, limit, worker) {
  let i = 0
  const runners = Array.from({ length: limit }, async () => {
    while (i < items.length) await worker(items[i++])
  })
  await Promise.all(runners)
}

// ------------------------------------------------------------ topojson decode
// world-atlas ships quantised, delta-encoded arcs. Decoding it by hand keeps
// this script dependency-free.

function decodeArcs(topo) {
  const { scale: [sx, sy], translate: [tx, ty] } = topo.transform
  return topo.arcs.map((arc) => {
    let x = 0, y = 0
    return arc.map(([dx, dy]) => {
      x += dx; y += dy
      return [x * sx + tx, y * sy + ty]
    })
  })
}

function ringFromArcIndexes(idxs, arcs) {
  const out = []
  for (const idx of idxs) {
    const rev = idx < 0
    const arc = arcs[rev ? ~idx : idx]
    const pts = rev ? arc.slice().reverse() : arc
    // Adjacent arcs share an endpoint; drop the duplicate.
    for (let i = out.length ? 1 : 0; i < pts.length; i++) out.push(pts[i])
  }
  return out
}

function polygonsOf(geom, arcs) {
  if (geom.type === 'Polygon') return [ringFromArcIndexes(geom.arcs[0], arcs)]
  if (geom.type === 'MultiPolygon') return geom.arcs.map((poly) => ringFromArcIndexes(poly[0], arcs))
  return []
}

// ------------------------------------------------------------------- geometry

function ringArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return Math.abs(a / 2)
}

function bbox(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

function centroid(ring) {
  const b = bbox(ring)
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]
}

function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) }

// Ramer-Douglas-Peucker over a closed ring. A ring starts and ends on the same
// point, so anchoring RDP on those two gives a zero-length baseline and every
// point measures as zero distance - split at the far point and simplify both
// halves instead.
function simplify(ring, tol) {
  if (ring.length < 6) return ring
  const [x0, y0] = ring[0]
  let far = 1, farD = -1
  for (let i = 1; i < ring.length - 1; i++) {
    const d = Math.hypot(ring[i][0] - x0, ring[i][1] - y0)
    if (d > farD) { farD = d; far = i }
  }
  const head = rdp(ring.slice(0, far + 1), tol)
  const tail = rdp(ring.slice(far), tol)
  return head.concat(tail.slice(1))
}

// Iterative so deep rings can't blow the stack.
function rdp(ring, tol) {
  if (ring.length < 3) return ring
  const keep = new Uint8Array(ring.length)
  keep[0] = keep[ring.length - 1] = 1
  const stack = [[0, ring.length - 1]]
  while (stack.length) {
    const [lo, hi] = stack.pop()
    if (hi - lo < 2) continue
    const [x1, y1] = ring[lo], [x2, y2] = ring[hi]
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    let best = -1, bestD = tol
    for (let i = lo + 1; i < hi; i++) {
      const [px, py] = ring[i]
      const d = Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / len
      if (d > bestD) { bestD = d; best = i }
    }
    if (best > 0) { keep[best] = 1; stack.push([lo, best], [best, hi]) }
  }
  return ring.filter((_, i) => keep[i])
}

// Local equirectangular: longitudes squashed by cos(mean latitude) so shapes
// keep their real proportions instead of the Mercator stretch.
function project(polys) {
  let lonMin = 180, lonMax = -180, latMin = 90, latMax = -90
  // Unwrap the antimeridian (Russia, Fiji, USA) before measuring the span.
  const spansDateline = polys.some((r) => r.some(([lon]) => lon > 150)) &&
                        polys.some((r) => r.some(([lon]) => lon < -150))
  const unwrapped = polys.map((ring) => ring.map(([lon, lat]) => {
    const l = spansDateline && lon < 0 ? lon + 360 : lon
    if (l < lonMin) lonMin = l
    if (l > lonMax) lonMax = l
    if (lat < latMin) latMin = lat
    if (lat > latMax) latMax = lat
    return [l, lat]
  }))
  const kx = Math.cos((((latMin + latMax) / 2) * Math.PI) / 180)
  return unwrapped.map((ring) => ring.map(([lon, lat]) => [lon * kx, -lat]))
}

function fitToBox(polys, size) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const ring of polys) for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const w = maxX - minX || 1
  const h = maxY - minY || 1
  const s = size / Math.max(w, h)
  const ox = (size - w * s) / 2
  const oy = (size - h * s) / 2
  return {
    polys: polys.map((r) => r.map(([x, y]) => [(x - minX) * s + ox, (y - minY) * s + oy])),
    aspect: w / h,
  }
}

function toPath(polys) {
  return polys.map((ring) => {
    const pts = ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    return `M${pts.join('L')}Z`
  }).join('')
}

function buildShape(geom, arcs) {
  const raw = polygonsOf(geom, arcs).filter((r) => r.length > 3)
  if (!raw.length) return null

  // Keep the mainland plus nearby islands. Two filters, and both matter:
  //  - area: scattered specks are not guessable.
  //  - distance: a far-flung territory (French Guiana, Alaska, Easter Island)
  //    stretches the bounding box until the mainland shrinks to nothing, which
  //    is exactly what a "guess the country" silhouette must not do.
  const withArea = raw.map((r) => ({ ring: r, area: ringArea(r), c: centroid(r), box: bbox(r) }))
  const main = withArea.reduce((a, b) => (b.area > a.area ? b : a))
  const mainSpan = Math.max(main.box.w, main.box.h)
  const maxDist = Math.max(4, mainSpan * 0.7)
  const kept = withArea
    .filter((p) => p.area >= main.area * 0.02 && dist(p.c, main.c) <= maxDist)
    .map((p) => p.ring)

  const fitted = fitToBox(project(kept), 100)
  const simplified = fitted.polys
    .map((r) => simplify(r, 0.35))
    .filter((r) => r.length > 3 && ringArea(r) > 1.5)
  if (!simplified.length) return null

  // Re-fit after simplification so the silhouette still fills the box.
  const final = fitToBox(simplified, 100)
  return { d: toPath(final.polys), aspect: Number(final.aspect.toFixed(3)) }
}

// ------------------------------------------------------------- flag downloads

async function downloadFlags(codes) {
  const jobs = []
  for (const w of ['w320', 'w160']) {
    for (const cc of codes) {
      jobs.push({ w, cc, file: path.join(ROOT, 'assets', 'flags', w, `${cc.toLowerCase()}.png`) })
    }
  }
  let done = 0, skipped = 0, failed = []
  await pool(jobs, 8, async (job) => {
    if (await exists(job.file)) { skipped++; return }
    const url = `https://flagcdn.com/${job.w}/${job.cc.toLowerCase()}.png`
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await writeFile(job.file, Buffer.from(await res.arrayBuffer()))
      done++
      if (done % 50 === 0) process.stdout.write(`  ${done} flags\n`)
    } catch (err) {
      failed.push(`${job.w}/${job.cc}: ${err.message}`)
    }
  })
  console.log(`flags: ${done} downloaded, ${skipped} cached, ${failed.length} failed`)
  if (failed.length) throw new Error(`flag downloads failed:\n${failed.join('\n')}`)
}

// ----------------------------------------------------------------------- main

async function main() {
  for (const dir of ['tools/.cache', 'js', 'assets/flags/w320', 'assets/flags/w160']) {
    await mkdir(path.join(ROOT, dir), { recursive: true })
  }

  const [all, namesEn, namesRoRaw, atlas] = await Promise.all([
    cachedJson('countries.json', SRC.countries),
    cachedJson('names-en.json', SRC.namesEn),
    cachedJson('names-ro.json', SRC.namesRo),
    cachedJson('atlas-110m.json', SRC.atlas),
  ])

  const namesRo = namesRoRaw.countries
  const pick = (v) => (Array.isArray(v) ? v[0] : v)

  const selected = all.filter((c) => c.unMember || EXTRA.includes(c.cca2))
  console.log(`countries: ${selected.length}`)

  // --- names -----------------------------------------------------------
  const missing = []
  const countries = selected.map((c) => {
    const cc = c.cca2
    const en = SHORT[cc]?.[0] || namesEn[cc.toLowerCase()] || c.name.common
    const ro = SHORT[cc]?.[1] || RO_FIX[cc] || pick(namesRo[cc])
    if (!en || !ro) missing.push(`${cc} en=${en} ro=${ro}`)
    return {
      cc,
      en,
      ro,
      region: c.region || 'Other',
      area: Math.round(c.area || 0),
      pop: c.population || 0,
    }
  })
  if (missing.length) throw new Error(`missing names:\n${missing.join('\n')}`)

  // --- difficulty tiers -------------------------------------------------
  // Recognition proxy: big + populous + European/American countries are the
  // ones a European 7-year-old runs into first.
  const REGION_BOOST = { Europe: 3, Americas: 1.5, Asia: 1, Africa: 0, Oceania: 0 }
  for (const c of countries) {
    c.score = Math.log10(c.pop + 10) * 1.6 +
              Math.log10(c.area + 10) * 0.9 +
              (REGION_BOOST[c.region] ?? 0)
  }
  const ranked = countries.slice().sort((a, b) => b.score - a.score)
  const rank = new Map(ranked.map((c, i) => [c.cc, i]))
  const n = ranked.length
  for (const c of countries) {
    const r = rank.get(c.cc)
    if (TIER1.includes(c.cc)) c.tier = 1
    else if (r < n * 0.30) c.tier = 2
    else if (r < n * 0.62) c.tier = 3
    else c.tier = 4
  }
  // Anything hand-pinned to tier 1 must not also sit in the tail pool.
  const tierCounts = [0, 0, 0, 0, 0]
  for (const c of countries) tierCounts[c.tier]++
  console.log(`tiers: 1=${tierCounts[1]} 2=${tierCounts[2]} 3=${tierCounts[3]} 4=${tierCounts[4]}`)

  // --- shapes -----------------------------------------------------------
  const arcs = decodeArcs(atlas)
  const byNumeric = new Map(selected.filter((c) => c.ccn3).map((c) => [String(Number(c.ccn3)), c.cca2]))
  const shapes = {}
  let noId = 0, unmatched = 0, tooSmall = 0
  for (const geom of atlas.objects.countries.geometries) {
    if (!geom.id) { noId++; continue }
    const cc = byNumeric.get(String(Number(geom.id)))
    if (!cc) { unmatched++; continue }
    const shape = buildShape(geom, arcs)
    if (!shape) { tooSmall++; continue }
    shapes[cc] = shape
  }
  console.log(`shapes: ${Object.keys(shapes).length} built (${noId} without id, ${unmatched} unmatched, ${tooSmall} too small)`)

  for (const c of countries) c.shape = Boolean(shapes[c.cc])

  // --- flags ------------------------------------------------------------
  await downloadFlags(countries.map((c) => c.cc))

  // --- emit -------------------------------------------------------------
  countries.sort((a, b) => a.en.localeCompare(b.en))
  const rows = countries.map((c) => JSON.stringify({
    cc: c.cc, en: c.en, ro: c.ro, tier: c.tier, region: c.region, shape: c.shape,
  }))
  await writeFile(
    path.join(ROOT, 'js', 'data.js'),
    '// GENERATED by tools/build-data.mjs - do not edit by hand.\n' +
    'window.COUNTRIES = [\n  ' + rows.join(',\n  ') + '\n];\n',
  )

  const shapeRows = Object.keys(shapes).sort()
    .map((cc) => `  ${cc}: ${JSON.stringify(shapes[cc])}`)
  await writeFile(
    path.join(ROOT, 'js', 'shapes.js'),
    '// GENERATED by tools/build-data.mjs - do not edit by hand.\n' +
    'window.SHAPES = {\n' + shapeRows.join(',\n') + '\n};\n',
  )

  // --- service worker precache -----------------------------------------
  const assets = [
    './', './index.html', './css/style.css',
    './js/icons.js', './js/data.js', './js/shapes.js', './js/lookalikes.js', './js/i18n.js',
    './js/store.js', './js/fx.js', './js/app.js',
    './js/modes/quiz-flag.js', './js/modes/quiz-name.js', './js/modes/quiz-shape.js',
    './js/modes/draw-free.js', './js/modes/draw-build.js',
    './manifest.webmanifest', './assets/icon-192.png', './assets/icon-512.png',
    ...countries.map((c) => `./assets/flags/w320/${c.cc.toLowerCase()}.png`),
    ...countries.map((c) => `./assets/flags/w160/${c.cc.toLowerCase()}.png`),
  ]
  const version = createHash('sha1').update(assets.join('|')).digest('hex').slice(0, 8)
  await writeFile(
    path.join(ROOT, 'sw.js'),
    `// GENERATED by tools/build-data.mjs - do not edit by hand.
var CACHE = 'steaguri-${version}';
var ASSETS = ${JSON.stringify(assets, null, 2)};

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // Individual misses must not fail the whole install.
    return Promise.all(ASSETS.map(function (url) {
      return c.add(url).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) {
      return k === CACHE ? null : caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    return hit || fetch(e.request).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () { return caches.match('./index.html'); });
  }));
});
`,
  )

  console.log(`\nwrote js/data.js (${countries.length}), js/shapes.js (${Object.keys(shapes).length}), sw.js (${assets.length} assets)`)
}

main().catch((err) => { console.error(err); process.exit(1) })
