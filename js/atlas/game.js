// The Atlas game: datasets, the difficulty ladder, question building, tap
// judging and feedback. The six modes at the bottom register into
// window.MODES with game: 'atlas'; app.js runs them like any other mode.
//
// A question is either
//   pick - the thing is painted yellow, choose its name from a list, or
//   tap  - the name is given, find it yourself on the map.
// Every mode starts on "pick" and mixes in more "tap" as the run climbs.
window.Atlas = (function () {
  var Geo = window.AtlasGeo;
  var data = null;
  var loading = null;

  var FILES = ['./js/atlas/data-world.js', './js/atlas/data-regions.js', './js/atlas/data-nature.js'];

  // ------------------------------------------------------------ loading

  // The map data is about a megabyte, so the flag game does not pay for it:
  // it loads the first time the Atlas is opened (offline from the cache).
  function load(cb) {
    if (data) { cb(true); return; }
    if (loading) { loading.push(cb); return; }
    loading = [cb];
    var left = FILES.length;
    var failed = false;
    function finish(ok) {
      var waiting = loading;
      loading = null;
      if (ok) prepare();
      waiting.forEach(function (fn) { fn(ok); });
    }
    FILES.forEach(function (src) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { if (--left === 0 && !failed) finish(true); };
      s.onerror = function () { if (!failed) { failed = true; finish(false); } };
      document.body.appendChild(s);
    });
  }

  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  }

  function scale(arr, f) {
    return arr.map(function (v) { return v * f; });
  }

  function byRank(a, b) { return a.r - b.r; }

  function prepare() {
    var W = window.ATLAS_WORLD, R = window.ATLAS_REGIONS, N = window.ATLAS_NATURE;
    var flags = {};
    window.COUNTRIES.forEach(function (c) { flags[c.cc] = true; });

    var countries = W.countries.map(function (c) {
      return {
        cc: 'c:' + c.k, type: 'country', en: c.en, ro: c.ro, r: c.r,
        b: c.b, bb: c.bb, l: c.l, small: !!c.s, src: c, flag: flags[c.k] ? c.k : null,
      };
    }).sort(byRank);

    var regions = [], regionNamed = [];
    R.scenes.forEach(function (sc) {
      sc.box = scale(sc.b, R.step);
      sc.items = [];
      sc.units.forEach(function (u) {
        if (!u.k) return;
        var it = {
          cc: u.k, type: 'region', en: u.en, ro: u.ro, t: u.t,
          b: scale(u.b, R.step), l: scale(u.l, R.step), scene: sc, unit: u,
        };
        u.item = it;
        sc.items.push(it);
        regionNamed.push(it);
        if (u.t) regions.push(it);
      });
    });
    // Easiest first; inside a tier a fixed shuffle so a run hops between
    // countries instead of working through one.
    regions.sort(function (a, b) { return a.t - b.t || hash(a.cc) - hash(b.cc); });
    regions.forEach(function (it, i) { it.r = i; });
    regionNamed.forEach(function (it) { if (it.r === undefined) it.r = regions.length + (hash(it.cc) % 50); });

    function nature(type, list) {
      return list.map(function (x) {
        return {
          cc: x.k, type: type, en: x.en, ro: x.ro, r: x.r, t: x.t, d: x.d,
          b: scale(x.b, N.step), l: scale(x.l, N.step), lake: !!x.w, elev: x.e,
        };
      });
    }
    var rivers = nature('river', N.rivers).sort(byRank);
    var ranges = nature('range', N.ranges);
    var peaks = nature('peak', N.peaks);
    var waters = nature('water', N.waters).sort(byRank);

    data = {
      countries: countries,
      smallCountries: countries.filter(function (c) { return c.small; }),
      regions: regions,
      regionNamed: regionNamed,
      rivers: rivers,
      ranges: ranges,
      peaks: peaks,
      mountains: ranges.concat(peaks).sort(byRank),
      waters: waters,
    };
  }

  // --------------------------------------------------------- geometry

  function geom(it) {
    if (it.g) return it.g;
    var W = window.ATLAS_WORLD, N = window.ATLAS_NATURE;
    if (it.type === 'country') it.g = Geo.parse(it.src.d1, W.steps[1]);
    else if (it.type === 'region') it.g = unitGeom(it.scene, it.unit);
    else if (it.type === 'peak') it.g = [[it.l]];
    else it.g = Geo.parse(it.d, N.step);
    return it.g;
  }

  function unitGeom(scene, unit) {
    if (!unit.g) {
      unit.g = Geo.parse(unit.d, scene.step);
      unit.bb = Geo.bboxOf(unit.g);
    }
    return unit.g;
  }

  function shapeOf(it) {
    var W = window.ATLAS_WORLD, N = window.ATLAS_NATURE;
    if (it.type === 'country') return { d: it.src.d1, step: W.steps[1] };
    if (it.type === 'region') return { d: it.unit.d, step: it.scene.step };
    if (it.type === 'river') return { d: it.d, step: N.step, line: true };
    if (it.type === 'peak') return { point: it.l };
    return { d: it.d, step: N.step };
  }

  // ------------------------------------------------------------ ladder

  function tapShare(set, L) {
    if (set === 'countries') return L <= 2 ? 0.35 : L <= 6 ? 0.6 : 0.85;
    if (set === 'regions') return L < 6 ? 0 : L < 14 ? 0.35 : 0.55;
    if (set === 'waters') return L < 5 ? 0.2 : L < 14 ? 0.4 : 0.6;
    return L < 8 ? 0 : L < 16 ? 0.35 : 0.5;          // rivers, mountains
  }

  function plan(level, set) {
    var L = Math.max(1, Math.min(30, level));
    return {
      level: L,
      options: L <= 2 ? 3 : L <= 5 ? 4 : L <= 9 ? 5 : L <= 14 ? 6 : L <= 21 ? 7 : 8,
      // From level 7 the wrong answers are the neighbours, which is what
      // makes a question genuinely hard.
      near: L >= 7,
      tap: tapShare(set, L),
      pickSeconds: L < 10 ? 0 : Math.max(7, 18 - (L - 10) * 0.55),
      tapSeconds: L < 12 ? 0 : Math.max(10, 26 - (L - 12) * 0.8),
      // Late tap questions start further out: less context, more searching.
      wide: L >= 20,
    };
  }

  // ------------------------------------------------------- questions

  function candidates(set, target) {
    if (set === 'regions') return data.regionNamed;
    if (set === 'mountains') return target.type === 'peak' ? data.peaks : data.ranges;
    if (set === 'waters') return data.waters.filter(function (w) { return w.lake === target.lake; });
    return data[set];
  }

  function dist(a, b) {
    var dx = a.l[0] - b.l[0], dy = a.l[1] - b.l[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  function distractors(set, target, count, near) {
    var shuffle = window.Game.shuffle;
    var pool = candidates(set, target).filter(function (c) { return c !== target; });
    var ordered;
    if (near) {
      var close = pool.slice().sort(function (a, b) { return dist(a, target) - dist(b, target); });
      if (set === 'regions') {
        // Same country first: "which of these Russian regions is it?"
        var siblings = shuffle(close.filter(function (c) { return c.scene === target.scene; }));
        close = siblings.concat(close.filter(function (c) { return c.scene !== target.scene; }));
      }
      ordered = shuffle(close.slice(0, count + 3)).concat(close.slice(count + 3));
    } else {
      var around = pool.filter(function (c) {
        return Math.abs(c.r - target.r) <= 30 && (set !== 'regions' || c.scene !== target.scene);
      });
      ordered = shuffle(around).concat(shuffle(pool));
    }
    var out = [];
    var seen = {};
    seen[target.en] = seen[target.ro] = true;
    for (var i = 0; i < ordered.length && out.length < count; i++) {
      var c = ordered[i];
      if (seen[c.en] || seen[c.ro]) continue;
      seen[c.en] = seen[c.ro] = true;
      out.push(c);
    }
    return out;
  }

  function question(set, target, level) {
    var p = plan(level, set);
    var kind = target.type !== 'peak' && Math.random() < p.tap ? 'tap' : 'pick';
    var q = { set: set, target: target, kind: kind, level: p.level, plan: p, delayWrong: 2600, delayRight: 1000 };
    if (kind === 'pick') {
      q.options = window.Game.shuffle([target].concat(distractors(set, target, p.options - 1, p.near)));
    }
    return q;
  }

  // --------------------------------------------------------------- views

  function grow(b, f, minW, minH) {
    var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    var hw = Math.max((b[2] - b[0]) * (0.5 + f), minW / 2);
    var hh = Math.max((b[3] - b[1]) * (0.5 + f), (minH === undefined ? minW * 0.55 : minH) / 2);
    return [cx - hw, cy - hh, cx + hw, cy + hh];
  }

  function union(a, b) {
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
  }

  function clipToWorld(b) {
    var v = window.ATLAS_WORLD.view;
    var w = b[2] - b[0], h = b[3] - b[1];
    var x0 = Math.max(v[0], Math.min(v[2] - w, b[0]));
    var y0 = Math.max(v[1], Math.min(v[3] - h, b[1]));
    return [x0, y0, x0 + w, y0 + h];
  }

  // A place that is the whole scene (Bir Tawil, Baikonur) needs the
  // countries around it, or the map is just sand.
  function regionMin(t, base) {
    return t.scene.units.length === 1 ? base * 3.2 : 5000;
  }

  function pickView(q) {
    var t = q.target;
    // Tiny island states would otherwise sit alone in an empty ocean.
    if (t.type === 'country') return grow(t.b, 0.9, t.small ? 36000 : 16000);
    if (t.type === 'region') return grow(union(t.scene.box, t.b), 0.08, regionMin(t, 5000));
    if (t.type === 'river') return grow(t.b, 0.35, 10000);
    if (t.type === 'peak') return grow([t.l[0], t.l[1], t.l[0], t.l[1]], 0, 16000);
    if (t.type === 'range') return grow(t.b, 0.6, 14000);
    return grow(t.b, 0.35, t.lake ? 9000 : 12000);
  }

  // Where a "find it" question starts: never centred on the answer.
  function tapView(q) {
    var t = q.target;
    if (t.type === 'country') return window.ATLAS_WORLD.view;
    if (t.type === 'region') return grow(union(t.scene.box, t.b), 0.08, regionMin(t, 8000));
    var span = Math.max(46000, 3 * Math.max(t.b[2] - t.b[0], t.b[3] - t.b[1])) * (q.plan.wide ? 1.9 : 1);
    var cx = (t.b[0] + t.b[2]) / 2 + (Math.random() - 0.5) * span * 0.45;
    var cy = (t.b[1] + t.b[3]) / 2 + (Math.random() - 0.5) * span * 0.25;
    return clipToWorld([cx - span / 2, cy - span * 0.3, cx + span / 2, cy + span * 0.3]);
  }

  // ------------------------------------------------------------- judging

  function slopUnits(map, px) { return px / map.k; }

  // What sits under a tap, for "you tapped: X" - or null for open sea.
  function hitCountry(map, x, y) {
    var slop = slopUnits(map, 12);
    var dots = map.visibleDots();
    var best = null, bestD = Infinity;
    dots.forEach(function (dt) {
      var d = Math.sqrt(Math.pow(dt.c.l[0] - x, 2) + Math.pow(dt.c.l[1] - y, 2));
      if (d < slopUnits(map, map.DOT_PX + 8) && d < bestD) { best = dt.c; bestD = d; }
    });
    if (best) return best;
    var near = null;
    bestD = slop;
    for (var i = 0; i < data.countries.length; i++) {
      var c = data.countries[i];
      if (!Geo.boxHas(c.bb, x, y, slop)) continue;
      var g = geom(c);
      if (Geo.inRings(g, x, y)) return c;
      var d2 = Geo.distTo(g, x, y, true);
      if (d2 < bestD) { bestD = d2; near = c; }
    }
    return near;
  }

  function hitUnit(scene, x, y) {
    for (var i = 0; i < scene.units.length; i++) {
      var u = scene.units[i];
      var g = unitGeom(scene, u);
      if (Geo.boxHas(u.bb, x, y, 0) && Geo.inRings(g, x, y)) return u;
    }
    return null;
  }

  function hitArea(list, x, y, exclude) {
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (it === exclude) continue;
      if (Geo.boxHas(it.b, x, y, 0) && Geo.inRings(geom(it), x, y)) return it;
    }
    return null;
  }

  function hitLine(map, list, x, y, exclude) {
    var slop = slopUnits(map, 16);
    var best = null, bestD = slop;
    list.forEach(function (it) {
      if (it === exclude || !Geo.boxHas(it.b, x, y, slop)) return;
      var d = Geo.distTo(geom(it), x, y, false);
      if (d < bestD) { bestD = d; best = it; }
    });
    return best;
  }

  // Returns { right, hit (item), hitShape (unnamed region unit), miss (km) }.
  function judge(map, q, x, y) {
    var t = q.target;
    var g = geom(t);
    var slop = slopUnits(map, 12);
    var right = false;
    var res = { right: false, hit: null, hitShape: null, miss: 0 };

    if (t.type === 'river') {
      right = Geo.distTo(g, x, y, false) <= slopUnits(map, 18);
    } else {
      right = Geo.inRings(g, x, y) || Geo.distTo(g, x, y, true) <= slop;
      // Tiny countries count on their ring as well as their outline.
      if (!right && t.small) {
        right = Math.sqrt(Math.pow(t.l[0] - x, 2) + Math.pow(t.l[1] - y, 2)) <= slopUnits(map, map.DOT_PX + 10);
      }
    }
    if (right) { res.right = true; return res; }

    if (t.type === 'country') res.hit = hitCountry(map, x, y);
    else if (t.type === 'region') {
      var u = hitUnit(t.scene, x, y);
      if (u && u.item) res.hit = u.item;
      else if (u) res.hitShape = { d: u.d, step: t.scene.step };
    } else if (t.type === 'river') res.hit = hitLine(map, data.rivers, x, y, t);
    else if (t.type === 'range') res.hit = hitArea(data.ranges, x, y, t);
    else if (t.type === 'water') res.hit = hitArea(data.waters, x, y, t);
    if (res.hit === t) res.hit = null;

    var p = Geo.nearestPoint(g, x, y);
    if (p) res.miss = Geo.km([x, y], p);
    return res;
  }

  // ----------------------------------------------------------- rendering

  function promptFor(q) {
    var p = document.createElement('p');
    p.className = 'prompt atlas-prompt';
    if (q.kind === 'tap') {
      var lead = document.createElement('span');
      lead.className = 'ask-lead';
      lead.textContent = window.T('askFind');
      var name = document.createElement('b');
      name.className = 'ask-name';
      name.textContent = window.NAME(q.target);
      p.appendChild(lead);
      p.appendChild(name);
      return p;
    }
    var t = q.target;
    var key = t.type === 'country' ? 'askPickCountry'
      : t.type === 'region' ? 'askPickRegion'
      : t.type === 'river' ? 'askPickRiver'
      : t.type === 'range' ? 'askPickRange'
      : t.type === 'peak' ? 'askPickPeak'
      : t.lake ? 'askPickLake' : 'askPickSea';
    p.textContent = window.T(key);
    return p;
  }

  // Background layers depend only on the kind of thing being asked, so they
  // are rebuilt only when that changes.
  function layersFor(map, q) {
    var t = q.target;
    var key = t.type === 'region' ? 'scene:' + t.scene.id
      : t.type === 'country' ? 'countries:' + q.kind
      : t.type === 'peak' || t.type === 'range' ? 'mountains'
      : t.type;
    if (map.layerKey === key) return;
    map.layerKey = key;
    map.setScene(t.type === 'region' ? t.scene : null);
    map.setDots(t.type === 'country' && q.kind === 'tap' ? data.smallCountries : null);
    map.setRivers(t.type === 'river' ? data.rivers : null);
    map.setRanges(t.type === 'range' || t.type === 'peak' ? data.ranges : null);
    map.setPeaks(t.type === 'range' || t.type === 'peak' ? data.peaks : null);
    map.root.setAttribute('data-layer', t.type);
  }

  function onScreenSize(map, it) {
    if (it.type === 'peak') return 0;
    return Math.max(it.b[2] - it.b[0], it.b[3] - it.b[1]) * map.k;
  }

  function fmtKm(n) {
    var v = Math.round(n / 10) * 10;
    var s = String(v);
    var sep = window.Store.get('lang') === 'en' ? ',' : '.';
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }

  function burstAt(map, sx, sy) {
    var r = map.root.getBoundingClientRect();
    window.FX.burst(r.left + sx, r.top + sy, 1);
  }

  function render(stage, q, done) {
    var map = window.AtlasMap.get();
    var t = q.target;
    map.stopAnim();
    map.onTap = null;
    stage.classList.add('is-atlas');

    var wrap = document.createElement('div');
    wrap.className = 'atlas-play kind-' + q.kind;
    var board = null;

    wrap.appendChild(promptFor(q));
    var mapBox = document.createElement('div');
    mapBox.className = 'atlas-mapbox';
    wrap.appendChild(mapBox);

    var note = document.createElement('div');
    note.className = 'atlas-note';
    note.hidden = true;
    mapBox.appendChild(note);

    var hint = null;
    if (q.kind === 'tap') {
      hint = document.createElement('div');
      hint.className = 'atlas-hint';
      hint.textContent = window.T('mapHint');
      mapBox.appendChild(hint);
    } else {
      board = window.QuizKit.nameButtons(q, done, null, function (chosen, right) {
        reveal(right, chosen && chosen !== t ? chosen : null, null, null);
      });
      board.el.classList.add('atlas-answers');
      wrap.appendChild(board.el);
    }
    stage.appendChild(wrap);

    map.attach(mapBox);
    // Anything that settles a frame later (fonts, the timer) must not leave
    // the map measuring the wrong box.
    requestAnimationFrame(function () { map.resize(); });
    layersFor(map, q);
    map.clearMarks();

    var view = q.kind === 'tap' ? tapView(q) : pickView(q);
    map.setHome(view);
    map.fit(view);

    if (q.kind === 'pick') {
      map.mark(shapeOf(t), 'target');
      if (onScreenSize(map, t) < 18) map.addBeacon(t.l[0], t.l[1], 'target');
    }

    var locked = false;

    // Paint the outcome on the map. Called for taps, picks and timeouts.
    function reveal(right, wrongItem, tap, miss) {
      if (hint) hint.hidden = true;
      map.clearLabels();
      if (q.kind === 'pick') map.clearMarks();
      if (wrongItem) {
        map.mark(shapeOf(wrongItem), 'bad');
        map.addLabel(wrongItem.l[0], wrongItem.l[1], window.NAME(wrongItem), 'bad');
      }
      map.mark(shapeOf(t), 'ok');
      if (!right && (onScreenSize(map, t) < 30 || tap)) map.addBeacon(t.l[0], t.l[1], 'ok');
      map.addLabel(t.l[0], t.l[1], window.NAME(t), 'ok');
      if (tap) map.addBeacon(tap[0], tap[1], 'tap');
      if (miss) {
        note.textContent = window.T('missBy') + ' ' + fmtKm(miss) + ' km';
        note.hidden = false;
      }
      // Bring the answer into view if it is off screen or tiny.
      if (!right) {
        var box = t.type === 'peak' ? grow([t.l[0], t.l[1], t.l[0], t.l[1]], 0, 12000) : t.b;
        if (wrongItem) box = union(box, wrongItem.type === 'peak' ? [wrongItem.l[0], wrongItem.l[1], wrongItem.l[0], wrongItem.l[1]] : wrongItem.b);
        if (tap) box = union(box, [tap[0], tap[1], tap[0], tap[1]]);
        var s = map.toScreen((box[0] + box[2]) / 2, (box[1] + box[3]) / 2);
        var fits = (box[2] - box[0]) * map.k < map.W * 0.9 && (box[3] - box[1]) * map.k < map.H * 0.9;
        var visible = s[0] > 0 && s[0] < map.W && s[1] > 0 && s[1] < map.H;
        if (!fits || !visible || onScreenSize(map, t) < 12) {
          map.fit(grow(box, 0.25, 9000), { animate: true, ms: 700 });
        }
      }
    }

    if (q.kind === 'tap') {
      map.onTap = function (x, y, sx, sy) {
        if (locked) return;
        locked = true;
        map.onTap = null;
        var res = judge(map, q, x, y);
        if (res.right) {
          window.FX.play('correct');
          burstAt(map, sx, sy);
          reveal(true, null, null, null);
          done({ correct: true, cc: t.cc, delay: q.delayRight });
        } else {
          window.FX.play('wrong');
          if (res.hitShape) map.mark(res.hitShape, 'bad');
          reveal(false, res.hit, [x, y], res.miss);
          done({ correct: false, cc: t.cc, delay: q.delayWrong });
        }
      };
    }

    return {
      timeout: function () {
        if (board) { board.api.timeout(); return; }
        if (locked) return;
        locked = true;
        map.onTap = null;
        reveal(false, null, null, null);
        done({ correct: false, cc: t.cc, delay: 2200 });
      },
    };
  }

  // ---------------------------------------------------------------- modes

  var SETS = ['countries', 'regions', 'mountains', 'rivers', 'waters'];
  var UNIT_KEY = {
    countries: 'unitCountries', regions: 'unitRegions', mountains: 'unitMountains',
    rivers: 'unitRivers', waters: 'unitWaters',
  };

  function unlocks(set) {
    return function (before, after) {
      var a = plan(before, set), b = plan(after, set);
      var chips = [];
      if (b.tap > 0 && a.tap === 0) chips.push(window.T('unlockFind'));
      else if (b.tap > a.tap + 0.01) chips.push(window.T('unlockMoreFind'));
      if (b.options > a.options) chips.push(b.options + ' ' + window.T('unlockOptions'));
      if (b.near && !a.near) chips.push(window.T('unlockNear'));
      if (b.pickSeconds && !a.pickSeconds) chips.push(window.T('unlockTimer') + ' ' + Math.round(b.pickSeconds) + 's');
      if (b.wide && !a.wide) chips.push(window.T('unlockWide'));
      return chips;
    };
  }

  function findItem(cc) {
    for (var i = 0; i < SETS.length; i++) {
      var list = SETS[i] === 'regions' ? data.regionNamed : data[SETS[i]];
      for (var j = 0; j < list.length; j++) if (list[j].cc === cc) return list[j];
    }
    return null;
  }

  // The shape itself, as a small picture - what a flag is to the flag game.
  function silhouette(it) {
    var sh = shapeOf(it);
    var b = it.b;
    var w = b[2] - b[0], h = b[3] - b[1];
    var pad = Math.max(w, h) * 0.1 + 1;
    return '<svg viewBox="' + (b[0] - pad) + ' ' + (b[1] - pad) + ' ' + (w + 2 * pad) + ' ' + (h + 2 * pad) +
      '" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g transform="scale(' + sh.step + ')">' +
      '<path class="' + (sh.line ? 'sil-line' : 'sil-area') + '" d="' + sh.d + '"></path></g></svg>';
  }

  // Result screen: what was missed, with the flag where there is one.
  function missedFigure(cc) {
    var it = findItem(cc);
    if (!it) return null;
    var fig = document.createElement('figure');
    fig.className = 'missed-atlas';
    if (it.flag) {
      var img = document.createElement('img');
      img.src = window.Game.flagUrl(it.flag, 'w160');
      img.alt = '';
      fig.appendChild(img);
    } else {
      var tile = document.createElement('span');
      tile.className = 'missed-ico';
      tile.innerHTML = it.type === 'peak' ? window.ICONS.mountain : silhouette(it);
      fig.appendChild(tile);
    }
    var cap = document.createElement('figcaption');
    cap.textContent = window.NAME(it);
    fig.appendChild(cap);
    return fig;
  }

  function mode(id, set, icon, color, dark) {
    return {
      id: 'atlas-' + id,
      game: 'atlas',
      icon: icon,
      color: color,
      dark: dark,
      titleKey: 'atlas_' + id,
      subKey: 'atlas_' + id + 'Sub',
      continuous: true,
      unitKey: UNIT_KEY[set],
      doneKey: 'atlasDone',
      runPool: function () { return data[set].slice(); },
      runTotal: function () { return window.ATLAS_META.counts[set]; },
      runChoice: function (round) {
        var target = window.Game.runTarget(round);
        if (!target) return null;
        return question(set, target, window.Game.runLevel(round.progress, round.runTotal));
      },
      seconds: function (level, item) {
        return item.kind === 'tap' ? item.plan.tapSeconds : item.plan.pickSeconds;
      },
      render: render,
      unlocks: unlocks(set),
      missedFigure: missedFigure,
    };
  }

  window.MODES = window.MODES || [];
  window.MODES.push(
    mode('countries', 'countries', 'pin', '#4cc9f0', '#1d84a8'),
    mode('regions', 'regions', 'regions', '#a06bff', '#6b3fc4'),
    mode('mountains', 'mountains', 'mountain', '#ff9f1c', '#b86b00'),
    mode('rivers', 'rivers', 'river', '#2ee6a8', '#0f9c6d'),
    mode('waters', 'waters', 'water', '#6d8dff', '#3d55c4'),
    {
      id: 'atlas-challenge',
      game: 'atlas',
      icon: 'bolt',
      color: '#ff5d73',
      dark: '#b32d40',
      titleKey: 'atlas_challenge',
      subKey: 'atlas_challengeSub',
      endless: true,
      lives: 3,
      scoreText: function (round) {
        return round.correct + ' ' + window.T('accuracy') +
          '  ·  ' + window.T('record') + ' ' + window.Store.bestOf('atlas-challenge');
      },
      // Everything mixed. The level climbs every five questions (app.js), and
      // the window into each list slides from famous towards obscure.
      makeItem: function (round) {
        var weights = [['countries', 3], ['regions', 2], ['mountains', 2], ['rivers', 2], ['waters', 2]];
        var total = 0;
        weights.forEach(function (w) { total += w[1]; });
        var roll = Math.random() * total, set = 'countries';
        for (var i = 0; i < weights.length; i++) {
          roll -= weights[i][1];
          if (roll < 0) { set = weights[i][0]; break; }
        }
        var list = data[set];
        var n = list.length;
        var L = Math.max(1, Math.min(30, round.level));
        var to = Math.max(12, Math.round(n * Math.min(1, 0.06 + L / 26)));
        var from = L <= 6 ? 0 : Math.round(to * 0.45 * (L - 6) / 24);
        var target = window.Game.pickTarget(list.slice(from, to), round.used);
        return question(set, target, L);
      },
      seconds: function (level, item) {
        return item.kind === 'tap' ? item.plan.tapSeconds : item.plan.pickSeconds;
      },
      render: render,
      missedFigure: missedFigure,
    }
  );

  return {
    load: load,
    ready: function () { return !!data; },
  };
})();
