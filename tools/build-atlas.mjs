#!/usr/bin/env node
// Build-time generator for the Atlas game (the world-map half of the app).
//
// Reads Natural Earth vector data, projects it, simplifies it with shared
// borders kept intact, and writes compact SVG paths into js/atlas/data-*.js.
// Run: (cd tools && npm install) && node tools/build-atlas.mjs
// Everything it writes is committed - the game itself still has no
// dependencies and needs no network.

import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { topology } from 'topojson-server'
import { presimplify, simplify } from 'topojson-simplify'
import { merge } from 'topojson-client'
import {
  UNIT, project, polygonsOf, linesOf, ringArea, bboxOf, unwrapDateline, datelineShifts,
  projectPolys, projectLine, rdp, rdpRing, encodeRings, encodeLines, centroidOfRing,
} from './atlas-geo.mjs'
import {
  MAP_TIER1, TERRITORIES, HOST, NOT_PLAYABLE, SCENES, RIVERS, RANGES, PEAKS, WATERS,
} from './atlas-curated.mjs'
import { writeServiceWorker } from './build-sw.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, 'tools', '.cache', 'ne')
const OUT = path.join(ROOT, 'js', 'atlas')
const NE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'

// Base map levels of detail: [Visvalingam weight in units², coordinate step].
// The coarse one draws the whole world; the fine one takes over once zoomed.
const LOD = [[60000, 40], [3000, 4]]
// Regions and nature are drawn at one detail level, in steps of 0.01°.
const STEP = 10

// ---------------------------------------------------------------- inputs

async function exists(p) {
  try { await access(p); return true } catch { return false }
}

async function ne(name) {
  const file = path.join(CACHE, name + '.geojson')
  if (!(await exists(file))) {
    process.stdout.write(`fetch ${name}\n`)
    const res = await fetch(NE_URL + name + '.geojson')
    if (!res.ok) throw new Error(`${name} -> HTTP ${res.status}`)
    await writeFile(file, await res.text())
  }
  return JSON.parse(await readFile(file, 'utf8')).features
}

async function loadCountryNames() {
  // The flag game's generated list carries the short names and the
  // recognition ranking - reuse both rather than deriving them twice.
  const src = await readFile(path.join(ROOT, 'js', 'data.js'), 'utf8')
  const sandbox = {}
  new Function('window', src)(sandbox)
  return new Map(sandbox.COUNTRIES.map((c) => [c.cc, c]))
}

// ----------------------------------------------------------------- utils

function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

// Easiest first: by tier, and inside a tier in a stable shuffled order so a
// run does not work through one country at a time.
function rankByTier(items) {
  items.sort((a, b) => a.t - b.t || hash(a.k) - hash(b.k))
  items.forEach((it, i) => { it.r = i })
}

const round = (v, step) => Math.round(v / step)
const box = (b, step) => b.map((v) => round(v, step))

// The part of a feature worth framing: the biggest ring plus whatever sits
// close to it, so Hawaii does not drag the camera across the Pacific.
function mainBox(rings) {
  const parts = rings.filter((r) => r.length > 2).map((r) => ({ r, a: Math.abs(ringArea(r)), b: bboxOf([r]) }))
  if (!parts.length) return null
  const main = parts.reduce((x, y) => (y.a > x.a ? y : x))
  const span = Math.max(main.b[2] - main.b[0], main.b[3] - main.b[1])
  const reach = Math.max(5 * UNIT, span * 1.2)
  const cx = (main.b[0] + main.b[2]) / 2, cy = (main.b[1] + main.b[3]) / 2
  const kept = parts.filter((p) => {
    const px = (p.b[0] + p.b[2]) / 2, py = (p.b[1] + p.b[3]) / 2
    return p.a >= main.a * 0.01 && Math.hypot(px - cx, py - cy) <= reach
  })
  return { box: bboxOf(kept.map((p) => p.r)), main: main.r }
}

// Drop specks that cannot be seen at this level of detail, but never a
// feature's only (largest) ring - small island states must stay drawable.
//
// `relative` also keeps anything at least that share of the largest ring, so
// an island group (Hawaii, the Azores) keeps its islands even inside a big
// country whose absolute threshold would sweep them away.
function dropSpecks(rings, minArea, relative = 0) {
  const areas = rings.map((r) => Math.abs(ringArea(r)))
  const max = Math.max(...areas)
  const floor = relative ? Math.min(minArea, max * relative) : minArea
  return rings.filter((r, i) => areas[i] >= floor || areas[i] === max)
}

