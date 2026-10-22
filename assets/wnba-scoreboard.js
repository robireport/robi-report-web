(function () {
  'use strict';
  document.querySelectorAll('[data-wnba-scoreboard]').forEach((root) => {
    window.EspnTeamScoreboard?.init(root, {
      apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard',
      sport: 'wnba',
      leagueName: 'WNBA',
    });
  });
})();
