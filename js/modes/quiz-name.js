// Mode 2: show a country name, pick its flag out of a grid.
window.MODES = window.MODES || [];
window.MODES.push({
  id: 'name-flag',
  icon: 'search',
  color: '#4cc9f0',
  dark: '#1d84a8',
  titleKey: 'modeNameFlag',
  subKey: 'modeNameFlagSub',

  makeItem: function (round) {
    return window.QuizKit.fitGrid(window.Game.makeChoice(round, false));
  },

  render: function (stage, item, done) {
    var board = window.QuizKit.flagGrid(item, done);
    stage.appendChild(window.QuizKit.prompt(
      window.T('askName') + ' ' + window.NAME(item.target) + '?'));
    stage.appendChild(board.el);
    return board.api;
  },
});