// Turn a MultiPolygon's coordinates into a flat ring list.
const ringsOf = (multi) => multi.flat()

function fc(features) {
  return { type: 'FeatureCollection', features }
}

// Dateline handling for a whole set of features at once, so a scene (New
// Zealand with the Chathams) moves together.
function unwrapSet(list) {
  const all = list.flatMap((f) => f.polys)
  const shifts = datelineShifts(all)
  let i = 0
  return list.map((f) => ({
    ...f,
    polys: f.polys.map((poly) => {
      const d = shifts[i++]
      return d ? poly.map((ring) => ring.map(([lon, lat]) => [lon + d, lat])) : poly
    }),
  }))
}

// ------------------------------------------------------------- countries

function countryKey(p) {
  if (NOT_PLAYABLE.has(p.GEOUNIT) || NOT_PLAYABLE.has(p.ADMIN)) return '_'
  if (p.ADMIN === 'United States Minor Outlying Islands') return '_'
  if (HOST[p.GEOUNIT]) return HOST[p.GEOUNIT]
  if (p.ISO_A2_EH && p.ISO_A2_EH !== '-99') return p.ISO_A2_EH
  return p.SU_A3
}

function kmArea(rings) {
  // Shoelace in degrees, scaled by the latitude of each ring. Plenty for
  // ranking by size.
  let total = 0
  for (const r of rings) {
    const lat = r.reduce((s, p) => s + p[1], 0) / r.length
    total += Math.abs(ringArea(r)) * Math.cos(lat * Math.PI / 180) * 111.32 * 111.32
  }
  return total
}

async function buildWorld(names) {
  const units = await ne('ne_10m_admin_0_map_units')
  // Natural Earth's default view puts Crimea in Russia; the Ukrainian point
  // of view draws it as part of Ukraine, which is what this game shows.
  const pov = await ne('ne_10m_admin_0_countries_ukr')
  const povGeom = {}
  for (const f of pov) if (['RUS', 'UKR'].includes(f.properties.ADM0_A3)) povGeom[f.properties.ADM0_A3] = f.geometry

  const feats = []
  const info = new Map()   // key -> { area, label, labelArea }
  for (const f of units) {
    const p = f.properties
    if (p.TYPE === 'Overlay') continue
    let geom = f.geometry
    if (povGeom[p.ADM0_A3] && p.GEOUNIT === p.ADMIN) geom = povGeom[p.ADM0_A3]
    const key = countryKey(p)
    const lonlat = unwrapDateline(polygonsOf(geom))
    const area = kmArea(lonlat.map((poly) => poly[0]))
    const rec = info.get(key) || { area: 0, label: null, labelArea: -1 }
    rec.area += area
    if (area > rec.labelArea && p.LABEL_X !== undefined) {
      rec.labelArea = area
      rec.label = project([p.LABEL_X, p.LABEL_Y])
    }
    info.set(key, rec)
    feats.push({ type: 'Feature', properties: { k: key }, geometry: { type: 'MultiPolygon', coordinates: projectPolys(lonlat) } })
  }

  const topo = presimplify(topology({ u: fc(feats) }))
  const keys = [...info.keys()]
  const lods = LOD.map(([w]) => simplify(topo, w))
  const byKey = (t, k) => t.objects.u.geometries.filter((g) => g.properties.k === k)

  const countries = []
  const missing = []
  let other = null
  for (const k of keys) {
    const geoms = lods.map((t) => merge(t, byKey(t, k)))
    const d = geoms.map((g, i) => encodeRings(dropSpecks(ringsOf(g.coordinates), LOD[i][0] * 6), LOD[i][1]))
    if (k === '_') { other = d; continue }
    const fine = ringsOf(geoms[1].coordinates)
    const mb = mainBox(fine)
    let en, ro, fame
    const sov = names.get(k)
    if (TERRITORIES[k]) [en, ro, fame] = TERRITORIES[k]
    else if (sov) { en = sov.en; ro = sov.ro; fame = 1 - sov.rank / 196 }
    else { missing.push(k); continue }
    const rec = info.get(k)
    const span = Math.max(mb.box[2] - mb.box[0], mb.box[3] - mb.box[1])
    countries.push({
      k, en, ro, fame,
      area: rec.area,
      d0: d[0], d1: d[1],
      b: mb.box,
      bb: bboxOf(fine),
      l: rec.label || centroidOfRing(mb.main).map(Math.round),
      s: span < 1.5 * UNIT ? 1 : 0,
    })
  }
  if (missing.length) throw new Error('countries without a name: ' + missing.join(', '))

  // Ranking for "find it on the map": fame matters, but so does size - Chad
  // is easier to find than Luxembourg even if its flag is less known.
  for (const c of countries) {
    const size = Math.max(0, Math.min(1, (Math.log10(c.area + 1) - 2) / 5))
    c.score = c.fame * 0.6 + size * 0.4
  }
  countries.sort((a, b) => {
    const pa = MAP_TIER1.indexOf(a.k), pb = MAP_TIER1.indexOf(b.k)
    if (pa !== -1 || pb !== -1) return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb)
    return b.score - a.score
  })
  countries.forEach((c, i) => { c.r = i })

  // A very coarse land silhouette for the menu card.
  const thumbTopo = simplify(topo, 4e6)
  const land = merge(thumbTopo, thumbTopo.objects.u.geometries.filter((g) => g.properties.k !== '_'))
  const thumb = encodeRings(dropSpecks(ringsOf(land.coordinates), 4e6 * 20), 500)

  console.log(`world: ${countries.length} countries, d0 ${sum(countries, 'd0')} B, d1 ${sum(countries, 'd1')} B`)
  return { countries, other, thumb, topo }
}

