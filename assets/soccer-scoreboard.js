(function () {
  'use strict';

  const LEAGUES = [
    {
      id: 'eng.1',
      label: 'Premier League',
      apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
    },
    {
      id: 'usa.1',
      label: 'MLS',
      apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard',
    },
    {
      id: 'uefa.champions',
      label: 'Champions League',
      apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard',
    },
  ];

  function readLeagueFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('league');
    return LEAGUES.find((l) => l.id === id) || LEAGUES[0];
  }

  function writeLeagueToUrl(id) {
    const url = new URL(window.location.href);
    url.searchParams.set('league', id);
    window.history.replaceState({}, '', url.toString());
  }

  document.querySelectorAll('[data-soccer-scoreboard]').forEach((root) => {
    let active = readLeagueFromUrl();

    const tabs = document.createElement('div');
    tabs.className = 'scoreboard-league-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Soccer competitions');

    LEAGUES.forEach((league) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scoreboard-league-tab';
      btn.setAttribute('role', 'tab');
      btn.dataset.leagueId = league.id;
      btn.textContent = league.label;
      if (league.id === active.id) {
        btn.setAttribute('aria-selected', 'true');
        btn.classList.add('is-active');
      } else {
        btn.setAttribute('aria-selected', 'false');
      }
      tabs.appendChild(btn);
    });

    const mount = document.createElement('div');
    mount.className = 'nba-scoreboard-root';
    root.appendChild(tabs);
    root.appendChild(mount);

    function loadLeague(league) {
      active = league;
      writeLeagueToUrl(league.id);
      tabs.querySelectorAll('.scoreboard-league-tab').forEach((tab) => {
        const on = tab.dataset.leagueId === league.id;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      mount.innerHTML = '';
      if (!window.EspnTeamScoreboard) return;
      window.EspnTeamScoreboard.init(mount, {
        apiUrl: league.apiUrl,
        sport: 'soccer',
        leagueName: league.label,
        showCompetition: true,
      });
    }

    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-league-id]');
      if (!btn) return;
      const league = LEAGUES.find((l) => l.id === btn.dataset.leagueId);
      if (league) loadLeague(league);
    });

    loadLeague(active);
  });
})();
