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
  const sport = (params.get('sport') || '').toLowerCase();
  const src = VIEW_SCRIPTS[view] || VIEW_SCRIPTS.boxscore;

  function loadScript(url, onLoad) {
    const script = document.createElement('script');
    script.src = url;
    if (onLoad) script.onload = onLoad;
    document.body.appendChild(script);
  }

  if (sport === 'soccer' && view === 'boxscore' && !window.GameSoccer) {
    loadScript('assets/game-soccer.js', () => loadScript(src));
  } else {
    loadScript(src);
  }
})();