const sum = (list, field) => list.reduce((s, x) => s + (x[field] ? x[field].length : 0), 0)

// ----------------------------------------------------------------- lakes

async function buildLakes(waterLakeNames) {
  const lakes = await ne('ne_10m_lakes')
  const keep = lakes.filter((f) => f.properties.scalerank <= 3 || waterLakeNames.has(f.properties.name))
  const polys = keep.flatMap((f) => projectPolys(polygonsOf(f.geometry)))
  const tol = [160, 28]
  return LOD.map(([, step], i) => {
    const rings = polys.map((poly) => poly[0])
      .map((r) => rdpRing(r, tol[i]))
      .filter((r) => r.length > 3 && Math.abs(ringArea(r)) > tol[i] * tol[i] * 8)
    return encodeRings(rings, step)
  })
}

// ---------------------------------------------------------------- scenes

async function buildScenes() {
  const admin1 = await ne('ne_10m_admin_1_states_provinces')
  const units = await ne('ne_10m_admin_0_map_units')
  const scenes = []
  let playable = 0

  for (const cfg of SCENES) {
    let source
    if (cfg.src === 'admin1') {
      source = admin1.filter((f) => {
        const p = f.properties
        if (cfg.extra && cfg.extra(p)) return true
        if (p.iso_a2 !== cfg.iso) return false
        const g = cfg.groupBy ? p[cfg.groupBy] : p.name
        return !(cfg.drop || []).includes(p.name) && !(cfg.drop || []).includes(g)
      })
    } else {
      const admins = cfg.admins || [cfg.admin]
      source = units.filter((f) => admins.includes(f.properties.ADMIN) || admins.includes(f.properties.GEOUNIT))
    }
    if (!source.length) throw new Error(`scene ${cfg.id}: no source features`)

    const groupOf = (p) => {
      if (cfg.group) return cfg.group(p)
      if (cfg.groupBy) return p[cfg.groupBy]
      return cfg.src === 'units' ? p.GEOUNIT : p.name
    }

    const list = unwrapSet(source.map((f) => ({ g: groupOf(f.properties), polys: polygonsOf(f.geometry) })))
    const feats = list.map((f) => ({
      type: 'Feature', properties: { g: f.g },
      geometry: { type: 'MultiPolygon', coordinates: projectPolys(f.polys) },
    }))

    // Detail follows the size the scene is framed at: about a pixel and a
    // half when the country fills the map.
    const outer = feats.flatMap((f) => f.geometry.coordinates.map((p) => p[0]))
    const areas = outer.map((r) => Math.abs(ringArea(r)))
    const total = areas.reduce((s, a) => s + a, 0)
    const sb = bboxOf(outer.filter((r, i) => areas[i] >= total * 0.002))
    const diag = Math.hypot(sb[2] - sb[0], sb[3] - sb[1])
    const step = Math.max(1, Math.min(40, Math.round(diag / 2500)))
    const weight = Math.max(4, (diag / 650) ** 2)

    const topo = presimplify(topology({ s: fc(feats) }))
    const t = simplify(topo, weight)
    const groups = [...new Set(feats.map((f) => f.properties.g))]
    const out = { id: cfg.id, step, units: [] }
    const named = cfg.units || {}
    for (const g of new Set(Object.keys(named))) {
      if (!groups.includes(g)) throw new Error(`scene ${cfg.id}: no unit called "${g}" (have: ${groups.join(', ')})`)
    }

    const mainRings = []
    for (const g of groups) {
      const geom = merge(t, t.objects.s.geometries.filter((x) => x.properties.g === g))
      const rings = dropSpecks(ringsOf(geom.coordinates), weight * 40, 0.02)
      if (!rings.length) continue
      const mb = mainBox(rings)
      mainRings.push(...rings)
      const unit = { d: encodeRings(rings, step) }
      if (named[g]) {
        const [en, ro, tier] = named[g]
        Object.assign(unit, {
          k: 'p:' + cfg.id + ':' + g.replace(/[^\p{L}\p{N}]+/gu, '-'),
          en, ro, t: tier,
          b: box(mb.box, STEP),
          l: centroidOfRing(mb.main).map((v) => round(v, STEP)),
        })
        if (tier) playable++
      }
      out.units.push(unit)
    }

    const mb = mainBox(mainRings)
    out.b = box(mb.box, STEP)
    scenes.push(out)
  }

  const bytes = scenes.reduce((s, sc) => s + sc.units.reduce((u, x) => u + x.d.length, 0), 0)
  console.log(`regions: ${scenes.length} scenes, ${playable} playable units, ${bytes} B of paths`)
  return scenes
}

