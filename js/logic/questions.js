// The logic curriculum, ages 7-10: patterns, the odd one out, grids and
// sudoku, space (a robot, mirrors, turning pieces, cubes, folded paper) and
// detective puzzles (who is tallest, balance scales, queues, who has which
// pet). The kind of thinking found in the Cangurul and Comper contests, a
// step at a time.
//
// Built like the maths curriculum: every mode is a list of stages, a stage
// opens at a level and stays in the mix afterwards.
//
// A generator returns a question:
//   key     identity of the puzzle (no repeats, the missed list)
//   ask     prompt: a string key, or a function returning the sentence
//   board   what is on the card - see LogicGame.board for the kinds
//   answer  a value; options and answers compare as strings
//   opt     how an option is drawn: tok, pix, poly, cmd, paper, num, text
//   show    for text options: value -> label, looked up when it is drawn
//   kind    pick (default) or tap (the answer is tapped on the board itself)
//   wrong   likely wrong answers, before any filler
//   why     a sentence shown after a miss; whyPic a picture with it
//   toks    tokens drawn inline in ask / why, as {a} {b} {c}
//   tm      timer multiplier, for puzzles that take longer to read
window.LogicQ = (function () {
  var MAX_LEVEL = 30;
  var P = window.LogicPics;

  // ------------------------------------------------------------ helpers

  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function chance(p) { return Math.random() < p; }
  function shuffle(arr) { return window.Game.shuffle(arr); }
  function some(arr, n) { return shuffle(arr).slice(0, n); }
  function T(k) { return window.T(k); }
  function val(a) { return typeof a === 'function' ? a() : a; }
  function assign(o, extra) { for (var k in extra) o[k] = extra[k]; return o; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function mod(a, n) { return ((a % n) + n) % n; }

  // A sentence from a string key, filled in only when it is shown, so a
  // language switch in the middle of a run still reads right.
  function say(key, args) {
    return function () {
      return T(key).replace(/\{(\d)\}/g, function (_, i) { return val((args || [])[+i]); });
    };
  }

  // A string that has a masculine and a feminine form in Romanian.
  function g(key, kid) {
    var v = T(key);
    return typeof v === 'string' ? v : v[kid[1]];
  }

  function listOf(words) {
    var w = words.map(val);
    return w.slice(0, -1).join(', ') + ' ' + T('lg_and') + ' ' + w[w.length - 1];
  }

  var SH = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'];
  var CO = ['r', 'b', 'y', 'g', 'p', 'o'];

  function tk(s, c, o) {
    o = o || {};
    return [s, c, o.z === undefined ? 1 : o.z, o.f === undefined ? 1 : o.f, o.r || 0, o.n || 0].join('|');
  }
  function alter(t, field, v) { var o = P.parse(t); o[field] = v; return P.key(o); }
  function attr(t, field) { return P.parse(t)[field]; }

  // Near misses for a token answer: the same thing in another colour or
  // shape, flipped in size or fill.
  function tokVariants(t) {
    var o = P.parse(t), out = [];
    if (o.s === 'box' || o.s === 'quad' || o.s === 'lines') return out;
    shuffle(CO).forEach(function (c) { if (c !== o.c) out.push(alter(t, 'c', c)); });
    if (SH.indexOf(o.s) !== -1) shuffle(SH).forEach(function (s) { if (s !== o.s) out.push(alter(t, 's', s)); });
    return shuffle(out);
  }

  // How many things on an odd-one-out board.
  function setSize(L) { return L < 10 ? 4 : L < 20 ? 5 : 6; }

  // ------------------------------------------------------------ patterns

  // A repeating unit shown `shown` long, with one place asked.
  function repeatQ(unit, shown, at, extra) {
    var items = [];
    for (var i = 0; i < shown; i++) items.push(unit[i % unit.length]);
    if (at === undefined) at = shown - 1;
    var answer = items[at];
    items[at] = null;
    return assign({
      key: 'pt:' + unit.join(',') + '@' + at + '/' + shown,
      ask: at === shown - 1 ? 'la_next' : 'la_gap',
      board: { t: 'row', items: items },
      answer: answer,
      opt: 'tok',
      wrong: unit.filter(function (u) { return u !== answer; }),
      why: say('lw_repeat'),
      whyPic: { t: 'unit', rows: [unit] },
    }, extra);
  }

  // A sequence where every place is computed: f(i) -> token.
  function ruleQ(f, shown, at, extra) {
    var items = [];
    for (var i = 0; i < shown; i++) items.push(f(i));
    var answer = items[at];
    items[at] = null;
    return assign({
      key: 'pt:' + items.join(',') + '@' + at,
      ask: at === shown - 1 ? 'la_next' : 'la_gap',
      board: { t: 'row', items: items },
      answer: answer,
      opt: 'tok',
    }, extra);
  }

  var QUAD_SHAPES = [[0, 1, 1, 1], [0, 0, 1, 1], [0, 1, 2, 1], [0, 1, 2, 2], [0, 0, 1, 2]];
  function quadTok(cells) { return 'quad|' + cells + '|1|1|0|0'; }
  function quadCw(s) { return s.charAt(3) + s.slice(0, 3); }
  function quadCcw(s) { return s.slice(1) + s.charAt(0); }
  function quadFlip(s) { return s.charAt(1) + s.charAt(0) + s.charAt(3) + s.charAt(2); }

  var PATTERNS = [
    { from: 1, key: 'pt_color', gen: function () {
      var s = pick(SH), cs = some(CO, 3);
      return repeatQ([tk(s, cs[0]), tk(s, cs[1])], rnd(5, 7), undefined, { more: [tk(s, cs[2])] });
    } },
    { from: 3, key: 'pt_shape', gen: function () {
      var c0 = pick(CO), ss = some(SH, 3), cs = some(CO, 3), unit;
      switch (rnd(0, 3)) {
        case 0: unit = [tk(ss[0], c0), tk(ss[1], c0)]; break;
        case 1: unit = [tk(ss[0], c0), tk(ss[0], c0), tk(ss[1], c0)]; break;
        case 2: unit = [tk(ss[0], cs[0]), tk(ss[0], cs[1]), tk(ss[0], cs[1])]; break;
        default: unit = [tk(ss[0], cs[0]), tk(ss[1], cs[1])];
      }
      return repeatQ(unit, unit.length * 2 + rnd(1, unit.length), undefined, { more: [tk(ss[2], c0), tk(ss[2], cs[2])] });
    } },
    { from: 5, key: 'pt_three', gen: function () {
      var ss = some(SH, 4), cs = some(CO, 4);
      var unit = [tk(ss[0], cs[0]), tk(ss[1], cs[1]), tk(ss[2], cs[2])];
      return repeatQ(unit, rnd(7, 8), undefined, { more: [tk(ss[3], cs[3]), tk(ss[0], cs[1]), tk(ss[1], cs[0])] });
    } },
    // The gap is in the middle: the rule has to be read from both sides.
    { from: 8, key: 'pt_gap', gen: function () {
      var ss = some(SH, 3), cs = some(CO, 3), unit;
      switch (rnd(0, 3)) {
        case 0: unit = [tk(ss[0], cs[0]), tk(ss[1], cs[1]), tk(ss[2], cs[2])]; break;
        case 1: unit = [tk(ss[0], cs[0]), tk(ss[0], cs[0]), tk(ss[1], cs[1])]; break;
        case 2: unit = [tk(ss[0], cs[0]), tk(ss[1], cs[1]), tk(ss[1], cs[1])]; break;
        default: unit = [tk(ss[0], cs[0]), tk(ss[1], cs[1]), tk(ss[2], cs[2]), tk(ss[2], cs[2])];
      }
      var shown = unit.length === 4 ? 10 : rnd(8, 9);
      return repeatQ(unit, shown, rnd(unit.length, shown - 2), { more: [tk(ss[0], cs[1]), tk(ss[2], cs[0])] });
    } },
    // Growing groups: 1, 2, 3, 4 ... or shrinking, or two at a time.
    { from: 10, key: 'pt_grow', gen: function (c) {
      var s = pick(SH), col = pick(CO), len = rnd(4, 5), step, start;
      switch (c.L >= 14 ? rnd(0, 2) : rnd(0, 1)) {
        case 0: step = 1; start = rnd(1, 10 - len); break;
        case 1: step = -1; start = rnd(len, 9); break;
        default: step = 2; len = 4; start = rnd(1, 3);
      }
      var last = start + (len - 1) * step;
      return ruleQ(function (i) { return tk(s, col, { n: start + i * step }); }, len, len - 1, {
        wrong: [last - step, last + step, last + 2 * step, last - 2 * step].filter(function (n) { return n >= 1 && n <= 9; })
          .map(function (n) { return tk(s, col, { n: n }); }),
        more: [tk(s, col, { n: last === 1 ? 2 : 1 })],
        why: say(step > 0 ? 'lw_grow' : 'lw_shrink', [Math.abs(step)]),
      });
    } },
    { from: 12, key: 'pt_turn', gen: function (c) {
      var step = c.L >= 20 && chance(0.5) ? 45 : 90, dir = chance(0.5) ? 1 : -1;
      var r0 = rnd(0, 7) * 45, len = rnd(5, 6), col = pick(CO);
      function at(i) { return tk('arrow', col, { r: mod(r0 + i * step * dir, 360) }); }
      var k = len - 1;
      return ruleQ(at, len, k, {
        wrong: [at(k - 1), at(k + 1), at(k + 2), alter(at(k), 'r', mod(r0 + k * step * dir + 180, 360))],
        why: say(dir > 0 ? 'lw_turnCw' : 'lw_turnCcw'),
      });
    } },
    // Two rules at once: shapes repeat every 3, colours every 2 (or the
    // other way round). The answer only fits both.
    { from: 15, key: 'pt_two', gen: function () {
      var ss = some(SH, 3), cs = some(CO, 3), flip = chance(0.5);
      var nS = flip ? 2 : 3, nC = flip ? 3 : 2;
      function at(i) { return tk(ss[i % nS], cs[i % nC]); }
      var len = rnd(7, 8), k = len - 1;
      return ruleQ(at, len, k, {
        wrong: [tk(ss[k % nS], cs[(k + 1) % nC]), tk(ss[(k + 1) % nS], cs[k % nC]), at(k - 1), tk(ss[(k + 1) % nS], cs[(k + 1) % nC])],
        why: say(flip ? 'lw_twoB' : 'lw_twoA'),
        whyPic: { t: 'unit', rows: [
          ss.slice(0, nS).map(function (s) { return tk(s, 'k'); }),
          cs.slice(0, nC).map(function (col) { return tk('circle', col, { z: 0 }); }),
        ] },
      });
    } },
    // A ball walking round a frame.
    { from: 18, key: 'pt_move', gen: function () {
      var step = pick([1, 2]), dir = chance(0.5) ? 1 : -1, p0 = rnd(0, 7), col = pick(CO);
      if (step === 2) p0 -= p0 % 2;
      function at(i) { return tk('box', col, { n: mod(p0 + i * step * dir, 8) }); }
      var len = rnd(4, 5), k = len - 1;
      return ruleQ(at, len, k, {
        wrong: [at(k - 1), at(k + 1), tk('box', col, { n: mod(p0 + (k - 2) * step * dir, 8) }), tk('box', col, { n: mod(p0 + k * step * dir + 4, 8) })],
        more: range(8).map(function (n) { return tk('box', col, { n: n }); }),
        why: say(dir > 0 ? 'lw_moveCw' : 'lw_moveCcw'),
      });
    } },
    // A square of four colours, turning a quarter each time.
    { from: 21, key: 'pt_quad', gen: function () {
      var cs = some(CO, 3), shape = pick(QUAD_SHAPES), dir = chance(0.5) ? 1 : -1;
      var s0 = shape.map(function (i) { return cs[i]; }).join('');
      var seq = [s0];
      for (var i = 1; i < 6; i++) seq.push(dir > 0 ? quadCw(seq[i - 1]) : quadCcw(seq[i - 1]));
      var len = rnd(4, 5), k = len - 1, ans = seq[k];
      return ruleQ(function (i) { return quadTok(seq[i]); }, len, k, {
        wrong: [quadTok(dir > 0 ? quadCcw(seq[k - 1]) : quadCw(seq[k - 1])), quadTok(quadFlip(ans)), quadTok(seq[k - 1]), quadTok(quadFlip(seq[k - 1]))],
        more: [quadTok(quadFlip(seq[k + 1])), quadTok(seq[k + 1])],
        why: say(dir > 0 ? 'lw_quadCw' : 'lw_quadCcw'),
      });
    } },
    // Two sequences woven together: odd places grow, even places turn.
    { from: 24, key: 'pt_alt', gen: function () {
      var s = pick(SH), col = pick(CO), cB = pick(CO.filter(function (x) { return x !== col; }));
      var a0 = rnd(1, 3), r0 = rnd(0, 3) * 90, dir = chance(0.5) ? 1 : -1;
      function at(i) {
        var j = Math.floor(i / 2);
        return i % 2 ? tk('arrow', cB, { r: mod(r0 + j * 90 * dir, 360) }) : tk(s, col, { n: a0 + j });
      }
      var len = rnd(7, 8), k = len - 1, ans = at(k);
      var wrong = k % 2
        ? [alter(ans, 'r', mod(attr(ans, 'r') + 90 * dir, 360)), alter(ans, 'r', mod(attr(ans, 'r') - 90 * dir, 360)), at(k - 1), alter(ans, 'r', mod(attr(ans, 'r') + 180, 360))]
        : [alter(ans, 'n', attr(ans, 'n') - 1), alter(ans, 'n', attr(ans, 'n') + 1), at(k - 1), at(k - 2)];
      return ruleQ(at, len, k, { wrong: wrong, why: say('lw_alt') });
    } },
    // Two rules on the same thing, and the gap anywhere.
    { from: 27, key: 'pt_mix', gen: function () {
      var cs = some(CO, 3), dir = chance(0.5) ? 1 : -1, f, why, len = rnd(6, 7);
      var kind = rnd(0, 2), p0 = rnd(0, 7), r0 = rnd(0, 3) * 90, ss = some(SH, 2);
      if (kind === 0) {
        f = function (i) { return tk('box', cs[i % 2], { n: mod(p0 + i * dir, 8) }); };
        why = 'lw_mixMove';
      } else if (kind === 1) {
        f = function (i) { return tk('arrow', cs[i % 3], { r: mod(r0 + i * 90 * dir, 360) }); };
        why = 'lw_mixTurn';
      } else {
        len = 6;
        f = function (i) { return tk(ss[i % 2], cs[0], { n: i + 1 }); };
        why = 'lw_mixGrow';
      }
      var k = rnd(3, len - 1), ans = f(k), o = P.parse(ans), wrong;
      if (kind === 0) wrong = [alter(ans, 'c', cs[(k + 1) % 2]), alter(ans, 'n', mod(o.n - 2 * dir, 8)), f(k - 1), alter(ans, 'n', mod(o.n + 4, 8))];
      else if (kind === 1) wrong = [alter(ans, 'c', cs[(k + 1) % 3]), alter(ans, 'r', mod(o.r + 180, 360)), f(k - 1), alter(ans, 'c', cs[(k + 2) % 3])];
      else wrong = [alter(ans, 's', ss[(k + 1) % 2]), alter(ans, 'n', o.n + 1), alter(ans, 'n', o.n - 1), f(k - 1)];
      return ruleQ(f, len, k, { wrong: wrong, why: say(why) });
    } },
  ];

  // ---------------------------------------------------------- odd one out

  // items[odd] is the one that does not belong; the board is shuffled.
  function oddQ(items, odd, show, why, extra) {
    var order = shuffle(range(items.length));
    var shown = order.map(function (i) { return items[i]; });
    return assign({
      key: 'od:' + shown.join(','),
      ask: 'la_odd',
      kind: 'tap',
      board: { t: 'set', items: shown, show: show },
      answer: order.indexOf(odd),
      why: why,
    }, extra);
  }

  function shapePl(s) { return function () { return T('shp_' + s); }; }
  function colourPl(c) { return function () { return T('clp_' + c); }; }

  // Word lists live in i18n.js, index-aligned across the two languages.
  var EASY_CATS = ['fruit', 'vehicle', 'clothes', 'school', 'furniture', 'body', 'music', 'colour', 'pets'];
  // Close pairs, majority first. Each odd word is never also in the majority's
  // category: no ducks among farm animals, no dolphins among wild animals.
  var HARD_PAIRS = [
    ['fruit', 'veg'], ['veg', 'fruit'], ['wild', 'pets'], ['pets', 'wild'], ['bird', 'wild'],
    ['bird', 'pets'], ['sea', 'pets'], ['sea', 'wild'], ['pets', 'sea'], ['day', 'month'],
    ['month', 'day'], ['month', 'season'], ['season', 'month'], ['music', 'tools'], ['tools', 'music'],
  ];
  function wordsOf(cat) { return T('lgw_' + cat).length; }
  function wordQ(major, odd, n) {
    var count = Math.min(n - 1, wordsOf(major));
    var items = some(range(wordsOf(major)), count).map(function (i) { return major + ':' + i; });
    items.push(odd + ':' + rnd(0, wordsOf(odd) - 1));
    return oddQ(items, items.length - 1, 'word', say('lw_allAre', [function () { return T('lgc_' + major); }]), { tm: 1.2 });
  }

  var NUMRULES = {
    even: { test: function (n) { return n % 2 === 0; }, gen: function () { return 2 * rnd(1, 49); }, miss: function () { return 2 * rnd(1, 48) + 1; } },
    odd: { test: function (n) { return n % 2 === 1; }, gen: function () { return 2 * rnd(0, 49) + 1; }, miss: function () { return 2 * rnd(1, 49); } },
    tens: { test: function (n) { return n % 10 === 0; }, gen: function () { return 10 * rnd(1, 9); }, miss: function () { return 10 * rnd(1, 9) + rnd(1, 9); } },
    same: { test: function (n) { return n > 10 && n < 100 && n % 11 === 0; }, gen: function () { return 11 * rnd(1, 9); }, miss: function () { return 11 * rnd(2, 8) + pick([-1, 1, 10, -10]); } },
    one: { test: function (n) { return n < 10; }, gen: function () { return rnd(1, 9); }, miss: function () { return rnd(10, 19); } },
    five: { test: function (n) { return n % 10 === 5; }, gen: function () { return 10 * rnd(0, 9) + 5; }, miss: function () { return 10 * rnd(1, 9) + pick([1, 2, 3, 4, 6, 7, 8]); } },
    three: { test: function (n) { return n % 3 === 0; }, gen: function () { return 3 * rnd(1, 10); }, miss: function () { var v; do { v = rnd(4, 29); } while (v % 3 === 0); return v; } },
  };

  // The one item a rule singles out, or -1: the only one failing it, or the
  // only one passing it.
  function soleOut(items, test) {
    var pass = items.filter(test).length;
    if (pass === items.length - 1) { for (var i = 0; i < items.length; i++) if (!test(items[i])) return i; }
    if (pass === 1) { for (var j = 0; j < items.length; j++) if (test(items[j])) return j; }
    return -1;
  }

  // Chiral pieces: a mirror image can never be turned into the original.
  var PIECES = [
    [[0, 0], [0, 1], [0, 2], [1, 2]],
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
    [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3]],
    [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]],
  ];
  function norm(cells) {
    var mx = Infinity, my = Infinity;
    cells.forEach(function (c) { mx = Math.min(mx, c[0]); my = Math.min(my, c[1]); });
    return cells.map(function (c) { return [c[0] - mx, c[1] - my]; })
      .sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
  }
  function cellStr(cells) { return norm(cells).map(function (c) { return c[0] + ',' + c[1]; }).join(';'); }
  function rotCells(cells, times) {
    var out = cells;
    for (var i = 0; i < times; i++) out = out.map(function (c) { return [-c[1], c[0]]; });
    return out;
  }
  function flipCells(cells) { return cells.map(function (c) { return [-c[0], c[1]]; }); }
  function polyStr(col, cells) { return col + ':' + cellStr(cells); }

  var ODD = [
    { from: 1, key: 'od_shape', gen: function (c) {
      var n = setSize(c.L), col = pick(CO), ss = some(SH, 2), items = [];
      for (var i = 0; i < n - 1; i++) items.push(tk(ss[0], col));
      items.push(tk(ss[1], col));
      return oddQ(items, n - 1, 'tok', say('lw_allAre', [shapePl(ss[0])]));
    } },
    { from: 3, key: 'od_color', gen: function (c) {
      var n = setSize(c.L), s = pick(SH), cs = some(CO, 2), items = [];
      for (var i = 0; i < n - 1; i++) items.push(tk(s, cs[0]));
      items.push(tk(s, cs[1]));
      return oddQ(items, n - 1, 'tok', say('lw_allAre', [colourPl(cs[0])]));
    } },
    { from: 5, key: 'od_words', gen: function (c) {
      var two = some(EASY_CATS, 2);
      return wordQ(two[0], two[1], setSize(c.L));
    } },
    // Everything else changes; only the size gives the odd one away.
    { from: 7, key: 'od_size', gen: function (c) {
      var n = setSize(c.L), ss = some(SH, n), cs = some(CO, n), big = chance(0.6) ? 1 : 0;
      var items = range(n).map(function (i) { return tk(ss[i], cs[i], { z: i === n - 1 ? 1 - big : big }); });
      return oddQ(items, n - 1, 'tok', say('lw_allAre', [function () { return T(big ? 'lg_bigPl' : 'lg_smallPl'); }]));
    } },
    // One property is shared and the others are all different, so there is
    // exactly one thing that breaks a pattern.
    { from: 10, key: 'od_attr', gen: function (c) {
      var n = setSize(c.L), ss = some(SH, n), cs = some(CO, n), items, why;
      switch (rnd(0, 2)) {
        case 0:
          items = range(n).map(function (i) { return tk(i === n - 1 ? ss[1] : ss[0], cs[i]); });
          why = say('lw_allAre', [shapePl(ss[0])]);
          break;
        case 1:
          items = range(n).map(function (i) { return tk(ss[i], i === n - 1 ? cs[1] : cs[0]); });
          why = say('lw_allAre', [colourPl(cs[0])]);
          break;
        default:
          var full = chance(0.6) ? 1 : 0;
          items = range(n).map(function (i) { return tk(ss[i], cs[i], { f: i === n - 1 ? 1 - full : full }); });
          why = say('lw_allAre', [function () { return T(full ? 'lg_fullPl' : 'lg_emptyPl'); }]);
      }
      return oddQ(items, n - 1, 'tok', why);
    } },
    { from: 12, key: 'od_num', gen: function (c) {
      var n = setSize(c.L), ids = ['even', 'odd', 'tens', 'same', 'one', 'five'];
      if (c.L >= 20) ids.push('three', 'three');
      for (var tries = 0; tries < 60; tries++) {
        var id = pick(ids), R = NUMRULES[id], seen = {}, items = [];
        while (items.length < n - 1) {
          var v = R.gen();
          if (!seen[v]) { seen[v] = true; items.push(v); }
        }
        var odd = R.miss();
        if (seen[odd] || R.test(odd) || odd < 1) continue;
        items.push(odd);
        // No other rule may single out a different number.
        var clash = Object.keys(NUMRULES).some(function (k) {
          var i = soleOut(items, NUMRULES[k].test);
          return i !== -1 && i !== n - 1;
        });
        if (clash) continue;
        return oddQ(items, n - 1, 'num', say('lw_allAre', [function () { return T('lgn_' + id); }]));
      }
      return ODD[0].gen(c);
    } },
    { from: 14, key: 'od_cat', gen: function (c) {
      var pair = pick(HARD_PAIRS);
      return wordQ(pair[0], pair[1], setSize(c.L));
    } },
    { from: 17, key: 'od_count', gen: function (c) {
      var n = setSize(c.L), k = rnd(3, 7), d = c.L >= 22 && chance(0.5) ? pick([-1, 1]) : pick([-2, -1, 1, 2]);
      if (k + d < 1 || k + d > 9) d = -d;
      var ss = some(SH, n), cs = some(CO, n);
      var items = range(n).map(function (i) { return tk(ss[i], cs[i], { n: i === n - 1 ? k + d : k }); });
      return oddQ(items, n - 1, 'tok', say('lw_allHave', [k]));
    } },
    { from: 20, key: 'od_mirror', gen: function (c) {
      var n = Math.min(5, setSize(c.L)), piece = pick(PIECES), col = pick(['p', 'b', 'o', 'g']);
      var rots = shuffle([0, 1, 2, 3]), items = [];
      for (var i = 0; i < n - 1; i++) items.push(polyStr(col, rotCells(piece, rots[i % 4])));
      items.push(polyStr(col, rotCells(flipCells(piece), rnd(0, 3))));
      return oddQ(items, n - 1, 'poly', say('lw_mirror'));
    } },
    { from: 23, key: 'od_sum', gen: function (c) {
      var n = setSize(c.L), S = rnd(7, 12), seen = {}, items = [];
      function expr(v) {
        var kind = c.L >= 26 ? rnd(0, 3) : 0, a, b;
        if (kind === 1 && v > 1) { a = rnd(v + 1, v + 9); return a + ' − ' + (a - v); }
        if (kind === 2) {
          var fs = [];
          for (a = 2; a <= 6; a++) if (v % a === 0 && v / a > 1) fs.push(a);
          if (fs.length) { a = pick(fs); return a + ' × ' + (v / a); }
        }
        a = rnd(1, v - 1);
        return a + ' + ' + (v - a);
      }
      for (var t = 0; items.length < n - 1 && t < 80; t++) {
        var e = expr(S);
        if (!seen[e]) { seen[e] = true; items.push(e); }
      }
      var odd;
      do { odd = expr(S + pick([-1, 1])); } while (seen[odd]);
      items.push(odd);
      return oddQ(items, items.length - 1, 'text', say('lw_allMake', [S]), { tm: 1.2 });
    } },
    { from: 26, key: 'od_sides', gen: function (c) {
      var n = setSize(c.L), cs = some(CO, n), items, k;
      if (chance(0.7)) {
        k = 4;
        var quads = shuffle(['square', 'rect', 'diamond', 'trap', 'para']);
        items = range(n - 1).map(function (i) { return tk(quads[i % 5], cs[i], { r: pick([0, 0, 90]), z: i < 5 ? 1 : 0 }); });
        items.push(tk(pick(['triangle', 'pent', 'hex']), cs[n - 1], { r: pick([0, 180]) }));
      } else {
        k = 3;
        items = range(n - 1).map(function (i) { return tk('triangle', cs[i], { r: pick([0, 90, 180, 270]), z: i % 2 }); });
        items.push(tk(pick(['trap', 'diamond', 'pent']), cs[n - 1]));
      }
      return oddQ(items, n - 1, 'tok', say('lw_allSides', [k]));
    } },
  ];

  // --------------------------------------------------------------- grids

  function latin3() {
    var base = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
    var rows = shuffle([0, 1, 2]), cols = shuffle([0, 1, 2]), sym = shuffle([0, 1, 2]);
    return rows.map(function (r) { return cols.map(function (col) { return sym[base[r][col]]; }); });
  }

  function gridQ(n, cells, at, extra) {
    var answer = cells[at];
    cells = cells.slice();
    cells[at] = null;
    return assign({
      key: 'gr:' + cells.join(',') + '@' + at,
      ask: 'la_grid',
      board: { t: 'grid', n: n, cells: cells },
      answer: answer,
      opt: 'tok',
    }, extra);
  }

  function flat(rows) { return [].concat.apply([], rows); }

  // A 4 x 4 sudoku, shuffled from one valid square.
  function sudoku4() {
    var g = [[0, 1, 2, 3], [2, 3, 0, 1], [1, 0, 3, 2], [3, 2, 1, 0]];
    var band = shuffle([0, 1]), stack = shuffle([0, 1]), sym = shuffle([0, 1, 2, 3]);
    var rows = [], cols = [];
    band.forEach(function (b) { shuffle([0, 1]).forEach(function (r) { rows.push(b * 2 + r); }); });
    stack.forEach(function (s) { shuffle([0, 1]).forEach(function (cc) { cols.push(s * 2 + cc); }); });
    var out = rows.map(function (r) { return cols.map(function (cc) { return sym[g[r][cc]]; }); });
    if (chance(0.5)) out = out[0].map(function (_, i) { return out.map(function (row) { return row[i]; }); });
    return out;
  }

  function unitCells(kind, r, c) {
    var out = [];
    for (var i = 0; i < 4; i++) {
      if (kind === 'row') out.push([r, i]);
      else if (kind === 'col') out.push([i, c]);
      else out.push([Math.floor(r / 2) * 2 + Math.floor(i / 2), Math.floor(c / 2) * 2 + i % 2]);
    }
    return out.filter(function (p) { return p[0] !== r || p[1] !== c; });
  }

  // level: 0 - one row, column or box already has the other three numbers;
  // 1 - only row, column and box together give them; 2 - the same, with
  // fewer numbers on the board.
  function sudokuQ(level, symbols, opt) {
    var g = sudoku4(), ar = rnd(0, 3), ac = rnd(0, 3), ans = g[ar][ac];
    var shown = {};
    function show(p) { shown[p[0] * 4 + p[1]] = true; }
    function given(kind) {
      return unitCells(kind, ar, ac).filter(function (p) { return shown[p[0] * 4 + p[1]]; }).length;
    }
    if (level === 0) {
      unitCells(pick(['row', 'col', 'box']), ar, ac).forEach(show);
    } else {
      // Each missing number comes from a different place - row, column, box -
      // so none of them alone gives the answer away.
      for (var t = 0; t < 12; t++) {
        shown = {};
        var units = shuffle(['row', 'col', 'box']);
        [0, 1, 2, 3].filter(function (v) { return v !== ans; }).forEach(function (v, i) {
          unitCells(units[i], ar, ac).forEach(function (p) { if (g[p[0]][p[1]] === v) show(p); });
        });
        if (given('row') < 3 && given('col') < 3 && given('box') < 3) break;
      }
    }
    var extra = level === 0 ? 5 : level === 1 ? 4 : 1;
    shuffle(range(16)).forEach(function (i) {
      if (extra <= 0 || shown[i] || i === ar * 4 + ac) return;
      shown[i] = true;
      if (level > 0 && (given('row') === 3 || given('col') === 3 || given('box') === 3)) { shown[i] = false; return; }
      extra--;
    });
    var cells = [];
    for (var i = 0; i < 16; i++) {
      var r = Math.floor(i / 4), cc = i % 4;
      cells.push(i === ar * 4 + ac ? null : shown[i] ? symbols[g[r][cc]] : '');
    }
    return {
      key: 'sd:' + cells.join(',') + '@' + ar + ',' + ac,
      ask: 'la_sudoku',
      board: { t: 'grid', n: 4, box: 2, cells: cells, hint: [ar, ac] },
      answer: symbols[ans],
      opts: symbols.slice(),
      opt: opt,
      why: say('lw_sudoku'),
      tm: 1.3,
    };
  }

  var SUDOKU_TOKS = [tk('circle', 'r'), tk('triangle', 'b'), tk('square', 'y'), tk('star', 'g')];

  // Analogy: a -> b, so c -> ?  `changes` lists what changes.
  var CHANGE = {
    colour: function (t, ctx) { return alter(t, 'c', ctx.c2); },
    size: function (t) { return alter(t, 'z', 1 - attr(t, 'z')); },
    fill: function (t) { return alter(t, 'f', 1 - attr(t, 'f')); },
    shape: function (t, ctx) { return alter(t, 's', ctx.s2); },
    turn: function (t, ctx) { return alter(t, 'r', mod(attr(t, 'r') + ctx.dr, 360)); },
  };
  function analogyQ(changes) {
    var ss = some(SH, 3), cs = some(CO, 3), has = function (ch) { return changes.indexOf(ch) !== -1; };
    var ctx = { c2: cs[1], s2: ss[1], dr: pick([90, -90, 180]) };
    var a, cc;
    if (has('turn')) {
      var r0 = rnd(0, 3) * 90, r1 = mod(r0 + pick([90, 180, 270]), 360);
      a = tk('arrow', cs[0], { r: r0 });
      cc = has('colour') ? tk('arrow', cs[0], { r: r1 }) : tk('arrow', cs[2], { r: r1 });
    } else {
      // c shares with a everything about to change, and differs from it in
      // something that stays the same.
      a = tk(ss[0], cs[0]);
      cc = !has('shape') ? alter(a, 's', ss[2]) : !has('colour') ? alter(a, 'c', cs[2]) : alter(a, 'f', 0);
    }
    function apply(t, list) { list.forEach(function (ch) { t = CHANGE[ch](t, ctx); }); return t; }
    var b = apply(a, changes), d = apply(cc, changes);
    var wrong = [cc, b];
    changes.forEach(function (ch) { wrong.push(apply(cc, changes.filter(function (x) { return x !== ch; }))); });
    if (has('colour')) wrong.push(alter(d, 'c', cs[2]));
    if (has('shape')) wrong.push(alter(d, 's', ss[2]));
    if (has('turn')) wrong.push(alter(d, 'r', mod(attr(d, 'r') + 180, 360)), alter(d, 'r', mod(attr(d, 'r') + 90, 360)));
    var names = changes.map(function (ch) { return function () { return T('lgx_' + ch); }; });
    return {
      key: 'an:' + a + '>' + b + ':' + cc,
      ask: 'la_analogy',
      board: { t: 'analogy', a: a, b: b, c: cc },
      answer: d,
      opt: 'tok',
      wrong: wrong.filter(function (w) { return w !== d; }),
      why: changes.length === 1 ? say('lw_change1', names) : say('lw_change2', names),
    };
  }

  function linesTok(mask) { return 'lines|k|1|1|0|' + mask; }
  function bits(mask) { var out = []; for (var i = 0; i <= 8; i++) if (mask & (1 << i)) out.push(1 << i); return out; }
  function randomMask(nBits, avoid) {
    var pool = shuffle(range(9).map(function (i) { return 1 << i; }).filter(function (b) { return !(avoid & b); }));
    var m = 0;
    for (var i = 0; i < nBits && i < pool.length; i++) m |= pool[i];
    return m;
  }

  var GRIDS = [
    { from: 1, key: 'gr_rows', gen: function () {
      var s = pick(SH), cs = some(CO, 3), byCol = chance(0.4), cells = [];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) cells.push(tk(s, cs[byCol ? r : c]));
      var at = byCol ? rnd(0, 2) * 3 + rnd(1, 2) : rnd(1, 2) * 3 + rnd(0, 2);
      return gridQ(3, cells, at, { why: say(byCol ? 'lw_colsSame' : 'lw_rowsSame'), more: [tk(s, pick(CO.filter(function (x) { return cs.indexOf(x) === -1; })))] });
    } },
    { from: 3, key: 'gr_latinc', gen: function () {
      var s = pick(SH), cs = some(CO, 3), sq = latin3();
      var cells = flat(sq).map(function (v) { return tk(s, cs[v]); });
      return gridQ(3, cells, rnd(0, 8), { why: say('lw_latinC') });
    } },
    { from: 5, key: 'gr_latins', gen: function () {
      var col = pick(CO), ss = some(SH, 3), sq = latin3();
      var cells = flat(sq).map(function (v) { return tk(ss[v], col); });
      var at = rnd(0, 8), ar = Math.floor(at / 3);
      var q = gridQ(3, cells, at, { why: say('lw_latinS'), more: [tk(pick(SH.filter(function (x) { return ss.indexOf(x) === -1; })), col)] });
      // A blank or two away from the asked row, so the row still gives it away.
      shuffle(range(9)).filter(function (i) { return Math.floor(i / 3) !== ar; }).slice(0, rnd(1, 2))
        .forEach(function (i) { q.board.cells[i] = ''; });
      q.key += '/' + q.board.cells.join(',');
      return q;
    } },
    { from: 7, key: 'gr_analogy', gen: function () { return analogyQ([pick(['colour', 'size', 'fill', 'shape'])]); } },
    { from: 9, key: 'gr_matrix', gen: function () {
      var ss = some(SH, 3), cs = some(CO, 3), byRow = chance(0.5), cells = [];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) cells.push(byRow ? tk(ss[r], cs[c]) : tk(ss[c], cs[r]));
      var at = chance(0.5) ? 8 : rnd(0, 8);
      var ans = cells[at];
      return gridQ(3, cells, at, {
        why: say(byRow ? 'lw_matrix' : 'lw_matrixT'),
        wrong: tokVariants(ans).filter(function (t) { return ss.indexOf(attr(t, 's')) !== -1 && cs.indexOf(attr(t, 'c')) !== -1; }),
      });
    } },
    { from: 11, key: 'gr_sudoku', gen: function () { return sudokuQ(0, [1, 2, 3, 4], 'num'); } },
    { from: 13, key: 'gr_count', gen: function () {
      var ss = some(SH, 3), cs = some(CO, 3), step = chance(0.5), cells = [];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) cells.push(tk(ss[r], cs[r], { n: step ? 1 + r + c : 1 + c }));
      var at = chance(0.6) ? 8 : rnd(3, 8), ans = cells[at], o = P.parse(ans);
      return gridQ(3, cells, at, {
        why: say(step ? 'lw_countStep' : 'lw_countCol'),
        wrong: [alter(ans, 'n', o.n + 1), alter(ans, 'n', o.n - 1), alter(ans, 's', ss[(Math.floor(at / 3) + 1) % 3]), alter(ans, 'n', o.n + 2)]
          .filter(function (t) { var n = attr(t, 'n'); return n >= 1 && n <= 9; }),
      });
    } },
    { from: 15, key: 'gr_analogy2', gen: function () {
      var pairs = [['colour', 'size'], ['colour', 'fill'], ['size', 'fill'], ['shape', 'colour'], ['turn', 'colour'], ['shape', 'size']];
      return analogyQ(pick(pairs));
    } },
    { from: 17, key: 'gr_sudokus', gen: function () { return sudokuQ(1, shuffle(SUDOKU_TOKS), 'tok'); } },
    // Numbers in rows that follow a rule the child has to find.
    { from: 20, key: 'gr_rule', gen: function () {
      var rule = pick(['sum', 'sum', 'diff', 'step', 'double']), rows = [], k = rnd(2, 5);
      for (var r = 0; r < 3; r++) {
        var a, b;
        if (rule === 'sum') { a = rnd(1, 9); b = rnd(1, 9); rows.push([a, b, a + b]); }
        else if (rule === 'diff') { a = rnd(6, 18); b = rnd(1, a - 1); rows.push([a, b, a - b]); }
        else if (rule === 'step') { a = rnd(1, 12); rows.push([a, a + k, a + 2 * k]); }
        else { a = rnd(1, 5); rows.push([a, 2 * a, 4 * a]); }
      }
      var at = 6 + (chance(0.6) ? 2 : rnd(0, 1)), cells = flat(rows), x = rows[0];
      var ans = cells[at], ra = rows[2];
      var wrong = [ans + 1, ans - 1];
      if (rule === 'sum' && at === 8) wrong.push(Math.abs(ra[0] - ra[1]));
      if (rule === 'diff' && at === 8) wrong.push(ra[0] + ra[1]);
      if (rule === 'step') wrong.push(ans + k, ans - k);
      if (rule === 'double') wrong.push(ans * 2, ans + 2);
      var why = rule === 'sum' ? say('lw_ruleSum', [x[0], x[1], x[2]])
        : rule === 'diff' ? say('lw_ruleDiff', [x[0], x[1], x[2]])
        : rule === 'step' ? say('lw_ruleStep', [k])
        : say('lw_ruleDouble');
      var q = gridQ(3, cells, at, { opt: 'num', why: why, wrong: wrong, tm: 1.2 });
      q.board.numbers = true;
      return q;
    } },
    // The third square is the first two drawn on top of each other.
    { from: 23, key: 'gr_overlay', gen: function () {
      var cells = [];
      for (var r = 0; r < 3; r++) {
        var a = randomMask(rnd(1, 2), 0), b = randomMask(rnd(1, 2), a);
        cells.push(linesTok(a), linesTok(b), linesTok(a | b));
      }
      var ab = P.parse(cells[8]).n, A = P.parse(cells[6]).n, B = P.parse(cells[7]).n;
      var wrong = [linesTok(A), linesTok(B), linesTok(ab | randomMask(1, ab))];
      bits(ab).forEach(function (bit) { wrong.push(linesTok(ab & ~bit)); });
      return gridQ(3, cells, 8, { why: say('lw_overlay'), wrong: wrong.filter(function (w) { return P.parse(w).n; }), tm: 1.2 });
    } },
    { from: 26, key: 'gr_sudokuh', gen: function () {
      return chance(0.5) ? sudokuQ(2, [1, 2, 3, 4], 'num') : sudokuQ(2, shuffle(SUDOKU_TOKS), 'tok');
    } },
    // Lines drawn twice cancel out.
    { from: 28, key: 'gr_xor', gen: function () {
      var cells = [];
      for (var r = 0; r < 3; r++) {
        var common = randomMask(1, 0), a = common | randomMask(rnd(1, 2), common), b = common | randomMask(rnd(1, 2), a);
        cells.push(linesTok(a), linesTok(b), linesTok(a ^ b));
      }
      var A = P.parse(cells[6]).n, B = P.parse(cells[7]).n, x = A ^ B;
      var wrong = [linesTok(A | B), linesTok(A & B), linesTok(A), linesTok(B)];
      return gridQ(3, cells, 8, { why: say('lw_xor'), wrong: wrong.filter(function (w) { return P.parse(w).n && P.parse(w).n !== x; }), tm: 1.3 });
    } },
  ];

  // --------------------------------------------------------------- space

  var DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  var OPP = { U: 'D', D: 'U', L: 'R', R: 'L' };

  function walk(start, code, w, h) {
    var x = start[0], y = start[1], path = [[x, y]];
    for (var i = 0; i < code.length; i++) {
      var d = DIRS[code.charAt(i)];
      x += d[0]; y += d[1];
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
      path.push([x, y]);
    }
    return path;
  }

  // A random walk that stays on the board and never steps straight back.
  function robotCode(start, len, w, h) {
    for (var t = 0; t < 50; t++) {
      var code = '', x = start[0], y = start[1], last = '';
      for (var i = 0; i < len; i++) {
        var ok = Object.keys(DIRS).filter(function (k) {
          var d = DIRS[k];
          return k !== OPP[last] && x + d[0] >= 0 && y + d[1] >= 0 && x + d[0] < w && y + d[1] < h;
        });
        // Runs of the same arrow are worth counting.
        var k = last && ok.indexOf(last) !== -1 && chance(0.4) ? last : pick(ok);
        code += k; x += DIRS[k][0]; y += DIRS[k][1]; last = k;
      }
      if (x !== start[0] || y !== start[1]) return code;
    }
    return null;
  }

  var TURN_R = { U: 'R', R: 'D', D: 'L', L: 'U' };
  var TURN_L = { U: 'L', L: 'D', D: 'R', R: 'U' };

  // Forward / turn-right / turn-left from a facing direction.
  function walkTurns(start, dir, code, w, h) {
    var x = start[0], y = start[1], d = dir, path = [[x, y]];
    for (var i = 0; i < code.length; i++) {
      var ch = code.charAt(i);
      if (ch === 'r') d = TURN_R[d];
      else if (ch === 'l') d = TURN_L[d];
      else {
        x += DIRS[d][0]; y += DIRS[d][1];
        if (x < 0 || y < 0 || x >= w || y >= h) return null;
        path.push([x, y]);
      }
    }
    return path;
  }

  function robotTap(w, h, len) {
    for (var t = 0; t < 40; t++) {
      var start = [rnd(0, w - 1), rnd(0, h - 1)], code = robotCode(start, len, w, h);
      if (!code) continue;
      var path = walk(start, code, w, h), end = path[path.length - 1];
      return {
        key: 'rb:' + start + ':' + code,
        ask: 'la_robot',
        kind: 'tap',
        board: { t: 'robot', w: w, h: h, start: start, code: code, path: path },
        answer: end[1] * w + end[0],
        why: say('lw_robot'),
        tm: 1.2,
      };
    }
    return null;
  }

  function mirrorPix(str, axis) {
    var p = str.split(':'), n = +p[0], s = p[1], out = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      out += axis === 'v' ? s.charAt(y * n + (n - 1 - x)) : s.charAt((n - 1 - y) * n + x);
    }
    return n + ':' + out;
  }
  function rotPix(str) {
    var p = str.split(':'), n = +p[0], s = p[1], out = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) out += s.charAt((n - 1 - x) * n + y);
    return n + ':' + out;
  }
  function randomPix(n, colours) {
    var s = '';
    for (var i = 0; i < n * n; i++) s += chance(0.5) ? pick(colours) : '.';
    return n + ':' + s;
  }

  function countSquares(m, n) {
    var parts = [];
    for (var s = 1; s <= Math.min(m, n); s++) parts.push((m - s + 1) * (n - s + 1));
    return parts;
  }
  function sumOf(parts) { return parts.reduce(function (a, b) { return a + b; }, 0); }

  function countQ(c) {
    var figs;
    if (c.L < 14) figs = [['sq', 2, 2], ['fan', 1, 0], ['fan', 2, 0], ['sq', 3, 1]];
    else if (c.L < 24) figs = [['sq', 3, 2], ['sq', 3, 3], ['sq', 4, 2], ['fan', 1, 1], ['fan', 2, 1], ['fan', 3, 0]];
    else figs = [['sq', 3, 3], ['sq', 4, 3], ['fan', 3, 1], ['fan', 2, 2], ['sq', 4, 2]];
    var f = pick(figs), parts, total, small;
    if (f[0] === 'sq') {
      parts = countSquares(f[1], f[2]);
      total = sumOf(parts);
      small = f[1] * f[2];
      return {
        key: 'ct:sq' + f[1] + 'x' + f[2],
        ask: 'la_countSq',
        board: { t: 'figure', svg: P.gridFig(f[1], f[2]) },
        answer: total,
        opt: 'num',
        wrong: [small, total + 1, total - 1, small + 1],
        why: parts.length > 1 ? say('lw_squares', [parts.join(' + ') + ' = ' + total]) : say('lw_squares1'),
        tm: 1.3,
      };
    }
    var m = f[1] + 1, band = m * (m + 1) / 2, list = [];
    for (var j = m; j >= 1; j--) list.push(j);
    total = band * (f[2] + 1);
    parts = f[2] ? range(f[2] + 1).map(function () { return band; }) : list;
    return {
      key: 'ct:fan' + f[1] + ',' + f[2],
      ask: 'la_countTri',
      board: { t: 'figure', svg: P.fanFig(f[1], f[2]) },
      answer: total,
      opt: 'num',
      wrong: [m * (f[2] + 1), total + 1, total - 1, band],
      why: say('lw_triangles', [parts.join(' + ') + ' = ' + total]),
      tm: 1.3,
    };
  }

  function cubesQ(c, depth) {
    var cols = depth === 1 ? rnd(3, 4) : 3, rows, tries = 0;
    do {
      rows = [];
      for (var y = 0; y < depth; y++) rows.push([]);
      for (var yy = depth - 1; yy >= 0; yy--) {
        for (var x = 0; x < cols; x++) {
          // Seen from the front right, a tower is never taller than the one
          // behind it or the one to its left - so none can hide another,
          // and every top shows. A single row needs no such rule.
          var hi = 3;
          if (depth > 1 && yy < depth - 1) hi = Math.min(hi, rows[yy + 1][x]);
          if (depth > 1 && x > 0) hi = Math.min(hi, rows[yy][x - 1]);
          var lo = depth === 3 && yy < depth - 1 && x > 0 ? 0 : 1;
          rows[yy][x] = rnd(Math.min(lo, hi), hi);
        }
      }
    } while (++tries < 30 && flat(rows).every(function (h, i, a) { return h === a[0]; }));
    var total = sumOf(flat(rows)), per = [];
    for (var b = depth - 1; b >= 0; b--) per.push(sumOf(rows[b]));
    var front = sumOf(rows[0]);
    return {
      key: 'cb:' + JSON.stringify(rows),
      ask: 'la_cubes',
      board: { t: 'figure', svg: P.cubes(rows), cls: 'is-cubes' },
      answer: total,
      opt: 'num',
      wrong: [total - 1, total + 1, total - 2, total + 2, front > 2 ? front : total + 3],
      why: depth === 1 ? say('lw_cubes1', [rows[0].join(' + ') + ' = ' + total])
        : say('lw_cubes', [per.join(' + ') + ' = ' + total]),
      tm: 1.3,
    };
  }

  function codeQ(c) {
    var w = 5, h = 4;
    for (var t = 0; t < 60; t++) {
      var start = [rnd(0, w - 1), rnd(0, h - 1)], goal = [rnd(0, w - 1), rnd(0, h - 1)];
      var dx = goal[0] - start[0], dy = goal[1] - start[1];
      if (Math.abs(dx) + Math.abs(dy) < 3 || !dx || !dy) continue;
      var moves = [];
      for (var i = 0; i < Math.abs(dx); i++) moves.push(dx > 0 ? 'R' : 'L');
      for (var j = 0; j < Math.abs(dy); j++) moves.push(dy > 0 ? 'D' : 'U');
      // Horizontal first or vertical first, kept in runs so it reads as a plan.
      var code = chance(0.5) ? moves.join('') : moves.slice().reverse().join('');
      var swap = function (s, i, ch) { return s.slice(0, i) + ch + s.slice(i + 1); };
      var cands = [];
      var k = rnd(0, code.length - 1);
      cands.push(swap(code, k, OPP[code.charAt(k)]));
      cands.push(code.slice(0, -1));
      cands.push(code + code.charAt(code.length - 1));
      cands.push(code.replace(/[UD]/g, function (m) { return OPP[m]; }));
      cands.push(code.replace(/[LR]/g, function (m) { return OPP[m]; }));
      cands.push(code.replace(/U/g, 'L').replace(/D/g, 'R'));
      var wrong = cands.filter(function (s, idx) {
        if (!s || s === code || cands.indexOf(s) !== idx) return false;
        var p = walk(start, s, w, h);
        return !p || p[p.length - 1][0] !== goal[0] || p[p.length - 1][1] !== goal[1];
      });
      if (wrong.length < 3) continue;
      return {
        key: 'rc:' + start + '>' + goal,
        ask: 'la_code',
        board: { t: 'robot', w: w, h: h, start: start, goal: goal, path: walk(start, code, w, h) },
        answer: code,
        opt: 'cmd',
        opts: [code].concat(shuffle(wrong).slice(0, 3)),
        why: say('lw_code', [Math.abs(dx), function () { return T(dx < 0 ? 'lgd_L' : 'lgd_R'); }, Math.abs(dy), function () { return T(dy < 0 ? 'lgd_U' : 'lgd_D'); }]),
        tm: 1.4,
      };
    }
    return robotTap(4, 4, 4);
  }

  function turnQ() {
    var w = 5, h = 5;
    for (var t = 0; t < 80; t++) {
      var start = [rnd(0, w - 1), rnd(0, h - 1)], dir = pick(['U', 'R', 'D', 'L']), code = '', turns = 0, fw = 0;
      var len = rnd(5, 6);
      for (var i = 0; i < len; i++) {
        var ch = (code.charAt(i - 1) === 'r' || code.charAt(i - 1) === 'l' || i === 0) ? 'f' : pick(['f', 'f', 'r', 'l']);
        code += ch;
        if (ch === 'f') fw++; else turns++;
      }
      if (!turns || fw < 3) continue;
      var path = walkTurns(start, dir, code, w, h);
      if (!path) continue;
      var end = path[path.length - 1];
      if (end[0] === start[0] && end[1] === start[1]) continue;
      return {
        key: 'rt:' + start + dir + code,
        ask: 'la_robotTurn',
        kind: 'tap',
        board: { t: 'robot', w: w, h: h, start: start, dir: dir, code: code, path: path },
        answer: end[1] * w + end[0],
        why: say('lw_robotTurn'),
        tm: 1.5,
      };
    }
    return robotTap(5, 5, 5);
  }

  function foldQ(c) {
    var kind = c.L < 24 ? pick(['v', 'h']) : pick(['v', 'h', 'q', 'q']), n = 4;
    var hx = kind === 'h' ? rnd(0, 3) : rnd(2, 3), hy = kind === 'v' ? rnd(0, 3) : rnd(2, 3);
    function holes(list) {
      var seen = {}, out = [];
      list.forEach(function (p) { var k = p[0] + ',' + p[1]; if (!seen[k]) { seen[k] = true; out.push(k); } });
      return out.sort().join(';');
    }
    var mx = 3 - hx, my = 3 - hy, ans, wrong;
    if (kind === 'v') {
      ans = holes([[hx, hy], [mx, hy]]);
      wrong = [holes([[hx, hy]]), holes([[hx, hy], [hx, my]]), holes([[hx, hy], [hx - 2, hy]]), holes([[mx, hy]]), holes([[hx, hy], [mx, my]])];
    } else if (kind === 'h') {
      ans = holes([[hx, hy], [hx, my]]);
      wrong = [holes([[hx, hy]]), holes([[hx, hy], [mx, hy]]), holes([[hx, hy], [hx, hy - 2]]), holes([[hx, my]]), holes([[hx, hy], [mx, my]])];
    } else {
      ans = holes([[hx, hy], [mx, hy], [hx, my], [mx, my]]);
      wrong = [holes([[hx, hy], [mx, hy]]), holes([[hx, hy], [hx, my]]), holes([[hx, hy], [mx, my]]), holes([[hx, hy], [hx - 2, hy], [hx, hy - 2], [hx - 2, hy - 2]])];
    }
    return {
      key: 'fd:' + kind + hx + hy,
      ask: 'la_fold',
      board: { t: 'fold', kind: kind, hole: [hx, hy], n: n },
      answer: ans,
      opt: 'paper',
      wrong: wrong.filter(function (w) { return w !== ans; }),
      why: say('lw_fold'),
      tm: 1.3,
    };
  }

  function mirrorQ(c) {
    var n = c.L < 22 ? 3 : 4, colours = c.L < 22 ? some(CO, 2) : some(CO, 3);
    var axis = c.L < 22 ? 'v' : pick(['v', 'h']);
    for (var t = 0; t < 80; t++) {
      var p = randomPix(n, colours), m = mirrorPix(p, axis);
      var other = mirrorPix(p, axis === 'v' ? 'h' : 'v'), r2 = rotPix(rotPix(p));
      var all = [m, p, other, r2];
      if (all.some(function (x, i) { return all.indexOf(x) !== i; })) continue;
      var blanks = (p.split(':')[1].match(/\./g) || []).length;
      if (blanks < n || n * n - blanks < n) continue;
      return {
        key: 'mr:' + p + axis,
        ask: 'la_mirror',
        board: { t: 'mirror', pix: p, axis: axis },
        answer: m,
        opt: 'pix',
        wrong: [p, other, r2, rotPix(p)],
        why: say(axis === 'v' ? 'lw_mirrorV' : 'lw_mirrorH'),
        tm: 1.2,
      };
    }
    return null;
  }

  function rotateQ(c) {
    if (c.L >= 27 && chance(0.6)) {
      for (var t = 0; t < 80; t++) {
        var p = randomPix(3, some(CO, 2)), rots = [p, rotPix(p), rotPix(rotPix(p)), rotPix(rotPix(rotPix(p)))];
        var flips = rots.map(function (x) { return mirrorPix(x, 'v'); });
        if (rots.some(function (x, i) { return rots.indexOf(x) !== i; })) continue;
        if (flips.some(function (x) { return rots.indexOf(x) !== -1; })) continue;
        var ans = rots[rnd(1, 3)];
        return {
          key: 'rp:' + p, ask: 'la_rotate',
          board: { t: 'shape', pix: p },
          answer: ans, opt: 'pix', opts: [ans].concat(some(flips, 3)),
          why: say('lw_rotate'), tm: 1.3,
        };
      }
    }
    var piece = pick(PIECES), col = pick(['p', 'b', 'o', 'g', 'r']), base = rotCells(piece, rnd(0, 3));
    var right = polyStr(col, base);
    shuffle([1, 2, 3]).forEach(function (k) {
      var r = polyStr(col, rotCells(base, k));
      if (right === polyStr(col, base) && r !== right) right = r;
    });
    var flipped = shuffle([0, 1, 2, 3]).map(function (k) { return polyStr(col, rotCells(flipCells(base), k)); })
      .filter(function (x, i, a) { return a.indexOf(x) === i; });
    return {
      key: 'ro:' + polyStr(col, base),
      ask: 'la_rotate',
      board: { t: 'shape', poly: polyStr(col, base) },
      answer: right,
      opt: 'poly',
      opts: [right].concat(flipped.slice(0, 3)),
      why: say('lw_rotate'),
      tm: 1.2,
    };
  }

  var SPACE = [
    { from: 1, key: 'sp_robot', gen: function () { return robotTap(3, 3, 2); } },
    { from: 3, key: 'sp_count', gen: countQ },
    { from: 5, key: 'sp_robot2', gen: function (c) { return robotTap(4, 4, c.L < 10 ? 3 : 4); } },
    { from: 7, key: 'sp_mirror', gen: mirrorQ },
    { from: 10, key: 'sp_rotate', gen: rotateQ },
    { from: 12, key: 'sp_cubes', gen: function (c) { return cubesQ(c, 1); } },
    { from: 14, key: 'sp_count2', gen: countQ },
    { from: 16, key: 'sp_code', gen: codeQ },
    { from: 18, key: 'sp_cubes2', gen: function (c) { return cubesQ(c, 2); } },
    { from: 20, key: 'sp_fold', gen: foldQ },
    { from: 22, key: 'sp_mirror2', gen: mirrorQ },
    { from: 25, key: 'sp_turn', gen: turnQ },
    { from: 27, key: 'sp_rotate2', gen: rotateQ },
    { from: 29, key: 'sp_cubes3', gen: function (c) { return cubesQ(c, 3); } },
  ];

  // ------------------------------------------------------------ reasoning

  // [name, 0 boy / 1 girl]: Romanian adjectives agree with it.
  var KIDS = [
    ['Ana', 1], ['Maria', 1], ['Ioana', 1], ['Elena', 1], ['Sofia', 1], ['Irina', 1], ['Bianca', 1],
    ['Andrei', 0], ['Matei', 0], ['Luca', 0], ['Radu', 0], ['Mihai', 0], ['Aris', 0], ['Tudor', 0],
  ];
  function kids(n) { return some(KIDS, n); }
  function nameOf(k) { return k[0]; }

  // "lui Dan" / "Anei" in Romanian, just the name in English.
  function genitive(k) {
    if (window.Store.get('lang') === 'en') return k[0];
    return k[1] && /a$/.test(k[0]) ? k[0].slice(0, -1) + 'ei' : 'lui ' + k[0];
  }
  // "al 3-lea" / "a 3-a" / "primul" / "prima"; "3rd" in English.
  function ordinal(n, k) {
    if (window.Store.get('lang') === 'en') {
      var s = n % 100 > 10 && n % 100 < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
      return n + s;
    }
    if (n === 1) return k[1] ? 'prima' : 'primul';
    return k[1] ? 'a ' + n + '-a' : 'al ' + n + '-lea';
  }

  var CMPS = ['tall', 'fast', 'old', 'sweets'];

  // People in order, most first. Each clue compares two neighbours; from
  // `mixFrom` on, some clues are turned round ("B is shorter than A").
  function orderQ(c, n, mixFrom) {
    var who = kids(n), kind = pick(CMPS), clues = [];
    for (var i = 0; i < n - 1; i++) {
      var a = who[i], b = who[i + 1], flip = c.L >= mixFrom && chance(0.5);
      clues.push(flip ? [b, 'less', a] : [a, 'more', b]);
    }
    var most = chance(0.5);
    if (n > 2) clues = shuffle(clues);
    else {
      // With two children the question is always the other way round from
      // the clue, so there is one step of thinking even at level 1.
      most = chance(0.5);
      clues = [most ? [who[1], 'less', who[0]] : [who[0], 'more', who[1]]];
    }
    var ans = most ? who[0] : who[n - 1];
    var q = n === 2 ? (most ? 'q2more' : 'q2less') : (most ? 'qmost' : 'qleast');
    return {
      key: 'or:' + kind + who.map(nameOf).join(''),
      ask: function () { return T('cmp_' + kind + '_' + q); },
      board: { t: 'story', lines: clues.map(function (cl) {
        return function () { return cl[0][0] + ' ' + g('cmp_' + kind + '_' + cl[1], cl[0]) + ' ' + cl[2][0] + '.'; };
      }) },
      answer: nameOf(ans),
      opt: 'text',
      opts: shuffle(who.map(nameOf)),
      why: say('cmp_' + kind + '_chain', [who.map(nameOf).join(', ')]),
      tm: 1.3,
    };
  }

  function scaleOrderQ(c) {
    var n = c.L >= 13 ? 4 : 3, ss = some(SH, n), cs = some(CO, n);
    var items = range(n).map(function (i) { return tk(ss[i], cs[i]); });   // heaviest first
    var scales = [];
    for (var i = 0; i < n - 1; i++) {
      scales.push(chance(0.5) ? { l: [items[i]], r: [items[i + 1]], tilt: -1 } : { l: [items[i + 1]], r: [items[i]], tilt: 1 });
    }
    var heavy = chance(0.5);
    return {
      key: 'sc:' + items.join(','),
      ask: heavy ? 'la_heaviest' : 'la_lightest',
      board: { t: 'scales', list: shuffle(scales) },
      answer: heavy ? items[0] : items[n - 1],
      opt: 'tok',
      opts: shuffle(items.slice()),
      why: say('lw_heavy'),
      whyPic: { t: 'chain', items: items },
      tm: 1.3,
    };
  }

  // Balance scales with equal weights: how many of one thing balance another.
  function balanceQ(c, hard) {
    var ss = some(SH, 3), cs = some(CO, 3);
    var A = tk(ss[0], cs[0]), B = tk(ss[1], cs[1]), C = tk(ss[2], cs[2]);
    function many(t, n) { var out = []; for (var i = 0; i < n; i++) out.push(t); return out; }
    var k = rnd(2, 3), list, ans, why, wrong, toks = { a: A, b: B, c: C };
    var variant = hard ? rnd(0, 1) : (c.L >= 19 && chance(0.5) ? 2 : 3);
    if (variant === 3) {
      var m = rnd(2, 4);
      list = [{ l: [A], r: many(B, k), tilt: 0 }, { l: many(A, m), r: ['?'], tilt: 0 }];
      ans = m * k; wrong = [m + k, k, m * k + 1, m * k - 1, m];
      why = say('lw_balTimes', [k, m, m + ' × ' + k + ' = ' + ans]);
      return balRet();
    }
    if (variant === 2) {
      var j = rnd(2, 3);
      list = [{ l: [A], r: many(B, k), tilt: 0 }, { l: [B], r: many(C, j), tilt: 0 }, { l: [A], r: ['?'], tilt: 0 }];
      ans = k * j; wrong = [k + j, k, j, ans + 1, ans - 1];
      why = say('lw_balChain', [k, j, k + ' × ' + j + ' = ' + ans]);
      toks.q = C;
      return balRet(C);
    }
    if (variant === 0) {
      // C weighs as much as A and B together, and A weighs as much as k B.
      var jj = rnd(1, 2);
      list = [{ l: [A], r: many(B, k), tilt: 0 }, { l: [C], r: [A].concat(many(B, jj)), tilt: 0 }, { l: [C], r: ['?'], tilt: 0 }];
      ans = k + jj; wrong = [k, k * jj, ans + 1, jj + 1, ans - 1];
      why = say('lw_balSum', [k, jj, ans]);
      return balRet();
    }
    // Two A weigh as much as k B ... how many B for 4 A?
    var half = rnd(2, 3);
    list = [{ l: many(A, 2), r: many(B, 2 * half), tilt: 0 }, { l: many(A, 4), r: ['?'], tilt: 0 }];
    ans = 4 * half; wrong = [2 * half, 4 + half, ans + 2, ans - 1, 2 * half + 2];
    why = say('lw_balTimes', [half, 4, '4 × ' + half + ' = ' + ans]);
    return balRet();

    function balRet(qTok) {
      return {
        key: 'bl:' + JSON.stringify(list),
        ask: 'la_balance',
        toks: assign(toks, { q: qTok || B }),
        board: { t: 'scales', list: list },
        answer: ans,
        opt: 'num',
        wrong: wrong,
        why: why,
        tm: 1.5,
      };
    }
  }

  function lineQ(c) {
    var k = kids(1)[0], variant = c.L >= 12 ? rnd(0, 2) : rnd(0, 1);
    if (variant === 0) {
      var p = rnd(3, 9);
      return {
        key: 'ln:f' + p, ask: say('lineFront', [k[0], function () { return ordinal(p, k); }, function () { return genitive(k); }]),
        board: null, answer: p - 1, opt: 'num', wrong: [p, p + 1, p - 2],
        why: say('lw_lineFront', [k[0], p, p - 1]), tm: 1.6,
      };
    }
    if (variant === 1) {
      var n = rnd(6, 12), f = rnd(2, n - 1), b = n - f + 1;
      return {
        key: 'ln:b' + n + ',' + f, ask: say('lineBack', [n, k[0], function () { return ordinal(f, k); }, function () { return g('lg_whatPlace', k); }]),
        board: null, answer: b, opt: 'num', wrong: [n - f, b + 1, f, n - f + 2],
        why: say('lw_lineBack', [n, f, b]), tm: 1.8,
      };
    }
    var fa = rnd(2, 8), fb = rnd(2, 8), tot = fa + fb - 1;
    return {
      key: 'ln:t' + fa + ',' + fb, ask: say('lineTotal', [k[0], function () { return ordinal(fa, k); }, function () { return ordinal(fb, k); }]),
      board: null, answer: tot, opt: 'num', wrong: [fa + fb, tot - 1, fa + fb + 1],
      why: say('lw_lineTotal', [k[0], fa, fb, tot]), tm: 1.8,
    };
  }

  // Legs of animals in the yard, wheels by the school. [word index, legs]
  var LEGS = { animal: [[0, 2], [1, 2], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]], wheel: [[0, 2], [1, 3], [2, 4]] };
  function legsQ(c) {
    if (c.L >= 22 && chance(0.4)) {
      var heads = rnd(3, 5), dogs = rnd(1, heads - 1), legs = 2 * heads + 2 * dogs;
      return {
        key: 'hd:' + heads + ',' + legs, ask: say('legsHeads', [heads, legs]),
        board: null, answer: dogs, opt: 'num', wrong: [heads - dogs, dogs + 1, dogs - 1, legs / 4],
        why: say('lw_heads', [heads, 2 * heads, legs, dogs]), tm: 2,
      };
    }
    var kind = chance(0.7) ? 'animal' : 'wheel', two = some(LEGS[kind], 2);
    if (two[0][1] === two[1][1] && kind === 'wheel') two = [LEGS.wheel[0], LEGS.wheel[2]];
    var n1 = rnd(2, 5), n2 = rnd(2, 5), ans = n1 * two[0][1] + n2 * two[1][1];
    var w = function (x) { return function () { return T('lgl_' + kind)[x[0]]; }; };
    return {
      key: 'lg:' + kind + n1 + two[0][0] + n2 + two[1][0],
      ask: say(kind === 'animal' ? 'legsQ' : 'wheelsQ', [n1, w(two[0]), n2, w(two[1])]),
      board: null, answer: ans, opt: 'num',
      wrong: [n1 + n2, (n1 + n2) * two[0][1], (n1 + n2) * two[1][1], ans + 2, ans - 2],
      why: function () { return n1 + ' × ' + two[0][1] + ' + ' + n2 + ' × ' + two[1][1] + ' = ' + ans; },
      tm: 1.6,
    };
  }

  // Who has which pet, who plays which instrument: clues are added until
  // exactly one arrangement fits them.
  function permutations(n) {
    if (n === 1) return [[0]];
    var out = [];
    permutations(n - 1).forEach(function (p) {
      for (var i = 0; i <= p.length; i++) out.push(p.slice(0, i).concat([n - 1]).concat(p.slice(i)));
    });
    return out;
  }
  function whoQ(n, negOnly) {
    var set = pick(['pet', 'mus']), who = kids(n), items = some(range(T('who_' + set + '_the').length), n);
    var sol = shuffle(range(n));       // person i has item sol[i]
    var asked = rnd(0, n - 1), askWho = chance(0.5);
    var cands = [];
    for (var p = 0; p < n; p++) for (var i = 0; i < n; i++) {
      if (sol[p] === i) { if (!negOnly && p !== asked) cands.push({ p: p, i: i, yes: true }); }
      else cands.push({ p: p, i: i, yes: false });
    }
    cands = shuffle(cands.filter(function (cl) { return !cl.yes; })).concat(shuffle(cands.filter(function (cl) { return cl.yes; })));
    if (!negOnly && n === 3) {
      // One positive clue keeps a three-way puzzle short enough to read.
      var pos = cands.filter(function (cl) { return cl.yes; });
      if (pos.length) cands = [pos[0]].concat(cands.filter(function (cl) { return !cl.yes; }));
    }
    var perms = permutations(n), clues = [];
    function fits(perm, list) { return list.every(function (cl) { return (perm[cl.p] === cl.i) === cl.yes; }); }
    function count(list) { return perms.filter(function (pm) { return fits(pm, list); }).length; }
    for (var k = 0; k < cands.length && count(clues) > 1; k++) clues.push(cands[k]);
    // Drop anything the puzzle does not need.
    for (var d = clues.length - 1; d >= 0; d--) {
      var without = clues.slice(0, d).concat(clues.slice(d + 1));
      if (count(without) === 1) clues = without;
    }
    var the = function (i) { return function () { return T('who_' + set + '_the')[items[i]]; }; };
    var lines = [say('who_' + set + '_intro', [function () { return listOf(who.map(nameOf)); }, function () { return listOf(items.map(function (i) { return T('who_' + set + '_a')[i]; })); }])];
    shuffle(clues).forEach(function (cl) {
      lines.push(say('who_' + set + (cl.yes ? '_has' : '_not'), [who[cl.p][0], the(cl.i)]));
    });
    var q, answer, opts, show;
    if (askWho) {
      q = say('who_' + set + '_qWho', [the(sol[asked])]);
      answer = nameOf(who[asked]);
      opts = who.map(nameOf);
    } else {
      q = say('who_' + set + '_qWhat', [who[asked][0]]);
      answer = String(sol[asked]);
      opts = range(n).map(String);
      show = function (v) { return cap(T('who_' + set + '_the')[items[+v]]); };
    }
    return {
      key: 'wh:' + set + who.map(nameOf).join('') + sol.join(''),
      ask: q,
      board: { t: 'story', lines: lines, intro: true },
      answer: answer,
      opt: 'text',
      opts: shuffle(opts),
      show: show,
      why: function () {
        return who.map(function (k, p) { return k[0] + ' – ' + T('who_' + set + '_the')[items[sol[p]]]; }).join(', ') + '.';
      },
      tm: 1.4 + 0.3 * n,
    };
  }

  function daysQ(c) {
    var today = rnd(0, 6), given = c.L >= 21 && chance(0.6) ? pick([-2, -1, 1, 2]) : 0, ask;
    do { ask = pick([-2, -1, 1, 2]); } while (ask === given);
    var gd = mod(today + given, 7), ad = mod(today + ask, 7);
    var day = function (i) { return function () { return T('m_days')[i]; }; };
    return {
      key: 'dy:' + today + ',' + given + ',' + ask,
      ask: say('day_q' + ask),
      board: { t: 'story', lines: [say('day_g' + given, [day(gd)])] },
      answer: String(ad),
      opt: 'text',
      wrong: [mod(ad + 1, 7), mod(ad - 1, 7), mod(today - ask, 7), mod(gd - ask, 7), gd].map(String),
      more: range(7).map(String),
      show: function (v) { return T('m_days')[+v]; },
      why: function () {
        var out = [];
        for (var o = Math.min(0, given, ask); o <= Math.max(0, given, ask); o++) out.push(T('day_w' + o) + ': ' + T('m_days')[mod(today + o, 7)]);
        return out.join(' · ');
      },
      tm: 1.3,
    };
  }

  function agesQ(c) {
    var k = kids(2), a, d, p, q, ans;
    switch (c.L >= 24 ? rnd(0, 3) : rnd(0, 2)) {
      case 0:
        a = rnd(7, 12); d = rnd(2, 4); p = rnd(2, 5); ans = a - d + p;
        return { key: 'ag:0' + a + d + p, ask: say('ageA', [k[0][0], a, k[1][0], d, function () { return g('lg_younger', k[1]); }, p]),
          board: null, answer: ans, opt: 'num', wrong: [a + d + p, a - d, a + p, ans + 1], why: function () { return a + ' − ' + d + ' + ' + p + ' = ' + ans; }, tm: 1.8 };
      case 1:
        a = rnd(10, 14); p = rnd(2, 4); q = rnd(2, 3); ans = a - p - q;
        return { key: 'ag:1' + a + p + q, ask: say('ageB', [k[0][0], p, a, q]),
          board: null, answer: ans, opt: 'num', wrong: [a - p, a - q, a + q - p, ans + 1], why: function () { return a + ' − ' + p + ' − ' + q + ' = ' + ans; }, tm: 1.8 };
      case 2:
        a = rnd(4, 9); p = rnd(2, 3); q = rnd(2, 4); ans = a + p + q;
        return { key: 'ag:2' + a + p + q, ask: say('ageC', [k[0][0], p, a, q]),
          board: null, answer: ans, opt: 'num', wrong: [a + q, a + q - p, a + p, ans - 1], why: function () { return a + ' + ' + p + ' + ' + q + ' = ' + ans; }, tm: 1.8 };
      default:
        a = rnd(6, 10); var m = rnd(30, 40), b = a + rnd(3, 8); ans = m + (b - a);
        return { key: 'ag:3' + a + m + b, ask: say('ageD', [k[0][0], a, m, b]),
          board: null, answer: ans, opt: 'num', wrong: [m + b, m, ans + 1, m + b - a + 1], why: say('lw_ageD', [m - a, b, m - a, ans]), tm: 2 };
    }
  }

  // The worst case decides it: socks and marbles in the dark.
  function socksQ(c) {
    var cols = some(['r', 'b', 'g', 'y'], c.L >= 24 ? rnd(2, 3) : 2);
    var counts = cols.map(function () { return rnd(3, 7); });
    var colourAdj = function (i, sg) { return function () { return T(sg ? 'mbl_' + cols[i] : 'mbp_' + cols[i]); }; };
    var parts = cols.map(function (cl, i) { return say('mb_part', [counts[i], function () { return T('mbp_' + cl); }]); });
    var variant = rnd(0, 2), goal, ans, wrong, why;
    if (variant === 0) {
      ans = cols.length + 1; goal = function () { return T('sock_same'); };
      wrong = [2, cols.length, counts[0] + 1, ans + 1];
      why = say('lw_sockSame', [cols.length, ans]);
    } else {
      var others = sumOf(counts) - counts[0], need = variant === 1 ? 1 : 2;
      ans = others + need;
      goal = variant === 1 ? say('sock_one', [colourAdj(0, true)]) : say('sock_two', [colourAdj(0, false)]);
      wrong = [need, others, counts[0], ans + 1, ans - 1];
      why = say('lw_sockOne', [others, need, ans]);
    }
    return {
      key: 'sk:' + cols.join('') + counts.join('') + variant,
      ask: say('sockQ', [function () { return listOf(parts); }, goal]),
      board: null, answer: ans, opt: 'num', wrong: wrong, why: why, tm: 2,
    };
  }

  function postsQ(c) {
    var n, d, L, s, e, m;
    switch (c.L >= 24 ? rnd(0, 3) : rnd(0, 2)) {
      case 0:
        n = rnd(3, 9);
        return { key: 'ps:c' + n, ask: say('cutQ', [n]), board: null, answer: n - 1, opt: 'num', wrong: [n, n + 1, n - 2], why: say('lw_cut', [n, n - 1]), tm: 1.5 };
      case 1:
        d = pick([2, 3]); L = d * rnd(3, 6);
        return { key: 'ps:f' + d + L, ask: say('fenceQ', [d, L]), board: null, answer: L / d + 1, opt: 'num', wrong: [L / d, L / d + 2, L / d - 1], why: say('lw_fence', [L, d, L / d, L / d + 1]), tm: 1.8 };
      case 2:
        s = pick([8, 10, 12, 15, 16, 18]); e = rnd(2, 4);
        return { key: 'ps:s' + s + e, ask: say('stairsQ', [s, e]), board: null, answer: s * e, opt: 'num', wrong: [s * (e + 1), s * (e - 1), s + e], why: say('lw_stairs', [e, s * e, s]), tm: 1.8 };
      default:
        m = rnd(2, 5); n = rnd(3, 6);
        return { key: 'ps:l' + m + n, ask: say('logQ', [m, n]), board: null, answer: m * (n - 1), opt: 'num', wrong: [m * n, m * (n - 2), m + n], why: say('lw_log', [n, n - 1, m * (n - 1), m]), tm: 1.8 };
    }
  }

  function shakeQ(c) {
    var n = rnd(3, 6), ans = n * (n - 1) / 2, list = [];
    for (var i = n - 1; i >= 1; i--) list.push(i);
    var games = chance(0.5);
    return {
      key: 'sh:' + n + games, ask: say(games ? 'chessQ' : 'shakeQ', [n]),
      board: null, answer: ans, opt: 'num', wrong: [n * (n - 1), n, ans + 1, ans - 1],
      why: say('lw_shake', [list.join(' + ') + ' = ' + ans]), tm: 1.8,
    };
  }

  var REASON = [
    { from: 1, key: 'rs_compare', gen: function (c) { return orderQ(c, 2, 99); } },
    { from: 3, key: 'rs_order', gen: function (c) { return orderQ(c, 3, 8); } },
    { from: 5, key: 'rs_scale', gen: scaleOrderQ },
    { from: 7, key: 'rs_line', gen: lineQ },
    { from: 9, key: 'rs_legs', gen: legsQ },
    { from: 11, key: 'rs_who', gen: function (c) { return whoQ(c.L < 16 ? 2 : 3, false); } },
    { from: 13, key: 'rs_balance', gen: function (c) { return balanceQ(c, false); } },
    { from: 15, key: 'rs_days', gen: daysQ },
    { from: 17, key: 'rs_ages', gen: agesQ },
    { from: 19, key: 'rs_socks', gen: socksQ },
    { from: 21, key: 'rs_posts', gen: postsQ },
    { from: 23, key: 'rs_order4', gen: function (c) { return orderQ(c, 4, 0); } },
    { from: 25, key: 'rs_who2', gen: function (c) { return whoQ(c.L < 29 ? 3 : 4, true); } },
    { from: 27, key: 'rs_balance2', gen: function (c) { return balanceQ(c, true); } },
    { from: 29, key: 'rs_shake', gen: shakeQ },
  ];

  // ------------------------------------------------------------- ladder

  var STAGES = { patterns: PATTERNS, odd: ODD, grids: GRIDS, space: SPACE, reason: REASON };

  function plan(set, level) {
    var L = Math.max(1, Math.min(MAX_LEVEL, level));
    return {
      level: L,
      options: L <= 4 ? 3 : L <= 16 ? 4 : 6,
      // Thinking takes longer than a sum, so the clock comes late and is kind.
      seconds: L < 15 ? 0 : Math.max(30, 50 - (L - 15) * 1.3),
    };
  }

  function stageIndex(set, level) {
    var stages = STAGES[set], i = 0;
    for (var k = 0; k < stages.length; k++) if (stages[k].from <= level) i = k;
    return i;
  }

  // Mostly the newest stage, some of the one before, a little of the rest.
  function chooseStage(i) {
    var bag = [i, i, i, i, i];
    if (i >= 1) bag.push(i - 1, i - 1);
    if (i >= 2) bag.push(i - 2);
    if (i >= 3) bag.push(rnd(0, i - 3), rnd(0, i - 3));
    return pick(bag);
  }

  function near(a) {
    if (a <= 20) return [a + 1, a - 1, a + 2, a - 2, a + 3];
    return [a + 1, a - 1, a + 2, a - 2, a + 10, a - 10];
  }

  function options(q, p) {
    if (q.opts) return shuffle(q.opts.slice());
    var numeric = typeof q.answer === 'number';
    var count = p.options, out = [q.answer], seen = {};
    seen[String(q.answer)] = true;
    function add(v) {
      if (out.length >= count || v === undefined || v === null) return;
      if (numeric && (typeof v !== 'number' || !isFinite(v) || v < 0 || v !== Math.floor(v))) return;
      if (numeric && v === 0 && q.answer > 3) return;
      var k = String(v);
      if (seen[k]) return;
      seen[k] = true;
      out.push(v);
    }
    shuffle(q.wrong || []).forEach(add);
    (q.more || []).forEach(add);
    if (numeric) {
      shuffle(near(q.answer)).forEach(add);
    } else if (q.opt === 'tok') {
      tokVariants(q.answer).forEach(add);
    }
    // Boards are laid out 2, 3, 4 or 6 wide - five would leave a hole.
    if (out.length === 5) out.pop();
    return shuffle(out);
  }

  function finish(q, p) {
    q.plan = p;
    q.level = p.level;
    q.kind = q.kind || 'pick';
    if (q.kind === 'pick') q.options = options(q, p);
    return q;
  }

  function make(set, level, recent, fresh) {
    var stages = STAGES[set], p = plan(set, level);
    var i = stageIndex(set, p.level), c = { L: p.level, recent: recent || {} }, q = null, s;
    for (var tries = 0; tries < 10; tries++) {
      s = stages[fresh && !tries ? i : chooseStage(i)];
      var made = s.gen(c);
      if (!made) continue;
      q = made;
      q.stage = s.key;
      if (!c.recent[q.key]) break;
    }
    if (!q) { q = stages[0].gen(c); q.stage = stages[0].key; }
    q.set = set;
    return finish(q, p);
  }

  function unlocks(set, before, after) {
    var chips = [];
    STAGES[set].forEach(function (s) { if (s.from > before && s.from <= after) chips.push(T(s.key)); });
    var a = plan(set, before), b = plan(set, after);
    if (b.options > a.options) chips.push(b.options + ' ' + T('unlockOptions'));
    if (b.seconds && !a.seconds) chips.push(T('unlockTimer') + ' ' + Math.round(b.seconds) + 's');
    return chips;
  }

  return {
    make: make,
    plan: plan,
    unlocks: unlocks,
    stageIndex: stageIndex,
    stages: STAGES,
  };
})();
