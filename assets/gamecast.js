(function () {
  'use strict';

  const { escapeHtml, initGamePage } = window.GameShared;

  function renderLeaders(leaders) {
    if (!leaders?.length) {
      return '<div class="boxscore-empty">Game leaders will appear once stats are available.</div>';
    }

    return leaders
      .map((group) => {
        const team = group.team || {};
        const logo = team.logo || team.logos?.[0]?.href || '';
        const cats = (group.leaders || [])
          .map((cat) => {
            const leader = cat.leaders?.[0];
            if (!leader) return '';
            const athlete = leader.athlete?.displayName || leader.athlete?.shortName || '—';
            const value = leader.displayValue || leader.value || '—';
            return `
              <li>
                <span class="label">${escapeHtml(cat.displayName || cat.name || 'Stat')}</span>
                <span class="value">${escapeHtml(athlete)} · ${escapeHtml(String(value))}</span>
              </li>
            `;
          })
          .join('');

        return `
          <section class="game-view-card">
            <div class="gamecast-leaders-header">
              ${logo ? `<img src="${escapeHtml(logo)}" alt="" />` : ''}
              <h2>${escapeHtml(team.displayName || team.abbreviation || 'Team')}</h2>
            </div>
            <ul class="game-info-list">${cats}</ul>
          </section>
        `;
      })
      .join('');
  }

  function renderMain({ data }) {
    const mainEl = document.getElementById('game-main');
    const videoSidebarEl = document.getElementById('game-video-sidebar');
    if (videoSidebarEl) videoSidebarEl.innerHTML = '';

    if (mainEl) {
      mainEl.innerHTML = `
        <section class="game-view-card">
          <div class="game-view-card-header"><h2>Game Leaders</h2></div>
        </section>
        <div class="gamecast-grid">${renderLeaders(data.leaders)}</div>
      `;
    }
  }

  initGamePage('gamecast', renderMain);
})();
