(function () {
  'use strict';
  document.querySelectorAll('[data-mlb-scoreboard]').forEach((root) => {
    window.EspnTeamScoreboard?.init(root, {
      apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
      sport: 'mlb',
      leagueName: 'MLB',
    });
  });
})();
