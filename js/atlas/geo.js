// Geometry for the Atlas game: reading the compact paths back into points,
// and the hit tests that decide whether a tap landed on the right thing.
// All coordinates here are map units: 1000 per degree of longitude, y from
// the Patterson projection (see tools/atlas-geo.mjs).
window.AtlasGeo = (function () {
  var UNIT = 1000;

  // "M12 34l5-6 7 8zM..." -> [[[x,y],...], ...]. Rings and lines share the
  // format; a ring simply ends in z.
  function parse(d, step) {
    var out = [];
    var cur = null;
    var nums = [];
    var cmd = '';
    var x = 0, y = 0;
    var i = 0, n = d.length;

    function flush() {
      var j;
      if (cmd === 'M') {
        x = nums[0]; y = nums[1];
        cur = [[x * step, y * step]];
        out.push(cur);
      } else if (cmd === 'l') {
        for (j = 0; j + 1 < nums.length; j += 2) {
          x += nums[j]; y += nums[j + 1];
          cur.push([x * step, y * step]);
        }
      }
      nums = [];
    }

    while (i < n) {
      var ch = d.charAt(i);
      if (ch === 'M' || ch === 'l' || ch === 'z') {
        flush();
        cmd = ch;
        i++;
      } else if (ch === ' ') {
        i++;
      } else {
        var start = i;
        i++;
        while (i < n) {
          var c = d.charCodeAt(i);
          if (c < 48 || c > 57) break;   // digits only after the first char
          i++;
        }
        nums.push(+d.substring(start, i));
      }
    }
    flush();
    return out;
  }

  function bboxOf(parts) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    for (var i = 0; i < parts.length; i++) {
      var r = parts[i];
      for (var j = 0; j < r.length; j++) {
        var p = r[j];
        if (p[0] < b[0]) b[0] = p[0];
        if (p[1] < b[1]) b[1] = p[1];
        if (p[0] > b[2]) b[2] = p[0];
        if (p[1] > b[3]) b[3] = p[1];
      }
    }
    return b;
  }

  // Even-odd over every ring, so holes (Lesotho inside South Africa) work.
  function inRings(rings, x, y) {
    var inside = false;
    for (var k = 0; k < rings.length; k++) {
      var r = rings[k];
      for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
        var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  }

  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var len = dx * dx + dy * dy;
    var t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var qx = ax + t * dx - px, qy = ay + t * dy - py;
    return Math.sqrt(qx * qx + qy * qy);
  }

  // Shortest distance from a point to the edges of rings (closed) or lines.
  function distTo(parts, x, y, closed) {
    var best = Infinity;
    for (var k = 0; k < parts.length; k++) {
      var r = parts[k];
      var last = closed ? r.length : r.length - 1;
      for (var i = 0; i < last; i++) {
        var a = r[i], b = r[(i + 1) % r.length];
        var d = segDist(x, y, a[0], a[1], b[0], b[1]);
        if (d < best) best = d;
      }
    }
    return best;
  }

  // The point of `parts` nearest to (x, y) - used to measure a miss.
  function nearestPoint(parts, x, y) {
    var best = null, bestD = Infinity;
    for (var k = 0; k < parts.length; k++) {
      var r = parts[k];
      for (var i = 0; i < r.length; i++) {
        var dx = r[i][0] - x, dy = r[i][1] - y;
        var d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = r[i]; }
      }
    }
    return best;
  }

  // Map units -> longitude/latitude. Latitude inverts Patterson with Newton.
  function toLonLat(x, y) {
    var target = -y / UNIT * Math.PI / 180;
    var phi = target;
    for (var i = 0; i < 10; i++) {
      var p2 = phi * phi;
      var f = phi * (1.0148 + p2 * p2 * (0.23185 + p2 * (-0.14499 + 0.02406 * p2))) - target;
      var df = 1.0148 + p2 * p2 * (5 * 0.23185 + p2 * (7 * -0.14499 + 9 * 0.02406 * p2));
      phi -= f / df;
    }
    var lon = x / UNIT;
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    return [lon, phi * 180 / Math.PI];
  }

  function km(a, b) {
    var r = Math.PI / 180;
    var p = toLonLat(a[0], a[1]), q = toLonLat(b[0], b[1]);
    var s = Math.sin((q[1] - p[1]) * r / 2), t = Math.sin((q[0] - p[0]) * r / 2);
    var h = s * s + Math.cos(p[1] * r) * Math.cos(q[1] * r) * t * t;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function boxHas(b, x, y, slop) {
    return x >= b[0] - slop && x <= b[2] + slop && y >= b[1] - slop && y <= b[3] + slop;
  }

  return {
    UNIT: UNIT,
    parse: parse,
    bboxOf: bboxOf,
    inRings: inRings,
    distTo: distTo,
    nearestPoint: nearestPoint,
    toLonLat: toLonLat,
    km: km,
    boxHas: boxHas,
  };
})();
