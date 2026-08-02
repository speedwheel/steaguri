// Sound, confetti and the performance tier. Everything here degrades on its
// own: on a slow tablet the effect tier drops to "low" after measuring real
// frame times, and the whole file works with audio permanently unavailable.
window.FX = (function () {
  var body = document.body;
  var canvas = document.getElementById('fxcanvas');
  var ctx = canvas.getContext('2d');
  var particles = [];
  var running = false;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  // ------------------------------------------------------------ perf tier

  var measured = null;

  function applyTier() {
    var pref = window.Store.get('fx');
    if (pref === 'high' || pref === 'low') { body.dataset.fx = pref; return; }
    body.dataset.fx = measured || 'high';
  }

  function weakDevice() {
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return true;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    return false;
  }

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  // Idle frame pacing tells us nothing - an idle page hits 60fps even on a slow
  // device. Time a fixed lump of canvas work instead, which is what the confetti
  // and the drawing modes actually cost.
  function benchmark() {
    var c = document.createElement('canvas');
    c.width = 160;
    c.height = 160;
    var x = c.getContext('2d');
    var t0 = now();
    for (var i = 0; i < 4000; i++) {
      x.save();
      x.globalAlpha = 0.8;
      x.translate(i % 150, (i * 7) % 150);
      x.rotate(i * 0.01);
      x.fillStyle = i % 2 ? '#ffffff' : '#2ee6a8';
      x.fillRect(-5, -5, 10, 6);
      x.restore();
    }
    return now() - t0;
  }

  function measure() {
    if (weakDevice()) { measured = 'low'; applyTier(); return; }
    // Let the first paint land before stealing the main thread.
    setTimeout(function () {
      var ms = benchmark();
      // Calibration: ~3ms on a desktop, ~30ms at 8x CPU throttle. Anything
      // past this is slow enough that the full effects would visibly stutter.
      measured = ms > 40 ? 'low' : 'high';
      applyTier();
    }, 400);
  }

  // Watchdog: if the confetti loop itself keeps missing frames, drop a tier for
  // the rest of the session. Catches devices the benchmark was too kind to.
  var slowFrames = 0;
  function watchFrame(dt) {
    if (measured === 'low' || body.dataset.fx !== 'high') return;
    if (dt > 34) slowFrames++;
    else if (slowFrames > 0) slowFrames--;
    if (slowFrames > 24) {
      measured = 'low';
      applyTier();
    }
  }

  // ---------------------------------------------------------------- audio

  var actx = null;
  var muted = false;

  function unlock() {
    if (actx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      actx = new AC();
      // Old Android needs a silent blip inside the gesture to open the context.
      var o = actx.createOscillator();
      var g = actx.createGain();
      g.gain.value = 0.0001;
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + 0.01);
    } catch (err) {
      actx = null;
    }
  }

  function tone(freq, at, dur, type, vol) {
    if (!actx || muted || !window.Store.get('sound')) return;
    var t0 = actx.currentTime + at;
    var o = actx.createOscillator();
    var g = actx.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol === undefined ? 0.22 : vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function buzz(ms) {
    if (navigator.vibrate && window.Store.get('sound')) {
      try { navigator.vibrate(ms); } catch (err) { /* ignore */ }
    }
  }

  var SOUNDS = {
    tap:     function () { tone(520, 0, 0.07, 'square', 0.10); },
    correct: function () { tone(660, 0, 0.12); tone(880, 0.09, 0.16); tone(1180, 0.18, 0.22); buzz(30); },
    wrong:   function () { tone(230, 0, 0.16, 'sawtooth', 0.16); tone(170, 0.11, 0.2, 'sawtooth', 0.14); buzz([25, 45, 25]); },
    star:    function () { tone(880, 0, 0.1); tone(1320, 0.1, 0.14); },
    level:   function () {
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, i * 0.11, 0.26); });
      buzz([40, 40, 90]);
    },
    save:    function () { tone(740, 0, 0.1); tone(988, 0.08, 0.18); },
  };

  // ------------------------------------------------------------- confetti

  function resize() {
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  var COLORS = ['#ffd23f', '#ff5d73', '#2ee6a8', '#4cc9f0', '#a06bff', '#ffffff'];

  function burst(x, y, strength) {
    var high = body.dataset.fx === 'high';
    var count = Math.round((high ? 90 : 26) * (strength || 1));
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 3 + Math.random() * (high ? 9 : 6);
      particles.push({
        x: x * dpr,
        y: y * dpr,
        vx: Math.cos(angle) * speed * dpr,
        vy: Math.sin(angle) * speed * dpr - 4 * dpr,
        size: (4 + Math.random() * 6) * dpr,
        life: 1,
        decay: 0.012 + Math.random() * 0.014,
        spin: (Math.random() - 0.5) * 0.3,
        rot: Math.random() * Math.PI,
        color: COLORS[(Math.random() * COLORS.length) | 0],
      });
    }
    if (particles.length > 420) particles = particles.slice(-420);
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  var lastFrame = 0;
  function tick(ts) {
    if (lastFrame) watchFrame((ts || 0) - lastFrame);
    lastFrame = ts || 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var gravity = 0.34 * dpr;
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      p.life -= p.decay;
      if (p.life <= 0 || p.y > canvas.height + 40) { particles.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
      ctx.restore();
    }
    if (particles.length) { requestAnimationFrame(tick); }
    else { running = false; lastFrame = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  function rain(strength) {
    var w = window.innerWidth;
    burst(w * 0.2, window.innerHeight * 0.28, strength);
    burst(w * 0.5, window.innerHeight * 0.2, strength);
    burst(w * 0.8, window.innerHeight * 0.28, strength);
  }

  // ---------------------------------------------------------------- misc

  var shakeTimer = 0;
  function shake() {
    if (body.dataset.fx !== 'high') return;
    body.classList.add('shake');
    clearTimeout(shakeTimer);
    shakeTimer = setTimeout(function () { body.classList.remove('shake'); }, 320);
  }

  var toastEl = document.getElementById('toast');
  var toastTimer = 0;
  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    // Restart the entry animation even if a toast is already showing.
    toastEl.style.animation = 'none';
    void toastEl.offsetWidth;
    toastEl.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, ms || 1600);
  }

  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true });

  return {
    play: function (name) { var s = SOUNDS[name]; if (s) s(); },
    burst: burst,
    rain: rain,
    shake: shake,
    toast: toast,
    applyTier: applyTier,
    startMeasuring: measure,
    benchmark: benchmark,
    setMuted: function (v) { muted = v; },
  };
})();
