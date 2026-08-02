// Mode 5: build the flag out of stripes, crosses, discs, stars and moons.
// Scored by how closely the result matches the real flag - stars, never fails.
window.MODES = window.MODES || [];

function starRow(n) {
  var s = '';
  for (var i = 0; i < n; i++) s += '\u2605';
  return s;
}

window.MODES.push({
  id: 'draw-build',
  icon: 'blocks',
  color: '#a06bff',
  dark: '#6b3fc4',
  titleKey: 'modeBuild',
  subKey: 'modeBuildSub',
  items: 3,
  untimed: true,

  scoreText: function (round) {
    var pct = round.extra.matchTotal
      ? Math.round(round.extra.matchTotal / round.total) : 0;
    return window.T('similarity') + ' ' + pct + '%';
  },

  makeItem: function (round) {
    return { target: window.DrawKit.pickCountry(round) };
  },

  render: function (stage, item, done) {
    var kit = window.DrawKit;
    var TOOLS = [
      { id: 'fill',    key: 'fill' },
      { id: 'stripeH', key: 'stripeH' },
      { id: 'stripeV', key: 'stripeV' },
      { id: 'block',   key: 'block' },
      { id: 'cross',   key: 'cross' },
      { id: 'disc',    key: 'disc' },
      { id: 'star',    key: 'star' },
      { id: 'moon',    key: 'moon' },
    ];

    var prompt = document.createElement('p');
    prompt.className = 'prompt';
    prompt.textContent = window.T('askBuild') + ' ' + window.NAME(item.target);

    var wrap = document.createElement('div');
    wrap.className = 'draw-wrap';
    var holder = document.createElement('div');
    holder.className = 'canvas-holder';
    wrap.appendChild(holder);

    var c;
    var stamps = [];
    var bg = '#ffffff';
    var color = kit.PALETTE[0];
    var tool = 'stripeH';

    // ------------------------------------------------------------ drawing

    function star(ctx, cx, cy, r) {
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var rad = i % 2 === 0 ? r : r * 0.42;
        var a = (Math.PI / 5) * i - Math.PI / 2;
        var x = cx + Math.cos(a) * rad;
        var y = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }

    function drawStamp(ctx, s, w, h) {
      ctx.fillStyle = s.color;
      if (s.type === 'stripeH') {
        var band = h / 3;
        ctx.fillRect(0, Math.floor(s.y / band) * band, w, band);
      } else if (s.type === 'stripeV') {
        var col = w / 3;
        ctx.fillRect(Math.floor(s.x / col) * col, 0, col, h);
      } else if (s.type === 'block') {
        var bw = w / 2, bh = h / 2;
        ctx.fillRect(Math.floor(s.x / bw) * bw, Math.floor(s.y / bh) * bh, bw, bh);
      } else if (s.type === 'cross') {
        var t = h / 5;
        var cx = Math.round(s.x / (w / 12)) * (w / 12);
        var cy = Math.round(s.y / (h / 8)) * (h / 8);
        ctx.fillRect(0, cy - t / 2, w, t);
        ctx.fillRect(cx - t / 2, 0, t, h);
      } else if (s.type === 'disc') {
        ctx.beginPath();
        ctx.arc(s.x, s.y, h / 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.type === 'star') {
        star(ctx, s.x, s.y, h / 6);
      } else if (s.type === 'moon') {
        // Crescent: a disc with a second disc punched out of it.
        var r = h / 4.5;
        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.arc(s.x + r * 0.42, s.y, r * 0.85, 0, Math.PI * 2);
        ctx.fill('evenodd');
        ctx.restore();
      }
    }

    function paintInto(ctx, w, h) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      stamps.forEach(function (s) { drawStamp(ctx, s, w, h); });
    }

    function repaint() { paintInto(c.ctx, c.w, c.h); }

    function place(e) {
      e.preventDefault();
      var r = c.canvas.getBoundingClientRect();
      var src = e.touches && e.touches.length ? e.touches[0] : e;
      var x = src.clientX - r.left;
      var y = src.clientY - r.top;
      if (tool === 'fill') {
        bg = color;
      } else {
        stamps.push({ type: tool, color: color, x: x, y: y });
        if (stamps.length > 60) stamps.shift();
      }
      window.FX.play('tap');
      repaint();
    }

    // -------------------------------------------------------- similarity

    // Compare a 24x16 thumbnail of the drawing against the same thumbnail of
    // the real flag. Coarse on purpose: layout matters, wobbly edges do not.
    function scoreAgainstFlag(cb) {
      var W = 24, H = 16;
      var mine = document.createElement('canvas');
      mine.width = W; mine.height = H;
      var mctx = mine.getContext('2d');
      paintInto(mctx, W, H);
      var mineData = mctx.getImageData(0, 0, W, H).data;

      var img = new Image();
      img.onload = function () {
        var ref = document.createElement('canvas');
        ref.width = W; ref.height = H;
        var rctx = ref.getContext('2d');
        rctx.drawImage(img, 0, 0, W, H);
        var refData;
        try {
          refData = rctx.getImageData(0, 0, W, H).data;
        } catch (err) {
          cb(0.6);   // canvas blocked - hand out a friendly default
          return;
        }
        var total = 0;
        for (var i = 0; i < refData.length; i += 4) {
          var dr = refData[i] - mineData[i];
          var dg = refData[i + 1] - mineData[i + 1];
          var db = refData[i + 2] - mineData[i + 2];
          total += Math.sqrt(dr * dr + dg * dg + db * db) / 441.67;
        }
        cb(Math.max(0, 1 - total / (refData.length / 4)));
      };
      img.onerror = function () { cb(0.6); };
      img.src = window.Game.flagUrl(item.target.cc, 'w160');
    }

    // ------------------------------------------------------------- tools

    var toolRow = document.createElement('div');
    toolRow.className = 'tools';
    TOOLS.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'tool' + (t.id === tool ? ' sel' : '');
      b.innerHTML = window.ICONS[t.id];
      b.title = window.T(t.key);
      b.addEventListener('click', function () {
        tool = t.id;
        for (var i = 0; i < toolRow.children.length; i++) toolRow.children[i].classList.remove('sel');
        b.classList.add('sel');
        window.FX.play('tap');
      });
      toolRow.appendChild(b);
    });

    var swatches = kit.swatchRow(kit.PALETTE, function (v) { color = v; }, 0);

    var actions = document.createElement('div');
    actions.className = 'tools';
    actions.appendChild(kit.toolBtn(window.ICONS.undo + window.T('undo'), function () {
      stamps.pop();
      repaint();
    }));
    actions.appendChild(kit.toolBtn(window.ICONS.trash + window.T('clear'), function () {
      stamps = [];
      bg = '#ffffff';
      repaint();
    }));
    var guideBtn = kit.toolBtn(window.ICONS.eye + window.T('guideOff'), function (btn) {
      var hidden = c.ghost.classList.toggle('hidden');
      btn.innerHTML = window.ICONS.eye + window.T(hidden ? 'guideOn' : 'guideOff');
    });
    actions.appendChild(guideBtn);

    var doneBtn = kit.toolBtn(window.ICONS.check + window.T('save'), function (btn) {
      if (btn.disabled) return;
      btn.disabled = true;
      scoreAgainstFlag(function (match) {
        var pct = Math.round(match * 100);
        var stars = match >= 0.86 ? 3 : match >= 0.72 ? 2 : 1;
        kit.saveDrawing(c.canvas, item.target.cc, 'draw-build');
        window.FX.toast(window.T('similarity') + ' ' + pct + '% ' + starRow(stars), 1800);
        window.FX.burst(window.innerWidth / 2, window.innerHeight / 2, stars * 0.6);
        var round = window.CurrentRound;
        if (round) round.extra.matchTotal = (round.extra.matchTotal || 0) + pct;
        done({ correct: true, points: 10 + stars * 15, cc: item.target.cc, noStreak: true, delay: 1400 });
      });
    });
    doneBtn.style.background = 'var(--mint)';
    doneBtn.style.color = '#063a29';
    actions.appendChild(doneBtn);

    wrap.appendChild(swatches);
    wrap.appendChild(toolRow);
    wrap.appendChild(actions);
    stage.appendChild(prompt);
    stage.appendChild(wrap);

    c = kit.makeCanvas(holder);
    c.ghost.style.backgroundImage = 'url(' + window.Game.flagUrl(item.target.cc, 'w320') + ')';
    repaint();

    if (window.PointerEvent) c.canvas.addEventListener('pointerdown', place);
    else {
      c.canvas.addEventListener('touchstart', place);
      c.canvas.addEventListener('mousedown', place);
    }
  },
});
