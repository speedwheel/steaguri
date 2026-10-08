// Pictures for the maths game. Counters in ten-frames, dot arrays, base-ten
// blocks, fraction pies, a number line, the clock, lei and bani, and shop
// items with price tags. Everything is built as an HTML/SVG string from a
// small description object - render({ t: 'clock', h: 7, m: 30 }) - so a
// question stays plain data and the picture is drawn only when it is shown.
window.MathPics = (function () {
  var PI = Math.PI;

  function r1(v) { return Math.round(v * 10) / 10; }

  // ------------------------------------------------------- ten-frames

  // The first number in sky, the second in orange. Two frames once the
  // total passes ten, so 8 + 5 shows itself as 8 + 2 + 3. A subtraction
  // crosses out what is taken away.
  function frames(a, b, op) {
    var total = op === '-' ? a : a + b;
    var n = total > 10 ? 2 : 1;
    var C = 30, P = 5, FW = 5 * C + 2 * P, FH = 2 * C + 2 * P, GAP = 16;
    var W = n * FW + (n - 1) * GAP;
    var s = '<svg class="pic-frames" viewBox="0 0 ' + W + ' ' + FH + '" aria-hidden="true">';
    for (var f = 0; f < n; f++) {
      var ox = f * (FW + GAP);
      s += '<rect class="fr" x="' + (ox + 1.5) + '" y="1.5" width="' + (FW - 3) + '" height="' + (FH - 3) + '" rx="8"/>';
      for (var c = 1; c < 5; c++) s += '<path class="fr-l" d="M' + (ox + P + c * C) + ' ' + P + 'v' + (2 * C) + '"/>';
      s += '<path class="fr-l" d="M' + (ox + P) + ' ' + (P + C) + 'h' + (5 * C) + '"/>';
      for (var i = 0; i < 10; i++) {
        var idx = f * 10 + i;
        if (idx >= total) continue;
        var cx = ox + P + (i % 5) * C + C / 2, cy = P + Math.floor(i / 5) * C + C / 2;
        var gone = op === '-' && idx >= a - b;
        var cls = op === '-' ? (gone ? 'dot gone' : 'dot a') : (idx < a ? 'dot a' : 'dot b');
        s += '<circle class="' + cls + '" cx="' + cx + '" cy="' + cy + '" r="' + (C * 0.36) + '"/>';
        if (gone) s += '<path class="dot-x" d="M' + (cx - 8) + ' ' + (cy - 8) + 'l16 16m0-16-16 16"/>';
      }
    }
    return s + '</svg>';
  }

  // ------------------------------------------------------------ arrays

  // rows x cols counters, each row on its own band so the groups read as
  // "3 rows of 4" rather than a heap of 12.
  function array(rows, cols) {
    var S = 26, P = 6;
    var W = P * 2 + cols * S, H = P * 2 + rows * S;
    var s = '<svg class="pic-array" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">';
    for (var r = 0; r < rows; r++) {
      s += '<rect class="row" x="' + (P - 1) + '" y="' + (P + r * S + 2) + '" width="' + (cols * S + 2) + '" height="' + (S - 4) + '" rx="' + ((S - 4) / 2) + '"/>';
      for (var c = 0; c < cols; c++) {
        s += '<circle class="dot ' + (r % 2 ? 'b' : 'a') + '" cx="' + (P + c * S + S / 2) + '" cy="' + (P + r * S + S / 2) + '" r="8.5"/>';
      }
    }
    return s + '</svg>';
  }

  // --------------------------------------------------- base-ten blocks

  // Hundreds as flats, tens as rods, ones as cubes, drawn to scale.
  function blocks(h, t, u) {
    var U = 10, x = 0, s = '';
    var i, k;
    for (i = 0; i < h; i++) {
      s += '<rect class="bk-h" x="' + x + '" y="0" width="' + (10 * U) + '" height="' + (10 * U) + '" rx="2"/>';
      for (k = 1; k < 10; k++) {
        s += '<path class="bk-l" d="M' + (x + k * U) + ' 0v' + (10 * U) + 'M' + x + ' ' + (k * U) + 'h' + (10 * U) + '"/>';
      }
      x += 10 * U + 9;
    }
    for (i = 0; i < t; i++) {
      s += '<rect class="bk-t" x="' + x + '" y="0" width="' + U + '" height="' + (10 * U) + '" rx="2"/>';
      for (k = 1; k < 10; k++) s += '<path class="bk-l" d="M' + x + ' ' + (k * U) + 'h' + U + '"/>';
      x += U + 5;
    }
    if (u) x += 4;
    // Ones sit in columns of five from the bottom, like a tidy pile.
    for (i = 0; i < u; i++) {
      var col = Math.floor(i / 5), row = i % 5;
      s += '<rect class="bk-u" x="' + (x + col * (U + 4)) + '" y="' + (10 * U - (row + 1) * (U + 4) + 4) + '" width="' + U + '" height="' + U + '" rx="1.5"/>';
    }
    if (u) x += Math.ceil(u / 5) * (U + 4) - 4;
    else x -= t ? 5 : 9;
    return '<svg class="pic-blocks" viewBox="-2 -2 ' + (x + 4) + ' ' + (10 * U + 4) + '" aria-hidden="true">' + s + '</svg>';
  }

  // --------------------------------------------------------- fractions

  function pie(n, k) {
    var R = 80, s = '<svg class="pic-pie" viewBox="-90 -90 180 180" aria-hidden="true">';
    for (var i = 0; i < n; i++) {
      var a0 = i / n * 2 * PI, a1 = (i + 1) / n * 2 * PI;
      var x0 = r1(R * Math.sin(a0)), y0 = r1(-R * Math.cos(a0));
      var x1 = r1(R * Math.sin(a1)), y1 = r1(-R * Math.cos(a1));
      s += '<path class="pie-s' + (i < k ? ' on' : '') + '" d="M0 0L' + x0 + ' ' + y0 +
        'A' + R + ' ' + R + ' 0 ' + (a1 - a0 > PI ? 1 : 0) + ' 1 ' + x1 + ' ' + y1 + 'z"/>';
    }
    return s + '<circle class="pie-rim" r="' + R + '"/></svg>';
  }

  function bar(n, k) {
    var W = 300, H = 64, w = W / n, s = '<svg class="pic-bar" viewBox="-3 -3 ' + (W + 6) + ' ' + (H + 6) + '" aria-hidden="true">';
    for (var i = 0; i < n; i++) {
      s += '<rect class="pie-s' + (i < k ? ' on' : '') + '" x="' + r1(i * w) + '" y="0" width="' + r1(w) + '" height="' + H + '"/>';
    }
    return s + '<rect class="pie-rim" x="0" y="0" width="' + W + '" height="' + H + '" rx="4"/></svg>';
  }

  // Stacked fraction for answer buttons and the card.
  function frac(a, b) {
    return '<span class="frac"><i>' + a + '</i><i>' + b + '</i></span>';
  }

  // ------------------------------------------------------- number line

  // lo..hi in ten steps, the number marked in coral: which end is closer?
  function numberLine(lo, hi, at) {
    var W = 460, X0 = 30, X1 = W - 30, Y = 66;
    var span = hi - lo, step = span / 10;
    var s = '<svg class="pic-line" viewBox="0 0 ' + W + ' 104" aria-hidden="true">';
    s += '<path class="nl-axis" d="M' + (X0 - 14) + ' ' + Y + 'H' + (X1 + 14) + '"/>';
    for (var i = 0; i <= 10; i++) {
      var x = r1(X0 + (X1 - X0) * i / 10);
      var big = i === 0 || i === 10, mid = i === 5;
      s += '<path class="nl-tick' + (big ? ' b' : '') + '" d="M' + x + ' ' + (Y - (big ? 14 : mid ? 10 : 7)) + 'V' + (Y + (big ? 14 : mid ? 10 : 7)) + '"/>';
      if (big || mid) {
        s += '<text class="nl-n' + (mid ? ' mid' : '') + '" x="' + x + '" y="' + (Y + 36) + '">' + (lo + step * i) + '</text>';
      }
    }
    var ax = r1(X0 + (X1 - X0) * (at - lo) / span);
    s += '<path class="nl-pin" d="M' + ax + ' ' + (Y - 6) + 'l-9-14h18z"/>';
    s += '<circle class="nl-dot" cx="' + ax + '" cy="' + Y + '" r="7"/>';
    s += '<text class="nl-at" x="' + ax + '" y="' + (Y - 28) + '">' + at + '</text>';
    return s + '</svg>';
  }

  // ------------------------------------------------------------- clock

  function hand(cls, deg, len, knob) {
    return '<g class="ck-' + cls + '" transform="rotate(' + r1(deg) + ')">' +
      '<line x1="0" y1="14" x2="0" y2="' + (-len) + '"/>' +
      (knob ? '<circle class="ck-knob" cx="0" cy="' + (-len) + '" r="11"/>' : '') + '</g>';
  }

  // Short coral hand for the hour, long blue one for the minutes - the
  // colours of a classroom teaching clock. fine: stronger minute ticks.
  function clock(h, m, o) {
    o = o || {};
    var s = '<svg class="pic-clock' + (o.cls ? ' ' + o.cls : '') + '" viewBox="-112 -112 224 224" aria-hidden="true">';
    s += '<circle class="ck-rim" r="106"/><circle class="ck-face" r="99"/>';
    for (var i = 0; i < 60; i++) {
      var big = i % 5 === 0;
      var a = i * 6 * PI / 180, ra = big ? 84 : 90, rb = 95;
      s += '<line class="ck-t' + (big ? ' b' : o.fine ? ' f' : '') + '" x1="' + r1(ra * Math.sin(a)) + '" y1="' + r1(-ra * Math.cos(a)) +
        '" x2="' + r1(rb * Math.sin(a)) + '" y2="' + r1(-rb * Math.cos(a)) + '"/>';
    }
    for (var n = 1; n <= 12; n++) {
      var b = n * 30 * PI / 180;
      s += '<text class="ck-n" x="' + r1(68 * Math.sin(b)) + '" y="' + r1(-68 * Math.cos(b)) + '" dy=".36em">' + n + '</text>';
    }
    s += '<g class="ck-hands">' + hand('h', (h % 12) * 30 + m * 0.5, 50, o.set) + hand('m', m * 6, 80, o.set) + '</g>';
    return s + '<circle class="ck-hub" r="7"/></svg>';
  }

  var SUN = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></svg>';

  // Morning / afternoon / evening, for the 24-hour questions.
  function period(p) {
    var icon = p === 'evening' ? window.ICONS.moon : SUN;
    return '<span class="ck-period is-' + p + '">' + icon + '<span>' + window.T('m_' + p) + '</span></span>';
  }

  // ------------------------------------------------------------- money

  // Stylised Romanian lei: a note per value in roughly its real colour,
  // coins in brass, copper and nickel. Play money, not a likeness.
  function note(v) {
    return '<span class="bill v' + v + '"><i class="bill-seal"></i><b>' + v + '</b><small>' + (v === 1 ? 'LEU' : 'LEI') + '</small></span>';
  }
  function coin(v) {
    return '<span class="coin c' + v + '"><b>' + v + '</b><small>' + (v === 1 ? 'BAN' : 'BANI') + '</small></span>';
  }
  function money(notes, coins) {
    return '<div class="pic-money">' + (notes || []).map(note).join('') + (coins || []).map(coin).join('') + '</div>';
  }

  // ----------------------------------------------------------- shop items

  var INK = '#17123a';
  function st(extra) { return ' stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"' + (extra || ''); }
  var ITEM_ART = {
    ball: '<circle cx="24" cy="24" r="17" fill="#ff5d73"' + st() + '/><path d="M8.5 18c8 4.5 23 4.5 31 0M8.5 30c8-4.5 23-4.5 31 0" fill="none" stroke="#fff" stroke-width="4"/><circle cx="24" cy="24" r="17" fill="none"' + st() + '/>',
    book: '<rect x="10" y="7" width="28" height="34" rx="3" fill="#4cc9f0"' + st() + '/><path d="M16 7v34" stroke="' + INK + '" stroke-width="2.4"/><path d="M21 15h12M21 20h9" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
    icecream: '<path d="M15 24h18l-9 19z" fill="#f2b46b"' + st() + '/><path d="M19 29l8 0M21 34h6" stroke="#b5783a" stroke-width="2"/><circle cx="18.5" cy="20" r="7" fill="#ff9ec4"' + st() + '/><circle cx="29.5" cy="20" r="7" fill="#fff1c9"' + st() + '/><circle cx="24" cy="12.5" r="7" fill="#8b5a3c"' + st() + '/>',
    pencil: '<g transform="rotate(-38 24 24)"><rect x="9" y="19" width="24" height="10" fill="#ffd23f"' + st() + '/><path d="M33 19l9 5-9 5z" fill="#f6d3a8"' + st() + '/><path d="M39.5 22.6l2.5 1.4-2.5 1.4z" fill="' + INK + '"/><rect x="4" y="19" width="5" height="10" rx="1.5" fill="#ff9ec4"' + st() + '/></g>',
    car: '<path d="M5 31v-6.5l3-1 5-7.5h15l7 7.5 6 1.5v6z" fill="#2ee6a8"' + st() + '/><path d="M15 17.5h5.5v6H11zM23.5 17.5h4.5l5 6h-9.5z" fill="#d9fbff"' + st(' stroke-width="1.8"') + '/><circle cx="14" cy="32" r="5" fill="' + INK + '"/><circle cx="34" cy="32" r="5" fill="' + INK + '"/><circle cx="14" cy="32" r="1.8" fill="#fff"/><circle cx="34" cy="32" r="1.8" fill="#fff"/>',
    apple: '<path d="M24 15c-4-3-13-3-14 7-1 9 5 19 10 19 2 0 3-1 4-1s2 1 4 1c5 0 11-10 10-19-1-10-10-10-14-7z" fill="#ff5d73"' + st() + '/><path d="M24 15c0-4 1-6 3-8" fill="none" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/><path d="M26 10c3-4 8-4 10-2-3 3-7 4-10 2z" fill="#2ee6a8"' + st(' stroke-width="1.8"') + '/>',
    juice: '<rect x="13" y="14" width="22" height="28" rx="2" fill="#ff9f1c"' + st() + '/><path d="M13 20h22" stroke="' + INK + '" stroke-width="2"/><circle cx="24" cy="31" r="5" fill="#ffd23f"' + st(' stroke-width="1.8"') + '/><path d="M28 14l3-9h5" fill="none" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    teddy: '<circle cx="13" cy="13" r="6" fill="#c98a55"' + st() + '/><circle cx="35" cy="13" r="6" fill="#c98a55"' + st() + '/><circle cx="24" cy="25" r="15" fill="#c98a55"' + st() + '/><ellipse cx="24" cy="30" rx="6.5" ry="5" fill="#f2d2a9"' + st(' stroke-width="1.8"') + '/><circle cx="18.5" cy="22" r="2" fill="' + INK + '"/><circle cx="29.5" cy="22" r="2" fill="' + INK + '"/><circle cx="24" cy="28.5" r="2" fill="' + INK + '"/>',
    notebook: '<rect x="11" y="6" width="27" height="36" rx="3" fill="#fffdf7"' + st() + '/><path d="M15 13h20M15 19h20M15 25h20M15 31h20M20 9v30M26 9v30M32 9v30" stroke="#9fdcf3" stroke-width="1.2"/><path d="M17 6v36" stroke="#ff5d73" stroke-width="2"/><rect x="11" y="6" width="27" height="36" rx="3" fill="none"' + st() + '/>',
  };

  function itemIcon(id) {
    return '<svg class="shop-ico" viewBox="0 0 48 48" aria-hidden="true">' + ITEM_ART[id] + '</svg>';
  }

  // items: [{ id, tag, n }] - n copies of the item share one price tag.
  // pay: the notes being handed over.
  function shop(items, pay) {
    var s = '<div class="pic-shop">';
    if (pay && pay.length) s += '<span class="shop-pay">' + pay.map(note).join('') + '</span>';
    items.forEach(function (it) {
      var icons = '';
      for (var i = 0; i < (it.n || 1); i++) icons += itemIcon(it.id);
      s += '<span class="shop-it' + ((it.n || 1) > 1 ? ' is-many' : '') + '"><span class="shop-icons">' + icons + '</span>' +
        '<span class="tag">' + it.tag() + '</span></span>';
    });
    return s + '</div>';
  }

  // ----------------------------------------------------------- dispatch

  function render(p) {
    if (!p) return '';
    switch (p.t) {
      case 'frames': return frames(p.a, p.b, p.op);
      case 'array': return array(p.rows, p.cols);
      case 'blocks': return blocks(p.h, p.tens, p.u);
      case 'pie': return pie(p.n, p.k);
      case 'bar': return bar(p.n, p.k);
      case 'line': return numberLine(p.lo, p.hi, p.at);
      case 'clock': return clock(p.h, p.m, { fine: p.fine }) + (p.period ? period(p.period) : '');
      case 'clocks':
        return '<div class="pic-clocks">' + clock(p.a[0], p.a[1]) + '<span class="clocks-arrow">' + window.ICONS.back + '</span>' + clock(p.b[0], p.b[1]) + '</div>';
      case 'money': return money(p.notes, p.coins);
      case 'shop': return shop(p.items, p.pay);
    }
    return '';
  }

  return {
    render: render,
    clock: clock,
    frac: frac,
    note: note,
    coin: coin,
    itemIcon: itemIcon,
  };
})();
