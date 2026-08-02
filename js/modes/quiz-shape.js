// Mode 3: show a country silhouette, pick the country name.
// Only countries with a usable outline take part (js/shapes.js).
window.MODES = window.MODES || [];
window.MODES.push({
  id: 'shape-name',
  icon: 'globe',
  color: '#2ee6a8',
  dark: '#0f9c6d',
  titleKey: 'modeShape',
  subKey: 'modeShapeSub',
  items: 10,

  makeItem: function (round) {
    return window.Game.makeChoice(round, true);
  },

  render: function (stage, item, done) {
    var prompt = document.createElement('p');
    prompt.className = 'prompt';
    prompt.textContent = window.T('askShape');

    var showcase = document.createElement('div');
    showcase.className = 'showcase pop';
    var shape = window.SHAPES[item.target.cc];
    showcase.innerHTML =
      '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<path d="' + shape.d + '"></path></svg>';

    var answers = document.createElement('div');
    answers.className = 'answers' + (item.options.length > 4 ? ' two-col' : '');

    var locked = false;
    item.options.forEach(function (country) {
      var btn = document.createElement('button');
      btn.className = 'ans';
      btn.textContent = window.NAME(country);
      btn.addEventListener('click', function (e) {
        if (locked) return;
        locked = true;
        var right = country.cc === item.target.cc;

        for (var i = 0; i < answers.children.length; i++) {
          var el = answers.children[i];
          if (el === btn) el.classList.add(right ? 'ok' : 'bad');
          else if (item.options[i].cc === item.target.cc) el.classList.add('ok');
          else el.classList.add('dim');
        }

        // Getting it wrong is the moment to show the flag - it ties the shape
        // to something he already recognises.
        if (!right) {
          var hint = document.createElement('img');
          hint.src = window.Game.flagUrl(item.target.cc, 'w160');
          hint.alt = '';
          hint.style.width = '90px';
          hint.style.borderRadius = '8px';
          hint.style.marginTop = '8px';
          showcase.appendChild(hint);
          window.FX.play('wrong');
        } else {
          window.FX.play('correct');
          window.FX.burst(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2, 1);
        }
        done({ correct: right, cc: item.target.cc, delay: right ? 750 : 1800 });
      });
      answers.appendChild(btn);
    });

    stage.appendChild(prompt);
    stage.appendChild(showcase);
    stage.appendChild(answers);
  },
});
