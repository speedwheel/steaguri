// The maths curriculum: what is asked at each level of each mode, and which
// wrong answers sit next to the right one. It follows the Romanian school
// order for clasa I-III: adding to 10, then 20, 100, 1000; the times table a
// couple of rows at a time; place value, patterns, fractions, Roman numerals;
// the clock; lei and bani.
//
// Every mode is a list of stages. A stage opens at a level and stays in the
// mix afterwards, so a run keeps revisiting what it has already passed.
//
// A generator returns a question:
//   key      identity of the problem (no repeats, the missed list, mastery)
//   fact     a small, finite fact (7 x 8, 13 - 5): misses are remembered
//            between sessions and those facts come back more often
//   ask      prompt: a string key, or a function returning the sentence
//   expr     tokens on the card - numbers, operators, '@unit' words,
//            { f } phrases, { frac }, and null for the answer slot
//   answer   a number (can be typed on the keypad) or a string (options only)
//   wrong    likely wrong answers: the mistakes children actually make
//   pic      a MathPics description; help: true marks a crutch that is
//            dropped once the run is past the early levels
//   explain  tokens shown after a miss: how to get there
//   clock    [h, m] when the question can also be "set the clock"
window.MathQ = (function () {
  var MAX_LEVEL = 30;

  // ------------------------------------------------------------ helpers

  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function chance(p) { return Math.random() < p; }
  function shuffle(arr) { return window.Game.shuffle(arr); }
  function sum(arr) { return arr.reduce(function (s, v) { return s + v; }, 0); }
  function T(k) { return window.T(k); }
  function en() { return window.Store.get('lang') === 'en'; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function val(a) { return typeof a === 'function' ? a() : a; }
  function assign(o, extra) { for (var k in extra) o[k] = extra[k]; return o; }
  function sortDesc(arr) { return arr.slice().sort(function (a, b) { return b - a; }); }

  // A sentence from a string key, filled in only when it is shown, so a
  // language switch in the middle of a run still reads right.
  function say(key, args) {
    return function () {
      return T(key).replace(/\{(\d)\}/g, function (_, i) { return val((args || [])[+i]); });
    };
  }
  function words(fn) { return { f: fn }; }

  // a + b + c as tokens, for "10 + 5 + 1 = 16".
  function plusChain(list) {
    var out = [];
    list.forEach(function (v, i) { if (i) out.push('+'); out.push(v); });
    return out;
  }

  // Facts the player has missed before come up more often.
  function weighted(list, keyOf, c) {
    var fresh = list.filter(function (it) { return !c.recent[keyOf(it)]; });
    var src = fresh.length ? fresh : list;
    var bag = [];
    src.forEach(function (it) {
      var m = window.Store.masteryOf(keyOf(it));
      var w = 1 + Math.min(6, Math.round(Math.max(0, m.w) * 2));
      for (var i = 0; i < w; i++) bag.push(it);
    });
    return pick(bag);
  }

  // Column addition with the carry forgotten: 47 + 38 -> 75.
  function noCarry(a, b) {
    var out = 0, p = 1;
    while (a || b) {
      out += ((a % 10 + b % 10) % 10) * p;
      a = Math.floor(a / 10); b = Math.floor(b / 10); p *= 10;
    }
    return out;
  }

  // Column subtraction taking the smaller digit from the bigger one in every
  // column: 62 - 29 -> 47. The classic borrowing mistake.
  function smallFromBig(a, b) {
    var out = 0, p = 1;
    while (a || b) {
      out += Math.abs(a % 10 - b % 10) * p;
      a = Math.floor(a / 10); b = Math.floor(b / 10); p *= 10;
    }
    return out;
  }

  function carries(a, b) {
    return a % 10 + b % 10 >= 10 || Math.floor(a / 10) % 10 + Math.floor(b / 10) % 10 >= 10;
  }
  function borrows(a, b) {
    return a % 10 < b % 10 || Math.floor(a / 10) % 10 < Math.floor(b / 10) % 10;
  }

  function swapDigits(n) {
    return (n % 10) * 10 + Math.floor(n / 10);
  }

  // ------------------------------------------------------- add and take

  function addQ(a, b, extra) {
    var s = a + b;
    return assign({
      key: (s <= 20 ? 'f:' : 'q:') + a + '+' + b,
      fact: s <= 20,
      ask: 'askCalc',
      expr: [a, '+', b, '=', null],
      answer: s,
      wrong: [],
    }, extra);
  }

  function subQ(a, b, extra) {
    return assign({
      key: (a <= 20 ? 'f:' : 'q:') + a + '-' + b,
      fact: a <= 20,
      ask: 'askCalc',
      expr: [a, '-', b, '=', null],
      answer: a - b,
      wrong: [],
    }, extra);
  }

  function framesPic(a, b, op) {
    return { t: 'frames', a: a, b: b, op: op, help: true };
  }

  function factList(maxA, op) {
    var list = [];
    for (var a = op === '+' ? 1 : 2; a <= maxA; a++) {
      for (var b = 1; op === '+' ? a + b <= 10 : b < a; b++) list.push([a, b]);
    }
    return list;
  }

  // Three parts, none of them carrying: 345 + 132, 876 - 254.
  function noRegroup(add) {
    var ah = rnd(add ? 1 : 2, add ? 8 : 9), at = rnd(0, 9), au = rnd(0, 9);
    var bh = add ? rnd(1, 9 - ah) : rnd(1, ah - 1);
    var bt = add ? rnd(0, 9 - at) : rnd(0, at);
    var bu = add ? rnd(0, 9 - au) : rnd(0, au);
    return [ah * 100 + at * 10 + au, bh * 100 + bt * 10 + bu];
  }

  var ADDSUB = [
    { from: 1, key: 'as_add10', gen: function (c) {
      var f = weighted(factList(9, '+'), function (f) { return 'f:' + f[0] + '+' + f[1]; }, c);
      return addQ(f[0], f[1], { pic: framesPic(f[0], f[1], '+'), wrong: [Math.abs(f[0] - f[1])] });
    } },
    { from: 3, key: 'as_sub10', gen: function (c) {
      var f = weighted(factList(10, '-'), function (f) { return 'f:' + f[0] + '-' + f[1]; }, c);
      return subQ(f[0], f[1], { pic: framesPic(f[0], f[1], '-'), wrong: [f[0] + f[1], f[1]] });
    } },
    // Inside 20 without crossing the ten: 12 + 5, 17 - 4, 10 + 6, 16 - 6.
    { from: 5, key: 'as_20', gen: function () {
      var x = rnd(1, 8), u;
      switch (rnd(0, 3)) {
        case 0:
          u = rnd(1, 9 - x);
          return addQ(10 + x, u, { pic: framesPic(10 + x, u, '+'), wrong: [x + u, 10 + x - u] });
        case 1:
          u = rnd(1, 9);
          return chance(0.5) ? addQ(10, u, { pic: framesPic(10, u, '+') }) : addQ(u, 10, { pic: framesPic(u, 10, '+') });
        case 2:
          x = rnd(1, 9); u = rnd(1, x);
          return subQ(10 + x, u, { pic: framesPic(10 + x, u, '-'), wrong: [x - u, 10 + x + u] });
        default:
          x = rnd(1, 9);
          return chance(0.5) ? subQ(10 + x, 10, { pic: framesPic(10 + x, 10, '-') }) : subQ(10 + x, x, { pic: framesPic(10 + x, x, '-') });
      }
    } },
    // Crossing the ten, with the bridge shown after a miss: 8 + 2 + 3.
    { from: 7, key: 'as_cross', gen: function (c) {
      var list = [], a, b;
      if (chance(0.5)) {
        for (a = 2; a <= 9; a++) for (b = 2; b <= 9; b++) if (a + b > 10) list.push([a, b]);
        var f = weighted(list, function (f) { return 'f:' + f[0] + '+' + f[1]; }, c);
        a = f[0]; b = f[1];
        var fill = 10 - a;
        return addQ(a, b, {
          pic: framesPic(a, b, '+'),
          wrong: [a + b - 10, a + b + 10],
          explain: [a, '+', fill, '+', b - fill, '=', a + b],
        });
      }
      for (a = 11; a <= 18; a++) for (b = 2; b <= 9; b++) if (b > a % 10) list.push([a, b]);
      var g = weighted(list, function (f) { return 'f:' + f[0] + '-' + f[1]; }, c);
      a = g[0]; b = g[1];
      return subQ(a, b, {
        pic: framesPic(a, b, '-'),
        wrong: [smallFromBig(a, b), a - b + 10],
        explain: [a, '-', a - 10, '-', b - (a - 10), '=', a - b],
      });
    } },
    { from: 9, key: 'as_missing', gen: function () {
      var a, b, s, d;
      switch (rnd(0, 3)) {
        case 0:
          s = rnd(6, 20); a = rnd(1, s - 1); b = s - a;
          return { key: 'f:' + a + '+?=' + s, fact: true, ask: 'askMissing', expr: [a, '+', null, '=', s], answer: b,
            wrong: [s + a, a, s], explain: [s, '-', a, '=', b] };
        case 1:
          s = rnd(6, 20); b = rnd(1, s - 1); a = s - b;
          return { key: 'f:?+' + b + '=' + s, fact: true, ask: 'askMissing', expr: [null, '+', b, '=', s], answer: a,
            wrong: [s + b, b, s], explain: [s, '-', b, '=', a] };
        case 2:
          a = rnd(6, 20); b = rnd(1, a - 1); d = a - b;
          return { key: 'f:' + a + '-?=' + d, fact: true, ask: 'askMissing', expr: [a, '-', null, '=', d], answer: b,
            wrong: [a + d, d, a], explain: [a, '-', d, '=', b] };
        default:
          d = rnd(1, 15); b = rnd(1, 20 - d); a = d + b;
          return { key: 'f:?-' + b + '=' + d, fact: true, ask: 'askMissing', expr: [null, '-', b, '=', d], answer: a,
            wrong: [Math.abs(d - b), b, d], explain: [d, '+', b, '=', a] };
      }
    } },
    // Whole tens and the easy two-digit steps: 30 + 40, 34 + 5, 78 - 30.
    { from: 11, key: 'as_tens', gen: function () {
      var t1, t2, a, b;
      switch (rnd(0, 5)) {
        case 0:
          t1 = rnd(1, 8); t2 = rnd(1, 9 - t1);
          return addQ(t1 * 10, t2 * 10, { wrong: [t1 + t2, (t1 + t2) * 100] });
        case 1:
          t1 = rnd(2, 9); t2 = rnd(1, t1 - 1);
          return subQ(t1 * 10, t2 * 10, { wrong: [t1 - t2, (t1 + t2) * 10] });
        case 2:
          a = rnd(1, 9) * 10 + rnd(0, 8); b = rnd(1, 9 - a % 10);
          return addQ(a, b, { wrong: [a + b * 10] });
        case 3:
          a = rnd(1, 9) * 10 + rnd(1, 9); b = rnd(1, a % 10);
          return subQ(a, b, { wrong: [a - b * 10, a + b] });
        case 4:
          a = rnd(1, 8) * 10 + rnd(1, 9); b = rnd(1, 9 - Math.floor(a / 10)) * 10;
          return addQ(a, b, { wrong: [a + b / 10] });
        default:
          a = rnd(2, 9) * 10 + rnd(1, 9); b = rnd(1, Math.floor(a / 10) - 1) * 10;
          return subQ(a, b, { wrong: [a - b / 10] });
      }
    } },
    { from: 13, key: 'as_100', gen: function () {
      var ta, tb, ua, ub, a, b;
      if (chance(0.5)) {
        ta = rnd(1, 8); tb = rnd(1, 9 - ta); ua = rnd(0, 9); ub = rnd(ua ? 0 : 1, 9 - ua);
        a = ta * 10 + ua; b = tb * 10 + ub;
        return addQ(a, b, { wrong: [a + b + 10, a + b - 10, a - b] });
      }
      ta = rnd(2, 9); tb = rnd(1, ta - 1); ua = rnd(1, 9); ub = rnd(0, ua);
      a = ta * 10 + ua; b = tb * 10 + ub;
      return subQ(a, b, { wrong: [a - b + 10, a - b - 10, a + b] });
    } },
    // Trecere peste ordin: carrying and borrowing inside 100.
    { from: 16, key: 'as_carry', gen: function () {
      var a, b;
      if (chance(0.5)) {
        do { a = rnd(11, 89); b = chance(0.25) ? rnd(2, 9) : rnd(11, 89); }
        while (a % 10 + b % 10 < 10 || a + b > 100);
        return addQ(a, b, { wrong: [noCarry(a, b), a + b + 10] });
      }
      do { a = rnd(20, 99); b = chance(0.25) ? rnd(2, 9) : rnd(11, a - 1); }
      while (b % 10 <= a % 10 || b >= a);
      return subQ(a, b, { wrong: [smallFromBig(a, b), a - b + 10] });
    } },
    { from: 19, key: 'as_three', gen: function () {
      var a, b, c, r, s, d;
      switch (rnd(0, 3)) {
        case 0:
          // Often with a ten hiding in it: 17 + 3 + 25.
          do { a = rnd(5, 40); b = chance(0.5) && a % 10 ? 10 - a % 10 : rnd(3, 30); c = rnd(3, 30); }
          while (a + b + c > 100);
          r = a + b + c;
          return { key: 'q:' + a + '+' + b + '+' + c, ask: 'askCalc', expr: [a, '+', b, '+', c, '=', null], answer: r, wrong: [a + b, r + 10, r - 10] };
        case 1:
          do { a = rnd(10, 60); b = rnd(5, 40); c = rnd(5, 50); } while (a + b - c < 0 || a + b > 100);
          r = a + b - c;
          return { key: 'q:' + a + '+' + b + '-' + c, ask: 'askCalc', expr: [a, '+', b, '-', c, '=', null], answer: r, wrong: [a + b + c, a + b, r + 10, r - 10] };
        case 2:
          do { a = rnd(30, 99); b = rnd(5, 30); c = rnd(5, 30); } while (a - b - c < 0);
          r = a - b - c;
          return { key: 'q:' + a + '-' + b + '-' + c, ask: 'askCalc', expr: [a, '-', b, '-', c, '=', null], answer: r, wrong: [a - b + c, a - b, r + 10, r - 10] };
        default:
          if (chance(0.5)) {
            s = rnd(30, 100); a = rnd(11, s - 5); b = s - a;
            return { key: 'q:' + a + '+?=' + s, ask: 'askMissing', expr: [a, '+', null, '=', s], answer: b,
              wrong: [s + a, smallFromBig(s, a), b + 10, b - 10], explain: [s, '-', a, '=', b] };
          }
          d = rnd(10, 60); b = rnd(11, 40); a = d + b;
          return { key: 'q:?-' + b + '=' + d, ask: 'askMissing', expr: [null, '-', b, '=', d], answer: a,
            wrong: [Math.abs(d - b), noCarry(d, b), a + 10, a - 10], explain: [d, '+', b, '=', a] };
      }
    } },
    { from: 21, key: 'as_1000', gen: function () {
      var a, b, h1, h2, p;
      switch (rnd(0, 3)) {
        case 0:
          h1 = rnd(1, 8); h2 = rnd(1, 9 - h1);
          return chance(0.5)
            ? addQ(h1 * 100, h2 * 100, { wrong: [h1 + h2, (h1 + h2) * 10] })
            : subQ((h1 + h2) * 100, h2 * 100, { wrong: [h1, h1 * 10, (h1 + 2 * h2) * 100] });
        case 1:
          a = rnd(1, 9) * 100 + rnd(1, 8) * 10;
          if (chance(0.5)) {
            b = rnd(1, 9 - (a / 10) % 10) * 10;
            return addQ(a, b, { wrong: [a + b * 10, a + b / 10] });
          }
          b = rnd(1, (a / 10) % 10) * 10;
          return subQ(a, b, { wrong: [a - b * 10, a + b] });
        default:
          var add = chance(0.5);
          p = noRegroup(add);
          a = p[0]; b = p[1];
          return add
            ? addQ(a, b, { wrong: [a + b + 100, a + b - 10, a + b + 110] })
            : subQ(a, b, { wrong: [a - b + 100, a - b - 10, a + b] });
      }
    } },
    { from: 24, key: 'as_carry1000', gen: function () {
      var a, b;
      if (chance(0.5)) {
        do { a = rnd(105, 899); b = chance(0.3) ? rnd(12, 98) : rnd(105, 899); }
        while (a + b >= 1000 || !carries(a, b));
        return addQ(a, b, { wrong: [noCarry(a, b), a + b - 10, a + b + 10, a + b - 100] });
      }
      do { a = rnd(200, 999); b = chance(0.3) ? rnd(12, 98) : rnd(101, a - 1); } while (!borrows(a, b));
      return subQ(a, b, { wrong: [smallFromBig(a, b), a - b + 10, a - b - 10, a - b + 100] });
    } },
    { from: 27, key: 'as_big', gen: function () {
      var a, b, c, s, r;
      switch (rnd(0, 3)) {
        case 0:
          s = rnd(3, 10) * 100 - (chance(0.3) ? 50 : 0); b = rnd(101, s - 50); a = s - b;
          return { key: 'q:?+' + b + '=' + s, ask: 'askMissing', expr: [null, '+', b, '=', s], answer: a,
            wrong: [s + b, smallFromBig(s, b), a + 10, a - 10, a + 100], explain: [s, '-', b, '=', a] };
        case 1:
          b = rnd(101, 899);
          return subQ(1000, b, { wrong: [smallFromBig(1000, b), 1000 - b + 10, 1000 - b - 10, 1000 - b + 100] });
        case 2:
          do { a = rnd(10, 60) * 10; b = rnd(10, 40) * 10; c = rnd(10, 50) * 10; } while (a + b - c < 0 || a + b >= 1000);
          r = a + b - c;
          return { key: 'q:' + a + '+' + b + '-' + c, ask: 'askCalc', expr: [a, '+', b, '-', c, '=', null], answer: r,
            wrong: [a + b + c, a + b, r + 100, r - 100] };
        default:
          a = rnd(4, 10) * 100; r = rnd(101, a - 50); b = a - r;
          return { key: 'q:' + a + '-?=' + r, ask: 'askMissing', expr: [a, '-', null, '=', r], answer: b,
            wrong: [a + r, smallFromBig(a, r), b + 10, b - 10, b + 100], explain: [a, '-', r, '=', b] };
      }
    } },
  ];

  // --------------------------------------------------- times and divide

  function mulQ(a, b, extra) {
    var p = a * b, small = a <= 10 && b <= 10;
    return assign({
      key: (small ? 'f:' : 'q:') + Math.min(a, b) + 'x' + Math.max(a, b),
      fact: small,
      ask: 'askCalc',
      expr: [a, 'x', b, '=', null],
      answer: p,
      wrong: [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, a + b],
    }, extra);
  }

  // The dot array and "4 + 4 + 4" only while the groups are few.
  function mulHelp(a, b) {
    var out = {};
    if (a * b <= 40 && a >= 1 && b >= 1) out.pic = { t: 'array', rows: a, cols: b, help: true };
    var n = a <= 5 ? a : b <= 5 ? b : 0, term = a <= 5 ? b : a;
    if (n >= 2) {
      var ex = [];
      for (var i = 0; i < n; i++) { if (i) ex.push('+'); ex.push(term); }
      ex.push('=', a * b);
      out.explain = ex;
    }
    return out;
  }

  function factKey(f) { return 'f:' + Math.min(f[0], f[1]) + 'x' + Math.max(f[0], f[1]); }

  function tableGen(tables) {
    return function (c) {
      var list = [];
      tables.forEach(function (t) { for (var b = 1; b <= 10; b++) list.push([t, b]); });
      var f = weighted(list, factKey, c);
      var a = f[0], b = f[1];
      if (chance(0.5)) { a = f[1]; b = f[0]; }
      return mulQ(a, b, mulHelp(a, b));
    };
  }

  function divQ(a, d, extra) {
    var qv = a / d, small = a <= 100 && d <= 10;
    return assign({
      key: (small ? 'f:' : 'q:') + a + '/' + d,
      fact: small,
      ask: 'askCalc',
      expr: [a, '/', d, '=', null],
      answer: qv,
      wrong: [qv + 1, qv - 1, a - d, d],
      explain: [qv, 'x', d, '=', a],
    }, extra);
  }

  function divGen(divisors) {
    return function (c) {
      var list = [];
      divisors.forEach(function (d) { for (var q = 1; q <= 10; q++) list.push([d * q, d]); });
      var f = weighted(list, function (f) { return 'f:' + f[0] + '/' + f[1]; }, c);
      return divQ(f[0], f[1], f[0] <= 40 ? { pic: { t: 'array', rows: f[1], cols: f[0] / f[1], help: true } } : {});
    };
  }

  function phraseQ(key, args, answer, wrong) {
    return { key: 'q:' + key + args.join(','), ask: 'askCalc', expr: [words(say(key, args)), '=', null], answer: answer, wrong: wrong };
  }

  function orderQ(lhs, r, w, ex) {
    return { key: 'q:' + lhs.join(''), ask: 'askOrder', expr: lhs.concat(['=', null]), answer: r, wrong: [w, r + 10], explain: ex, tm: 1.5 };
  }

  var MULDIV = [
    { from: 1, key: 'md_x2', gen: tableGen([2, 10]) },
    { from: 3, key: 'md_x5', gen: tableGen([5]) },
    { from: 5, key: 'md_x34', gen: tableGen([3, 4]) },
    { from: 7, key: 'md_div', gen: divGen([2, 5, 10]) },
    { from: 9, key: 'md_x67', gen: tableGen([6, 7]) },
    { from: 11, key: 'md_divmid', gen: divGen([3, 4, 6, 7]) },
    { from: 13, key: 'md_x89', gen: tableGen([8, 9]) },
    { from: 15, key: 'md_table', gen: function (c) {
      var list = [];
      for (var x = 2; x <= 10; x++) for (var y = 1; y <= 10; y++) list.push([x, y]);
      var f = weighted(list, factKey, c), a = f[0], b = f[1], p = a * b, r = Math.random(), n;
      if (chance(0.5)) { a = f[1]; b = f[0]; }
      if (r < 0.12) {
        n = rnd(2, 10);
        if (chance(0.5)) return chance(0.5) ? mulQ(0, n, { wrong: [n, 1, n * 10] }) : mulQ(n, 0, { wrong: [n, 1, n * 10] });
        return chance(0.5) ? mulQ(1, n, { wrong: [n + 1, 1, 0] }) : mulQ(n, 1, { wrong: [n + 1, 1, 0] });
      }
      if (r < 0.4 && a > 1 && b > 1) {
        if (chance(0.5)) {
          return { key: 'f:?x' + b + '=' + p, fact: true, ask: 'askMissing', expr: [null, 'x', b, '=', p], answer: a,
            wrong: [a + 1, a - 1, p - b, b], explain: [p, '/', b, '=', a] };
        }
        return { key: 'f:' + a + 'x?=' + p, fact: true, ask: 'askMissing', expr: [a, 'x', null, '=', p], answer: b,
          wrong: [b + 1, b - 1, p - a, a], explain: [p, '/', a, '=', b] };
      }
      return mulQ(a, b);
    } },
    { from: 17, key: 'md_divall', gen: function (c) {
      var list = [];
      for (var d = 2; d <= 10; d++) for (var q = 1; q <= 10; q++) list.push([d * q, d]);
      var f = weighted(list, function (f) { return 'f:' + f[0] + '/' + f[1]; }, c), a = f[0], d2 = f[1], qv = a / d2;
      if (chance(0.3) && qv !== d2) {
        return { key: 'f:' + a + '/?=' + qv, fact: true, ask: 'askMissing', expr: [a, '/', null, '=', qv], answer: d2,
          wrong: [d2 + 1, d2 - 1, qv, a - qv], explain: [a, '/', qv, '=', d2] };
      }
      if (chance(0.08)) return chance(0.5) ? divQ(0, d2, { wrong: [d2, 1] }) : divQ(a, 1, { wrong: [1, a - 1, a + 1] });
      return divQ(a, d2);
    } },
    // Dublul, triplul, jumătatea - and "cu 3 mai mult" against "de 3 ori mai
    // mult", the pair every Romanian textbook drills.
    { from: 19, key: 'md_words', gen: function () {
      var n, k;
      switch (rnd(0, 5)) {
        case 0: n = rnd(2, 50); return phraseQ('mDouble', [n], 2 * n, [n + 2, 2 * n + 1, 3 * n]);
        case 1: n = rnd(2, 20); return phraseQ('mTriple', [n], 3 * n, [n + 3, 2 * n, 3 * n + 1]);
        case 2: n = rnd(2, 50) * 2; return phraseQ('mHalf', [n], n / 2, [2 * n, n - 2, n / 2 + 1]);
        case 3: n = rnd(2, 10) * 4; return phraseQ('mQuarter', [n], n / 4, [n / 2, n - 4, n * 4]);
        case 4:
          k = rnd(2, 5); n = rnd(3, 12);
          return chance(0.5)
            ? phraseQ('mMoreBy', [k, n], n + k, [n * k, n + k + 1])
            : phraseQ('mTimesMore', [k, n], n * k, [n + k, n * k + k]);
        default:
          k = rnd(2, 5); n = k * rnd(3, 10);
          return chance(0.5)
            ? phraseQ('mLessBy', [k, n], n - k, [n / k, n + k])
            : phraseQ('mTimesLess', [k, n], n / k, [n - k, n * k]);
      }
    } },
    { from: 21, key: 'md_tens', gen: function () {
      var a, b, t, d, qv;
      switch (rnd(0, 3)) {
        case 0:
          a = rnd(11, 99);
          return chance(0.5) ? mulQ(a, 10, { wrong: [a * 100, a + 10] }) : mulQ(10, a, { wrong: [a * 100, a + 10] });
        case 1:
          do { t = rnd(2, 9) * 10; b = rnd(2, 9); } while (t * b > 900);
          return mulQ(b, t, { wrong: [b * t / 10, b * t * 10, b * t + t] });
        case 2:
          t = rnd(1, 4) * 100; b = rnd(2, Math.floor(900 / t));
          return mulQ(t, b, { wrong: [t * b / 10, t * b * 10, t + b] });
        default:
          do { d = rnd(2, 9); qv = rnd(1, 9) * (chance(0.5) ? 10 : 100); } while (qv * d > 900);
          return divQ(qv * d, d, { wrong: [qv / 10, qv * 10, qv + 10] });
      }
    } },
    { from: 23, key: 'md_twodig', gen: function () {
      var a, b, p, qv;
      if (chance(0.6)) {
        do { a = rnd(11, 49); b = rnd(2, 9); } while (a * b > 400 || a % 10 === 0);
        p = a * b;
        var t = Math.floor(a / 10), u = a % 10;
        return mulQ(a, b, {
          wrong: [t * b * 10 + (u * b) % 10, p + b, p - b, p + 10],
          explain: [t * 10, 'x', b, '=', t * 10 * b, ';', u, 'x', b, '=', u * b, ';', t * 10 * b, '+', u * b, '=', p],
        });
      }
      do { b = rnd(2, 9); qv = rnd(11, 40); a = qv * b; } while (a > 400);
      return divQ(a, b, { wrong: [qv + 1, qv - 1, qv + 10, qv - 10] });
    } },
    { from: 26, key: 'md_order', gen: function () {
      var a, b, c, r;
      switch (rnd(0, 5)) {
        case 0:
          a = rnd(2, 20); b = rnd(2, 9); c = rnd(2, 9); r = a + b * c;
          return orderQ([a, '+', b, 'x', c], r, (a + b) * c, [b, 'x', c, '=', b * c, ';', a, '+', b * c, '=', r]);
        case 1:
          b = rnd(2, 9); c = rnd(2, 9); a = b * c + rnd(1, 30); r = a - b * c;
          return orderQ([a, '-', b, 'x', c], r, (a - b) * c, [b, 'x', c, '=', b * c, ';', a, '-', b * c, '=', r]);
        case 2:
          c = rnd(2, 9); b = c * rnd(2, 9); a = rnd(2, 30); r = a + b / c;
          return orderQ([a, '+', b, '/', c], r, (a + b) % c === 0 ? (a + b) / c : a + b, [b, '/', c, '=', b / c, ';', a, '+', b / c, '=', r]);
        case 3:
          a = rnd(2, 9); b = rnd(2, 9); c = rnd(2, 9); r = (a + b) * c;
          return orderQ(['(', a, '+', b, ')', 'x', c], r, a + b * c, [a, '+', b, '=', a + b, ';', a + b, 'x', c, '=', r]);
        case 4:
          a = rnd(2, 9); c = rnd(1, 8); b = c + rnd(1, 8); r = a * (b - c);
          return orderQ([a, 'x', '(', b, '-', c, ')'], r, a * b - c, [b, '-', c, '=', b - c, ';', a, 'x', b - c, '=', r]);
        default:
          a = rnd(2, 9); b = rnd(2, 9); c = rnd(2, 20); r = a * b + c;
          return orderQ([a, 'x', b, '+', c], r, a * (b + c), [a, 'x', b, '=', a * b, ';', a * b, '+', c, '=', r]);
      }
    } },
    { from: 28, key: 'md_rem', gen: function () {
      var d = rnd(2, 9), qv = rnd(1, 9), r = rnd(1, d - 1), a = qv * d + r;
      var ex = [qv, 'x', d, '+', r, '=', a];
      if (chance(0.6)) {
        return { key: 'q:' + a + '/' + d + 'r', ask: 'askRemainder', expr: [a, '/', d, '=', qv, '@rest', null], answer: r,
          wrong: [r + 1, r - 1, d - r, d, qv], explain: ex };
      }
      return { key: 'q:' + a + '/' + d + 'c', ask: 'askCalc', expr: [a, '/', d, '=', null, '@rest', r], answer: qv,
        wrong: [qv + 1, qv - 1, a - r, d], explain: ex };
    } },
  ];

  // ----------------------------------------------------------- numbers

  function signOf(a, b) { return a < b ? '<' : a > b ? '>' : '='; }

  function cmpQ(lhs, rhs, a, b) {
    return {
      key: 'n:' + JSON.stringify(lhs) + '?' + JSON.stringify(rhs),
      ask: 'askSign',
      expr: lhs.concat([null]).concat(rhs),
      answer: signOf(a, b),
      sign: true,
    };
  }

  function neighborQ(n, after) {
    return after
      ? { key: 'n:' + n + '>', ask: say('mAfter', [n]), expr: [n, ',', null], answer: n + 1, wrong: [n - 1, n + 2, n + 10, n] }
      : { key: 'n:<' + n, ask: say('mBefore', [n]), expr: [null, ',', n], answer: n - 1, wrong: [n + 1, n - 2, n - 10, n] };
  }

  // "1 sută" but "5 sute": the place words agree with their digit.
  function place(n, word) { return [n, '@' + word + (n === 1 ? '1' : '')]; }

  function digitQ(n, at) {
    var digits = String(n).split('').map(Number);
    var idx = { u: 1, t: 2, h: 3, th: 4 }[at];
    var d = digits[digits.length - idx];
    var lead = Math.floor(n / Math.pow(10, idx - 1));
    return {
      key: 'n:d' + at + n,
      ask: 'askFill',
      expr: [words(say('mDigit_' + at)), n, '=', null],
      answer: d,
      wrong: digits.concat([lead, d + 1, d - 1]),
    };
  }

  function seqQ(step, max) {
    var terms = 5, span = Math.abs(step) * (terms - 1), start;
    if (step > 0) start = rnd(0, max - span);
    else start = rnd(span, max);
    if (Math.abs(step) >= 5 && chance(0.7)) start = Math.round(start / Math.abs(step)) * Math.abs(step);
    if (step > 0 && start + span > max) start -= Math.abs(step);
    if (step < 0 && start - span < 0) start += Math.abs(step);
    var seq = [];
    for (var i = 0; i < terms; i++) seq.push(start + i * step);
    return seqOf(seq, step);
  }

  function seqOf(seq, step) {
    var hole = chance(0.7) ? seq.length - 1 : rnd(1, seq.length - 2);
    var expr = [];
    seq.forEach(function (v, i) { if (i) expr.push(','); expr.push(i === hole ? null : v); });
    var ans = seq[hole];
    return {
      key: 'n:s' + seq.join(','),
      ask: hole === seq.length - 1 ? 'askNext' : 'askMissing',
      expr: expr,
      answer: ans,
      wrong: [ans + 1, ans - 1, ans + step, ans - step, ans + 2 * step],
    };
  }

  var ROMAN = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  function roman(n) {
    var out = '';
    ROMAN.forEach(function (r) { while (n >= r[0]) { out += r[1]; n -= r[0]; } });
    return out;
  }

  // XIV against XVI, IX against XI: the order of the letters is the lesson.
  function mirror(n) {
    var u = n % 10, t = Math.floor(n / 10) % 10;
    if (u === 4 || u === 9) return n + 2;
    if (u === 6 || (u === 1 && n > 10)) return n - 2;
    if (t === 4 || t === 9) return n + 20;
    if (t === 6) return n - 20;
    return n + 1;
  }

  function romanQ(lo, hi) {
    var n = rnd(lo, hi);
    var near = [mirror(n), n - 1, n + 1, n + 5, n - 5, n + 10, n - 10].filter(function (v) {
      return v >= 1 && v <= Math.max(hi, 20) && v !== n;
    });
    if (chance(0.5)) {
      return { key: 'n:R' + n, ask: 'askToRoman', expr: [n, '=', null], answer: roman(n), wrong: near.map(roman), roman: true };
    }
    return { key: 'n:r' + n, ask: 'askFromRoman', expr: [roman(n), '=', null], answer: n, wrong: near };
  }

  var FRACS = ['1/2', '1/3', '2/3', '1/4', '3/4', '1/5', '2/5', '1/6', '5/6', '1/8', '3/8'];

  function fracValue(s) { var p = s.split('/'); return +p[0] / +p[1]; }

  var NUMBERS = [
    { from: 1, key: 'nu_cmp20', gen: function () {
      if (chance(0.6)) {
        var a = rnd(0, 20), b = chance(0.25) ? a : rnd(0, 20);
        return cmpQ([a], [b], a, b);
      }
      return neighborQ(rnd(1, 19), chance(0.6));
    } },
    { from: 3, key: 'nu_tu', gen: function () {
      var t = rnd(1, 9), u = rnd(0, 9), n = t * 10 + u;
      switch (rnd(0, 4)) {
        case 0: case 1:
          return { key: 'n:b' + n, ask: 'askBlocks', pic: { t: 'blocks', h: 0, tens: t, u: u }, expr: [null], answer: n,
            wrong: [u * 10 + t, t + u, n + 10, n - 10, n + 1, n - 1] };
        case 2:
          t = rnd(2, 9); u = rnd(2, 9); n = t * 10 + u;
          return { key: 'n:t' + n, ask: 'askFill', expr: [n, '=', null, '@tens', '+', u, '@ones'], answer: t, wrong: [u, n, t + 1, t - 1] };
        case 3:
          t = rnd(2, 9); u = rnd(2, 9); n = t * 10 + u;
          return { key: 'n:u' + n, ask: 'askFill', expr: [n, '=', t, '@tens', '+', null, '@ones'], answer: u, wrong: [t, n, u + 1, u - 1] };
        default:
          return { key: 'n:p' + n, ask: 'askFill', expr: place(t, 'tens').concat(['@and']).concat(place(u, 'ones')).concat(['=', null]), answer: n,
            wrong: [u * 10 + t, t + u, n + 10, t * 100 + u] };
      }
    } },
    { from: 5, key: 'nu_seq', gen: function () { return seqQ(pick([2, 5, 10, 2, 5, 10, -1, -2, -10]), 100); } },
    { from: 7, key: 'nu_cmp100', gen: function () {
      var r = Math.random(), a, b, n;
      if (r < 0.5) {
        a = rnd(10, 99);
        var how = rnd(0, 3);
        if (how === 0 && a % 10 && Math.floor(a / 10) !== a % 10) b = swapDigits(a);
        else if (how === 1) b = a;
        else b = Math.max(10, Math.min(99, a + pick([-3, -2, -1, 1, 2, 3, 10, -10])));
        return cmpQ([a], [b], a, b);
      }
      if (r < 0.75) {
        // Across a ten is where counting goes wrong: after 39, before 70.
        if (chance(0.6)) { n = rnd(1, 9) * 10 + (chance(0.5) ? 9 : 0); n = Math.max(10, Math.min(99, n)); }
        else n = rnd(10, 98);
        return neighborQ(n, n % 10 === 9 || (n % 10 !== 0 && chance(0.5)));
      }
      n = rnd(10, 99);
      return { key: 'n:eo' + n, ask: 'askEvenOdd', expr: [n, '\u2192', null], answer: n % 2 ? 'odd' : 'even', opts: ['even', 'odd'],
        show: function (v) { return T('m_' + v); } };
    } },
    { from: 9, key: 'nu_cmpexpr', gen: function () {
      var a, b, c, d, s;
      switch (rnd(0, 2)) {
        case 0:
          a = rnd(2, 12); b = rnd(2, 9); s = a + b; c = s + pick([-2, -1, 0, 0, 1, 2]);
          return cmpQ([a, '+', b], [c], s, c);
        case 1:
          a = rnd(8, 20); b = rnd(2, a - 1); s = a - b; c = Math.max(0, s + pick([-2, -1, 0, 0, 1, 2]));
          return cmpQ([a, '-', b], [c], s, c);
        default:
          a = rnd(2, 10); b = rnd(2, 10); c = rnd(2, 10); d = a + b - c + pick([-1, 0, 0, 1]);
          if (d < 1) d = 1;
          return cmpQ([a, '+', b], [c, '+', d], a + b, c + d);
      }
    } },
    { from: 11, key: 'nu_htu', gen: function () {
      var h = rnd(1, 9), t = rnd(0, 9), u = rnd(0, 9), n;
      switch (rnd(0, 2)) {
        case 0:
          h = rnd(1, 3); n = h * 100 + t * 10 + u;
          return { key: 'n:b' + n, ask: 'askBlocks', pic: { t: 'blocks', h: h, tens: t, u: u }, expr: [null], answer: n,
            wrong: [h * 100 + u * 10 + t, h + t + u, n + 100, n - 100, n + 10, n - 10] };
        case 1:
          return digitQ(h * 100 + t * 10 + u, pick(['u', 't', 'h']));
        default:
          // 5 sute, 0 zeci, 3 unități: the zero is the trap.
          if (chance(0.5)) t = 0;
          n = h * 100 + t * 10 + u;
          return { key: 'n:p' + n, ask: 'askFill',
            expr: place(h, 'hundreds').concat(place(t, 'tens'), place(u, 'ones'), ['=', null]), answer: n,
            wrong: [h * 10 + u, h * 100 + u * 10 + t, h + t + u, n + 10, n - 100] };
      }
    } },
    { from: 13, key: 'nu_frac', gen: function () {
      var n = pick([2, 3, 4, 4, 5, 6, 8]), k = rnd(1, n - 1), v = k + '/' + n;
      var wrong = [(n - k) + '/' + n, k + '/' + (n - k), '1/' + n, k + '/' + (n + 1), (k + 1) + '/' + n, (k - 1) + '/' + n];
      return { key: 'n:f' + v, ask: 'askFrac', pic: { t: chance(0.7) ? 'pie' : 'bar', n: n, k: k }, expr: [null], answer: v,
        wrong: wrong, more: FRACS, frac: true,
        // 2/4 is also 1/2 - an equal fraction must never be a wrong answer.
        valid: function (s) {
          var p = s.split('/');
          return +p[0] >= 1 && +p[1] >= 2 && +p[0] < +p[1] && fracValue(s) !== k / n;
        } };
    } },
    { from: 15, key: 'nu_round', gen: function () {
      var n;
      do { n = rnd(11, 99); } while (n % 10 === 0);
      var lo = n - n % 10, hi = lo + 10, ans = n % 10 >= 5 ? hi : lo;
      return { key: 'n:r' + n, ask: 'askRound10', pic: { t: 'line', lo: lo, hi: hi, at: n }, expr: [n, '≈', null], answer: ans,
        wrong: [ans === lo ? hi : lo, n, lo - 10, hi + 10] };
    } },
    { from: 17, key: 'nu_roman', gen: function () { return romanQ(1, 20); } },
    { from: 19, key: 'nu_seqhard', gen: function () {
      var s;
      switch (rnd(0, 3)) {
        case 0: return seqQ(pick([3, 4, 6, -3, -4, -5]), 100);
        case 1: return seqQ(pick([25, 50, 100, -25, -50]), 1000);
        case 2:
          s = pick([1, 2, 3, 5]);
          var q = seqOf([s, 2 * s, 4 * s, 8 * s, 16 * s], 8 * s);
          q.wrong = [10 * s, 12 * s, 20 * s, 32 * s, 15 * s];
          return q;
        default:
          // Gaps that grow by one: 1, 2, 4, 7, 11, ...
          s = rnd(1, 10);
          var g = [s, s + 1, s + 3, s + 6, s + 10];
          var q2 = seqOf(g, 4);
          q2.wrong = [q2.answer + 1, q2.answer - 1, q2.answer + 2, q2.answer - 2, q2.answer + 4];
          return q2;
      }
    } },
    { from: 21, key: 'nu_cmp1000', gen: function () {
      var r = Math.random(), a, b, n;
      if (r < 0.5) {
        a = rnd(100, 999);
        var h = Math.floor(a / 100), t = Math.floor(a / 10) % 10, u = a % 10;
        switch (rnd(0, 3)) {
          case 0: b = h * 100 + u * 10 + t; break;
          case 1: b = t ? t * 100 + h * 10 + u : a + 1; break;
          case 2: b = a; break;
          default: b = a + pick([-10, -1, 1, 10, 100, -100]);
        }
        b = Math.max(100, Math.min(999, b));
        return cmpQ([a], [b], a, b);
      }
      if (r < 0.75) {
        n = rnd(1, 9) * 100 + pick([-1, 0, 9, 10]);
        if (n < 100) n = 100;
        return neighborQ(n, n % 10 === 9);
      }
      var X = [[10, [11, 1, 99, 100]], [99, [98, 100, 90, 999]], [100, [101, 111, 999, 10]],
        [999, [998, 1000, 900, 99]], [98, [99, 100, 88, 96]], [11, [10, 13, 1, 9]]];
      var i = rnd(0, X.length - 1);
      return { key: 'n:x' + i, ask: 'askFill', expr: [words(say('mX' + i)), '=', null], answer: X[i][0], wrong: X[i][1] };
    } },
    { from: 23, key: 'nu_fracof', gen: function () {
      if (chance(0.3)) {
        var n = pick([3, 4, 5, 6, 8, 10]), a = rnd(1, n - 1), b = chance(0.2) ? a : rnd(1, n - 1);
        return { key: 'n:fc' + a + '/' + n + '?' + b, ask: 'askSign', expr: [{ frac: [a, n] }, null, { frac: [b, n] }], answer: signOf(a, b), sign: true };
      }
      var d = pick([2, 3, 4, 5, 10]), k = d > 2 && chance(0.35) ? rnd(2, d - 1) : 1, m = rnd(2, 10), whole = d * m, ans = k * m;
      return { key: 'n:fo' + k + '/' + d + 'of' + whole, ask: 'askCalc', expr: [{ frac: [k, d] }, '@of', whole, '=', null], answer: ans,
        wrong: [k > 1 ? m : whole - d, whole - d, ans + 1, ans - 1, whole * k],
        explain: k > 1 ? [whole, '/', d, '=', m, ';', m, 'x', k, '=', ans] : [whole, '/', d, '=', m] };
    } },
    { from: 25, key: 'nu_10000', gen: function () {
      var n = rnd(1000, 9999), a, b, th, h, t, u, lo;
      switch (rnd(0, 4)) {
        case 0: return digitQ(n, pick(['u', 't', 'h', 'th']));
        case 1:
          th = rnd(1, 9); h = rnd(0, 9); t = chance(0.4) ? 0 : rnd(0, 9); u = rnd(0, 9);
          n = th * 1000 + h * 100 + t * 10 + u;
          return { key: 'n:p' + n, ask: 'askFill',
            expr: place(th, 'thousands').concat(place(h, 'hundreds'), place(t, 'tens'), place(u, 'ones'), ['=', null]), answer: n,
            wrong: [th * 100 + h * 10 + u, th * 1000 + h * 100 + u * 10 + t, n + 100, n - 1000, th + h + t + u] };
        case 2:
          a = n; b = chance(0.3) ? a : a + pick([-1000, -100, -10, 10, 100, 1000, 90, -90]);
          b = Math.max(1000, Math.min(9999, b));
          return cmpQ([a], [b], a, b);
        case 3:
          do { n = rnd(101, 999); } while (n % 100 === 0);
          lo = n - n % 100;
          var ans = n % 100 >= 50 ? lo + 100 : lo;
          return { key: 'n:r' + n, ask: 'askRound100', pic: { t: 'line', lo: lo, hi: lo + 100, at: n }, expr: [n, '≈', null], answer: ans,
            wrong: [ans === lo ? lo + 100 : lo, Math.round(n / 10) * 10, lo - 100, lo + 200] };
        default:
          n = rnd(1, 9) * 1000 + pick([0, -1, 99, 100, 999]);
          return neighborQ(n, n % 10 === 9);
      }
    } },
    { from: 28, key: 'nu_romanbig', gen: function () { return romanQ(20, 100); } },
  ];

  // -------------------------------------------------------------- clock

  function tv(h, m) { return h + ':' + pad2(m); }
  function wrapH(h) { return ((h - 1) % 12 + 12) % 12 + 1; }

  // "8 fără un sfert", "quarter to 8" - how the time is said out loud.
  function timeWords(h, m) {
    var next = wrapH(h + 1);
    if (en()) {
      if (m === 0) return h + " o'clock";
      if (m === 15) return 'quarter past ' + h;
      if (m === 30) return 'half past ' + h;
      if (m === 45) return 'quarter to ' + next;
      return m < 30 ? m + ' past ' + h : (60 - m) + ' to ' + next;
    }
    if (m === 0) return 'ora ' + h;
    if (m === 15) return h + ' și un sfert';
    if (m === 30) return h + ' și jumătate';
    if (m === 45) return next + ' fără un sfert';
    return m < 30 ? h + ' și ' + m : next + ' fără ' + (60 - m);
  }

  // Romanian puts "de" before the unit from 20 up: 13 lei, 20 de lei, 101 lei.
  function de(n) { return n >= 20 && (n % 100 === 0 || n % 100 >= 20); }

  function minutesS(n) {
    if (en()) return n === 1 ? '1 minute' : n + ' minutes';
    return n === 1 ? '1 minut' : n + (de(n) ? ' de minute' : ' minute');
  }

  function dur(d) {
    return function () {
      if (d === 60) return T('mAnHour');
      if (d === 90) return T('mHourHalf');
      return minutesS(d);
    };
  }

  function clockQ(h, m, wrong, extra) {
    return assign({
      key: 'c:' + tv(h, m),
      ask: 'askClock',
      pic: { t: 'clock', h: h, m: m, fine: m % 5 !== 0 },
      expr: [null],
      answer: tv(h, m),
      wrong: wrong,
      clock: [h, m],
      setStep: 5,
      target: function () { return tv(h, m); },
      explain: [words(say('mHands'))],
    }, extra);
  }

  function dayQ() {
    var d = rnd(0, 6), after = chance(0.65), ans = (d + (after ? 1 : 6)) % 7;
    var name = function () { return T('m_days')[d]; };
    return {
      key: 'c:day' + d + after,
      ask: say(after ? 'mDayAfter' : 'mDayBefore', [name]),
      expr: after ? [words(name), '→', null] : [null, '→', words(name)],
      answer: 'd' + ans,
      wrong: ['d' + ((d + (after ? 6 : 1)) % 7), 'd' + ((d + (after ? 2 : 5)) % 7), 'd' + d, 'd' + ((d + 3) % 7)],
      show: function (v) { return T('m_days')[+v.slice(1)]; },
    };
  }

  function monthQ() {
    var m = rnd(0, 11), ans = (m + 1) % 12;
    var name = function () { return T('m_months')[m]; };
    return {
      key: 'c:mon' + m,
      ask: say('mMonthAfter', [name]),
      expr: [words(name), '→', null],
      answer: 'm' + ans,
      wrong: ['m' + ((m + 11) % 12), 'm' + ((m + 2) % 12), 'm' + m, 'm' + ((m + 6) % 12)],
      show: function (v) { return T('m_months')[+v.slice(1)]; },
    };
  }

  var TIME_FACTS = [
    [[1, '@week'], 7, '@days', [5, 6, 10, 12]],
    [[1, '@year'], 12, '@months', [10, 7, 24, 11]],
    [[1, '@day'], 24, '@hours', [12, 60, 10, 20]],
    [[1, '@hour'], 60, '@min', [100, 30, 24, 50]],
    [[{ frac: [1, 2] }, '@hour'], 30, '@min', [50, 15, 60, 20]],
    [[{ frac: [1, 4] }, '@hour'], 15, '@min', [25, 4, 30, 45]],
  ];
  var BIG_TIME_FACTS = [
    [[2, '@hours'], 120, '@min', [200, 60, 100, 90]],
    [[3, '@hours'], 180, '@min', [300, 120, 160, 90]],
    [[words(say('mHourHalf'))], 90, '@min', [150, 130, 60, 75]],
    [[2, '@weeks'], 14, '@days', [12, 10, 21, 16]],
  ];

  function timeFactQ(list) {
    var i = rnd(0, list.length - 1), f = list[i];
    return { key: 'c:f' + f[1] + f[2], ask: 'askFill', expr: f[0].concat(['=', null, f[2]]), answer: f[1], wrong: f[3] };
  }

  var CLOCK = [
    { from: 1, key: 'ck_hours', gen: function () {
      var h = rnd(1, 12);
      // 12:15 for three o'clock: the hands read the wrong way round.
      return clockQ(h, 0, [tv(wrapH(h + 1), 0), tv(wrapH(h - 1), 0), h !== 12 ? tv(12, h * 5 % 60) : tv(6, 0), tv(h, 30)]);
    } },
    { from: 4, key: 'ck_half', gen: function () {
      var h = rnd(1, 12);
      // Half past seven: the hour hand already leans towards 8.
      return clockQ(h, 30, [tv(wrapH(h + 1), 30), tv(h, 0), tv(wrapH(h - 1), 30), h !== 6 ? tv(6, h * 5 % 60) : tv(h, 6)]);
    } },
    { from: 7, key: 'ck_quarter', gen: function () {
      var h = rnd(1, 12), m = pick([15, 45]);
      // 7:03 - the minute hand on the 3 read as three minutes.
      return clockQ(h, m, [tv(h, 60 - m), tv(wrapH(h + 1), m), tv(wrapH(h - 1), m), tv(h, m / 5), tv(h, 30)]);
    } },
    { from: 9, key: 'ck_cal', gen: function () {
      var r = Math.random();
      if (r < 0.3) return dayQ();
      if (r < 0.5) return monthQ();
      return timeFactQ(TIME_FACTS);
    } },
    { from: 12, key: 'ck_five', gen: function () {
      var h = rnd(1, 12), m = pick([5, 10, 20, 25, 35, 40, 50, 55]);
      return clockQ(h, m, [tv(h, m / 5), tv(wrapH(h + 1), m), tv(h, m >= 55 ? m - 10 : m + 5), tv(h, m - 5), tv(h, 60 - m), tv(wrapH(h - 1), m)]);
    } },
    { from: 15, key: 'ck_say', gen: function () {
      var h = rnd(1, 12), m = pick([0, 15, 30, 45, 15, 45, 10, 20, 40, 50, 5, 25, 35, 55]);
      var v = function (a, b) { return a + '|' + b; };
      return clockQ(h, m, [v(wrapH(h + 1), m), v(h, (60 - m) % 60), v(wrapH(h - 1), m), v(h, (m + 15) % 60), v(h, (m + 30) % 60)], {
        key: 'c:w' + tv(h, m),
        ask: 'askClockSay',
        answer: v(h, m),
        show: function (x) { var p = x.split('|'); return timeWords(+p[0], +p[1]); },
        target: function () { return timeWords(h, m); },
      });
    } },
    { from: 18, key: 'ck_minute', gen: function () {
      var h = rnd(1, 12), m;
      do { m = rnd(1, 59); } while (m % 5 === 0);
      return clockQ(h, m, [tv(h, m >= 59 ? m - 2 : m + 1), tv(h, m - 1), tv(h, m >= 55 ? m - 10 : m + 5), tv(h, m < 5 ? m + 10 : m - 5),
        tv(wrapH(h + 1), m), tv(h, 60 - m)], { setStep: 1 });
    } },
    { from: 21, key: 'ck_24', gen: function () {
      var p = pick(['morning', 'afternoon', 'evening']);
      var h = p === 'morning' ? rnd(6, 11) : p === 'afternoon' ? rnd(1, 5) : rnd(6, 10);
      var m = pick([0, 15, 30, 45]), h24 = p === 'morning' ? h : h + 12, other = p === 'morning' ? h + 12 : h;
      return {
        key: 'c:24' + tv(h24, m), ask: 'askH24', pic: { t: 'clock', h: h, m: m, period: p }, expr: [null], answer: tv(h24, m),
        wrong: [tv(other, m), tv(h24 + 1, m), tv(h24 - 1, m), tv(h24 + 2, m), tv(h24, (m + 30) % 60)],
        valid: function (s) { var hh = +s.split(':')[0]; return hh >= 0 && hh <= 23; },
      };
    } },
    { from: 24, key: 'ck_later', gen: function () {
      var h = rnd(1, 12), m = rnd(0, 11) * 5, d = pick([10, 15, 20, 30, 30, 45, 60, 90]);
      var t = h * 60 + m + d, h2 = wrapH(Math.floor(t / 60)), m2 = t % 60;
      var wrong = [tv(h, m2), tv(wrapH(h2 + 1), m2), tv(h2, (m2 + 5) % 60), tv(wrapH(h2 - 1), m2)];
      // 7:50 and 20 minutes is not 7:70.
      if (m + d >= 60 && m + d < 100 && d < 60) wrong.unshift(h + ':' + (m + d));
      return {
        key: 'c:+' + d + tv(h, m), ask: say('mLater', [dur(d)]), pic: { t: 'clock', h: h, m: m }, expr: [null], answer: tv(h2, m2),
        story: true, tm: 1.5,
        wrong: wrong, explain: [tv(h, m), '+', words(dur(d)), '=', tv(h2, m2)],
      };
    } },
    { from: 27, key: 'ck_duration', gen: function () {
      if (chance(0.35)) return timeFactQ(BIG_TIME_FACTS);
      var h = rnd(1, 10), m = pick([0, 15, 30, 45, 10, 20, 40, 50]), d = pick([15, 30, 45, 60, 75, 90, 120, 20, 40]);
      var t = h * 60 + m + d, h2 = wrapH(Math.floor(t / 60)), m2 = t % 60;
      // 9:00 - 8:15 worked out like ordinary numbers: 900 - 815 = 85.
      var naive = (h2 * 100 + m2) - (h * 100 + m);
      return {
        key: 'c:d' + tv(h, m) + '-' + tv(h2, m2), ask: say('mDuration', [tv(h, m), tv(h2, m2)]), story: true, tm: 1.6,
        pic: { t: 'clocks', a: [h, m], b: [h2, m2] }, expr: [null, '@min'], answer: d,
        wrong: [naive, d + 15, d - 15, d + 10, d - 10, d + 60],
        explain: [tv(h, m), '→', tv(h2, m2), '=', d, '@min'],
      };
    } },
  ];

  // -------------------------------------------------------------- money

  var ITEMS = {
    ball:     { lo: 9, hi: 35, ro: ['minge', 'mingi', 'mingea', 'o minge', 'Câte'], en: ['ball', 'balls', 'the ball', 'a ball'] },
    book:     { lo: 12, hi: 45, ro: ['carte', 'cărți', 'cartea', 'o carte', 'Câte'], en: ['book', 'books', 'the book', 'a book'] },
    icecream: { lo: 4, hi: 9, ro: ['înghețată', 'înghețate', 'înghețata', 'o înghețată', 'Câte'], en: ['ice cream', 'ice creams', 'the ice cream', 'an ice cream'] },
    pencil:   { lo: 2, hi: 5, ro: ['creion', 'creioane', 'creionul', 'un creion', 'Câte'], en: ['pencil', 'pencils', 'the pencil', 'a pencil'] },
    car:      { lo: 10, hi: 40, ro: ['mașinuță', 'mașinuțe', 'mașinuța', 'o mașinuță', 'Câte'], en: ['toy car', 'toy cars', 'the toy car', 'a toy car'] },
    apple:    { lo: 1, hi: 3, ro: ['măr', 'mere', 'mărul', 'un măr', 'Câte'], en: ['apple', 'apples', 'the apple', 'an apple'] },
    juice:    { lo: 3, hi: 7, ro: ['suc', 'sucuri', 'sucul', 'un suc', 'Câte'], en: ['juice', 'juices', 'the juice', 'a juice'] },
    teddy:    { lo: 20, hi: 60, ro: ['ursuleț', 'ursuleți', 'ursulețul', 'un ursuleț', 'Câți'], en: ['teddy bear', 'teddy bears', 'the teddy bear', 'a teddy bear'] },
    notebook: { lo: 3, hi: 8, ro: ['caiet', 'caiete', 'caietul', 'un caiet', 'Câte'], en: ['notebook', 'notebooks', 'the notebook', 'a notebook'] },
  };

  function word(id, i) { var it = ITEMS[id]; return (en() ? it.en : it.ro)[i]; }
  function many(id) { return function () { return word(id, 1); }; }
  function the(id, capital) { return function () { var w = word(id, 2); return capital ? cap(w) : w; }; }
  function an(id, capital) { return function () { var w = word(id, 3); return capital ? cap(w) : w; }; }
  function howMany(id) { return function () { return ITEMS[id].ro[4]; }; }

  function leiS(n) {
    if (n === 1) return '1 leu';
    return n + (!en() && de(n) ? ' de lei' : ' lei');
  }
  function baniS(n) {
    if (n === 1) return '1 ban';
    return n + (!en() && de(n) ? ' de bani' : ' bani');
  }
  function lei(n) { return function () { return leiS(n); }; }
  function leiBaniS(l, b) {
    if (l && b) return leiS(l) + (en() ? ' ' : ' și ') + baniS(b);
    return l ? leiS(l) : baniS(b);
  }
  // Shop labels are short: "13 lei", "3,50 lei".
  function tag(l, b) {
    return function () {
      if (b) return l + (en() ? '.' : ',') + pad2(b) + ' lei';
      return l + (l === 1 ? ' leu' : ' lei');
    };
  }

  function price(id, cap_) { var it = ITEMS[id]; return rnd(it.lo, Math.max(it.lo, Math.min(it.hi, cap_))); }

  // The fewest notes that make an amount.
  function notesOf(total) {
    var out = [];
    [500, 200, 100, 50, 10, 5, 1].forEach(function (v) { while (total >= v) { out.push(v); total -= v; } });
    return out;
  }

  function lbValue(l, b) { return l + '|' + b; }
  function lbShow(x) { var p = x.split('|'); return leiBaniS(+p[0], +p[1]); }
  function lbValid(x) { var p = x.split('|'); return +p[0] >= 0 && +p[1] >= 0 && +p[1] <= 99 && (+p[0] || +p[1]); }

  function changeQ(pay, notes, id, p, extraWrong) {
    var ch = pay - p;
    return {
      key: 's:' + pay + '-' + id + p, story: true, tm: 2,
      ask: say('mChange', [lei(pay), the(id, true), lei(p)]),
      pic: { t: 'shop', items: [{ id: id, tag: tag(p) }], pay: notes },
      expr: [null, '@lei'], answer: ch,
      wrong: [p, pay + p, smallFromBig(pay, p), ch + 10, ch - 10].concat(extraWrong || []),
      explain: [pay, '-', p, '=', ch, '@lei'],
    };
  }

  var CHEAP = ['apple', 'pencil', 'juice', 'notebook', 'icecream'];

  var MONEY = [
    { from: 1, key: 'mo_lei', gen: function (c) {
      var den = c.L >= 3 ? [1, 5, 10] : [1, 5], k = rnd(2, c.L >= 3 ? 5 : 4), notes = [];
      for (var i = 0; i < k; i++) notes.push(pick(den));
      notes = sortDesc(notes);
      var s = sum(notes);
      return { key: 'l:' + notes.join('+'), ask: 'askLei', pic: { t: 'money', notes: notes }, expr: [null, '@lei'], answer: s,
        wrong: [k, s + 1, s - 1, s + 5, s - 5], explain: plusChain(notes).concat(['=', s, '@lei']) };
    } },
    { from: 4, key: 'mo_lei100', gen: function (c) {
      var notes, s;
      do {
        notes = [];
        for (var i = rnd(2, 6); i > 0; i--) notes.push(pick([1, 5, 10, 10, 50]));
        s = sum(notes);
      } while (s > 100);
      // From level 6 the notes come unsorted: tidying them up is half the job.
      if (c.L < 6 || chance(0.5)) notes = sortDesc(notes);
      return { key: 'l:' + notes.join('+'), ask: 'askLei', pic: { t: 'money', notes: notes }, expr: [null, '@lei'], answer: s,
        wrong: [notes.length, s + 10, s - 10, s + 5, s - 5, s + 1], explain: plusChain(notes).concat(['=', s, '@lei']) };
    } },
    { from: 7, key: 'mo_shop', gen: function () {
      var ids = shuffle(CHEAP.concat(['ball', 'car'])).slice(0, 2), p1, p2;
      do { p1 = price(ids[0], 30); p2 = price(ids[1], 30); } while (p1 + p2 > 50);
      return {
        key: 's:' + ids.join('') + p1 + '+' + p2, story: true, tm: 2,
        ask: say('mShopSum', [the(ids[0], true), lei(p1), the(ids[1]), lei(p2)]),
        pic: { t: 'shop', items: [{ id: ids[0], tag: tag(p1) }, { id: ids[1], tag: tag(p2) }] },
        expr: [null, '@lei'], answer: p1 + p2,
        wrong: [Math.abs(p1 - p2), p1 + p2 + 10, p1 + p2 - 10, noCarry(p1, p2)],
        explain: [p1, '+', p2, '=', p1 + p2, '@lei'],
      };
    } },
    { from: 10, key: 'mo_change', gen: function () {
      var id;
      switch (rnd(0, 2)) {
        case 0: id = pick(CHEAP); return changeQ(10, [10], id, rnd(ITEMS[id].lo, Math.min(9, ITEMS[id].hi)));
        case 1: id = pick(['ball', 'book', 'car']); return changeQ(20, [10, 10], id, rnd(Math.max(11, ITEMS[id].lo), 19));
        default: id = pick(['ball', 'book', 'car', 'teddy']); return changeQ(50, [50], id, rnd(Math.max(11, ITEMS[id].lo), Math.min(ITEMS[id].hi, 48)));
      }
    } },
    { from: 13, key: 'mo_bani', gen: function () {
      if (chance(0.15)) return { key: 'b:leu', ask: 'askFill', expr: [1, '@leu', '=', null, '@bani'], answer: 100, wrong: [10, 50, 1000, 60] };
      var coins, s;
      do {
        coins = [];
        for (var i = rnd(2, 5); i > 0; i--) coins.push(pick([1, 5, 10, 10, 50]));
        s = sum(coins);
      } while (s > 99);
      coins = sortDesc(coins);
      return { key: 'b:' + coins.join('+'), ask: 'askBani', pic: { t: 'money', coins: coins }, expr: [null, '@bani'], answer: s,
        wrong: [coins.length, s + 5, s - 5, s + 10, s - 10], explain: plusChain(coins).concat(['=', s, '@bani']) };
    } },
    { from: 16, key: 'mo_leibani', gen: function () {
      var notes = [], coins, i, B;
      for (i = rnd(1, 3); i > 0; i--) notes.push(pick([1, 1, 5]));
      do {
        coins = [];
        for (i = rnd(1, 3); i > 0; i--) coins.push(pick([10, 50, 5, 10]));
        B = sum(coins);
      } while (B >= 100);
      notes = sortDesc(notes); coins = sortDesc(coins);
      var L = sum(notes);
      return {
        key: 'lb:' + notes.join('+') + '/' + coins.join('+'), ask: 'askMoney', pic: { t: 'money', notes: notes, coins: coins },
        expr: [null], answer: lbValue(L, B),
        wrong: [lbValue(B, L), lbValue(L + 1, B), lbValue(L, B + 10), lbValue(L - 1, B), lbValue(L, B - 10), lbValue(L, (B + 50) % 100), lbValue(L + B, 0)],
        show: lbShow, valid: lbValid,
      };
    } },
    { from: 19, key: 'mo_times', gen: function () {
      var id = pick(CHEAP), p = rnd(Math.max(2, ITEMS[id].lo), Math.min(10, ITEMS[id].hi)), n = rnd(2, 5);
      if (chance(0.55)) {
        return {
          key: 's:' + n + 'x' + id + p, story: true, tm: 2,
          ask: say('mTimes', [an(id, true), lei(p), n, many(id)]),
          pic: { t: 'shop', items: [{ id: id, tag: tag(p), n: n }] },
          expr: [null, '@lei'], answer: n * p, wrong: [n + p, n * p + p, n * p - p], explain: [n, 'x', p, '=', n * p, '@lei'],
        };
      }
      var total = n * p;
      return {
        key: 's:' + total + '/' + id + p, story: true, tm: 2,
        ask: say('mHowMany', [an(id, true), lei(p), howMany(id), many(id), lei(total)]),
        pic: { t: 'shop', items: [{ id: id, tag: tag(p) }], pay: notesOf(total) },
        expr: [null, words(many(id))], answer: n, wrong: [total - p, n + 1, n - 1, p, n + 2], explain: [total, '/', p, '=', n],
      };
    } },
    { from: 22, key: 'mo_bignotes', gen: function () {
      if (chance(0.35)) {
        var ids = shuffle(CHEAP.concat(['ball', 'book', 'car'])).slice(0, 3), ps;
        do { ps = ids.map(function (id) { return price(id, 45); }); } while (sum(ps) > 100);
        var s = sum(ps);
        return {
          key: 's:' + ids.join('') + ps.join('+'), story: true, tm: 2, ask: 'askShop3',
          pic: { t: 'shop', items: ids.map(function (id, i) { return { id: id, tag: tag(ps[i]) }; }) },
          expr: [null, '@lei'], answer: s, wrong: [ps[0] + ps[1], s + 10, s - 10, noCarry(noCarry(ps[0], ps[1]), ps[2])],
          explain: plusChain(ps).concat(['=', s, '@lei']),
        };
      }
      var pay = pick([50, 100, 100]), id = pick(['ball', 'book', 'car', 'teddy']);
      var p = rnd(Math.max(ITEMS[id].lo, 11), Math.min(ITEMS[id].hi, pay - 3));
      // 100 - 37 = 73: both digits taken from ten, the borrow forgotten.
      var slip = pay === 100 ? (10 - p % 10) % 10 + ((10 - Math.floor(p / 10)) % 10) * 10 : -1;
      return changeQ(pay, [pay], id, p, [slip]);
    } },
    { from: 25, key: 'mo_steps', gen: function () {
      if (chance(0.5)) {
        var id = pick(['book', 'ball', 'car', 'notebook', 'juice']), n = rnd(2, 3), total = pick([50, 100]);
        var p = rnd(Math.max(ITEMS[id].lo, 3), Math.max(ITEMS[id].lo, Math.min(ITEMS[id].hi, Math.floor((total - 1) / n))));
        var cost = n * p, left = total - cost;
        return {
          key: 's:' + total + '-' + n + 'x' + id + p, story: true, tm: 2.2,
          ask: say('mLeft', [lei(total), n, many(id), lei(p)]),
          pic: { t: 'shop', items: [{ id: id, tag: tag(p), n: n }], pay: [total] },
          expr: [null, '@lei'], answer: left, wrong: [total - p, cost, left + 10, left - 10, left + p],
          explain: [n, 'x', p, '=', cost, ';', total, '-', cost, '=', left, '@lei'],
        };
      }
      var two = shuffle(['ball', 'book', 'juice', 'icecream', 'notebook', 'car', 'apple']).slice(0, 2);
      var budget = pick([20, 50, 100].filter(function (b) { return b > ITEMS[two[0]].lo + ITEMS[two[1]].lo; }));
      var p1, p2, tries = 0;
      do { p1 = price(two[0], budget); p2 = price(two[1], budget); } while (p1 + p2 >= budget && ++tries < 40);
      if (p1 + p2 >= budget) { p1 = ITEMS[two[0]].lo; p2 = ITEMS[two[1]].lo; }
      var rest = budget - p1 - p2;
      return {
        key: 's:' + budget + '-' + two.join('') + p1 + '+' + p2, story: true, tm: 2.2,
        ask: say('mLeft2', [lei(budget), an(two[0]), lei(p1), an(two[1]), lei(p2)]),
        pic: { t: 'shop', items: [{ id: two[0], tag: tag(p1) }, { id: two[1], tag: tag(p2) }], pay: notesOf(budget) },
        expr: [null, '@lei'], answer: rest, wrong: [budget - p1, budget - p2, p1 + p2, rest + 10, rest - 10],
        explain: [p1, '+', p2, '=', p1 + p2, ';', budget, '-', p1 + p2, '=', rest, '@lei'],
      };
    } },
    { from: 28, key: 'mo_changebani', gen: function () {
      var pay = pick([5, 10]), id = pick(['juice', 'icecream', 'notebook', 'pencil']);
      var L = rnd(1, pay - 1), B = rnd(1, 9) * 10;
      var cents = pay * 100 - (L * 100 + B), cL = Math.floor(cents / 100), cB = cents % 100;
      return {
        key: 's:' + pay + '-' + L + ',' + B, story: true, tm: 2.2,
        ask: say('mChange', [lei(pay), the(id, true), function () { return leiBaniS(L, B); }]),
        pic: { t: 'shop', items: [{ id: id, tag: tag(L, B) }], pay: [pay] },
        expr: [null], answer: lbValue(cL, cB),
        // 5 lei - 3 lei 50 bani = 2 lei 50 bani: the leu given up for the bani is forgotten.
        wrong: [lbValue(pay - L, B), lbValue(cL + 1, cB), lbValue(cL, 100 - cB), lbValue(cL - 1, cB), lbValue(cL, (cB + 50) % 100)],
        show: lbShow, valid: lbValid,
        explain: [words(lei(pay)), '-', words(function () { return leiBaniS(L, B); }), '=', words(function () { return leiBaniS(cL, cB); })],
      };
    } },
  ];

  // ------------------------------------------------------------- ladder

  var STAGES = { addsub: ADDSUB, muldiv: MULDIV, numbers: NUMBERS, clock: CLOCK, money: MONEY };

  // Share of questions answered on the keypad instead of from a list.
  var TYPE_SHARE = {
    addsub: [[5, 0.25], [9, 0.4], [15, 0.55], [23, 0.7]],
    muldiv: [[5, 0.25], [9, 0.4], [15, 0.55], [23, 0.7]],
    numbers: [[7, 0.2], [15, 0.35]],
    clock: [],
    money: [[10, 0.3], [20, 0.5]],
  };

  function share(table, L) {
    var v = 0;
    table.forEach(function (r) { if (L >= r[0]) v = r[1]; });
    return v;
  }

  function plan(set, level) {
    var L = Math.max(1, Math.min(MAX_LEVEL, level));
    return {
      level: L,
      options: L <= 3 ? 3 : L <= 17 ? 4 : 6,
      type: share(TYPE_SHARE[set], L),
      // "Set the clock" questions, where the hands are dragged into place.
      set: set === 'clock' ? (L < 10 ? 0 : L < 18 ? 0.3 : 0.4) : 0,
      pickSeconds: L < 12 ? 0 : Math.max(12, 25 - (L - 12) * 0.7),
      typeSeconds: L < 14 ? 0 : Math.max(20, 40 - (L - 14)),
      // Counters and dot arrays are a crutch for the first stretch only.
      help: L <= 10,
    };
  }

  function stageIndex(set, level) {
    var stages = STAGES[set], i = 0;
    for (var k = 0; k < stages.length; k++) if (stages[k].from <= level) i = k;
    return i;
  }

  // Mostly the newest stage, some of the one before, a little of the rest.
  function chooseStage(i) {
    var bag = [i, i, i, i, i, i];
    if (i >= 1) bag.push(i - 1, i - 1);
    if (i >= 2) bag.push(i - 2);
    if (i >= 3) bag.push(rnd(0, i - 3));
    return pick(bag);
  }

  function near(a) {
    if (a <= 20) return [a + 1, a - 1, a + 2, a - 2, a + 3];
    if (a <= 100) return [a + 1, a - 1, a + 10, a - 10, a + 2];
    return [a + 1, a - 1, a + 10, a - 10, a + 100, a - 100];
  }

  function options(q, p) {
    if (q.sign) return ['<', '=', '>'];
    if (q.opts) return q.opts.slice();
    var numeric = typeof q.answer === 'number';
    var count = p.options, out = [q.answer], seen = {};
    seen[String(q.answer)] = true;
    function add(v) {
      if (out.length >= count || v === undefined || v === null) return;
      if (numeric && (typeof v !== 'number' || !isFinite(v) || v < 0 || v !== Math.floor(v))) return;
      if (!numeric && typeof v !== 'string') return;
      if (q.valid && !q.valid(v)) return;
      var k = String(v);
      if (seen[k]) return;
      seen[k] = true;
      out.push(v);
    }
    shuffle(q.wrong || []).forEach(add);
    if (numeric) {
      shuffle(near(q.answer)).forEach(add);
      var spread = Math.max(4, Math.ceil(q.answer * 0.3));
      for (var t = 0; out.length < count && t < 60; t++) add(q.answer + rnd(-spread, spread));
    } else if (q.more) {
      shuffle(q.more).forEach(add);
    }
    // Boards are laid out 2, 3, 4 or 6 wide - five would leave a hole.
    if (out.length === 5) out.pop();
    return shuffle(out);
  }

  function finish(q, p) {
    if (q.pic && q.pic.help && !p.help) q.pic = null;
    q.plan = p;
    q.level = p.level;
    if (q.clock && Math.random() < p.set) {
      q.kind = 'set';
    } else if (typeof q.answer === 'number' && !q.noType && Math.random() < p.type) {
      q.kind = 'type';
    } else {
      q.kind = 'pick';
      q.options = options(q, p);
    }
    return q;
  }

  // recent: keys asked a moment ago. fresh: a stage has just opened - its
  // first question should be the new thing the level-up card announced.
  function make(set, level, recent, fresh) {
    var stages = STAGES[set], p = plan(set, level);
    var i = stageIndex(set, p.level), c = { L: p.level, recent: recent || {} }, q;
    for (var tries = 0; tries < 8; tries++) {
      q = stages[fresh ? i : chooseStage(i)].gen(c);
      if (!c.recent[q.key]) break;
    }
    q.set = set;
    return finish(q, p);
  }

  function unlocks(set, before, after) {
    var chips = [];
    STAGES[set].forEach(function (s) { if (s.from > before && s.from <= after) chips.push(T(s.key)); });
    var a = plan(set, before), b = plan(set, after);
    if (b.type && !a.type) chips.push(T('unlockType'));
    else if (b.type > a.type + 0.01) chips.push(T('unlockMoreType'));
    if (b.set && !a.set) chips.push(T('unlockSet'));
    if (b.options > a.options) chips.push(b.options + ' ' + T('unlockOptions'));
    if (b.pickSeconds && !a.pickSeconds) chips.push(T('unlockTimer') + ' ' + Math.round(b.pickSeconds) + 's');
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
