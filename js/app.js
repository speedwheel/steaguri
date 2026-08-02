// Screen router, round loop, scoring and question generation.
// Modes register themselves in window.MODES before this file runs.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var COUNTRIES = window.COUNTRIES;
  var byCc = {};
  COUNTRIES.forEach(function (c) { byCc[c.cc] = c; });

  // ------------------------------------------------------------ helpers

  function flagUrl(cc, size) {
    return './assets/flags/' + (size || 'w320') + '/' + cc.toLowerCase() + '.png';
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function sample(arr) { return arr[(Math.random() * arr.length) | 0]; }

  // Difficulty ladder: which tiers are in play, and how many answers to show.
  function levelPlan(level) {
    if (level <= 3)  return { tiers: [1],          options: 3, lookalikes: false };
    if (level <= 6)  return { tiers: [1, 2],       options: 4, lookalikes: false };
    if (level <= 9)  return { tiers: [1, 2, 3],    options: 4, lookalikes: true };
    return             { tiers: [1, 2, 3, 4], options: 6, lookalikes: true };
  }

  var Game = {
    byCc: byCc,
    flagUrl: flagUrl,
    shuffle: shuffle,
    sample: sample,
    levelPlan: levelPlan,

    pool: function (level, needShape) {
      var tiers = levelPlan(level).tiers;
      return COUNTRIES.filter(function (c) {
        return tiers.indexOf(c.tier) !== -1 && (!needShape || c.shape);
      });
    },

    // Pick the country to ask about. Mostly weighted towards ones the player
    // has got wrong before, so mistakes come back without feeling punitive.
    pickTarget: function (pool, used) {
      var fresh = pool.filter(function (c) { return used.indexOf(c.cc) === -1; });
      var candidates = fresh.length ? fresh : pool;
      if (Math.random() < 0.7) {
        var weighted = [];
        candidates.forEach(function (c) {
          var m = window.Store.masteryOf(c.cc);
          var weight = 1 + Math.max(0, m.w) * 3 + (m.s === 0 ? 0.5 : 0);
          for (var i = 0; i < Math.min(6, Math.round(weight)); i++) weighted.push(c);
        });
        if (weighted.length) return sample(weighted);
      }
      return sample(candidates);
    },

    // Wrong answers: confusable flags first on hard levels, then same region,
    // then anything else in the pool.
    distractors: function (target, pool, count, level) {
      var plan = levelPlan(level);
      var out = [];
      var seen = {};
      seen[target.cc] = true;

      function add(c) {
        if (!c || seen[c.cc]) return;
        seen[c.cc] = true;
        out.push(c);
      }

      if (plan.lookalikes) {
        var look = window.LOOKALIKE_MAP[target.cc] || [];
        shuffle(look).forEach(function (cc) {
          if (out.length < count && byCc[cc]) add(byCc[cc]);
        });
      }
      if (out.length < count) {
        shuffle(pool.filter(function (c) { return c.region === target.region; }))
          .forEach(function (c) { if (out.length < count) add(c); });
      }
      if (out.length < count) {
        shuffle(pool).forEach(function (c) { if (out.length < count) add(c); });
      }
      // Very small pools (level 1 + shape mode) may still fall short - top up
      // from every country so the board is never half empty.
      if (out.length < count) {
        shuffle(COUNTRIES).forEach(function (c) { if (out.length < count) add(c); });
      }
      return out;
    },

    // One multiple-choice question: the answer plus shuffled options.
    makeChoice: function (round, needShape) {
      var pool = Game.pool(round.level, needShape);
      var target = Game.pickTarget(pool, round.used);
      var count = levelPlan(round.level).options - 1;
      var options = shuffle([target].concat(Game.distractors(target, pool, count, round.level)));
      return { target: target, options: options };
    },
  };
  window.Game = Game;

  // ------------------------------------------------------------- screens

  var screens = ['home', 'play', 'result', 'gallery'];
  function show(name) {
    screens.forEach(function (s) {
      $('screen-' + s).classList.toggle('is-active', s === name);
    });
  }

  function applyLang() {
    document.documentElement.lang = window.Store.get('lang');
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = window.T(nodes[i].getAttribute('data-i18n'));
    }
    renderModes();
    renderLevel();
  }

  function renderLevel() {
    $('level-num').textContent = window.Store.level();
    $('xp-num').textContent = window.Store.get('xp');
    $('xp-fill').style.width = Math.round(window.Store.levelProgress() * 100) + '%';
  }

  function renderModes() {
    var grid = $('mode-grid');
    grid.innerHTML = '';
    window.MODES.forEach(function (mode) {
      var stars = window.Store.starsFor(mode.id);
      var btn = document.createElement('button');
      btn.className = 'mode-card';
      btn.style.setProperty('--card', mode.color);
      btn.style.setProperty('--card-dark', mode.dark);
      btn.innerHTML =
        '<span class="m-icon">' + (window.ICONS[mode.icon] || '') + '</span>' +
        '<span class="m-title"></span>' +
        '<span class="m-sub"></span>' +
        '<span class="m-stars">' +
          (stars ? '<b>' + '★'.repeat(stars) + '</b>' : '') +
          '☆'.repeat(3 - stars) +
        '</span>';
      btn.querySelector('.m-title').textContent = window.T(mode.titleKey);
      btn.querySelector('.m-sub').textContent = window.T(mode.subKey);
      btn.addEventListener('click', function () {
        window.FX.play('tap');
        startRound(mode);
      });
      grid.appendChild(btn);
    });
  }

  // --------------------------------------------------------- round logic

  var round = null;

  function startRound(mode) {
    var level = window.Store.level();
    round = {
      mode: mode,
      level: level,
      total: mode.items,
      index: 0,
      score: 0,
      correct: 0,
      streak: 0,
      used: [],
      missed: [],
      marks: [],
      extra: {},
      startedAt: 0,
    };
    window.CurrentRound = round;   // modes that keep their own tally read this
    window.Store.bumpPlays();
    $('score').textContent = '0';
    $('streak').hidden = true;
    renderDots();
    show('play');
    nextItem();
  }

  function renderDots() {
    var dots = $('dots');
    dots.innerHTML = '';
    for (var i = 0; i < round.total; i++) {
      var d = document.createElement('i');
      if (i < round.index) d.className = round.marks[i] ? 'ok' : 'bad';
      else if (i === round.index) d.className = 'now';
      dots.appendChild(d);
    }
  }

  function nextItem() {
    if (round.index >= round.total) { endRound(); return; }
    var stage = $('stage');
    stage.innerHTML = '';
    var item = round.mode.makeItem(round);
    round.current = item;
    round.startedAt = Date.now();
    round.mode.render(stage, item, resolve);
  }

  // Called by a mode once it has shown its own answer feedback.
  // result: { correct, cc, points (optional flat award), delay, noStreak }
  function resolve(result) {
    var elapsed = (Date.now() - round.startedAt) / 1000;
    var gained;

    if (result.points !== undefined) {
      gained = result.points;                        // draw / build modes
    } else if (result.correct) {
      gained = 10 + (elapsed < 5 ? 5 : 0);
      if (!result.noStreak) {
        round.streak++;
        if (round.streak >= 6) gained = Math.round(gained * 2);
        else if (round.streak >= 3) gained = Math.round(gained * 1.5);
      }
    } else {
      gained = 0;
      round.streak = 0;
    }

    if (result.cc) {
      window.Store.seen(result.cc, !result.correct);
      round.used.push(result.cc);
      if (!result.correct) round.missed.push(result.cc);
    }

    round.marks[round.index] = !!result.correct;
    round.index++;
    if (result.correct) round.correct++;
    round.score += gained;

    $('score').textContent = round.score;
    var streakEl = $('streak');
    if (round.streak >= 3) {
      streakEl.hidden = false;
      $('streak-num').textContent = round.streak;
      if (round.streak === 3 || round.streak === 6) window.FX.shake();
    } else {
      streakEl.hidden = true;
    }
    renderDots();

    setTimeout(nextItem, result.delay === undefined ? 850 : result.delay);
  }

  function endRound() {
    var accuracy = round.total ? round.correct / round.total : 0;
    var stars = accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1;
    window.Store.setStars(round.mode.id, stars);
    var levelledUp = window.Store.addXp(round.score);

    $('result-score').textContent = round.score;
    $('result-title').textContent = levelledUp ? window.T('newLevel')
      : stars === 3 ? window.T('greatJob')
      : window.T('roundDone');

    var starEls = $('result-stars').children;
    for (var i = 0; i < 3; i++) starEls[i].className = i < stars ? 'on' : '';

    var detail = round.mode.scoreText
      ? round.mode.scoreText(round)
      : round.correct + '/' + round.total + ' ' + window.T('accuracy');
    $('result-detail').textContent = detail;

    var missed = $('result-missed');
    missed.innerHTML = '';
    var uniqueMissed = round.missed.filter(function (cc, idx) {
      return round.missed.indexOf(cc) === idx;
    }).slice(0, 6);
    uniqueMissed.forEach(function (cc) {
      var fig = document.createElement('figure');
      var img = document.createElement('img');
      img.src = flagUrl(cc, 'w160');
      img.alt = '';
      var cap = document.createElement('figcaption');
      cap.textContent = window.NAME(byCc[cc]);
      fig.appendChild(img);
      fig.appendChild(cap);
      missed.appendChild(fig);
    });

    show('result');
    renderLevel();

    if (levelledUp) {
      window.FX.play('level');
      window.FX.rain(1.4);
    } else if (stars >= 2) {
      window.FX.play('star');
      window.FX.rain(stars === 3 ? 1.2 : 0.7);
    } else {
      window.FX.play('tap');
    }
  }

  // ------------------------------------------------------------- gallery

  function renderGallery() {
    var wrap = $('gallery');
    var items = window.Store.get('gallery');
    wrap.innerHTML = '';
    if (!items.length) {
      var note = document.createElement('p');
      note.className = 'empty-note';
      note.textContent = window.T('noDrawings');
      wrap.appendChild(note);
      return;
    }
    items.slice().reverse().forEach(function (entry, revIdx) {
      var realIdx = items.length - 1 - revIdx;
      var fig = document.createElement('figure');
      var img = document.createElement('img');
      img.src = entry.png;
      img.alt = '';
      var cap = document.createElement('figcaption');
      cap.textContent = byCc[entry.cc] ? window.NAME(byCc[entry.cc]) : entry.cc;
      var del = document.createElement('button');
      del.textContent = window.T('deleteOne');
      del.addEventListener('click', function () {
        window.Store.removeDrawing(realIdx);
        window.FX.toast(window.T('deleted'));
        renderGallery();
      });
      fig.appendChild(img);
      fig.appendChild(cap);
      fig.appendChild(del);
      wrap.appendChild(fig);
    });
  }

  // ------------------------------------------------------------ settings

  function syncSegs() {
    setSeg('seg-lang', window.Store.get('lang'));
    setSeg('seg-sound', window.Store.get('sound') ? 'on' : 'off');
    setSeg('seg-fx', window.Store.get('fx'));
  }

  function setSeg(id, value) {
    var buttons = $(id).children;
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('sel', buttons[i].getAttribute('data-val') === value);
    }
  }

  function onSeg(id, handler) {
    $(id).addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      window.FX.play('tap');
      handler(btn.getAttribute('data-val'));
      syncSegs();
    });
  }

  // ---------------------------------------------------------------- boot

  // Static chrome icons, painted once at boot.
  function paintIcons() {
    var map = {
      'btn-settings': 'gear',
      'btn-back': 'back',
      'btn-gallery-back': 'back',
    };
    for (var id in map) $(id).innerHTML = window.ICONS[map[id]];
    var slots = document.querySelectorAll('[data-icon]');
    for (var i = 0; i < slots.length; i++) {
      slots[i].innerHTML = window.ICONS[slots[i].getAttribute('data-icon')] || '';
    }
    document.querySelector('.logo-mark').innerHTML = window.ICONS.globe;
  }

  function boot() {
    paintIcons();
    applyLang();
    syncSegs();
    window.FX.applyTier();
    window.FX.startMeasuring();

    $('btn-settings').addEventListener('click', function () {
      window.FX.play('tap');
      $('sheet-settings').hidden = false;
    });
    $('btn-close-settings').addEventListener('click', function () {
      window.FX.play('tap');
      $('sheet-settings').hidden = true;
    });
    $('sheet-settings').addEventListener('click', function (e) {
      if (e.target === $('sheet-settings')) $('sheet-settings').hidden = true;
    });

    onSeg('seg-lang', function (v) { window.Store.set('lang', v); applyLang(); });
    onSeg('seg-sound', function (v) {
      window.Store.set('sound', v === 'on');
      window.FX.setMuted(v !== 'on');
    });
    onSeg('seg-fx', function (v) { window.Store.set('fx', v); window.FX.applyTier(); });

    $('btn-reset').addEventListener('click', function () {
      if (window.confirm(window.T('resetAsk'))) {
        window.Store.reset();
        applyLang();
        syncSegs();
        $('sheet-settings').hidden = true;
      }
    });

    $('btn-back').addEventListener('click', function () {
      window.FX.play('tap');
      show('home');
      renderLevel();
    });
    $('btn-again').addEventListener('click', function () {
      window.FX.play('tap');
      startRound(round.mode);
    });
    $('btn-result-home').addEventListener('click', function () {
      window.FX.play('tap');
      show('home');
      renderModes();
      renderLevel();
    });
    $('btn-gallery').addEventListener('click', function () {
      window.FX.play('tap');
      renderGallery();
      show('gallery');
    });
    $('btn-gallery-back').addEventListener('click', function () {
      window.FX.play('tap');
      show('home');
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function () { /* offline is a bonus */ });
      });
    }
  }

  boot();
})();
