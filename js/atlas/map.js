// The Atlas map: one SVG world that pans, pinches and zooms, plus overlay
// layers for whatever the current question needs.
//
// Old-tablet strategy: while a finger is moving, only a CSS transform on the
// <svg> changes - the GPU stretches the last rendered picture, nothing is
// redrawn. When the gesture ends the new view is "committed" (viewBox set,
// transform cleared) and the vector paths are drawn once, crisp. The SVG is
// rendered with a margin around the visible area so short pans never show an
// empty edge.
window.AtlasMap = (function () {
  var NS = 'http://www.w3.org/2000/svg';
  var Geo = window.AtlasGeo;

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function AtlasMap() {
    var W = window.ATLAS_WORLD;
    this.world = W;
    this.view = W.view;
    // Panning stops a little past the drawn world on every side.
    this.bounds = [W.view[0] - 20000, W.view[1] - 20000, W.view[2] + 20000, W.view[3] + 50000];
    this.cx = (W.view[0] + W.view[2]) / 2;
    this.cy = (W.view[1] + W.view[3]) / 2;
    this.k = 0.004;
    this.W = 0;
    this.H = 0;
    this.M = 0;
    this.lod = -1;
    this.pointers = {};
    this.labels = [];
    this.onTap = null;
    this.home = null;
    this.anim = 0;
    this.build();
  }

  var P = AtlasMap.prototype;

  // --------------------------------------------------------------- DOM

  P.build = function () {
    var W = this.world;
    var root = this.root = document.createElement('div');
    root.className = 'amap';

    var svg = this.svg = svgEl('svg', { 'class': 'amap-svg', preserveAspectRatio: 'none' });
    root.appendChild(svg);

    svgEl('rect', {
      'class': 'am-sea', x: this.bounds[0] - 200000, y: this.bounds[1] - 200000,
      width: this.bounds[2] - this.bounds[0] + 400000, height: this.bounds[3] - this.bounds[1] + 400000,
    }, svg);

    // A faint graticule makes the sea read as a map rather than a blank.
    var grat = svgEl('g', { 'class': 'am-grat' }, svg);
    var d = '';
    for (var lon = -180; lon <= 180; lon += 30) d += 'M' + lon * 1000 + ' -130000V130000';
    [-60, -30, 0, 30, 60].forEach(function (lat) {
      d += 'M-200000 ' + projectLat(lat) + 'H200000';
    });
    svgEl('path', { d: d }, grat);

    this.gLand = svgEl('g', { 'class': 'am-land' }, svg);
    this.landPaths = [];
    var self = this;
    W.countries.forEach(function (c) {
      self.landPaths.push(svgEl('path', { 'class': 'c' }, self.gLand));
    });
    this.otherPath = svgEl('path', { 'class': 'c other' }, this.gLand);
    this.gLakes = svgEl('g', { 'class': 'am-lakes' }, svg);
    this.lakePath = svgEl('path', {}, this.gLakes);

    this.gScene = svgEl('g', { 'class': 'am-scene' }, svg);
    this.gRanges = svgEl('g', { 'class': 'am-ranges' }, svg);
    this.gRivers = svgEl('g', { 'class': 'am-rivers' }, svg);
    this.gMarks = svgEl('g', { 'class': 'am-marks' }, svg);
    this.gPeaks = svgEl('g', { 'class': 'am-peaks' }, svg);
    this.gDots = svgEl('g', { 'class': 'am-dots' }, svg);

    this.layerLabels = document.createElement('div');
    this.layerLabels.className = 'amap-labels';
    root.appendChild(this.layerLabels);

    this.buildControls();
    this.bindInput();
  };

  P.buildControls = function () {
    var self = this;
    var bar = document.createElement('div');
    bar.className = 'amap-ctl';
    [['zoomIn', 'plus'], ['zoomOut', 'minus'], ['reset', 'target']].forEach(function (b) {
      var btn = document.createElement('button');
      btn.className = 'amap-btn';
      btn.setAttribute('aria-label', window.T('map_' + b[0]));
      btn.innerHTML = window.ICONS[b[1]];
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.FX.play('tap');
        if (b[0] === 'zoomIn') self.zoomBy(2);
        else if (b[0] === 'zoomOut') self.zoomBy(0.5);
        else if (self.home) self.fit(self.home, { animate: true });
      });
      // Taps on the buttons must never reach the map underneath.
      btn.addEventListener(window.PointerEvent ? 'pointerdown' : 'touchstart', function (e) { e.stopPropagation(); });
      bar.appendChild(btn);
    });
    this.root.appendChild(bar);
  };

  // Attach to a new parent (the map is reused between questions - rebuilding
  // 250 country paths each time would be the slowest thing in the game).
  P.attach = function (parent) {
    parent.appendChild(this.root);
    this.resize();
  };

  P.resize = function () {
    var r = this.root.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var changed = Math.abs(r.width - this.W) > 1 || Math.abs(r.height - this.H) > 1;
    this.W = r.width;
    this.H = r.height;
    this.M = Math.round(Math.max(this.W, this.H) * 0.3);
    this.svg.style.left = -this.M + 'px';
    this.svg.style.top = -this.M + 'px';
    this.svg.style.width = (this.W + 2 * this.M) + 'px';
    this.svg.style.height = (this.H + 2 * this.M) + 'px';
    this.svg.style.transformOrigin = this.M + 'px ' + this.M + 'px';
    // Zoomed all the way out shows the whole inhabited world.
    var v = this.view;
    this.minK = Math.min(this.W / (v[2] - v[0]), this.H / (v[3] - v[1])) * 0.92;
    this.maxK = this.minK * 60;
    if (changed) this.commit(this.cx, this.cy, this.k);
  };

  // ------------------------------------------------------------- views

  P.clamp = function (cx, cy, k) {
    k = Math.max(this.minK || k, Math.min(this.maxK || k, k));
    var b = this.bounds;
    var hw = this.W / 2 / k, hh = this.H / 2 / k;
    // Keep the centre inside the world, and never show more empty sea than
    // half a screen past its edge.
    cx = Math.max(b[0] + Math.min(hw, (b[2] - b[0]) / 2), Math.min(b[2] - Math.min(hw, (b[2] - b[0]) / 2), cx));
    cy = Math.max(b[1] + Math.min(hh, (b[3] - b[1]) / 2), Math.min(b[3] - Math.min(hh, (b[3] - b[1]) / 2), cy));
    return [cx, cy, k];
  };

  // The state for framing `box` with some breathing room.
  P.frame = function (box, pad) {
    pad = pad === undefined ? 0.12 : pad;
    var w = Math.max(1, box[2] - box[0]), h = Math.max(1, box[3] - box[1]);
    var k = Math.min(this.W * (1 - 2 * pad) / w, this.H * (1 - 2 * pad) / h);
    return this.clamp((box[0] + box[2]) / 2, (box[1] + box[3]) / 2, k);
  };

  P.fit = function (box, opts) {
    opts = opts || {};
    var s = this.frame(box, opts.pad);
    if (opts.animate) this.animateTo(s[0], s[1], s[2], opts.ms || 650);
    else this.commit(s[0], s[1], s[2]);
  };

  P.setHome = function (box) { this.home = box; };

  P.zoomBy = function (f, px, py) {
    if (px === undefined) { px = this.W / 2; py = this.H / 2; }
    var m = this.toMap(px, py);
    var k = Math.max(this.minK, Math.min(this.maxK, this.k * f));
    var cx = m[0] - (px - this.W / 2) / k, cy = m[1] - (py - this.H / 2) / k;
    var s = this.clamp(cx, cy, k);
    this.animateTo(s[0], s[1], s[2], 320);
  };

  // Screen (container px) <-> map units, for the committed view.
  P.toMap = function (px, py) {
    return [this.cx + (px - this.W / 2) / this.k, this.cy + (py - this.H / 2) / this.k];
  };
  P.toScreen = function (x, y, st) {
    st = st || [this.cx, this.cy, this.k];
    return [(x - st[0]) * st[2] + this.W / 2, (y - st[1]) * st[2] + this.H / 2];
  };
  P.unitsPerPx = function () { return 1 / this.k; };

  // Draw the view for real. This is the only place the vector paths redraw.
  P.commit = function (cx, cy, k) {
    var s = this.clamp(cx, cy, k);
    this.cx = s[0]; this.cy = s[1]; this.k = s[2];
    this.live = null;
    if (!this.W) return;
    var vw = (this.W + 2 * this.M) / this.k, vh = (this.H + 2 * this.M) / this.k;
    var vx = this.cx - (this.W / 2 + this.M) / this.k, vy = this.cy - (this.H / 2 + this.M) / this.k;
    this.svg.setAttribute('viewBox', vx + ' ' + vy + ' ' + vw + ' ' + vh);
    this.svg.style.transform = '';
    this.updateLOD();
    this.updateDots();
    this.updatePeaks();
    this.placeLabels();
  };

  // Show a different view without redrawing: stretch the committed picture.
  P.preview = function (cx, cy, k) {
    var s = this.clamp(cx, cy, k);
    this.live = s;
    var sc = s[2] / this.k;
    var tx = this.W / 2 * (1 - sc) + (this.cx - s[0]) * s[2];
    var ty = this.H / 2 * (1 - sc) + (this.cy - s[1]) * s[2];
    this.svg.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + sc.toFixed(4) + ')';
    this.placeLabels();
    return s;
  };

  P.stopAnim = function () {
    if (this.anim) { cancelAnimationFrame(this.anim); this.anim = 0; }
  };

  P.animateTo = function (cx, cy, k, ms) {
    var self = this;
    this.stopAnim();
    var s = this.clamp(cx, cy, k);
    var from = this.live || [this.cx, this.cy, this.k];
    if (!this.W || document.body.getAttribute('data-fx') === 'low') { this.commit(s[0], s[1], s[2]); return; }

    // Zooming out (or jumping somewhere new): draw the destination first,
    // then animate from the old framing into it - so no blank edges appear.
    // Zooming in: animate the current picture, then draw crisp at the end.
    var renderedHalfW = (this.W / 2 + this.M) / this.k, renderedHalfH = (this.H / 2 + this.M) / this.k;
    var destHalfW = this.W / 2 / s[2], destHalfH = this.H / 2 / s[2];
    var inside = Math.abs(s[0] - this.cx) + destHalfW <= renderedHalfW &&
                 Math.abs(s[1] - this.cy) + destHalfH <= renderedHalfH;
    if (!inside) {
      var oldHalfW = this.W / 2 / from[2], oldHalfH = this.H / 2 / from[2];
      var covers = Math.abs(from[0] - s[0]) + oldHalfW <= (this.W / 2 + this.M) / s[2] &&
                   Math.abs(from[1] - s[1]) + oldHalfH <= (this.H / 2 + this.M) / s[2];
      this.commit(s[0], s[1], s[2]);
      if (!covers) return;                 // too far apart to animate cleanly
      this.preview(from[0], from[1], from[2]);
    }

    var t0 = now();
    var lk0 = Math.log(from[2]), lk1 = Math.log(s[2]);
    function step() {
      var t = Math.min(1, (now() - t0) / ms);
      var e = ease(t);
      var kk = Math.exp(lk0 + (lk1 - lk0) * e);
      // Interpolate the centre in screen terms so the motion looks straight.
      var cxx = from[0] + (s[0] - from[0]) * e;
      var cyy = from[1] + (s[1] - from[1]) * e;
      if (t >= 1) {
        self.anim = 0;
        self.commit(s[0], s[1], s[2]);
        return;
      }
      self.preview(cxx, cyy, kk);
      self.anim = requestAnimationFrame(step);
    }
    this.anim = requestAnimationFrame(step);
  };

  // ------------------------------------------------------- land detail

  P.updateLOD = function () {
    var W = this.world;
    var lod = this.k > this.minK * 2.4 ? 1 : 0;
    if (lod === this.lod) return;
    this.lod = lod;
    var step = W.steps[lod];
    this.gLand.setAttribute('transform', 'scale(' + step + ')');
    this.gLakes.setAttribute('transform', 'scale(' + step + ')');
    for (var i = 0; i < W.countries.length; i++) {
      this.landPaths[i].setAttribute('d', lod ? W.countries[i].d1 : W.countries[i].d0);
    }
    this.otherPath.setAttribute('d', W.other[lod]);
    this.lakePath.setAttribute('d', W.lakes[lod]);
  };

  // Tiny countries get a ring so there is something to see and to tap.
  P.setDots = function (list) {
    while (this.gDots.firstChild) this.gDots.removeChild(this.gDots.firstChild);
    this.dots = [];
    var self = this;
    (list || []).forEach(function (c) {
      var el = svgEl('circle', { cx: c.l[0], cy: c.l[1], r: 1 }, self.gDots);
      self.dots.push({ c: c, el: el, on: false });
    });
    this.updateDots();
  };

  P.DOT_PX = 7;

  P.updateDots = function () {
    if (!this.dots) return;
    var r = this.DOT_PX / this.k;
    for (var i = 0; i < this.dots.length; i++) {
      var dt = this.dots[i];
      var b = dt.c.b;
      var size = Math.max(b[2] - b[0], b[3] - b[1]) * this.k;
      dt.on = size < 14;
      dt.el.setAttribute('r', r);
      dt.el.style.display = dt.on ? '' : 'none';
    }
  };

  P.visibleDots = function () {
    return (this.dots || []).filter(function (d) { return d.on; });
  };

  // -------------------------------------------------------- overlays

  P.clearGroup = function (g) {
    while (g.firstChild) g.removeChild(g.firstChild);
  };

  P.setScene = function (scene) {
    this.clearGroup(this.gScene);
    this.scenePaths = [];
    if (!scene) return;
    this.gScene.setAttribute('transform', 'scale(' + scene.step + ')');
    var self = this;
    scene.units.forEach(function (u) {
      self.scenePaths.push(svgEl('path', { 'class': 'u', d: u.d }, self.gScene));
    });
  };

  P.setRivers = function (list) {
    this.clearGroup(this.gRivers);
    if (!list) return;
    this.gRivers.setAttribute('transform', 'scale(' + window.ATLAS_NATURE.step + ')');
    var self = this;
    list.forEach(function (r) { svgEl('path', { d: r.d }, self.gRivers); });
  };

  P.setRanges = function (list) {
    this.clearGroup(this.gRanges);
    if (!list) return;
    this.gRanges.setAttribute('transform', 'scale(' + window.ATLAS_NATURE.step + ')');
    var self = this;
    list.forEach(function (r) { svgEl('path', { d: r.d }, self.gRanges); });
  };

  // Peaks are drawn as little triangles whose size stays constant on screen.
  P.setPeaks = function (list) {
    this.clearGroup(this.gPeaks);
    this.peaks = [];
    var self = this;
    (list || []).forEach(function (p) {
      var el = svgEl('path', { d: 'M0 -1L0.9 0.6L-0.9 0.6Z' }, self.gPeaks);
      self.peaks.push({ p: p, el: el });
    });
    this.updatePeaks();
  };

  P.updatePeaks = function () {
    if (!this.peaks) return;
    var s = 9 / this.k;
    for (var i = 0; i < this.peaks.length; i++) {
      var pk = this.peaks[i];
      pk.el.setAttribute('transform', 'translate(' + pk.p.l[0] + ' ' + pk.p.l[1] + ') scale(' + s + ')');
    }
    var marks = this.gMarks.querySelectorAll('[data-peak]');
    for (var j = 0; j < marks.length; j++) {
      var m = marks[j];
      m.setAttribute('transform', 'translate(' + m.getAttribute('data-x') + ' ' + m.getAttribute('data-y') +
        ') scale(' + (16 / this.k) + ')');
    }
  };

  P.clearMarks = function () {
    this.clearGroup(this.gMarks);
    this.clearLabels();
  };

  // Paint one feature on top of everything. cls: 'target' | 'ok' | 'bad'.
  //   shape: { d, step, line } for paths, { point: [x, y] } for a peak.
  P.mark = function (shape, cls) {
    if (shape.point) {
      var g = svgEl('path', {
        'class': 'mk mk-peak ' + cls, d: 'M0 -1L0.9 0.6L-0.9 0.6Z',
        'data-peak': 1, 'data-x': shape.point[0], 'data-y': shape.point[1],
      }, this.gMarks);
      this.updatePeaks();
      return g;
    }
    var grp = svgEl('g', { transform: 'scale(' + shape.step + ')' }, this.gMarks);
    if (shape.line) svgEl('path', { 'class': 'mk-casing', d: shape.d }, grp);
    svgEl('path', { 'class': 'mk ' + (shape.line ? 'mk-line ' : 'mk-area ') + cls, d: shape.d }, grp);
    return grp;
  };

  // ------------------------------------------------------------ labels

  // HTML labels and beacons ride on top of the SVG and follow it around.
  P.addLabel = function (x, y, text, cls) {
    // The outer element is a zero-size anchor on the point; the pill inside
    // centres itself on it, so positioning is one transform per frame.
    var el = document.createElement('div');
    el.className = 'amap-label ' + (cls || '');
    var pill = document.createElement('span');
    pill.textContent = text;
    el.appendChild(pill);
    this.layerLabels.appendChild(el);
    this.labels.push({ x: x, y: y, el: el });
    this.placeLabels();
    return el;
  };

  P.addBeacon = function (x, y, cls) {
    var el = document.createElement('div');
    el.className = 'amap-beacon ' + (cls || '');
    // A steady ring that is always visible, and a pulse around it.
    el.innerHTML = '<i></i><b></b>';
    this.layerLabels.appendChild(el);
    this.labels.push({ x: x, y: y, el: el });
    this.placeLabels();
    return el;
  };

  P.clearLabels = function () {
    this.labels.forEach(function (l) { if (l.el.parentNode) l.el.parentNode.removeChild(l.el); });
    this.labels = [];
  };

  P.placeLabels = function () {
    var st = this.live || [this.cx, this.cy, this.k];
    for (var i = 0; i < this.labels.length; i++) {
      var l = this.labels[i];
      var p = this.toScreen(l.x, l.y, st);
      var off = p[0] < -40 || p[1] < -40 || p[0] > this.W + 40 || p[1] > this.H + 40;
      l.el.style.display = off ? 'none' : '';
      l.el.style.transform = 'translate(' + Math.round(p[0]) + 'px,' + Math.round(p[1]) + 'px)';
      // Keep a name pill inside the map even when its point is at the edge.
      var pill = l.el.firstChild;
      if (pill && pill.tagName === 'SPAN') {
        if (!l.w) l.w = pill.offsetWidth;
        var half = l.w / 2 + 8;
        var shift = p[0] - half < 0 ? half - p[0] : p[0] + half > this.W ? this.W - half - p[0] : 0;
        pill.style.marginLeft = Math.round(shift) + 'px';
        pill.style.bottom = p[1] < 60 ? '-52px' : '';
      }
    }
  };

  // ------------------------------------------------------------- input

  P.bindInput = function () {
    var self = this;
    var root = this.root;
    var start = null;          // gesture start: pointers + view
    var moved = false;
    var multi = false;
    var downAt = 0;
    var lastMulti = 0;

    function local(e) {
      var r = root.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }

    function snapshot() {
      var ids = Object.keys(self.pointers);
      var pts = ids.map(function (id) { return self.pointers[id]; });
      var v = self.live || [self.cx, self.cy, self.k];
      if (pts.length >= 2) {
        var a = pts[0], b = pts[1];
        return {
          two: true, cx: v[0], cy: v[1], k: v[2],
          mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          dist: Math.max(10, dist2(a, b)),
        };
      }
      return { two: false, cx: v[0], cy: v[1], k: v[2], mid: pts[0] ? pts[0].slice() : [0, 0], dist: 1 };
    }

    function down(id, p) {
      self.stopAnim();
      self.pointers[id] = p;
      if (Object.keys(self.pointers).length === 1) { moved = false; multi = false; downAt = now(); }
      else multi = true;
      start = snapshot();
    }

    function move(id, p) {
      if (!self.pointers[id] || !start) return;
      self.pointers[id] = p;
      var ids = Object.keys(self.pointers);
      if (ids.length >= 2) {
        var a = self.pointers[ids[0]], b = self.pointers[ids[1]];
        var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        var dist = Math.max(10, dist2(a, b));
        var k = start.k * dist / start.dist;
        k = Math.max(self.minK, Math.min(self.maxK, k));
        var mx = start.cx + (start.mid[0] - self.W / 2) / start.k;
        var my = start.cy + (start.mid[1] - self.H / 2) / start.k;
        moved = true;
        self.preview(mx - (mid[0] - self.W / 2) / k, my - (mid[1] - self.H / 2) / k, k);
      } else {
        var dx = p[0] - start.mid[0], dy = p[1] - start.mid[1];
        if (!moved && Math.abs(dx) + Math.abs(dy) < 9) return;
        moved = true;
        var s = self.preview(start.cx - dx / start.k, start.cy - dy / start.k, start.k);
        // A long drag runs off the pre-drawn margin: redraw and carry on.
        var sc = self.k;
        if (Math.abs(s[0] - self.cx) * sc > self.M * 0.8 || Math.abs(s[1] - self.cy) * sc > self.M * 0.8) {
          self.commit(s[0], s[1], s[2]);
          start = snapshot();
          start.mid = p.slice();
        }
      }
    }

    function up(id, p) {
      if (!self.pointers[id]) return;
      delete self.pointers[id];
      var left = Object.keys(self.pointers).length;
      if (left > 0) {
        // Pinch -> one finger: restart the pan from here, without a jump.
        lastMulti = now();
        start = snapshot();
        return;
      }
      var wasMulti = multi;
      if (wasMulti) lastMulti = now();
      if (self.live) self.commit(self.live[0], self.live[1], self.live[2]);
      start = null;
      // A tap: short, still, one finger, and not the tail end of a pinch.
      if (!moved && !wasMulti && now() - downAt < 700 && now() - lastMulti > 350 && self.onTap) {
        var m = self.toMap(p[0], p[1]);
        self.onTap(m[0], m[1], p[0], p[1]);
      }
    }

    if (window.PointerEvent) {
      root.addEventListener('pointerdown', function (e) {
        if (e.button && e.button !== 0) return;
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* old engines */ }
        down(e.pointerId, local(e));
      });
      root.addEventListener('pointermove', function (e) { move(e.pointerId, local(e)); });
      root.addEventListener('pointerup', function (e) { up(e.pointerId, local(e)); });
      root.addEventListener('pointercancel', function (e) {
        delete self.pointers[e.pointerId];
        moved = true;
        if (!Object.keys(self.pointers).length && self.live) self.commit(self.live[0], self.live[1], self.live[2]);
      });
    } else {
      root.addEventListener('touchstart', function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) down(e.changedTouches[i].identifier, local(e.changedTouches[i]));
      });
      root.addEventListener('touchmove', function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) move(e.changedTouches[i].identifier, local(e.changedTouches[i]));
      });
      root.addEventListener('touchend', function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) up(e.changedTouches[i].identifier, local(e.changedTouches[i]));
      });
      root.addEventListener('mousedown', function (e) { down('m', local(e)); });
      window.addEventListener('mousemove', function (e) { if (self.pointers.m) move('m', local(e)); });
      window.addEventListener('mouseup', function (e) { if (self.pointers.m) up('m', local(e)); });
    }

    // Desktop wheel zoom: preview while the wheel spins, draw once it stops.
    var wheelTimer = 0;
    root.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.stopAnim();
      var p = local(e);
      var v = self.live || [self.cx, self.cy, self.k];
      var f = Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0018));
      var k = Math.max(self.minK, Math.min(self.maxK, v[2] * f));
      var mx = v[0] + (p[0] - self.W / 2) / v[2], my = v[1] + (p[1] - self.H / 2) / v[2];
      self.preview(mx - (p[0] - self.W / 2) / k, my - (p[1] - self.H / 2) / k, k);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function () {
        if (self.live) self.commit(self.live[0], self.live[1], self.live[2]);
      }, 160);
    }, { passive: false });
  };

  function dist2(a, b) {
    var dx = a[0] - b[0], dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  function projectLat(lat) {
    var phi = lat * Math.PI / 180, p2 = phi * phi;
    return Math.round(-phi * (1.0148 + p2 * p2 * (0.23185 + p2 * (-0.14499 + 0.02406 * p2))) * 180 / Math.PI * 1000);
  }

  var instance = null;
  return {
    get: function () {
      if (!instance) instance = new AtlasMap();
      return instance;
    },
  };
})();
