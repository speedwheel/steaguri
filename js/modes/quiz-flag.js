// Mode 1: show a flag, pick the country name.
window.MODES = window.MODES || [];
window.MODES.push({
  id: 'flag-name',
  icon: 'flag',
  color: '#ffd23f',
  dark: '#c98f00',
  titleKey: 'modeFlagName',
  subKey: 'modeFlagNameSub',
  items: 10,

  makeItem: function (round) {
    return window.Game.makeChoice(round, false);
  },

  render: function (stage, item, done) {
    var prompt = document.createElement('p');
    prompt.className = 'prompt';
    prompt.textContent = window.T('askFlag');

    var showcase = document.createElement('div');
    showcase.className = 'showcase pop';
    var img = document.createElement('img');
    img.src = window.Game.flagUrl(item.target.cc, 'w320');
    img.alt = '';
    showcase.appendChild(img);

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
          else if (el.textContent === window.NAME(item.target)) el.classList.add('ok');
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
      answers.appendChild(btn);
    });

    stage.appendChild(prompt);
    stage.appendChild(showcase);
    stage.appendChild(answers);
  },
});
