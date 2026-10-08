// The logic game: a puzzle board (a page of dotted paper), answer buttons,
// and boards that are answered by tapping on them - the odd one out, the
// square the robot stops on. The six modes at the bottom register into
// window.MODES with game: 'logic'; app.js runs them like any other mode.
window.LogicGame = (function () {
  var Q = window.LogicQ, P = window.LogicPics;
  var RUN = 60;   // puzzles in a full run, one ladder of 30 levels

  function T(k) { return window.T(k); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function textOf(v) { return typeof v === 'function' ? v() : T(v); }

  // Text with little pictures in it: {a} {b} {c} {q} are tokens from q.toks.
  function rich(text, toks) {
    var h = esc(text);
    if (toks) h = h.replace(/\{([abcq])\}/g, function (m, k) { return toks[k] ? P.tok(toks[k], 'is-inline') : m; });
    return h;
  }

  // How an answer value looks, on a button and in the missed list.
  function optHtml(q, v) {
    switch (q.opt) {
      case 'tok': return P.tok(v);
      case 'pix': return P.pix(v);
      case 'poly': return P.poly(v);
      case 'cmd': return P.cmds(v);
      case 'paper': return P.paper(v, 4);
      default: return esc(q.show ? q.show(v) : v);
    }
  }

  function itemHtml(show, v) {
    if (show === 'tok') return P.tok(v);
    if (show === 'poly') return P.poly(v);
    if (show === 'word') { var p = v.split(':'); return esc(T('lgw_' + p[0])[+p[1]]); }
    return esc(v);
  }

  var SIZER = '<svg class="lg-sizer" viewBox="0 0 1 1" aria-hidden="true"></svg>';
  function slotEl(cls) { return el('div', 'lg-slot' + (cls ? ' ' + cls : ''), SIZER + '<b>?</b>'); }
  function fillSlot(slot, html) {
    slot.className += ' is-ok';
    slot.innerHTML = html;
  }

  // ---------------------------------------------------------------- boards
  //
  // Each returns { el, reveal(given, right) }. Tap boards call onTap(value, e).

  var BOARDS = {
    // A sequence with one place asked.
    row: function (q, b) {
      var row = el('div', 'lg-row' + (b.items.length > 7 ? ' is-long' : b.items.length > 5 ? ' is-mid' : '')), slot;
      b.items.forEach(function (t) {
        if (t === null) { slot = slotEl('lg-cell'); row.appendChild(slot); return; }
        row.appendChild(el('div', 'lg-cell', P.tok(t)));
      });
      return { el: row, reveal: function () { fillSlot(slot, P.tok(q.answer)); } };
    },

    // The odd one out: the things themselves are the buttons.
    set: function (q, b, onTap) {
      var wrap = el('div', 'lg-set n' + b.items.length + ' show-' + b.show);
      b.items.forEach(function (v, i) {
        var btn = el('button', 'lg-item', itemHtml(b.show, v));
        btn.addEventListener('click', function (e) { onTap(i, e); });
        wrap.appendChild(btn);
      });
      return {
        el: wrap,
        reveal: function (given) {
          for (var i = 0; i < wrap.children.length; i++) {
            wrap.children[i].disabled = true;
            wrap.children[i].classList.add(i === q.answer ? 'ok' : i === given ? 'bad' : 'dim');
          }
        },
      };
    },

    grid: function (q, b) {
      var n = b.n, wrap = el('div', 'lg-grid n' + n + (b.numbers || q.opt === 'num' ? ' is-num' : '')), slot = null, cells = [];
      b.cells.forEach(function (v, i) {
        var r = Math.floor(i / n), c = i % n, cell;
        if (v === null) cell = slot = slotEl('lg-gc');
        else if (v === '') cell = el('div', 'lg-gc is-blank');
        else cell = el('div', 'lg-gc', typeof v === 'number' ? String(v) : P.tok(v));
        if (b.box) {
          if (c % b.box === b.box - 1 && c < n - 1) cell.classList.add('bx-r');
          if (r % b.box === b.box - 1 && r < n - 1) cell.classList.add('bx-b');
        }
        cells.push(cell);
        wrap.appendChild(cell);
      });
      return {
        el: wrap,
        reveal: function (given, right) {
          fillSlot(slot, typeof q.answer === 'number' ? String(q.answer) : P.tok(q.answer));
          // Sudoku: light up the row, the column and the box that decide it.
          if (!right && b.hint) {
            var hr = b.hint[0], hc = b.hint[1];
            cells.forEach(function (cell, i) {
              var r = Math.floor(i / n), c = i % n;
              var inBox = Math.floor(r / 2) === Math.floor(hr / 2) && Math.floor(c / 2) === Math.floor(hc / 2);
              if (r === hr || c === hc || inBox) cell.classList.add('is-hint');
            });
          }
        },
      };
    },

    // a is to b as c is to ?
    analogy: function (q, b) {
      var wrap = el('div', 'lg-analogy'), arrow = '<svg class="lg-to" viewBox="-12 -12 24 24" aria-hidden="true"><path d="M-9 0h16M1-7l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var r1 = el('div', 'lg-pair', '<div class="lg-cell">' + P.tok(b.a) + '</div>' + arrow + '<div class="lg-cell">' + P.tok(b.b) + '</div>');
      var r2 = el('div', 'lg-pair', '<div class="lg-cell">' + P.tok(b.c) + '</div>' + arrow);
      var slot = slotEl('lg-cell');
      r2.appendChild(slot);
      wrap.appendChild(r1);
      wrap.appendChild(el('div', 'lg-as', esc(T('lg_as'))));
      wrap.appendChild(r2);
      return { el: wrap, reveal: function () { fillSlot(slot, P.tok(q.answer)); } };
    },

    // The robot's floor. Tappable when the question is "where does it stop?".
    robot: function (q, b, onTap) {
      var wrap = el('div', 'lg-robobox');
      if (b.code) wrap.appendChild(el('div', 'lg-code', P.cmds(b.code)));
      var floor = el('div', 'lg-floor w' + b.w);
      floor.style.setProperty('--cols', b.w);
      var cells = [];
      for (var i = 0; i < b.w * b.h; i++) {
        var x = i % b.w, y = Math.floor(i / b.w);
        var cell = el(q.kind === 'tap' ? 'button' : 'div', 'lg-tile' + ((x + y) % 2 ? ' is-alt' : ''));
        if (x === b.start[0] && y === b.start[1]) cell.innerHTML = P.robot(b.dir);
        else if (b.goal && x === b.goal[0] && y === b.goal[1]) cell.innerHTML = P.goal();
        if (q.kind === 'tap') {
          (function (idx) { cell.addEventListener('click', function (e) { onTap(idx, e); }); })(i);
        }
        cells.push(cell);
        floor.appendChild(cell);
      }
      wrap.appendChild(floor);
      return {
        el: wrap,
        reveal: function (given) {
          cells.forEach(function (cell) { if (cell.tagName === 'BUTTON') cell.disabled = true; });
          if (q.kind === 'tap') {
            cells[q.answer].classList.add('ok');
            if (given !== null && given !== q.answer) cells[given].classList.add('bad');
          }
          // The route, square by square.
          var pts = b.path.map(function (p) { return (p[0] + 0.5) + ',' + (p[1] + 0.5); }).join(' ');
          var end = b.path[b.path.length - 1];
          var svg = '<svg class="lg-path" viewBox="0 0 ' + b.w + ' ' + b.h + '" preserveAspectRatio="none" aria-hidden="true">' +
            '<polyline points="' + pts + '"/><circle cx="' + (end[0] + 0.5) + '" cy="' + (end[1] + 0.5) + '" r=".12"/></svg>';
          floor.insertAdjacentHTML('beforeend', svg);
        },
      };
    },

    figure: function (q, b) {
      return { el: el('div', 'lg-figure' + (b.cls ? ' ' + b.cls : ''), b.svg), reveal: function () {} };
    },

    // A picture, a mirror, and what the mirror shows.
    mirror: function (q, b) {
      var wrap = el('div', 'lg-mirror is-' + b.axis);
      wrap.appendChild(el('div', 'lg-cell is-pix', P.pix(b.pix)));
      wrap.appendChild(el('div', 'lg-glass'));
      var slot = slotEl('lg-cell is-pix');
      wrap.appendChild(slot);
      return { el: wrap, reveal: function () { fillSlot(slot, P.pix(q.answer)); } };
    },

    // One piece, shown big: which of the answers is it, turned?
    shape: function (q, b) {
      return { el: el('div', 'lg-piece', b.poly ? P.poly(b.poly) : P.pix(b.pix)), reveal: function () {} };
    },

    fold: function (q, b) {
      var wrap = el('div', 'lg-fold', P.fold(b.kind, b.hole, b.n));
      wrap.insertAdjacentHTML('beforeend', '<svg class="lg-step" viewBox="-12 -12 24 24" aria-hidden="true"><path d="M-8 0h14M1-6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      var slot = slotEl('lg-paperslot');
      wrap.appendChild(slot);
      return { el: wrap, reveal: function () { fillSlot(slot, P.paper(q.answer, b.n)); } };
    },

    scales: function (q, b) {
      var wrap = el('div', 'lg-scales n' + b.list.length);
      b.list.forEach(function (s) {
        var asked = s.r.indexOf('?') !== -1 || s.l.indexOf('?') !== -1;
        wrap.appendChild(el('div', 'lg-scalebox' + (asked ? ' is-ask' : ''), P.scale(s.l, s.r, s.tilt)));
      });
      return { el: wrap, reveal: function () {} };
    },

    // Clues, one per line.
    story: function (q, b) {
      var wrap = el('div', 'lg-story');
      b.lines.forEach(function (line, i) {
        wrap.appendChild(el('p', i === 0 && b.intro ? 'is-intro' : '', rich(textOf(line), q.toks)));
      });
      return { el: wrap, reveal: function () {} };
    },
  };

  function choiceBoard(q, onPick) {
    var wrap = el('div');
    var longest = 0;
    q.options.forEach(function (v) {
      var b = el('button', 'ans', optHtml(q, v));
      if (q.opt === 'text' || q.opt === 'num') longest = Math.max(longest, b.textContent.length);
      b.addEventListener('click', function (e) { onPick(v, e); });
      wrap.appendChild(b);
    });
    wrap.className = 'answers lg-answers n' + q.options.length + ' opt-' + q.opt + (longest > 7 ? ' is-text' : '');
    return {
      el: wrap,
      mark: function (chosen) {
        for (var i = 0; i < wrap.children.length; i++) {
          var v = q.options[i];
          wrap.children[i].disabled = true;
          if (String(v) === String(q.answer)) wrap.children[i].classList.add('ok');
          else if (chosen !== null && String(v) === String(chosen)) wrap.children[i].classList.add('bad');
          else wrap.children[i].classList.add('dim');
        }
      },
    };
  }

  // What to look at after a miss: a sentence, sometimes a picture.
  function explainEl(q) {
    var box = el('div', 'lg-explain');
    if (q.why) box.appendChild(el('p', '', rich(textOf(q.why), q.toks)));
    var pic = q.whyPic;
    if (pic && pic.t === 'unit') {
      pic.rows.forEach(function (row) {
        box.appendChild(el('div', 'lg-unit', row.map(function (t) { return P.tok(t); }).join('')));
      });
    } else if (pic && pic.t === 'chain') {
      box.appendChild(el('div', 'lg-unit is-chain', pic.items.map(function (t) { return P.tok(t); }).join('<b>&gt;</b>')));
    }
    return box;
  }

  function burstAt(node, e) {
    if (e && e.clientX) { window.FX.burst(e.clientX, e.clientY, 1); return; }
    var r = node.getBoundingClientRect();
    window.FX.burst(r.left + r.width / 2, r.top + r.height / 2, 1);
  }

  // ------------------------------------------------------------ rendering

  function render(stage, q, done) {
    stage.classList.add('is-logic');
    var wrap = el('div', 'lg-play kind-' + q.kind + ' board-' + (q.board ? q.board.t : 'text'));
    var card = el('div', 'lg-card pop');
    var side = el('div', 'lg-side');
    var locked = false, choices = null, board = null;

    function settle(given, right, e) {
      if (locked) return;
      locked = true;
      if (choices) choices.mark(given);
      if (board) board.reveal(given, right);
      if (right) {
        window.FX.play('correct');
        burstAt(card, e);
      } else {
        if (given !== null) window.FX.play('wrong');   // a timeout already played it
        if (q.why || q.whyPic) card.appendChild(explainEl(q));
      }
      done({
        correct: right,
        cc: q.key,
        mastery: false,
        delay: right ? 1000 : (q.why || q.whyPic) ? 3400 + Math.min(1600, (q.tm || 1) * 500) : 2400,
      });
    }

    // Word problems with no picture are read on the card itself.
    var askText = rich(textOf(q.ask), q.toks);
    if (q.board) {
      var prompt = el('p', 'prompt lg-prompt', askText);
      if (prompt.textContent.length > 46) prompt.classList.add('is-story');
      wrap.appendChild(prompt);
      board = BOARDS[q.board.t](q, q.board, function (v, e) { settle(v, v === q.answer, e); });
      card.appendChild(board.el);
    } else {
      card.classList.add('is-text');
      card.appendChild(el('p', 'lg-problem', askText));
    }
    wrap.appendChild(card);

    if (q.kind === 'pick') {
      choices = choiceBoard(q, function (v, e) { settle(v, String(v) === String(q.answer), e); });
      side.appendChild(choices.el);
      wrap.appendChild(side);
    }

    stage.appendChild(wrap);
    return { timeout: function () { settle(null, false, null); } };
  }

  function seconds(level, q) {
    return q.plan.seconds * (q.tm || 1);
  }

  // ------------------------------------------------------------ missed list

  function missedFigure(cc) {
    var r = window.CurrentRound, q = r && r.extra.qs && r.extra.qs[cc];
    if (!q) return null;
    var fig = el('figure', 'missed-logic');
    var html;
    if (q.kind === 'tap' && q.board.t === 'set') html = itemHtml(q.board.show, q.board.items[q.answer]);
    else if (q.kind === 'tap') html = P.robot(q.board.dir);
    else html = optHtml(q, q.answer);
    var tile = el('span', 'ml-tile opt-' + (q.kind === 'tap' ? q.board.show || 'robot' : q.opt), html);
    fig.appendChild(tile);
    fig.appendChild(el('figcaption', '', esc(T(q.stage))));
    return fig;
  }

  // --------------------------------------------------------------- modes

  function ask(set, level, round) {
    var x = round.extra;
    if (!x.qs) { x.qs = {}; x.stage = {}; }
    var recent = {};
    round.used.slice(-15).forEach(function (k) { recent[k] = true; });
    var now = Q.stageIndex(set, level);
    var fresh = x.stage[set] !== undefined && now > x.stage[set];
    x.stage[set] = now;
    var q = Q.make(set, level, recent, fresh);
    x.qs[q.key] = q;
    return q;
  }

  function mode(id, icon, color, dark) {
    return {
      id: 'logic-' + id,
      game: 'logic',
      icon: icon,
      color: color,
      dark: dark,
      titleKey: 'logic_' + id,
      subKey: 'logic_' + id + 'Sub',
      continuous: true,
      unitKey: 'unitPuzzles',
      doneKey: 'logicDone',
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

  var MIX = ['patterns', 'odd', 'grids', 'space', 'reason'];

  window.MODES = window.MODES || [];
  window.MODES.push(
    mode('patterns', 'pattern', '#ffd23f', '#c98f00'),
    mode('odd', 'odd', '#4cc9f0', '#1d84a8'),
    mode('grids', 'grid3', '#2ee6a8', '#0f9c6d'),
    mode('space', 'robot', '#ff9f1c', '#b86b00'),
    mode('reason', 'search', '#a06bff', '#6b3fc4'),
    {
      id: 'logic-challenge',
      game: 'logic',
      icon: 'bolt',
      color: '#ff5d73',
      dark: '#b32d40',
      titleKey: 'logic_challenge',
      subKey: 'logic_challengeSub',
      endless: true,
      lives: 3,
      scoreText: function (round) {
        return round.correct + ' ' + window.T('accuracy') +
          '  ·  ' + window.T('record') + ' ' + window.Store.bestOf('logic-challenge');
      },
      // Everything mixed; app.js climbs a level every five questions.
      makeItem: function (round) { return ask(MIX[(Math.random() * MIX.length) | 0], round.level, round); },
      seconds: seconds,
      render: render,
      missedFigure: missedFigure,
    }
  );

  return { tok: P.tok };
})();
