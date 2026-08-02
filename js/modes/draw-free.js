// Mode 4: paint the flag freehand. Never a fail state - finishing always pays.
window.MODES = window.MODES || [];

// Flags a 7-year-old can actually paint: bands, crosses, discs, simple stars.
window.SIMPLE_FLAGS = [
  'RO', 'FR', 'IT', 'DE', 'BE', 'IE', 'NL', 'LU', 'PL', 'ID', 'MC', 'UA',
  'SE', 'DK', 'NO', 'FI', 'IS', 'CH', 'JP', 'BD', 'PW', 'AT', 'LV', 'PE',
  'CO', 'AR', 'GR', 'HU', 'BG', 'LT', 'EE', 'CZ', 'RU', 'TH', 'IN', 'NE',
  'CA', 'TR', 'TN', 'VN', 'CN', 'MA', 'CL', 'CU', 'SO', 'MU', 'JM', 'CD',
  'NG', 'CI', 'ML', 'SN', 'GA', 'AE', 'KW', 'ES', 'PT', 'BR', 'GB', 'US',
];

window.DrawKit = (function () {
  // 16 chunky, high-contrast colours - the ones real flags are made of.
  var PALETTE = [
    '#e63946', '#d00000', '#ff8800', '#ffd23f', '#f7f7f7', '#111111',
    '#1b6ca8', '#0353a4', '#4cc9f0', '#2a9d3f', '#0b6e2e', '#7ac74f',
    '#8b4513', '#a06bff', '#ff6fb5', '#00a99d',
  ];

  // Drawing has its own pool: flags a child can actually paint. It does not
  // follow the quiz ladder - there is no point asking anyone to paint
  // Turkmenistan - but it does favour ones previously drawn badly.
  function pickCountry(round) {
    var pool = window.SIMPLE_FLAGS
      .map(function (cc) { return window.Game.byCc[cc]; })
      .filter(Boolean);
    return window.Game.pickTarget(pool, round.used);
  }

  // A canvas sized to the flag ratio that actually fits the space available.
  function makeCanvas(holder) {
    var stack = document.createElement('div');
    stack.className = 'canvas-stack';
    var canvas = document.createElement('canvas');
    var ghost = document.createElement('div');
    ghost.className = 'ghost';
    stack.appendChild(canvas);
    stack.appendChild(ghost);
    holder.appendChild(stack);

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var box = holder.getBoundingClientRect();
    var w = Math.max(220, Math.min(box.width - 4, (box.height - 4) * 1.5));
    var h = w / 1.5;
    canvas.style.width = Math.round(w) + 'px';
    canvas.style.height = Math.round(h) + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return { stack: stack, canvas: canvas, ghost: ghost, ctx: ctx, w: w, h: h, dpr: dpr };
  }

  // Save a 400px-wide PNG into the gallery.
  function saveDrawing(canvas, cc, mode) {
    var out = document.createElement('canvas');
    out.width = 400;
    out.height = 267;
    var octx = out.getContext('2d');
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, 400, 267);
    octx.drawImage(canvas, 0, 0, 400, 267);
    window.Store.addDrawing({ cc: cc, mode: mode, png: out.toDataURL('image/png'), t: Date.now() });
    window.FX.play('save');
    window.FX.toast(window.T('saved'));
  }

  function swatchRow(colors, onPick, initial) {
    var row = document.createElement('div');
    row.className = 'swatches';
    colors.forEach(function (color, i) {
      var b = document.createElement('button');
      b.className = 'swatch' + (i === initial ? ' sel' : '');
      b.style.background = color;
      b.setAttribute('aria-label', color);
      b.addEventListener('click', function () {
        for (var j = 0; j < row.children.length; j++) row.children[j].classList.remove('sel');
        b.classList.add('sel');
        window.FX.play('tap');
        onPick(color);
      });
      row.appendChild(b);
    });
    return row;
  }

  // label may contain an inline SVG icon, so it is set as HTML.
  function toolBtn(label, onClick) {
    var b = document.createElement('button');
    b.className = 'tool';
    b.innerHTML = label;
    b.addEventListener('click', function () { window.FX.play('tap'); onClick(b); });
    return b;
  }

  return {
    PALETTE: PALETTE,
    pickCountry: pickCountry,
    makeCanvas: makeCanvas,
    saveDrawing: saveDrawing,
    swatchRow: swatchRow,
    toolBtn: toolBtn,
  };
})();

