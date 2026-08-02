// Persistent profile. One localStorage key, written lazily so a fast tapper
// never triggers a write per frame.
//
// There is deliberately no lifetime XP or account level: a run starts from the
// easiest flag every time, so the only thing worth keeping between sessions is
// how far the best run got.
window.Store = (function () {
  var KEY = 'steaguri.v1';
  var DEFAULTS = {
    lang: 'ro',
    sound: true,
    fx: 'auto',
    timer: true,
    plays: 0,
    best: {},     // modeId -> furthest a run has ever got
    stars: {},    // modeId -> best stars (the drawing modes)
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

  return {
    get: function (k) { return state[k]; },
    set: function (k, v) { state[k] = v; save(); },

    bestOf: function (modeId) { return state.best[modeId] || 0; },
    // Returns true when this run beat the stored record.
    setBest: function (modeId, value) {
      if (value > (state.best[modeId] || 0)) { state.best[modeId] = value; save(); return true; }
      return false;
    },

    starsFor: function (modeId) { return state.stars[modeId] || 0; },
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
