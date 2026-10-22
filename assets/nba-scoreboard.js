(function () {
  'use strict';

  const API_URL =
    'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

  document.querySelectorAll('[data-nba-scoreboard]').forEach((root) => {
    if (!window.EspnTeamScoreboard) {
      console.warn('EspnTeamScoreboard not loaded');
      return;
    }
    window.EspnTeamScoreboard.init(root, {
      apiUrl: API_URL,
      sport: 'nba',
      leagueName: 'NBA',
    });
  });
})();
