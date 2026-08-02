// Mode 1: show a flag, pick the country name.
window.MODES = window.MODES || [];
window.MODES.push({
  id: 'flag-name',
  icon: 'flag',
  color: '#ffd23f',
  dark: '#c98f00',
  titleKey: 'modeFlagName',
  continuous: true,
  subKey: 'modeFlagNameSub',

  makeItem: function (round) {
    return window.Game.makeChoice(round, false);
  },

  render: function (stage, item, done) {
    var board = window.QuizKit.nameButtons(item, done);
    stage.appendChild(window.QuizKit.prompt(window.T('askFlag')));
    stage.appendChild(window.QuizKit.flagShowcase(item.target.cc));
    stage.appendChild(board.el);
    return board.api;
  },
});
