(function () {
  'use strict';

  const { escapeHtml, initGamePage } = window.GameShared;

  function renderTeamBlock(teamData) {
    const team = teamData.team || {};
    const logo =
      team.logo ||
      team.logos?.find((l) => l.rel?.includes('default'))?.href ||
      team.logos?.[0]?.href ||
      '';
    const stats = (teamData.statistics || []).filter((s) => s.displayValue && s.label);

    if (!stats.length) {
      return `<section class="teamstats-card"><div class="boxscore-empty">Team stats not available.</div></section>`;
    }

    const rows = stats
      .map(
        (s) =>
          `<tr><td class="teamstats-label">${escapeHtml(s.label)}</td><td class="teamstats-value">${escapeHtml(s.displayValue)}</td></tr>`
      )
      .join('');

    return `
      <section class="teamstats-card">
        <div class="teamstats-card-header">
          ${logo ? `<img src="${escapeHtml(logo)}" alt="" />` : ''}
          <h2>${escapeHtml(team.displayName || team.shortDisplayName || 'Team')}</h2>
        </div>
        <div class="teamstats-table-wrap">
          <table class="teamstats-table"><tbody>${rows}</tbody></table>
        </div>
      </section>
    `;
  }

  function renderComparison(teams) {
    if (teams.length < 2) return '';

    const awayStats = teams[0]?.statistics || [];
    const homeStats = teams[1]?.statistics || [];
    const labels = awayStats.filter((s) => s.label).map((s) => s.label);
    const rows = labels
      .map((label) => {
        const awayVal = awayStats.find((s) => s.label === label)?.displayValue || '—';
        const homeVal = homeStats.find((s) => s.label === label)?.displayValue || '—';
        return `<tr><td class="teamstats-label">${escapeHtml(label)}</td><td>${escapeHtml(awayVal)}</td><td>${escapeHtml(homeVal)}</td></tr>`;
      })
      .join('');

    const awayName = teams[0]?.team?.abbreviation || 'Away';
    const homeName = teams[1]?.team?.abbreviation || 'Home';

    return `
      <section class="game-view-card">
        <div class="game-view-card-header"><h2>Team Comparison</h2></div>
        <div class="teamstats-table-wrap">
          <table class="teamstats-table teamstats-compare">
            <thead><tr><th>Stat</th><th>${escapeHtml(awayName)}</th><th>${escapeHtml(homeName)}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderMain({ data }) {
    const teams = data.boxscore?.teams || [];
    const mainEl = document.getElementById('game-main');
    const videoSidebarEl = document.getElementById('game-video-sidebar');
    if (videoSidebarEl) videoSidebarEl.innerHTML = '';

    if (mainEl) {
      mainEl.innerHTML = `
        ${renderComparison(teams)}
        <div class="teamstats-grid">${teams.map(renderTeamBlock).join('')}</div>
      `;
    }
  }

  initGamePage('teamstats', renderMain);
})();
