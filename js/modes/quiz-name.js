// Mode 2: show a country name, pick its flag out of a grid.
window.MODES = window.MODES || [];
window.MODES.push({
  id: 'name-flag',
  icon: 'search',
  color: '#4cc9f0',
  dark: '#1d84a8',
  titleKey: 'modeNameFlag',
  subKey: 'modeNameFlagSub',
  items: 10,

  makeItem: function (round) {
    var choice = window.Game.makeChoice(round, false);
    // The grid wants a full rectangle: 4, 6 or 9 tiles.
    var want = choice.options.length <= 4 ? 4 : 6;
    while (choice.options.length > want) choice.options.pop();
    if (choice.options.indexOf(choice.target) === -1) {
      choice.options[(Math.random() * want) | 0] = choice.target;
    }
    return choice;
  },

  render: function (stage, item, done) {
    var prompt = document.createElement('p');
    prompt.className = 'prompt';
    prompt.textContent = window.T('askName') + ' ' + window.NAME(item.target) + '?';

    var grid = document.createElement('div');
    grid.className = 'flag-grid' + (item.options.length > 4 ? ' three' : '');

    var locked = false;
    item.options.forEach(function (country) {
      var btn = document.createElement('button');
      btn.className = 'flag-pick';
      var img = document.createElement('img');
      img.src = window.Game.flagUrl(country.cc, 'w160');
      img.alt = '';
      btn.appendChild(img);
      btn.addEventListener('click', function (e) {
        if (locked) return;
        locked = true;
        var right = country.cc === item.target.cc;

        for (var i = 0; i < grid.children.length; i++) {
          var el = grid.children[i];
          if (el === btn) el.classList.add(right ? 'ok' : 'bad');
          else if (item.options[i].cc === item.target.cc) el.classList.add('ok');
          else el.classList.add('dim');
        }

        if (right) {
          window.FX.play('correct');
          window.FX.burst(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2, 1);
        } else {
          window.FX.play('wrong');
        }
        done({ correct: right, cc: item.target.cc, delay: right ? 750 : 1500 });
      });
      grid.appendChild(btn);
    });

    stage.appendChild(prompt);
    stage.appendChild(grid);
  },
});
