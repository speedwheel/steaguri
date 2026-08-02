// Mode 6: endless challenge. Three lives, no fixed length, and the difficulty
// climbs a level every five questions on top of whatever level the player has
// already earned - so it ends when he runs out of knowledge, not after 30
// seconds. Question type is mixed so nothing settles into a rhythm.
window.MODES = window.MODES || [];
window.MODES.push({
  id: 'challenge',
  icon: 'bolt',
  color: '#ff9f1c',
  dark: '#b86b00',
  titleKey: 'modeChallenge',
  subKey: 'modeChallengeSub',
  endless: true,
  lives: 3,

  scoreText: function (round) {
    return round.correct + ' ' + window.T('accuracy') +
      '  ·  ' + window.T('record') + ' ' + window.Store.bestOf('challenge');
  },

  makeItem: function (round) {
    // Shapes only once the player is a few questions in, so a run does not
    // open on the hardest question type.
    var kinds = round.index < 3 ? ['flag', 'grid'] : ['flag', 'grid', 'shape'];
    var kind = kinds[(Math.random() * kinds.length) | 0];
    var item = window.Game.makeChoice(round, kind === 'shape');
    item.kind = kind;
    if (kind === 'grid') window.QuizKit.fitGrid(item);
    return item;
  },

  render: function (stage, item, done) {
    var kit = window.QuizKit;
    var board;

    if (item.kind === 'grid') {
      board = kit.flagGrid(item, done);
      stage.appendChild(kit.prompt(window.T('askName') + ' ' + window.NAME(item.target) + '?'));
      stage.appendChild(board.el);
    } else if (item.kind === 'shape') {
      var showcase = kit.shapeShowcase(item.target.cc);
      board = kit.nameButtons(item, done, function () {
        var hint = document.createElement('img');
        hint.src = window.Game.flagUrl(item.target.cc, 'w160');
        hint.alt = '';
        hint.className = 'shape-hint';
        showcase.appendChild(hint);
      });
      stage.appendChild(kit.prompt(window.T('askShape')));
      stage.appendChild(showcase);
      stage.appendChild(board.el);
    } else {
      board = kit.nameButtons(item, done);
      stage.appendChild(kit.prompt(window.T('askFlag')));
      stage.appendChild(kit.flagShowcase(item.target.cc));
      stage.appendChild(board.el);
    }

    return board.api;
  },
});
