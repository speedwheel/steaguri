// Persistent profile. One localStorage key, written lazily so a fast tapper
// never triggers a write per frame.
window.Store = (function () {
  var KEY = 'steaguri.v1';
  var DEFAULTS = {
    lang: 'ro',
    sound: true,
    fx: 'auto',
    timer: true,
    xp: 0,
    plays: 0,
    stars: {},    // modeId -> best stars in a round (0..3)
    best: {},     // modeId -> best score in an endless run
    mastery: {},  // cc -> { s: seen, w: wrong }
    gallery: [],  // { cc, mode, png, t }
  };

  var state;
  try {
    state = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (err) {
    state = {};
  }
  for (var k in DEFAULTS) {
    if (state[k] === undefined) {
      state[k] = (DEFAULTS[k] && typeof DEFAULTS[k] === 'object')
        ? JSON.parse(JSON.stringify(DEFAULTS[k]))
        : DEFAULTS[k];
    }
  }

  var pending = 0;
  function save() {
    if (pending) return;
    pending = setTimeout(function () {
      pending = 0;
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (err) {
        // Quota full - most likely the drawing gallery. Drop the oldest and retry once.
        state.gallery = state.gallery.slice(-4);
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err2) { /* give up */ }
      }
    }, 250);
  }

  // 30 levels. Each one costs more than the last, so the hard end of the
  // ladder takes real play to reach rather than one lucky round.
  var MAX_LEVEL = 30;
  function stepCost(lvl) { return 100 + lvl * 25; }
  function levelFor(xp) {
    var lvl = 1;
    var need = 0;
    while (lvl < MAX_LEVEL) {
      need += stepCost(lvl);
      if (xp < need) break;
      lvl++;
    }
    return lvl;
  }
  function xpFloor(level) {
    var need = 0;
    for (var l = 1; l < level; l++) need += stepCost(l);
    return need;
  }

  return {
    MAX_LEVEL: MAX_LEVEL,
    get: function (k) { return state[k]; },
    set: function (k, v) { state[k] = v; save(); },
    level: function () { return levelFor(state.xp); },
    // 0..1 progress inside the current level.
    levelProgress: function () {
      var lvl = this.level();
      if (lvl >= MAX_LEVEL) return 1;
      var lo = xpFloor(lvl);
      var hi = xpFloor(lvl + 1);
      return Math.max(0, Math.min(1, (state.xp - lo) / (hi - lo)));
    },
    // Returns true when the award pushed the player into a new level.
    addXp: function (amount) {
      var before = this.level();
      state.xp += amount;
      save();
      return this.level() > before;
    },
    starsFor: function (modeId) { return state.stars[modeId] || 0; },
    bestOf: function (modeId) { return state.best[modeId] || 0; },
    // Returns true when this run beat the stored record.
    setBest: function (modeId, value) {
      if (value > (state.best[modeId] || 0)) { state.best[modeId] = value; save(); return true; }
      return false;
    },
    setStars: function (modeId, stars) {
      if (stars > (state.stars[modeId] || 0)) { state.stars[modeId] = stars; save(); }
    },
    seen: function (cc, wasWrong) {
      var m = state.mastery[cc] || (state.mastery[cc] = { s: 0, w: 0 });
      m.s++;
      if (wasWrong) m.w++;
      else if (m.w > 0) m.w -= 0.5;  // forgive slowly, so old mistakes fade
      save();
    },
    masteryOf: function (cc) { return state.mastery[cc] || { s: 0, w: 0 }; },
    addDrawing: function (entry) {
      state.gallery.push(entry);
      if (state.gallery.length > 12) state.gallery = state.gallery.slice(-12);
      save();
    },
    removeDrawing: function (index) {
      state.gallery.splice(index, 1);
      save();
    },
    bumpPlays: function () { state.plays++; save(); },
    reset: function () {
      state = JSON.parse(JSON.stringify(DEFAULTS));
      try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
      save();
    },
  };
})();
