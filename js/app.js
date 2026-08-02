// Screen router, round loop, scoring and question generation.
// Modes register themselves in window.MODES before this file runs.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var COUNTRIES = window.COUNTRIES;
  var byCc = {};
  COUNTRIES.forEach(function (c) { byCc[c.cc] = c; });

  // Countries sorted easiest-to-hardest. Difficulty is a window that slides
  // along this list, so late levels ask about flags nobody just "knows".
  var BY_RANK = COUNTRIES.slice().sort(function (a, b) { return a.rank - b.rank; });
  var N = BY_RANK.length;
  // The difficulty ladder a single run climbs from start to finish.
  var MAX_LEVEL = 30;

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

  // The difficulty ladder.
  //
  //  from..to   window into BY_RANK. It widens to the whole world by level 18,
  //             and from level 7 the easy end is dropped as well, so the pool
  //             SHIFTS instead of just growing - by level 30 the 120 most
  //             recognisable countries are gone and only the hard tail is left.
  //  options    how many answers are on screen (3 -> 8)
  //  rounds     questions per round (10 -> 20)
  //  seconds    per-question countdown, 0 = untimed (kicks in at level 10)
  function levelPlan(level) {
    var L = Math.max(1, Math.min(MAX_LEVEL, level));
    var grow = Math.min(1, (L - 1) / 17);
    var to = Math.round(24 * Math.pow(N / 24, grow));
    var shift = L <= 6 ? 0 : (L - 6) / (MAX_LEVEL - 6);
    var from = Math.round(shift * N * 0.62);
    // Never let the window get too narrow to fill an answer board.
    if (from > to - 30) from = Math.max(0, to - 30);
    return {
      level: L,
      from: from,
      to: to,
      options: L <= 2 ? 3 : L <= 5 ? 4 : L <= 9 ? 5 : L <= 14 ? 6 : L <= 21 ? 7 : 8,
      rounds: L <= 4 ? 10 : L <= 9 ? 12 : L <= 16 ? 15 : L <= 23 ? 18 : 20,
      lookalikes: L >= 5,
      seconds: L < 10 ? 0 : Math.max(5, 14 - (L - 10) * 0.45),
    };
  }

  var Game = {
    byCc: byCc,
    flagUrl: flagUrl,
    shuffle: shuffle,
    sample: sample,
    levelPlan: levelPlan,

    // The countries in play at this level.
    pool: function (level, needShape) {
      var plan = levelPlan(level);
      var list = BY_RANK.slice(plan.from, plan.to);
      if (needShape) {
        list = list.filter(function (c) { return c.shape; });
        // Few of the obscure countries have a usable outline, so widen
        // downwards until there is enough to build a board from.
        var i = plan.from;
        while (list.length < 12 && i > 0) {
          i -= 10;
          list = BY_RANK.slice(Math.max(0, i), plan.to).filter(function (c) { return c.shape; });
        }
      }
      return list;
    },

    // Countries already left behind, used for the occasional refresher.
    reviewPool: function (level, needShape) {
      var plan = levelPlan(level);
      if (!plan.from) return [];
      return BY_RANK.slice(0, plan.from).filter(function (c) { return !needShape || c.shape; });
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

    // Wrong answers: confusable flags first once look-alikes are on, then the
    // same region, then anything else in the window.
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
      // Small pools (shape mode high up the ladder) may still fall short -
      // top up from every country so the board is never half empty.
      if (out.length < count) {
        shuffle(COUNTRIES).forEach(function (c) { if (out.length < count) add(c); });
      }
      return out;
    },

    // How hard a run is at this point: the whole ladder is spread across the
    // countries in the run, so finishing one means climbing all 30 levels.
    runLevel: function (progress, total) {
      var step = total / (MAX_LEVEL - 1);
      return Math.max(1, Math.min(MAX_LEVEL, 1 + Math.floor(progress / step)));
    },

    // Every country eligible for a run of this mode, easiest first.
    runPool: function (needShape) {
      return needShape ? BY_RANK.filter(function (c) { return c.shape; }) : BY_RANK.slice();
    },

    // A run walks the difficulty ranking from the front. The next question is
    // drawn from a short window of the easiest countries not yet won, so the
    // order stays unpredictable while the climb stays strictly easy-to-hard.
    runChoice: function (round) {
      var unseen = round.runPool.filter(function (c) { return !round.seen[c.cc]; });
      if (!unseen.length) return null;
      var window_ = unseen.slice(0, Math.min(10, unseen.length));
      // Weight the front of the window, and anything previously missed.
      var weighted = [];
      window_.forEach(function (c, i) {
        var m = window.Store.masteryOf(c.cc);
        var weight = (window_.length - i) + Math.max(0, m.w) * 2;
        for (var k = 0; k < Math.max(1, Math.round(weight)); k++) weighted.push(c);
      });
      var target = sample(weighted);

      var level = Game.runLevel(round.progress, round.runTotal);
      var count = levelPlan(level).options - 1;
      var options = shuffle([target].concat(Game.runDistractors(target, round, count, level)));
      return { target: target, options: options };
    },

    // Wrong answers come from look-alikes first, then neighbours on the
    // difficulty ranking, so they are always plausible for this stage.
    runDistractors: function (target, round, count, level) {
      var out = [];
      var seen = {};
      seen[target.cc] = true;
      function add(c) {
        if (!c || seen[c.cc]) return;
        seen[c.cc] = true;
        out.push(c);
      }
      if (levelPlan(level).lookalikes) {
        shuffle(window.LOOKALIKE_MAP[target.cc] || []).forEach(function (cc) {
          if (out.length < count) add(byCc[cc]);
        });
      }
      var pool = round.runPool;
      var at = pool.indexOf(target);
      var near = pool.slice(Math.max(0, at - 25), at + 26);
      shuffle(near).forEach(function (c) { if (out.length < count) add(c); });
      shuffle(pool).forEach(function (c) { if (out.length < count) add(c); });
      return out;
    },

    // One multiple-choice question: the answer plus shuffled options.
    makeChoice: function (round, needShape) {
      var level = round.level;
      var pool = Game.pool(level, needShape);
      var review = Game.reviewPool(level, needShape);
      // One question in six revisits something already left behind, so old
      // countries do not rot while the window moves on.
      var source = (review.length && Math.random() < 0.16) ? review : pool;
      var target = Game.pickTarget(source, round.used);
      var count = levelPlan(level).options - 1;
      var options = shuffle([target].concat(Game.distractors(target, pool, count, level)));
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

  // The only thing carried between sessions is the best run.
  function renderLevel() {
    var best = 0;
    var total = 0;
    window.MODES.forEach(function (m) {
      if (!m.continuous) return;
      var v = window.Store.bestOf(m.id);
      if (v > best) { best = v; total = Game.runPool(m.id === 'shape-name').length; }
    });
    $('level-num').textContent = best;
    // The badge carries the number, so the note carries the target.
    $('xp-note').textContent = best
      ? window.T('outOf') + ' ' + total + ' ' + window.T('countries')
      : window.T('startHint');
    $('xp-fill').style.width = (best && total ? (best / total * 100) : 0).toFixed(1) + '%';
  }

  function renderModes() {
    var grid = $('mode-grid');
    grid.innerHTML = '';
    window.MODES.forEach(function (mode) {
      var btn = document.createElement('button');
      btn.className = 'mode-card' + (mode.endless ? ' is-wide' : '');
      btn.style.setProperty('--card', mode.color);
      btn.style.setProperty('--card-dark', mode.dark);

      var badge;
      if (mode.endless || mode.continuous) {
        var best = window.Store.bestOf(mode.id);
        badge = best ? '<span class="rec">' + window.ICONS.trophy + best + '</span>' : '';
      } else {
        var stars = window.Store.starsFor(mode.id);
        badge = (stars ? '<b>' + starStr(stars) + '</b>' : '') + dimStarStr(3 - stars);
      }

      btn.innerHTML =
        '<span class="m-icon">' + (window.ICONS[mode.icon] || '') + '</span>' +
        '<span class="m-title"></span>' +
        '<span class="m-sub"></span>' +
        '<span class="m-stars">' + badge + '</span>';
      btn.querySelector('.m-title').textContent = window.T(mode.titleKey);
      btn.querySelector('.m-sub').textContent = window.T(mode.subKey);
      btn.addEventListener('click', function () {
        window.FX.play('tap');
        startRound(mode);
      });
      grid.appendChild(btn);
    });
  }

  function starStr(n) { var s = ''; for (var i = 0; i < n; i++) s += '★'; return s; }
  function dimStarStr(n) { var s = ''; for (var i = 0; i < n; i++) s += '☆'; return s; }

  // --------------------------------------------------------- round logic

  var round = null;

  function startRound(mode) {
    // Every run begins at the beginning. Drawing rounds sit at an easy stage.
    var base = 1;
    var plan = levelPlan(base);
    round = {
      mode: mode,
      baseLevel: base,
      startLevel: base,
      level: base,
      // A run always starts from the easiest country: three mistakes and it
      // is over, a clean run carries on until every flag in the world is done.
      continuous: !!mode.continuous,
      seen: {},
      progress: 0,
      won: false,
      total: mode.items || plan.rounds,
      endless: !!mode.endless,
      lives: mode.lives || 0,
      index: 0,
      score: 0,
      correct: 0,
      streak: 0,
      bestStreak: 0,
      used: [],
      missed: [],
      marks: [],
      extra: {},
      startedAt: 0,
      api: null,
    };
    if (round.continuous) {
      round.runPool = Game.runPool(mode.id === 'shape-name');
      round.runTotal = round.runPool.length;
      round.lives = mode.lives || 3;
      round.level = 1;                 // every run starts at the beginning
      round.startLevel = 1;
    }
    window.CurrentRound = round;
    $('play-level').textContent = base;
    window.Store.bumpPlays();
    $('score').textContent = '0';
    $('streak').hidden = true;
    renderProgress();
    show('play');
    nextItem();
  }

  // Continuous modes show the live level bar, the endless mode shows lives,
  // fixed rounds show a dot per question.
  function renderProgress() {
    var dots = $('dots');
    if (round.continuous) {
      if (dots.className !== 'dots is-climb') {
        dots.className = 'dots is-climb';
        dots.innerHTML =
          '<span class="run-hearts" id="run-hearts"></span>' +
          '<span class="levelbar-track"><i class="levelbar-fill" id="climb-fill"></i></span>' +
          '<b class="run-count" id="run-count"></b>';
      }
      var hearts = '';
      for (var h = 0; h < (round.mode.lives || 3); h++) {
        hearts += '<span class="heart' + (h < round.lives ? '' : ' gone') + '">' +
          window.ICONS.heart + '</span>';
      }
      $('run-hearts').innerHTML = hearts;
      var done = Math.min(round.progress, round.runTotal);
      $('climb-fill').style.width = (done / round.runTotal * 100).toFixed(1) + '%';
      $('run-count').textContent = done + '/' + round.runTotal;
      $('play-level').textContent = round.level;
      return;
    }
    dots.innerHTML = '';
    if (round.endless) {
      dots.className = 'dots is-lives';
      for (var h = 0; h < (round.mode.lives || 3); h++) {
        var heart = document.createElement('span');
        heart.className = 'heart' + (h < round.lives ? '' : ' gone');
        heart.innerHTML = window.ICONS.heart;
        dots.appendChild(heart);
      }
      var count = document.createElement('b');
      count.className = 'endless-count';
      count.textContent = round.index;
      dots.appendChild(count);
      return;
    }
    dots.className = 'dots';
    for (var i = 0; i < round.total; i++) {
      var d = document.createElement('i');
      if (i < round.index) d.className = round.marks[i] ? 'ok' : 'bad';
      else if (i === round.index) d.className = 'now';
      dots.appendChild(d);
    }
  }

  // ------------------------------------------------------------- timer

  var timerRaf = 0;
  var timerEnd = 0;

  function stopTimer() {
    if (timerRaf) { cancelAnimationFrame(timerRaf); timerRaf = 0; }
    $('timer').hidden = true;
  }

  function startTimer(seconds) {
    stopTimer();
    if (!seconds) return;
    var bar = $('timer');
    var fill = $('timer-fill');
    bar.hidden = false;
    bar.classList.remove('urgent');
    fill.style.transform = 'scaleX(1)';
    timerEnd = Date.now() + seconds * 1000;
    var total = seconds * 1000;
    function step() {
      var left = timerEnd - Date.now();
      if (left <= 0) {
        fill.style.transform = 'scaleX(0)';
        timerRaf = 0;
        onTimeout();
        return;
      }
      fill.style.transform = 'scaleX(' + (left / total).toFixed(3) + ')';
      bar.classList.toggle('urgent', left < 3000);
      timerRaf = requestAnimationFrame(step);
    }
    timerRaf = requestAnimationFrame(step);
  }

  function onTimeout() {
    $('timer').hidden = true;
    window.FX.play('wrong');
    if (round.api && round.api.timeout) round.api.timeout();
    else resolve({ correct: false, cc: round.current && round.current.target.cc, delay: 1400 });
  }

  // ------------------------------------------------------------- items

  function nextItem() {
    if (!round.endless && !round.continuous && round.index >= round.total) { endRound(); return; }
    // The endless mode ramps a level every five questions, on top of whatever
    // level the player has already reached.
    if (round.endless) {
      round.level = Math.min(MAX_LEVEL, round.baseLevel + Math.floor(round.index / 5));
      $('play-level').textContent = round.level;
    }
    var stage = $('stage');
    stage.innerHTML = '';
    var item = round.continuous ? Game.runChoice(round) : round.mode.makeItem(round);
    if (!item) { round.won = true; endRound(); return; }   // world completed
    round.current = item;
    round.startedAt = Date.now();
    round.api = round.mode.render(stage, item, resolve) || null;
    if (!round.mode.untimed && window.Store.get('timer') !== false) {
      startTimer(levelPlan(round.level).seconds);
    }
  }

  // Called by a mode once it has shown its own answer feedback.
  // result: { correct, cc, points (optional flat award), delay, noStreak }
  function resolve(result) {
    stopTimer();
    var elapsed = (Date.now() - round.startedAt) / 1000;
    var gained;

    if (result.points !== undefined) {
      gained = result.points;                        // draw / build modes
    } else if (result.correct) {
      var plan = levelPlan(round.level);
      // Harder levels are worth more, so climbing actually pays.
      gained = 10 + Math.round(plan.level * 1.2) + (elapsed < 5 ? 5 : 0);
      if (!result.noStreak) {
        round.streak++;
        if (round.streak > round.bestStreak) round.bestStreak = round.streak;
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
    if (round.endless && !result.correct) round.lives--;

    var delay = result.delay === undefined ? 850 : result.delay;

    if (round.continuous) {
      if (result.correct) {
        round.seen[result.cc] = true;
        round.progress++;
        var lvlBefore = round.level;
        round.level = Game.runLevel(round.progress, round.runTotal);
        if (round.level > lvlBefore) {
          showLevelUp(lvlBefore, round.level);
          delay = 2300;
        }
      } else {
        // A missed country is not banked - it comes back later in the run.
        round.lives--;
      }
    }

    $('score').textContent = round.score;
    var streakEl = $('streak');
    if (round.streak >= 3) {
      streakEl.hidden = false;
      $('streak-num').textContent = round.streak;
      if (round.streak === 3 || round.streak === 6) window.FX.shake();
    } else {
      streakEl.hidden = true;
    }
    renderProgress();

    if ((round.endless || round.continuous) && round.lives <= 0) {
      setTimeout(endRound, delay);
      return;
    }
    setTimeout(nextItem, delay);
  }

  function endRound() {
    stopTimer();
    var answered = round.index;
    var accuracy = answered ? round.correct / answered : 0;
    var stars = accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1;
    var record = false;

    if (round.continuous) {
      record = window.Store.setBest(round.mode.id, round.progress);
      var share = round.progress / round.runTotal;
      stars = round.won || share >= 0.75 ? 3 : share >= 0.4 ? 2 : 1;
    } else if (round.endless) {
      record = window.Store.setBest(round.mode.id, round.correct);
      stars = round.correct >= 30 ? 3 : round.correct >= 15 ? 2 : 1;
    } else {
      window.Store.setStars(round.mode.id, stars);
    }
    $('result-score').textContent = round.score;
    $('result-title').textContent = round.won ? window.T('worldDone')
      : record ? window.T('newRecord')
      : round.continuous ? window.T('runOver')
      : stars === 3 ? window.T('greatJob')
      : window.T('roundDone');

    var starEls = $('result-stars').children;
    for (var i = 0; i < 3; i++) starEls[i].className = i < stars ? 'on' : '';

    var detail = round.mode.scoreText
      ? round.mode.scoreText(round)
      : round.correct + '/' + answered + ' ' + window.T('accuracy');
    if (round.continuous) {
      detail = round.progress + '/' + round.runTotal + ' ' + window.T('countries') +
        '  \u00b7  ' + window.T('reachedLevel') + ' ' + round.level +
        '  \u00b7  ' + window.T('best') + ' ' + window.Store.bestOf(round.mode.id);
    }
    if (round.bestStreak >= 3) detail += '  ·  ' + window.T('bestStreak') + ' ' + round.bestStreak;
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

    if (round.won || record) {
      window.FX.play('level');
      window.FX.rain(1.4);
    } else if (stars >= 2) {
      window.FX.play('star');
      window.FX.rain(stars === 3 ? 1.2 : 0.7);
    } else {
      window.FX.play('tap');
    }
  }

  // What actually got harder, in words a child can read.
  function renderUnlocks(before, after, box) {
    box.innerHTML = '';
    if (after <= before) return;
    var a = levelPlan(before);
    var b = levelPlan(after);
    var chips = [];
    if (b.to > a.to) chips.push('+' + (b.to - a.to) + ' ' + window.T('unlockCountries'));
    if (b.options > a.options) chips.push(b.options + ' ' + window.T('unlockOptions'));
    if (b.rounds > a.rounds) chips.push(b.rounds + ' ' + window.T('unlockQuestions'));
    if (b.lookalikes && !a.lookalikes) chips.push(window.T('unlockLookalikes'));
    if (b.seconds && !a.seconds) chips.push(window.T('unlockTimer') + ' ' + Math.round(b.seconds) + 's');
    if (!chips.length) return;

    var title = document.createElement('p');
    title.className = 'unlocks-title';
    title.textContent = window.T('unlocked');
    box.appendChild(title);
    chips.forEach(function (text) {
      var chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = text;
      box.appendChild(chip);
    });
  }

  // Level-up without leaving the run: a card sits over the board for a couple
  // of seconds, then the next - harder - question comes straight up.
  function showLevelUp(before, after) {
    var box = $('levelup');
    $('levelup-num').textContent = after;
    renderUnlocks(before, after, $('levelup-unlocks'));
    box.hidden = false;
    window.FX.play('level');
    window.FX.rain(1.2);
    clearTimeout(showLevelUp.timer);
    showLevelUp.timer = setTimeout(function () { box.hidden = true; }, 2100);
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
    setSeg('seg-timer', window.Store.get('timer') === false ? 'off' : 'on');
  }

  function setSeg(id, value) {
    var el = $(id);
    if (!el) return;
    var buttons = el.children;
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

  function leavePlay() {
    stopTimer();
    $('levelup').hidden = true;
    show('home');
    renderModes();
    renderLevel();
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
    onSeg('seg-timer', function (v) { window.Store.set('timer', v === 'on'); });

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
      stopTimer();
      // A continuous run has no natural end, so stopping is what produces the
      // summary - but only when there is something to summarise.
      if ((round.continuous || round.endless) && round.index > 0) endRound();
      else leavePlay();
    });
    $('btn-again').addEventListener('click', function () {
      window.FX.play('tap');
      startRound(round.mode);
    });
    $('btn-result-home').addEventListener('click', function () {
      window.FX.play('tap');
      leavePlay();
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

    // Leaving the tab must not let the countdown run down in the background.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopTimer();
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function () { /* offline is a bonus */ });
      });
    }
  }

  boot();
})();
