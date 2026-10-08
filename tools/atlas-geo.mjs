// Geometry helpers for tools/build-atlas.mjs: projection, dateline handling,
// ring maths and the compact SVG path encoding the game reads back.

// Map units per degree of longitude. Fine enough that Vatican and Monaco keep
// a real outline, coarse enough that path deltas stay short.
export const UNIT = 1000

// Patterson cylindrical: a compromise projection - rectangular, so the map
// pans like a sheet of paper, without Mercator's giant Greenland.
export function project([lon, lat]) {
  const clamped = Math.max(-89.9, Math.min(89.9, lat))
  const phi = (clamped * Math.PI) / 180
  const p2 = phi * phi
  const y = phi * (1.0148 + p2 * p2 * (0.23185 + p2 * (-0.14499 + 0.02406 * p2)))
  return [Math.round(lon * UNIT), Math.round((-y * 180 / Math.PI) * UNIT)]
}

// Inverse of project() for the latitude axis, used to place hand-written
// points and to sanity-check output.
export function unprojectY(y) {
  let phi = -y / UNIT * Math.PI / 180
  for (let i = 0; i < 12; i++) {
    const p2 = phi * phi
    const f = phi * (1.0148 + p2 * p2 * (0.23185 + p2 * (-0.14499 + 0.02406 * p2))) + y / UNIT * Math.PI / 180
    const df = 1.0148 + p2 * p2 * (5 * 0.23185 + p2 * (7 * -0.14499 + 9 * 0.02406 * p2))
    phi -= f / df
  }
  return phi * 180 / Math.PI
}

export function polygonsOf(geometry) {
  if (!geometry) return []
  if (geometry.type === 'Polygon') return [geometry.coordinates]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates
  return []
}

export function linesOf(geometry) {
  if (!geometry) return []
  if (geometry.type === 'LineString') return [geometry.coordinates]
  if (geometry.type === 'MultiLineString') return geometry.coordinates
  return []
}

export function ringArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return a / 2
}

export function bboxOf(rings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const ring of rings) for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return [minX, minY, maxX, maxY]
}

// A feature that straddles the 180th meridian arrives as pieces on both
// edges of the map (Chukotka, Fiji, the Aleutians). Move the smaller side
// across so the feature is one piece; the map is wide enough to hold it.
export function datelineShifts(polys) {
  const side = polys.map((poly) => {
    const lons = poly[0].map((p) => p[0])
    return (Math.min(...lons) + Math.max(...lons)) / 2 >= 0 ? 1 : -1
  })
  const touchesEast = polys.some((p, i) => side[i] > 0 && p[0].some(([lon]) => lon > 150))
  const touchesWest = polys.some((p, i) => side[i] < 0 && p[0].some(([lon]) => lon < -150))
  if (!touchesEast || !touchesWest) return polys.map(() => 0)
  let east = 0, west = 0
  polys.forEach((p, i) => { if (side[i] > 0) east += Math.abs(ringArea(p[0])); else west += Math.abs(ringArea(p[0])) })
  const keep = east >= west ? 1 : -1
  // Only pieces near the dateline move; a far-off piece on the other side
  // (Kiribati's Line Islands) is genuinely there.
  return polys.map((p, i) => {
    if (side[i] === keep) return 0
    const near = p[0].some(([lon]) => (keep > 0 ? lon < -120 : lon > 120))
    return near ? keep * 360 : 0
  })
}

export function unwrapDateline(polys) {
  const shifts = datelineShifts(polys)
  if (shifts.every((s) => !s)) return polys
  return polys.map((poly, i) => shifts[i]
    ? poly.map((ring) => ring.map(([lon, lat]) => [lon + shifts[i], lat]))
    : poly)
}

export function projectPolys(polys) {
  return polys.map((poly) => poly.map((ring) => dedupe(ring.map(project))))
}

export function projectLine(line) {
  return dedupe(line.map(project))
}

function dedupe(pts) {
  const out = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p)
  }
  return out
}

// Ramer-Douglas-Peucker for polylines (rivers) - topology does not matter for
// a line drawn on its own.
export function rdp(points, tol) {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [lo, hi] = stack.pop()
    if (hi - lo < 2) continue
    const [x1, y1] = points[lo], [x2, y2] = points[hi]
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy)
    let best = -1, bestD = tol
    for (let i = lo + 1; i < hi; i++) {
      const [px, py] = points[i]
      const d = len
        ? Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / len
        : Math.hypot(px - x1, py - y1)
      if (d > bestD) { bestD = d; best = i }
    }
    if (best > 0) { keep[best] = 1; stack.push([lo, best], [best, hi]) }
  }
  return points.filter((_, i) => keep[i])
}

// Closed rings simplified with RDP need a split point away from the start,
// otherwise the baseline has zero length.
export function rdpRing(ring, tol) {
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

// Compact path: absolute moveto, then relative integer linetos. Values are
// divided by `step` first, so a coarse level of detail can store short numbers
// and be drawn with a matching scale transform.
export function encodeRings(rings, step = 1) {
  let out = ''
  for (const ring of rings) {
    const pts = ring.slice()
    // GeoJSON rings repeat the first point at the end; "z" already closes it.
    if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop()
    if (pts.length < 3) continue
    const enc = encodePoints(pts, step, 2)
    if (enc) out += enc + 'z'
  }
  return out
}

export function encodeLines(lines, step = 1) {
  return lines.filter((l) => l.length > 1).map((l) => encodePoints(l, step, 1)).join('')
}

// Returns '' when rounding to `step` collapses the shape below minSegments.
function encodePoints(pts, step, minSegments) {
  let px = Math.round(pts[0][0] / step), py = Math.round(pts[0][1] / step)
  let s = 'M' + px + ' ' + py + 'l'
  let segments = 0
  for (let i = 1; i < pts.length; i++) {
    const x = Math.round(pts[i][0] / step), y = Math.round(pts[i][1] / step)
    const dx = x - px, dy = y - py
    if (!dx && !dy) continue
    s += (segments ? (dx < 0 ? '' : ' ') : '') + dx + (dy < 0 ? '' : ' ') + dy
    segments++
    px = x; py = y
  }
  return segments >= minSegments ? s : ''
}

export function centroidOfRing(ring) {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
    a += f
    cx += (ring[j][0] + ring[i][0]) * f
    cy += (ring[j][1] + ring[i][1]) * f
  }
  if (!a) return ring[0]
  return [cx / (3 * a), cy / (3 * a)]
}

// Great-circle distance in km between two lon/lat points.
export function km([lon1, lat1], [lon2, lat2]) {
  const r = Math.PI / 180
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}