// ---------------------------------------------------------------- nature

function within(lonlat, w) {
  if (!w) return true
  return lonlat.some(([lon, lat]) => lon >= w[0] && lon <= w[2] && lat >= w[1] && lat <= w[3])
}

async function buildRivers() {
  const src = await ne('ne_10m_rivers_lake_centerlines')
  const out = []
  for (const [id, en, ro, tier, names, w] of RIVERS) {
    const lines = src
      .filter((f) => names.includes(f.properties.name))
      .flatMap((f) => linesOf(f.geometry))
      .filter((l) => within(l, w))
    if (!lines.length) throw new Error(`river ${id}: nothing matched ${names.join('/')}`)
    const projected = lines.map(projectLine)
    const b = bboxOf(projected)
    const tol = Math.max(12, Math.hypot(b[2] - b[0], b[3] - b[1]) / 900)
    const simple = projected.map((l) => rdp(l, tol)).filter((l) => l.length > 1)
    const longest = simple.reduce((x, y) => (y.length > x.length ? y : x))
    out.push({
      k: 'r:' + id, en, ro, t: tier,
      d: encodeLines(simple, STEP),
      b: box(b, STEP),
      l: longest[Math.floor(longest.length / 2)].map((v) => round(v, STEP)),
    })
  }
  rankByTier(out)
  console.log(`rivers: ${out.length}, ${sum(out, 'd')} B`)
  return out
}

function polygonItem(prefix, id, en, ro, tier, polysLonLat, extra) {
  const polys = projectPolys(polysLonLat)
  const rings = polys.flat()
  const b = bboxOf(rings)
  const tol = Math.max(8, Math.hypot(b[2] - b[0], b[3] - b[1]) / 700)
  const simple = rings.map((r) => rdpRing(r, tol)).filter((r) => r.length > 3)
  const kept = dropSpecks(simple, tol * tol * 6)
  const mb = mainBox(kept)
  if (!mb) throw new Error(`${prefix}${id}: nothing left after simplifying`)
  return {
    k: prefix + id, en, ro, t: tier,
    d: encodeRings(kept, STEP),
    b: box(mb.box, STEP),
    l: centroidOfRing(mb.main).map((v) => round(v, STEP)),
    ...extra,
  }
}

