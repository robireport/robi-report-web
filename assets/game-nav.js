(function (global) {
  'use strict';

  const TABS = [
    { id: 'gamecast', label: 'Gamecast', page: 'gamecast.html', view: 'gamecast' },
    { id: 'recap', label: 'Recap', page: 'recap.html', view: 'recap' },
    { id: 'boxscore', label: 'Box Score', page: 'game.html', view: 'boxscore' },
    { id: 'playbyplay', label: 'Play-by-Play', page: 'playbyplay.html', view: 'playbyplay' },
    { id: 'teamstats', label: 'Team Stats', page: 'teamstats.html', view: 'teamstats' },
    { id: 'videos', label: 'Videos', page: 'videos.html', view: 'videos' },
  ];

  function buildTabHref(tab, sport, gameId) {
    const params = new URLSearchParams();
    params.set('sport', sport);
    params.set('gameId', gameId);
    if (tab.page === 'game.html') {
      if (tab.view && tab.view !== 'boxscore') params.set('view', tab.view);
      return `${tab.page}?${params.toString()}`;
    }
    return `${tab.page}?${params.toString()}`;
  }

  function renderTabs(activeId, sport, gameId) {
    const items = TABS.map((tab) => {
      const isActive = tab.id === activeId;
      const href = buildTabHref(tab, sport, gameId);
      return `<li class="game-tabs-item"><a href="${href}" class="game-tab${isActive ? ' is-active' : ''}"${isActive ? ' aria-current="page"' : ''}>${tab.label}</a></li>`;
    }).join('');

    return `
      <nav class="game-tabs" aria-label="Game views">
        <div class="game-tabs-scroll">
          <ul class="game-tabs-list">${items}</ul>
        </div>
      </nav>
    `;
  }

  global.GameNav = {
    TABS,
    buildTabHref,
    renderTabs,
  };
})(window);
