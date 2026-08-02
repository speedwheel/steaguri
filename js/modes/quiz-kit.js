// Shared answer boards. All the multiple-choice modes (and the endless
// challenge) build their answers through here, so locking, feedback, the
// timeout path and scoring behave identically everywhere.
window.QuizKit = (function () {

  // Returns { el, api } - api.timeout() is what the countdown calls when it
  // runs out, revealing the answer as if it had been answered wrong.
  function nameButtons(item, done, onWrong) {
    var wrap = document.createElement('div');
    wrap.className = 'answers' + (item.options.length > 4 ? ' two-col' : '');
    var locked = false;

    function reveal(chosen, e) {
      if (locked) return;
      locked = true;
      var right = !!chosen && chosen.cc === item.target.cc;

      for (var i = 0; i < wrap.children.length; i++) {
        var el = wrap.children[i];
        if (item.options[i].cc === item.target.cc) el.classList.add('ok');
        else if (chosen && item.options[i].cc === chosen.cc) el.classList.add('bad');
        else el.classList.add('dim');
      }

      if (right) {
        window.FX.play('correct');
        window.FX.burst(
          (e && e.clientX) || window.innerWidth / 2,
          (e && e.clientY) || window.innerHeight / 2, 1);
      } else {
        if (chosen) window.FX.play('wrong');   // a timeout already played it
        if (onWrong) onWrong();
      }
      done({ correct: right, cc: item.target.cc, delay: right ? 700 : 1500 });
    }

    item.options.forEach(function (country) {
      var btn = document.createElement('button');
      btn.className = 'ans';
      btn.textContent = window.NAME(country);
      btn.addEventListener('click', function (e) { reveal(country, e); });
      wrap.appendChild(btn);
    });

    return { el: wrap, api: { timeout: function () { reveal(null, null); } } };
  }

  function flagGrid(item, done) {
    var grid = document.createElement('div');
    grid.className = 'flag-grid' + (item.options.length > 4 ? ' three' : '');
    var locked = false;

    function reveal(chosen, e) {
      if (locked) return;
      locked = true;
      var right = !!chosen && chosen.cc === item.target.cc;

      for (var i = 0; i < grid.children.length; i++) {
        var el = grid.children[i];
        if (item.options[i].cc === item.target.cc) el.classList.add('ok');
        else if (chosen && item.options[i].cc === chosen.cc) el.classList.add('bad');
        else el.classList.add('dim');
      }

      if (right) {
        window.FX.play('correct');
        window.FX.burst(
          (e && e.clientX) || window.innerWidth / 2,
          (e && e.clientY) || window.innerHeight / 2, 1);
      } else if (chosen) {
        window.FX.play('wrong');
      }
      done({ correct: right, cc: item.target.cc, delay: right ? 700 : 1500 });
    }

    item.options.forEach(function (country) {
      var btn = document.createElement('button');
      btn.className = 'flag-pick';
      var img = document.createElement('img');
      img.src = window.Game.flagUrl(country.cc, 'w160');
      img.alt = '';
      btn.appendChild(img);
      btn.addEventListener('click', function (e) { reveal(country, e); });
      grid.appendChild(btn);
    });

    return { el: grid, api: { timeout: function () { reveal(null, null); } } };
  }

  function prompt(text) {
    var p = document.createElement('p');
    p.className = 'prompt';
    p.textContent = text;
    return p;
  }

  function flagShowcase(cc) {
    var box = document.createElement('div');
    box.className = 'showcase pop';
    var img = document.createElement('img');
    img.src = window.Game.flagUrl(cc, 'w320');
    img.alt = '';
    box.appendChild(img);
    return box;
  }

  function shapeShowcase(cc) {
    var box = document.createElement('div');
    box.className = 'showcase pop';
    box.innerHTML =
      '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<path d="' + window.SHAPES[cc].d + '"></path></svg>';
    return box;
  }

  // The flag grid wants a full rectangle, not a ragged last row.
  function fitGrid(item) {
    var want = item.options.length <= 4 ? 4 : item.options.length <= 6 ? 6 : 9;
    while (item.options.length > want) item.options.pop();
    if (item.options.indexOf(item.target) === -1) {
      item.options[(Math.random() * item.options.length) | 0] = item.target;
    }
    return item;
  }

  return {
    nameButtons: nameButtons,
    flagGrid: flagGrid,
    prompt: prompt,
    flagShowcase: flagShowcase,
    shapeShowcase: shapeShowcase,
    fitGrid: fitGrid,
  };
})();
