// The maths game: the board (a page of squared notebook paper), answer
// buttons, a number keypad and a clock whose hands are dragged into place.
// The six modes at the bottom register into window.MODES with game: 'math';
// app.js runs them like any other mode.
//
// A question is answered one of three ways:
//   pick - choose from a list, as in the other two games
//   type - write the number yourself on the keypad (more of these as the
//          run climbs, which is what keeps multiple choice from being a crutch)
//   set  - drag the hands of the clock to the time asked
window.MathGame = (function () {
  var Q = window.MathQ, Pics = window.MathPics;
  var RUN = 100;   // problems in a full run, one ladder of 30 levels

  var OPS = {
    '+': '+', '-': '−', 'x': '×', '/': '/', '=': '=', '<': '<', '>': '>',
    '≈': '≈', ',': ',', '(': '(', ')': ')', '→': '→',
  };

  // Romanian schools write division as 12 : 3.
  function opText(t) {
    if (t === '/') return window.Store.get('lang') === 'en' ? '÷' : ':';
    return OPS[t];
  }

  function fmt(n) {
    var s = String(n);
    return n >= 10000 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : s;
  }

  // How an answer value looks, on a button and in the answer slot.
  function showHtml(q, v) {
    if (q.frac) { var p = v.split('/'); return Pics.frac(p[0], p[1]); }
    if (q.show) return q.show(v);
    if (q.sign) return opText(v);
    return typeof v === 'number' ? fmt(v) : String(v);
  }

  // ------------------------------------------------------- expressions

  // Tokens -> a line of spans. Returns the answer slot so it can be filled.
  // slotChars: how wide the answer will be once it is written in, so the
  // line is sized for the solved sum and does not wrap on the reveal.
  function exprEl(tokens, slotChars) {
    var line = document.createElement('div');
    line.className = 'm-expr';
    var slot = null, chars = 0;
    tokens.forEach(function (t) {
      var span = document.createElement('span');
      if (t === null) {
        span.className = 'm-blank';
        span.textContent = '?';
        slot = span;
        chars += Math.max(2, slotChars || 0);
      } else if (typeof t === 'number') {
        span.className = 'm-num';
        span.textContent = fmt(t);
        chars += span.textContent.length;
      } else if (typeof t === 'string') {
        if (t === ';') {
          span.className = 'm-sep';
        } else if (OPS.hasOwnProperty(t)) {
          span.className = 'm-op' + (t === ',' ? ' is-comma' : '');
          span.textContent = opText(t);
          chars += 1;
        } else if (t.charAt(0) === '@') {
          span.className = 'm-unit';
          span.textContent = window.T('u_' + t.slice(1));
          chars += span.textContent.length * 0.5;
        } else {
          span.className = 'm-num';     // Roman numerals, clock times
          span.textContent = t;
          chars += t.length;
        }
      } else if (t.f) {
        span.className = 'm-words';
        span.textContent = t.f();
        chars += span.textContent.length * 0.5;
      } else if (t.frac) {
        span.className = 'm-frac';
        span.innerHTML = Pics.frac(t.frac[0], t.frac[1]);
        chars += 1.5;
      } else if (t.html) {
        span.className = 'm-num m-ans';
        span.innerHTML = t.html;
        chars += 2;
      }
      line.appendChild(span);
    });
    line.className += chars > 17 ? ' is-long' : chars > 10 ? ' is-mid' : '';
    return { el: line, slot: slot };
  }

  // The expression with the answer written in - for the missed list.
  function solvedTokens(q) {
    return q.expr.map(function (t) { return t === null ? { html: showHtml(q, q.answer) } : t; });
  }

  // --------------------------------------------------------------- input

  // Only one keypad is ever live; the physical keyboard drives it too.
  var activePad = null;

  document.addEventListener('keydown', function (e) {
    if (!activePad || !document.getElementById('screen-play').classList.contains('is-active')) return;
    var k = e.key;
    if (/^[0-9]$/.test(k)) activePad.press(k);
    else if (k === 'Backspace') activePad.press('del');
    else if (k === 'Enter') activePad.press('ok');
    else return;
    e.preventDefault();
  });

  function keypad(q, slot, onSubmit) {
    var max = Math.min(5, String(q.answer).length + 1);
    var typed = '', locked = false;
    var pad = document.createElement('div');
    pad.className = 'keypad';
    var ok = null;

    function paint() {
      slot.textContent = typed ? fmt(+typed) : '';
      slot.classList.toggle('is-empty', !typed);
      ok.disabled = !typed;
    }

    function press(k) {
      if (locked) return;
      if (k === 'ok') { if (typed) onSubmit(parseInt(typed, 10)); return; }
      if (k === 'del') typed = typed.slice(0, -1);
      else if (typed.length < max) typed = (typed === '0' ? '' : typed) + k;
      window.FX.play('tap');
      paint();
    }

    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].forEach(function (k) {
      var b = document.createElement('button');
      b.className = 'key' + (k === 'del' ? ' is-del' : k === 'ok' ? ' is-ok' : '');
      b.setAttribute('data-k', k);
      if (k === 'del') { b.innerHTML = window.ICONS.backspace; b.setAttribute('aria-label', window.T('kpDel')); }
      else if (k === 'ok') { b.innerHTML = window.ICONS.check + '<span></span>'; b.lastChild.textContent = window.T('done'); ok = b; }
      else b.textContent = k;
      pad.appendChild(b);
    });
    pad.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) press(b.getAttribute('data-k'));
    });

    slot.classList.add('is-typing');
    paint();
    var api = {
      el: pad,
      press: press,
      typed: function () { return typed; },
      lock: function () { locked = true; pad.classList.add('is-locked'); },
    };
    activePad = api;
    return api;
  }

  function choiceBoard(q, onPick) {
    var wrap = document.createElement('div');
    var longest = 0;
    q.options.forEach(function (v) {
      var b = document.createElement('button');
      b.className = 'ans';
      b.innerHTML = showHtml(q, v);
      if (!q.frac) longest = Math.max(longest, b.textContent.length);
      b.addEventListener('click', function (e) { onPick(v, e); });
      wrap.appendChild(b);
    });
    // Words ("8 fără un sfert") get a reading size; numbers, times and Roman
    // numerals stay big.
    wrap.className = 'answers math-answers n' + q.options.length + (longest > 7 ? ' is-text' : '') + (q.sign ? ' is-sign' : '');
    return {
      el: wrap,
      mark: function (chosen) {
        for (var i = 0; i < wrap.children.length; i++) {
          var v = q.options[i];
          if (String(v) === String(q.answer)) wrap.children[i].classList.add('ok');
          else if (chosen !== null && String(v) === String(chosen)) wrap.children[i].classList.add('bad');
          else wrap.children[i].classList.add('dim');
        }
      },
    };
  }

  // A clock whose hands follow a finger. The minute hand snaps to `step`
  // minutes and carries the hour round with it like real gearing; the hour
  // hand can also be dragged on its own and snaps to whole hours.
  function clockSetter(svg, step) {
    var h = 12, m = 0, grab = null, locked = false;
    var hourHand = svg.querySelector('.ck-h'), minHand = svg.querySelector('.ck-m');

    function paint() {
      hourHand.setAttribute('transform', 'rotate(' + ((h % 12) * 30 + m * 0.5) + ')');
      minHand.setAttribute('transform', 'rotate(' + (m * 6) + ')');
    }
    function polar(x, y) {
      var r = svg.getBoundingClientRect();
      var dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
      return { a: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, d: Math.sqrt(dx * dx + dy * dy) / (r.width / 2) };
    }
    function apart(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
    function choose(p) {
      var dh = apart(p.a, (h % 12) * 30 + m * 0.5), dm = apart(p.a, m * 6);
      if (Math.abs(dh - dm) < 25) return p.d < 0.6 ? 'h' : 'm';
      return dh < dm ? 'h' : 'm';
    }
    function apply(p) {
      if (grab === 'm') {
        var nm = Math.round(p.a / 6 / step) * step % 60;
        if (m >= 45 && nm < 15) h = h % 12 + 1;
        else if (m < 15 && nm >= 45) h = (h + 10) % 12 + 1;
        m = nm;
      } else {
        var nh = Math.round((p.a - m * 0.5) / 30) % 12;
        h = nh <= 0 ? nh + 12 : nh;
      }
      paint();
    }
    function down(x, y) {
      if (locked) return false;
      var p = polar(x, y);
      if (p.d > 1.2) return false;
      grab = choose(p);
      svg.classList.add('is-grab-' + grab);
      apply(p);
      return true;
    }
    function move(x, y) { if (grab && !locked) apply(polar(x, y)); }
    function up() {
      if (grab) svg.classList.remove('is-grab-' + grab);
      grab = null;
    }

    if (window.PointerEvent) {
      svg.addEventListener('pointerdown', function (e) {
        if (!down(e.clientX, e.clientY)) return;
        e.preventDefault();
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* old engines */ }
      });
      svg.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); });
      svg.addEventListener('pointerup', up);
      svg.addEventListener('pointercancel', up);
    } else {
      svg.addEventListener('touchstart', function (e) {
        if (down(e.touches[0].clientX, e.touches[0].clientY)) e.preventDefault();
      });
      svg.addEventListener('touchmove', function (e) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); });
      svg.addEventListener('touchend', up);
      svg.addEventListener('mousedown', function (e) { down(e.clientX, e.clientY); });
      svg.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
      svg.addEventListener('mouseup', up);
    }
    paint();

    return {
      value: function () { return [h, m]; },
      lock: function () { locked = true; up(); },
    };
  }

  // ----------------------------------------------------------- rendering

  function promptEl(q) {
    var p = document.createElement('p');
    p.className = 'prompt math-prompt';
    if (q.kind === 'set') {
      var lead = document.createElement('span');
      lead.className = 'ask-lead';
      lead.textContent = window.T('askSet');
      var name = document.createElement('b');
      name.className = 'ask-name';
      name.textContent = q.target();
      p.appendChild(lead);
      p.appendChild(name);
      p.classList.add('is-set');
      return p;
    }
    p.textContent = typeof q.ask === 'function' ? q.ask() : window.T(q.ask);
    if (p.textContent.length > 46) p.classList.add('is-story');
    return p;
  }

  function burstAt(el, e) {
    if (e && e.clientX) { window.FX.burst(e.clientX, e.clientY, 1); return; }
    var r = el.getBoundingClientRect();
    window.FX.burst(r.left + r.width / 2, r.top + r.height / 2, 1);
  }

  function render(stage, q, done) {
    // A keypad left behind by a run that was abandoned must not answer this one.
    activePad = null;
    stage.classList.add('is-math');
    var wrap = document.createElement('div');
    wrap.className = 'math-play kind-' + q.kind;
    wrap.appendChild(promptEl(q));

    var card = document.createElement('div');
    card.className = 'math-card pop' + (q.pic ? ' has-' + q.pic.t : '');
    var side = document.createElement('div');
    side.className = 'math-side';
    wrap.appendChild(card);
    wrap.appendChild(side);

    var locked = false, board = null, pad = null, setter = null, expr = null, svg = null;

    if (q.kind === 'set') {
      card.classList.add('has-clock', 'is-setting');
      var face = document.createElement('div');
      face.className = 'm-pic';
      face.innerHTML = Pics.clock(12, 0, { set: true, cls: 'is-set', fine: q.setStep === 1 });
      card.appendChild(face);
      svg = face.firstChild;
      setter = clockSetter(svg, q.setStep || 5);
    } else {
      if (q.pic) {
        var pic = document.createElement('div');
        pic.className = 'm-pic';
        pic.innerHTML = Pics.render(q.pic);
        card.appendChild(pic);
      }
      expr = exprEl(q.expr, String(q.answer).length + 1);
      card.appendChild(expr.el);
    }

    var explain = document.createElement('div');
    explain.className = 'm-explain';
    explain.hidden = true;
    card.appendChild(explain);

    // Every way of answering ends here, timeouts included (given = null).
    function settle(given, right, e) {
      if (locked) return;
      locked = true;
      if (pad) { pad.lock(); if (activePad === pad) activePad = null; }
      if (board) board.mark(given);
      if (expr && expr.slot) {
        var slot = expr.slot;
        slot.className = 'm-blank is-ok';
        slot.innerHTML = showHtml(q, q.answer);
        if (!right && given !== null && q.kind === 'type') {
          var was = document.createElement('s');
          was.className = 'm-was';
          was.textContent = fmt(given);
          slot.parentNode.insertBefore(was, slot);
        }
      }
      if (setter) {
        setter.lock();
        side.querySelector('.set-go').disabled = true;
        svg.classList.add(right ? 'is-ok' : 'is-bad');
        if (!right) {
          // The right time drawn over the attempt in mint.
          var t = q.clock, ghost = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          ghost.setAttribute('class', 'ck-ghost');
          ghost.innerHTML =
            '<g class="ck-h" transform="rotate(' + ((t[0] % 12) * 30 + t[1] * 0.5) + ')"><line x1="0" y1="14" x2="0" y2="-50"/></g>' +
            '<g class="ck-m" transform="rotate(' + (t[1] * 6) + ')"><line x1="0" y1="14" x2="0" y2="-80"/></g>';
          svg.insertBefore(ghost, svg.lastChild);
          var label = document.createElement('div');
          label.className = 'm-settime';
          label.textContent = q.clock[0] + ':' + (q.clock[1] < 10 ? '0' : '') + q.clock[1];
          card.insertBefore(label, explain);
        }
      }
      if (right) {
        window.FX.play('correct');
        burstAt(expr && expr.slot ? expr.slot : card, q.kind === 'pick' ? e : null);
      } else {
        if (given !== null) window.FX.play('wrong');   // a timeout already played it
        if (q.explain) {
          explain.innerHTML = '';
          explain.appendChild(exprEl(q.explain).el);
          explain.hidden = false;
        }
      }
      done({
        correct: right,
        cc: q.key,
        mastery: !!q.fact,
        delay: right ? 1000 : q.explain ? 3200 : 2300,
      });
    }

    if (q.kind === 'pick') {
      board = choiceBoard(q, function (v, e) { settle(v, String(v) === String(q.answer), e); });
      side.appendChild(board.el);
    } else if (q.kind === 'type') {
      pad = keypad(q, expr.slot, function (v) { settle(v, v === q.answer, null); });
      side.appendChild(pad.el);
    } else {
      var hint = document.createElement('p');
      hint.className = 'set-hint';
      hint.textContent = window.T('setHint');
      var go = document.createElement('button');
      go.className = 'big-btn set-go';
      go.innerHTML = window.ICONS.check + '<span></span>';
      go.lastChild.textContent = window.T('done');
      go.addEventListener('click', function () {
        var v = setter.value();
        settle(v, v[0] === q.clock[0] && v[1] === q.clock[1], null);
      });
      side.appendChild(hint);
      side.appendChild(go);
    }

    stage.appendChild(wrap);
    return { timeout: function () { settle(null, false, null); } };
  }

  // The countdown: reading a story problem or setting a clock takes longer.
  function seconds(level, q) {
    var base = q.kind === 'pick' ? q.plan.pickSeconds : q.plan.typeSeconds;
    return base * (q.tm || 1);
  }

  // ------------------------------------------------------------ missed list

  function missedFigure(cc) {
    var r = window.CurrentRound, q = r && r.extra.qs && r.extra.qs[cc];
    if (!q) return null;
    var fig = document.createElement('figure');
    fig.className = 'missed-math';
    var clock = q.clock || (q.pic && q.pic.t === 'clock' ? [q.pic.h, q.pic.m] : null);
    if (q.story && q.explain) clock = null;
    var tile = document.createElement('span');
    tile.className = 'mm-tile' + (clock ? ' is-clock' : '');
    if (clock) {
      tile.innerHTML = Pics.clock(clock[0], clock[1]);
      var cap = document.createElement('figcaption');
      cap.innerHTML = showHtml(q, q.answer);
      fig.appendChild(tile);
      fig.appendChild(cap);
      return fig;
    }
    // A story problem is remembered by its working, a sum by itself.
    tile.appendChild(exprEl(q.story && q.explain ? q.explain : solvedTokens(q)).el);
    fig.appendChild(tile);
    return fig;
  }

  // --------------------------------------------------------------- modes

  // One question for a run. Keeps the questions of this run on the round so
  // the result screen can show what was missed.
  function ask(set, level, round) {
    var x = round.extra;
    if (!x.qs) { x.qs = {}; x.stage = {}; }
    var recent = {};
    round.used.slice(-12).forEach(function (k) { recent[k] = true; });
    var now = Q.stageIndex(set, level);
    var fresh = x.stage[set] !== undefined && now > x.stage[set];
    x.stage[set] = now;
    var q = Q.make(set, level, recent, fresh);
    x.qs[q.key] = q;
    return q;
  }

  function mode(id, icon, color, dark) {
    return {
      id: 'math-' + id,
      game: 'math',
      icon: icon,
      color: color,
      dark: dark,
      titleKey: 'math_' + id,
      subKey: 'math_' + id + 'Sub',
      continuous: true,
      unitKey: 'unitProblems',
      doneKey: 'mathDone',
      runPool: function () { return new Array(RUN); },
      runTotal: function () { return RUN; },
      runChoice: function (round) {
        if (round.progress >= round.runTotal) return null;
        return ask(id, window.Game.runLevel(round.progress, round.runTotal), round);
      },
      seconds: seconds,
      render: render,
      unlocks: function (before, after) { return Q.unlocks(id, before, after); },
      missedFigure: missedFigure,
    };
  }

  var MIX = [['addsub', 3], ['muldiv', 3], ['numbers', 2], ['clock', 2], ['money', 2]];

  window.MODES = window.MODES || [];
  window.MODES.push(
    mode('addsub', 'plusminus', '#ffd23f', '#c98f00'),
    mode('muldiv', 'times', '#4cc9f0', '#1d84a8'),
    mode('numbers', 'numline', '#a06bff', '#6b3fc4'),
    mode('clock', 'clock', '#2ee6a8', '#0f9c6d'),
    mode('money', 'coin', '#ff9f1c', '#b86b00'),
    {
      id: 'math-challenge',
      game: 'math',
      icon: 'bolt',
      color: '#ff5d73',
      dark: '#b32d40',
      titleKey: 'math_challenge',
      subKey: 'math_challengeSub',
      endless: true,
      lives: 3,
      scoreText: function (round) {
        return round.correct + ' ' + window.T('accuracy') +
          '  ·  ' + window.T('record') + ' ' + window.Store.bestOf('math-challenge');
      },
      // Everything mixed; app.js climbs a level every five questions.
      makeItem: function (round) {
        var total = 0, set = 'addsub';
        MIX.forEach(function (m) { total += m[1]; });
        var roll = Math.random() * total;
        for (var i = 0; i < MIX.length; i++) {
          roll -= MIX[i][1];
          if (roll < 0) { set = MIX[i][0]; break; }
        }
        return ask(set, round.level, round);
      },
      seconds: seconds,
      render: render,
      missedFigure: missedFigure,
    }
  );

  return { clock: Pics.clock };
})();
