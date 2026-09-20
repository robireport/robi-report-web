(function () {
  'use strict';

  const VIEW_SCRIPTS = {
    boxscore: 'assets/game.js',
    gamecast: 'assets/gamecast.js',
    recap: 'assets/recap.js',
    playbyplay: 'assets/playbyplay.js',
    teamstats: 'assets/teamstats.js',
    videos: 'assets/videos.js',
  };

  const params = new URLSearchParams(window.location.search);
  const view = (params.get('view') || 'boxscore').toLowerCase();
  const src = VIEW_SCRIPTS[view] || VIEW_SCRIPTS.boxscore;

  const script = document.createElement('script');
  script.src = src;
  document.body.appendChild(script);
})();