async function buildMountains() {
  const regions = await ne('ne_10m_geography_regions_polys')
  const points = await ne('ne_10m_geography_regions_elevation_points')
  const ranges = []
  for (const [id, en, ro, tier, name] of RANGES) {
    const feats = regions.filter((f) => f.properties.NAME === name)
    if (!feats.length) throw new Error(`range ${id}: no feature named ${name}`)
    ranges.push(polygonItem('m:', id, en, ro, tier, feats.flatMap((f) => polygonsOf(f.geometry))))
  }
  const peaks = []
  for (const [id, en, ro, tier, name, region, lon, lat, metres] of PEAKS) {
    let ll = [lon, lat], elev = metres
    if (name) {
      const f = points.find((x) => x.properties.name === name && (!region || x.properties.region === region))
      if (!f) throw new Error(`peak ${id}: no point named ${name}`)
      ll = f.geometry.coordinates
      elev = f.properties.elevation
    }
    const p = project(ll).map((v) => round(v, STEP))
    peaks.push({ k: 'm:' + id, en, ro, t: tier, p, e: elev, b: [p[0], p[1], p[0], p[1]], l: p })
  }
  // One ladder for both: a run mixes ranges and peaks.
  const all = ranges.concat(peaks)
  rankByTier(all)
  console.log(`mountains: ${ranges.length} ranges (${sum(ranges, 'd')} B), ${peaks.length} peaks`)
  return { ranges, peaks }
}

async function buildWaters() {
  const marine = await ne('ne_10m_geography_marine_polys')
  const lakes = await ne('ne_10m_lakes')
  const out = []
  for (const [id, en, ro, tier, source, names] of WATERS) {
    const pool = source === 'marine' ? marine : lakes
    const feats = pool.filter((f) => names.includes(f.properties.name))
    if (!feats.length) throw new Error(`water ${id}: nothing named ${names.join('/')}`)
    out.push(polygonItem('w:', id, en, ro, tier, feats.flatMap((f) => polygonsOf(f.geometry)), { w: source === 'lake' ? 1 : 0 }))
  }
  rankByTier(out)
  console.log(`waters: ${out.length}, ${sum(out, 'd')} B`)
  return out
}

// ------------------------------------------------------------------ emit

function emit(name, header, obj, listKeys) {
  // One record per line keeps the generated files diffable.
  let body = '// GENERATED by tools/build-atlas.mjs - do not edit by hand.\n' + header + ' = {\n'
  for (const [key, value] of Object.entries(obj)) {
    if (listKeys.includes(key)) {
      body += `  ${key}: [\n` + value.map((v) => '    ' + JSON.stringify(v)).join(',\n') + '\n  ],\n'
    } else {
      body += `  ${key}: ${JSON.stringify(value)},\n`
    }
  }
  body += '};\n'
  return writeFile(path.join(OUT, name), body)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  await mkdir(CACHE, { recursive: true })
  const names = await loadCountryNames()

  const world = await buildWorld(names)
  const lakes = await buildLakes(new Set(WATERS.filter((w) => w[4] === 'lake').flatMap((w) => w[5])))
  const scenes = await buildScenes()
  const rivers = await buildRivers()
  const mountains = await buildMountains()
  const waters = await buildWaters()

  const countries = world.countries.map((c) => ({
    k: c.k, en: c.en, ro: c.ro, r: c.r, s: c.s, b: c.b, bb: c.bb, l: c.l, d0: c.d0, d1: c.d1,
  }))

  await emit('data-world.js', 'window.ATLAS_WORLD', {
    unit: UNIT,
    steps: LOD.map((l) => l[1]),
    // The inhabited world: what "show everything" frames.
    view: [-172 * UNIT, project([0, 83.5])[1], 192 * UNIT, project([0, -57])[1]],
    other: world.other,
    lakes,
    countries,
  }, ['countries'])

  await emit('data-regions.js', 'window.ATLAS_REGIONS', { step: STEP, scenes }, ['scenes'])
  await emit('data-nature.js', 'window.ATLAS_NATURE', {
    step: STEP, rivers, ranges: mountains.ranges, peaks: mountains.peaks, waters,
  }, ['rivers', 'ranges', 'peaks', 'waters'])

  // Loaded at boot: just enough for the menu card and the mode counts.
  const count = (list) => list.filter((x) => x.t).length
  await writeFile(path.join(OUT, 'meta.js'),
    '// GENERATED by tools/build-atlas.mjs - do not edit by hand.\n' +
    'window.ATLAS_META = ' + JSON.stringify({
      thumb: world.thumb,
      thumbBox: [-170, -65, 190, 85].map((v, i) => Math.round((i % 2 ? project([0, v])[1] : v * UNIT) / 500)),
      counts: {
        countries: countries.length,
        regions: scenes.reduce((s, sc) => s + sc.units.filter((u) => u.t).length, 0),
        mountains: count(mountains.ranges) + count(mountains.peaks),
        rivers: count(rivers),
        waters: count(waters),
      },
    }) + ';\n')

  await writeServiceWorker(ROOT)
}

main().catch((err) => { console.error(err); process.exit(1) })
