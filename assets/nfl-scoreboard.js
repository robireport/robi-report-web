(function () {
  'use strict';
  document.querySelectorAll('[data-nfl-scoreboard]').forEach((root) => {
    window.EspnTeamScoreboard?.init(root, {
      apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      sport: 'nfl',
      leagueName: 'NFL',
    });
  });
})();
