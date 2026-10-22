(function () {
  'use strict';
  document.querySelectorAll('[data-ufc-scoreboard]').forEach((root) => {
    window.EspnCombatScoreboard?.init(root, {
      apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',
      sport: 'ufc',
      leagueName: 'UFC',
    });
  });
})();
