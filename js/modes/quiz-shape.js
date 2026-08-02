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

  makeItem: function (round) {
    return window.Game.makeChoice(round, true);
  },

  render: function (stage, item, done) {
    var showcase = window.QuizKit.shapeShowcase(item.target.cc);

    // Getting it wrong is the moment to show the flag - it ties the shape to
    // something he already recognises.
    var board = window.QuizKit.nameButtons(item, done, function () {
      var hint = document.createElement('img');
      hint.src = window.Game.flagUrl(item.target.cc, 'w160');
      hint.alt = '';
      hint.className = 'shape-hint';
      showcase.appendChild(hint);
    });

    stage.appendChild(window.QuizKit.prompt(window.T('askShape')));
    stage.appendChild(showcase);
    stage.appendChild(board.el);
    return board.api;
  },
});
