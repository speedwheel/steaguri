// Pictures for the logic game. Shapes, a robot's grid, balance scales, cube
// stacks, folded paper and the figures to count shapes in. Like the maths
// pictures, everything is a string built from plain data, so a question stays
// data and is drawn only when it is shown.
//
// A token is one picture on a board, written as "shape|colour|size|fill|turn|count":
//   shape   circle square triangle star heart diamond pent hex rect trap para
//           arrow - or box (a dot moving round a frame), quad (four coloured
//           quarters), lines (strokes in a square, for overlay puzzles)
//   colour  r b y g p o k; a quad carries four of them, one per quarter
//   size    1 big, 0 small
//   fill    1 solid, 0 empty
//   turn    degrees clockwise
//   count   0 = one shape; n = a little group of n shapes (dice layout).
//           box: the dot's position round the frame; lines: a bit mask
window.LogicPics = (function () {
  var COL = {
    r: ['#ff5d73', '#c2304a'],
    b: ['#3d8bfd', '#1f5bc0'],
    y: ['#ffd23f', '#c48f00'],
    g: ['#2fc46b', '#167a3f'],
    p: ['#a06bff', '#6b3fc4'],
    o: ['#ff9f1c', '#bd6500'],
    k: ['#4b4570', '#17123a'],
  };

  function r1(v) { return Math.round(v * 10) / 10; }

  function parse(t) {
    var p = String(t).split('|');
    return { s: p[0], c: p[1], z: +p[2], f: +p[3], r: +p[4], n: +p[5] };
  }
  function key(o) { return [o.s, o.c, o.z, o.f, o.r, o.n].join('|'); }

  // ------------------------------------------------------------ shapes

  function points(list) {
    return '<polygon points="' + list.map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ') + '"/>';
  }
  function ngon(n, R, rot) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = (rot || 0) + i * 2 * Math.PI / n;
      out.push([R * Math.sin(a), -R * Math.cos(a)]);
    }
    return points(out);
  }
  function starShape(R, r) {
    var out = [];
    for (var i = 0; i < 10; i++) {
      var a = i * Math.PI / 5, d = i % 2 ? r : R;
      out.push([d * Math.sin(a), -d * Math.cos(a) + 4]);
    }
    return points(out);
  }

  // Drawn round 0,0 inside a 100 x 100 box.
  var SHAPE = {
    circle: '<circle r="38"/>',
    square: '<rect x="-34" y="-34" width="68" height="68" rx="5"/>',
    triangle: points([[0, -40], [43, 34], [-43, 34]]),
    star: starShape(46, 19),
    heart: '<path d="M0 40C-30 20-46 4-46-14c0-16 12-26 24-26 10 0 18 6 22 14 4-8 12-14 22-14 12 0 24 10 24 26 0 18-16 34-46 54z"/>',
    diamond: points([[0, -45], [34, 0], [0, 45], [-34, 0]]),
    pent: ngon(5, 42),
    hex: ngon(6, 41, Math.PI / 6),
    rect: '<rect x="-45" y="-26" width="90" height="52" rx="4"/>',
    trap: points([[-24, -28], [24, -28], [45, 28], [-45, 28]]),
    para: points([[-18, -28], [45, -28], [18, 28], [-45, 28]]),
    arrow: '<path d="M0-45 35-6H13v48h-26V-6h-22z"/>',
  };

  function shapeG(s, c, k, f, r, x, y) {
    var col = COL[c] || COL.k;
    var sw = r1((f ? 5 : 9) / k);
    return '<g transform="translate(' + r1(x) + ' ' + r1(y) + ') rotate(' + r + ') scale(' + k + ')" fill="' +
      (f ? col[0] : '#fff') + '" stroke="' + col[1] + '" stroke-width="' + sw + '" stroke-linejoin="round">' +
      SHAPE[s] + '</g>';
  }

  // Dice layouts, so a small count reads at a glance.
  var DICE = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    7: [[-1, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [1, 1]],
    8: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
    9: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
  };

  // Round a 3 x 3 frame, clockwise from the top-left corner.
  var RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];

  function boxG(o) {
    var p = RING[((o.n % 8) + 8) % 8], col = COL[o.c] || COL.k;
    return '<rect x="-42" y="-42" width="84" height="84" rx="8" fill="#fff" stroke="#17123a" stroke-width="5"/>' +
      '<path d="M-14-42v84M14-42v84M-42-14h84M-42 14h84" stroke="rgba(23,18,58,.16)" stroke-width="2"/>' +
      '<circle cx="' + p[0] * 28 + '" cy="' + p[1] * 28 + '" r="11" fill="' + col[0] + '" stroke="' + col[1] + '" stroke-width="3"/>';
  }

  // Quarters clockwise from the top-left: "rbyg".
  function quadG(o) {
    var at = [[-40, -40], [0, -40], [0, 0], [-40, 0]], s = '';
    for (var i = 0; i < 4; i++) {
      var ch = o.c.charAt(i), fill = COL[ch] ? COL[ch][0] : '#fff';
      s += '<rect x="' + at[i][0] + '" y="' + at[i][1] + '" width="40" height="40" fill="' + fill + '"/>';
    }
    return s + '<rect x="-40" y="-40" width="80" height="80" rx="3" fill="none" stroke="#17123a" stroke-width="5"/>' +
      '<path d="M0-40v80M-40 0h80" stroke="#17123a" stroke-width="3"/>';
  }

  var LINES = [
    'M-38-38H38', 'M38-38V38', 'M-38 38H38', 'M-38-38V38',
    'M-38-38 38 38', 'M38-38-38 38', 'M0-38V38', 'M-38 0H38',
  ];
  function linesG(o) {
    var s = '<rect x="-38" y="-38" width="76" height="76" fill="#fff" stroke="rgba(23,18,58,.22)" stroke-width="2" stroke-dasharray="5 5"/>';
    var d = '';
    for (var i = 0; i < LINES.length; i++) if (o.n & (1 << i)) d += LINES[i];
    if (d) s += '<path d="' + d + '" fill="none" stroke="#17123a" stroke-width="8" stroke-linecap="round"/>';
    if (o.n & 256) s += '<circle r="13" fill="' + COL.p[0] + '" stroke="' + COL.p[1] + '" stroke-width="4"/>';
    return s;
  }

  function groupG(o) {
    var s = '', pos = DICE[o.n] || DICE[1];
    for (var i = 0; i < pos.length; i++) s += shapeG(o.s, o.c, 0.3, o.f, o.r, pos[i][0] * 29, pos[i][1] * 29);
    return s;
  }

  function tokG(t) {
    var o = typeof t === 'string' ? parse(t) : t;
    if (o.s === 'box') return boxG(o);
    if (o.s === 'quad') return quadG(o);
    if (o.s === 'lines') return linesG(o);
    if (o.n > 0) return groupG(o);
    return shapeG(o.s, o.c, o.z ? 1 : 0.56, o.f, o.r, 0, 0);
  }

  function tok(t, cls) {
    return '<svg class="lg-tok' + (cls ? ' ' + cls : '') + '" viewBox="-50 -50 100 100" aria-hidden="true">' + tokG(t) + '</svg>';
  }

  // ------------------------------------------------- coloured pixel grids

  // "3:rr.b..yy." - side, then the cells row by row; '.' is blank paper.
  function pix(str, cls) {
    var p = String(str).split(':'), n = +p[0], cells = p[1], S = 100 / n, s = '';
    s += '<rect x="0" y="0" width="100" height="100" fill="#fff"/>';
    for (var i = 0; i < cells.length; i++) {
      var ch = cells.charAt(i);
      if (!COL[ch]) continue;
      s += '<rect x="' + r1((i % n) * S) + '" y="' + r1(Math.floor(i / n) * S) + '" width="' + r1(S) + '" height="' + r1(S) + '" fill="' + COL[ch][0] + '"/>';
    }
    var d = '';
    for (var k = 1; k < n; k++) d += 'M' + r1(k * S) + ' 0V100M0 ' + r1(k * S) + 'H100';
    s += '<path d="' + d + '" stroke="rgba(23,18,58,.28)" stroke-width="1.5"/>';
    s += '<rect x="0" y="0" width="100" height="100" rx="3" fill="none" stroke="#17123a" stroke-width="4"/>';
    return '<svg class="lg-pix' + (cls ? ' ' + cls : '') + '" viewBox="-3 -3 106 106" aria-hidden="true">' + s + '</svg>';
  }

  // ------------------------------------------------------ polyominoes

  // "p:0,0;1,0;1,1" - a colour, then the squares of the piece.
  function poly(str, cls) {
    var p = String(str).split(':'), col = COL[p[0]] || COL.p;
    var cells = p[1].split(';').map(function (c) { var v = c.split(','); return [+v[0], +v[1]]; });
    var minx = 99, miny = 99, maxx = -99, maxy = -99;
    cells.forEach(function (c) {
      minx = Math.min(minx, c[0]); maxx = Math.max(maxx, c[0]);
      miny = Math.min(miny, c[1]); maxy = Math.max(maxy, c[1]);
    });
    var w = maxx - minx + 1, h = maxy - miny + 1, U = 84 / Math.max(w, h, 3);
    var ox = 50 - w * U / 2, oy = 50 - h * U / 2, s = '';
    cells.forEach(function (c) {
      s += '<rect x="' + r1(ox + (c[0] - minx) * U) + '" y="' + r1(oy + (c[1] - miny) * U) + '" width="' + r1(U) + '" height="' + r1(U) + '" rx="2"/>';
    });
    return '<svg class="lg-poly' + (cls ? ' ' + cls : '') + '" viewBox="0 0 100 100" aria-hidden="true"><g fill="' + col[0] +
      '" stroke="' + col[1] + '" stroke-width="3" stroke-linejoin="round">' + s + '</g></svg>';
  }

  // ---------------------------------------------------- robot commands

  var ARROW_ROT = { U: 0, R: 90, D: 180, L: 270 };
  function cmdIcon(ch) {
    var body;
    if (ARROW_ROT[ch] !== undefined) {
      body = '<g transform="rotate(' + ARROW_ROT[ch] + ')"><path d="M0-15 13 0H5v15H-5V0h-8z"/></g>';
    } else if (ch === 'f') {
      body = '<path d="M0-15 13 0H5v15H-5V0h-8z"/>';
    } else {
      // Turn on the spot: a curled arrow, mirrored for a left turn.
      body = '<g transform="scale(' + (ch === 'l' ? -1 : 1) + ' 1)"><path d="M-9 12V-1a8 8 0 0 1 8-8h5" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M3-17 14-9 3-1z"/></g>';
    }
    return '<svg class="lg-cmd-i" viewBox="-18 -18 36 36" aria-hidden="true" fill="currentColor">' + body + '</svg>';
  }

  // A code as a strip of arrow chips. Runs of the same arrow stay separate,
  // so counting them is part of reading the code.
  function cmds(str, cls) {
    var s = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      s += '<i class="lg-cmd is-' + (ARROW_ROT[ch] !== undefined ? 'go' : ch === 'f' ? 'fwd' : 'turn') + '">' + cmdIcon(ch) + '</i>';
    }
    return '<span class="lg-cmds' + (cls ? ' ' + cls : '') + '">' + s + '</span>';
  }

  // A facing direction, when it matters, is a pointer on that side of it.
  function robot(dir) {
    return '<svg class="lg-robot" viewBox="-50 -50 100 100" aria-hidden="true">' +
      (dir ? '<g transform="rotate(' + ARROW_ROT[dir] + ')"><path d="M0-50 15-36H-15z" fill="#ff5d73" stroke="#17123a" stroke-width="4" stroke-linejoin="round"/></g>' : '') +
      '<g>' +
      (dir ? '' : '<path d="M0-30v-9" stroke="#17123a" stroke-width="4"/><circle cx="0" cy="-42" r="6" fill="#ff5d73" stroke="#17123a" stroke-width="3"/>') +
      '<rect x="-34" y="-30" width="68" height="64" rx="16" fill="#4cc9f0" stroke="#17123a" stroke-width="5"/>' +
      '<circle cx="-14" cy="-5" r="9" fill="#fff" stroke="#17123a" stroke-width="3.5"/><circle cx="14" cy="-5" r="9" fill="#fff" stroke="#17123a" stroke-width="3.5"/>' +
      '<circle cx="-14" cy="-6" r="4" fill="#17123a"/><circle cx="14" cy="-6" r="4" fill="#17123a"/>' +
      '<path d="M-11 17q11 7 22 0" fill="none" stroke="#17123a" stroke-width="4.5" stroke-linecap="round"/>' +
      '</g></svg>';
  }

  function goal() {
    return '<svg class="lg-goal" viewBox="-50 -50 100 100" aria-hidden="true">' + shapeG('star', 'y', 0.78, 1, 0, 0, 0) + '</svg>';
  }

  // ------------------------------------------------- figures to count in

  // A rectangle of m x n unit squares.
  function gridFig(m, n) {
    var U = 50, W = m * U, H = n * U, d = '';
    for (var i = 0; i <= m; i++) d += 'M' + i * U + ' 0V' + H;
    for (var j = 0; j <= n; j++) d += 'M0 ' + j * U + 'H' + W;
    return '<svg class="lg-fig" viewBox="-6 -6 ' + (W + 12) + ' ' + (H + 12) + '" aria-hidden="true"><rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff"/>' +
      '<path d="' + d + '" fill="none" stroke="#17123a" stroke-width="5" stroke-linecap="round"/></svg>';
  }

  // A triangle with k lines from the top corner to the base, cut across by
  // h lines parallel to the base.
  function fanFig(k, h) {
    var A = [110, 8], B = [8, 180], C = [212, 180], d = '';
    d += 'M' + A + 'L' + B + 'L' + C + 'Z';
    for (var i = 1; i <= k; i++) {
      var x = B[0] + (C[0] - B[0]) * i / (k + 1);
      d += 'M' + A + 'L' + r1(x) + ' ' + B[1];
    }
    for (var j = 1; j <= h; j++) {
      var t = j / (h + 1), y = A[1] + (B[1] - A[1]) * t;
      d += 'M' + r1(A[0] - (A[0] - B[0]) * t) + ' ' + r1(y) + 'H' + r1(A[0] + (C[0] - A[0]) * t);
    }
    return '<svg class="lg-fig is-fan" viewBox="0 0 220 188" aria-hidden="true"><path d="' + 'M' + A + 'L' + B + 'L' + C + 'Z' + '" fill="#fff"/>' +
      '<path d="' + d + '" fill="none" stroke="#17123a" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  // ------------------------------------------------------- cube stacks

  // rows[0] is the front row; each row lists stack heights left to right.
  // An isometric view from the front right: every cube shows its top, its
  // front and its right side. Drawn back to front, left to right, bottom to
  // top, so nearer cubes cover the ones behind exactly as real blocks would.
  function cubes(rows) {
    var S = 40, C = S * 0.866, H = S * 0.5, faces = '';
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    function pt(x, y, z) {
      var X = r1((x + y) * C), Y = r1((x - y) * H - z * S);
      minX = Math.min(minX, X); maxX = Math.max(maxX, X);
      minY = Math.min(minY, Y); maxY = Math.max(maxY, Y);
      return X + ' ' + Y;
    }
    function face(cls, a, b, c, d) { return '<path class="' + cls + '" d="M' + a + 'L' + b + 'L' + c + 'L' + d + 'z"/>'; }
    for (var y = rows.length - 1; y >= 0; y--) {
      for (var x = 0; x < rows[y].length; x++) {
        for (var z = 0; z < rows[y][x]; z++) {
          faces +=
            face('cb-t', pt(x, y, z + 1), pt(x + 1, y, z + 1), pt(x + 1, y + 1, z + 1), pt(x, y + 1, z + 1)) +
            face('cb-f', pt(x, y, z), pt(x + 1, y, z), pt(x + 1, y, z + 1), pt(x, y, z + 1)) +
            face('cb-r', pt(x + 1, y, z), pt(x + 1, y + 1, z), pt(x + 1, y + 1, z + 1), pt(x + 1, y, z + 1));
        }
      }
    }
    return '<svg class="lg-cubes" viewBox="' + r1(minX - 4) + ' ' + r1(minY - 4) + ' ' + r1(maxX - minX + 8) + ' ' + r1(maxY - minY + 8) +
      '" aria-hidden="true">' + faces + '</svg>';
  }

  // ------------------------------------------------------ folded paper

  // n x n spots a hole can be punched in.
  function paper(holes, n, cls) {
    var U = 100 / n, s = '<rect x="0" y="0" width="100" height="100" rx="3" class="pp"/>';
    String(holes).split(';').forEach(function (h) {
      if (!h) return;
      var v = h.split(',');
      s += '<circle class="pp-hole" cx="' + r1((+v[0] + 0.5) * U) + '" cy="' + r1((+v[1] + 0.5) * U) + '" r="' + r1(U * 0.26) + '"/>';
    });
    return '<svg class="lg-paper' + (cls ? ' ' + cls : '') + '" viewBox="-3 -3 106 106" aria-hidden="true">' + s + '</svg>';
  }

  // The fold, then the folded paper with its hole: v folds the left half
  // over the right, h the top half down, q does both.
  function fold(kind, hole, n) {
    var U = 100 / n, hx = (hole[0] + 0.5) * U, hy = (hole[1] + 0.5) * U;
    var full = '<rect x="0" y="0" width="100" height="100" rx="3" class="pp"/>', folded, arrow;
    if (kind === 'v') {
      full += '<path class="pp-fold" d="M50-4V104"/>';
      arrow = '<path class="pp-arrow" d="M22 32C30 14 70 14 78 32"/><path class="pp-arrow-h" d="M84 26 80 40 70 32z"/>';
      folded = '<rect x="50" y="0" width="50" height="100" rx="3" class="pp is-double"/>';
    } else if (kind === 'h') {
      full += '<path class="pp-fold" d="M-4 50H104"/>';
      arrow = '<path class="pp-arrow" d="M68 22C86 30 86 70 68 78"/><path class="pp-arrow-h" d="M74 84 60 80 68 70z"/>';
      folded = '<rect x="0" y="50" width="100" height="50" rx="3" class="pp is-double"/>';
    } else {
      full += '<path class="pp-fold" d="M50-4V104M-4 50H104"/>';
      arrow = '<path class="pp-arrow" d="M22 32C30 14 70 14 78 32"/><path class="pp-arrow-h" d="M84 26 80 40 70 32z"/>' +
        '<path class="pp-arrow" d="M68 58C86 64 86 82 72 90"/><path class="pp-arrow-h" d="M78 96 64 92 72 82z"/>';
      folded = '<rect x="50" y="50" width="50" height="50" rx="3" class="pp is-double"/>';
    }
    folded += '<circle class="pp-hole" cx="' + r1(hx) + '" cy="' + r1(hy) + '" r="' + r1(U * 0.26) + '"/>';
    return '<svg class="lg-paper" viewBox="-6 -6 112 112" aria-hidden="true">' + full + arrow + '</svg>' +
      '<svg class="lg-step" viewBox="-12 -12 24 24" aria-hidden="true"><path d="M-8 0h14M1-6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<svg class="lg-paper" viewBox="-6 -6 112 112" aria-hidden="true">' + folded + '</svg>';
  }

  // ------------------------------------------------------ balance scale

  // left / right: lists of tokens ('?' marks the side being asked about).
  // tilt: -1 the left pan is heavier, 1 the right one, 0 they balance.
  function scale(left, right, tilt) {
    var deg = tilt * 9, a = deg * Math.PI / 180, L = 80;
    var lx = 120 - L * Math.cos(a), ly = 44 - L * Math.sin(a);
    var rx = 120 + L * Math.cos(a), ry = 44 + L * Math.sin(a);
    function pan(x, y, items) {
      var s = '<path class="sc-cord" d="M' + r1(x) + ' ' + r1(y) + 'L' + r1(x - 40) + ' ' + r1(y + 44) + 'M' + r1(x) + ' ' + r1(y) + 'L' + r1(x + 40) + ' ' + r1(y + 44) + '"/>';
      s += '<path class="sc-pan" d="M' + r1(x - 46) + ' ' + r1(y + 44) + 'h92c-4 12-14 16-24 16h-44c-10 0-20-4-24-16z"/>';
      var n = items.length, per = n > 3 ? Math.ceil(n / 2) : n, size = n > 3 ? 27 : 32;
      items.forEach(function (t, i) {
        var row = Math.floor(i / per), col = i % per, inRow = Math.min(per, n - row * per);
        var cx = x + (col - (inRow - 1) / 2) * (size + 2), cy = y + 44 - size / 2 - 1 - row * (size + 1);
        if (t === '?') {
          s += '<g transform="translate(' + r1(cx) + ' ' + r1(cy - 2) + ')"><circle r="15" class="sc-ask"/><text class="sc-ask-t" y="7">?</text></g>';
        } else {
          s += '<g transform="translate(' + r1(cx) + ' ' + r1(cy) + ') scale(' + r1(size / 100 * 1.12) + ')">' + tokG(t) + '</g>';
        }
      });
      return s;
    }
    return '<svg class="lg-scale" viewBox="-10 -40 260 216" aria-hidden="true">' +
      '<path class="sc-stand" d="M120 44V162M88 170h64l-10-10h-44z"/>' +
      '<path class="sc-beam" d="M' + r1(lx) + ' ' + r1(ly) + 'L' + r1(rx) + ' ' + r1(ry) + '"/>' +
      '<circle class="sc-pivot" cx="120" cy="44" r="7"/>' +
      pan(lx, ly, left) + pan(rx, ry, right) + '</svg>';
  }

  return {
    COL: COL,
    parse: parse,
    key: key,
    tok: tok,
    tokG: tokG,
    pix: pix,
    poly: poly,
    cmds: cmds,
    robot: robot,
    goal: goal,
    gridFig: gridFig,
    fanFig: fanFig,
    cubes: cubes,
    paper: paper,
    fold: fold,
    scale: scale,
  };
})();