window.MODES.push({
  id: 'draw-free',
  icon: 'brush',
  color: '#ff5d73',
  dark: '#b32d40',
  titleKey: 'modeDraw',
  subKey: 'modeDrawSub',
  items: 3,
  untimed: true,

  scoreText: function (round) {
    return round.total + ' ' + window.T('drawnCount');
  },

  makeItem: function (round) {
    return { target: window.DrawKit.pickCountry(round) };
  },

  render: function (stage, item, done) {
    var kit = window.DrawKit;

    var prompt = document.createElement('p');
    prompt.className = 'prompt';
    prompt.textContent = window.T('askDraw') + ' ' + window.NAME(item.target);

    var wrap = document.createElement('div');
    wrap.className = 'draw-wrap';
    var holder = document.createElement('div');
    holder.className = 'canvas-holder';
    wrap.appendChild(holder);

    var c;                       // set once the toolbars are in place
    var strokes = [];
    var current = null;
    var color = kit.PALETTE[0];
    var size = 18;

    function repaint() {
      c.ctx.clearRect(0, 0, c.w, c.h);
      strokes.forEach(function (s) {
        c.ctx.strokeStyle = s.color;
        c.ctx.lineWidth = s.size;
        c.ctx.beginPath();
        s.pts.forEach(function (p, i) {
          if (i === 0) c.ctx.moveTo(p[0], p[1]);
          else c.ctx.lineTo(p[0], p[1]);
        });
        if (s.pts.length === 1) c.ctx.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
        c.ctx.stroke();
      });
    }

    function posOf(e) {
      var r = c.canvas.getBoundingClientRect();
      var src = e.touches && e.touches.length ? e.touches[0] : e;
      return [src.clientX - r.left, src.clientY - r.top];
    }

    function start(e) {
      e.preventDefault();
      current = { color: color, size: size, pts: [posOf(e)] };
      strokes.push(current);
      if (strokes.length > 400) strokes.shift();
      repaint();
    }
    function move(e) {
      if (!current) return;
      e.preventDefault();
      current.pts.push(posOf(e));
      // Draw just the new segment; a full repaint per move would crawl.
      var pts = current.pts;
      var n = pts.length;
      c.ctx.strokeStyle = current.color;
      c.ctx.lineWidth = current.size;
      c.ctx.beginPath();
      c.ctx.moveTo(pts[n - 2][0], pts[n - 2][1]);
      c.ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
      c.ctx.stroke();
    }
    function end() { current = null; }

    function attachDrawing(canvas) {
      if (window.PointerEvent) {
        canvas.addEventListener('pointerdown', function (e) {
          canvas.setPointerCapture(e.pointerId);
          start(e);
        });
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
      } else {
        canvas.addEventListener('touchstart', start);
        canvas.addEventListener('touchmove', move);
        canvas.addEventListener('touchend', end);
        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);
      }
    }

    // --- brush sizes ---
    var sizes = document.createElement('div');
    sizes.className = 'brush-sizes';
    [10, 18, 34].forEach(function (s, i) {
      var b = document.createElement('button');
      b.className = 'brush-dot' + (i === 1 ? ' sel' : '');
      var dot = document.createElement('i');
      dot.style.width = Math.round(s * 0.7) + 'px';
      dot.style.height = Math.round(s * 0.7) + 'px';
      b.appendChild(dot);
      b.addEventListener('click', function () {
        size = s;
        for (var j = 0; j < sizes.children.length; j++) sizes.children[j].classList.remove('sel');
        b.classList.add('sel');
        window.FX.play('tap');
      });
      sizes.appendChild(b);
    });

    var swatches = kit.swatchRow(kit.PALETTE, function (v) { color = v; }, 0);

    // --- tools ---
    var tools = document.createElement('div');
    tools.className = 'tools';
    tools.appendChild(kit.toolBtn(window.ICONS.undo + window.T('undo'), function () {
      strokes.pop();
      repaint();
    }));
    tools.appendChild(kit.toolBtn(window.ICONS.trash + window.T('clear'), function () {
      strokes = [];
      repaint();
    }));
    var guideBtn = kit.toolBtn(window.ICONS.eye + window.T('guideOff'), function (btn) {
      var hidden = c.ghost.classList.toggle('hidden');
      btn.innerHTML = window.ICONS.eye + window.T(hidden ? 'guideOn' : 'guideOff');
    });
    tools.appendChild(guideBtn);

    var doneBtn = kit.toolBtn(window.ICONS.check + window.T('save'), function () {
      if (!strokes.length) return;
      kit.saveDrawing(c.canvas, item.target.cc, 'draw-free');
      window.FX.burst(window.innerWidth / 2, window.innerHeight / 2, 1.1);
      // Drawing is its own reward: full points, no wrong answers possible.
      done({ correct: true, points: 25, cc: item.target.cc, noStreak: true, delay: 900 });
    });
    doneBtn.style.background = 'var(--mint)';
    doneBtn.style.color = '#063a29';
    tools.appendChild(doneBtn);

    wrap.appendChild(swatches);
    wrap.appendChild(sizes);
    wrap.appendChild(tools);
    stage.appendChild(prompt);
    stage.appendChild(wrap);

    // Size the canvas only once everything else has claimed its space.
    c = kit.makeCanvas(holder);
    c.ghost.style.backgroundImage = 'url(' + window.Game.flagUrl(item.target.cc, 'w320') + ')';
    attachDrawing(c.canvas);
  },
});
