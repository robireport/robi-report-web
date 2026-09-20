(function () {
  'use strict';

  const { escapeHtml, initGamePage } = window.GameShared;

  const BASKETBALL_COLS = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', '+/-'];

  const NFL_CATEGORIES = [
    { key: 'passing', title: 'Passing', columns: ['C/ATT', 'YDS', 'AVG', 'TD', 'INT', 'SACKS', 'RTG'] },
    { key: 'rushing', title: 'Rushing', columns: ['CAR', 'YDS', 'AVG', 'TD', 'LONG'] },
    { key: 'receiving', title: 'Receiving', columns: ['REC', 'YDS', 'AVG', 'TD', 'LONG', 'TGTS'] },
    { key: 'fumbles', title: 'Fumbles', columns: ['FUM', 'LOST', 'REC'] },
    { key: 'defensive', title: 'Defense', columns: ['TOT', 'SOLO', 'SACKS', 'TFL', 'PD', 'QB HTS', 'TD'] },
    { key: 'interceptions', title: 'Interceptions', columns: ['INT', 'YDS', 'TD'] },
    { key: 'kickReturns', title: 'Kick Returns', columns: ['NO', 'YDS', 'AVG', 'LONG', 'TD'] },
    { key: 'puntReturns', title: 'Punt Returns', columns: ['NO', 'YDS', 'AVG', 'LONG', 'TD'] },
    { key: 'kicking', title: 'Kicking', columns: ['FG', 'PCT', 'LONG', 'XP', 'PTS'] },
    { key: 'punting', title: 'Punting', columns: ['NO', 'YDS', 'AVG', 'TB', 'In 20', 'LONG'] },
  ];

  function filterColumns(labels, wanted) {
    const indices = [];
    const filtered = [];
    wanted.forEach((col) => {
      const i = labels.indexOf(col);
      if (i >= 0) {
        indices.push(i);
        filtered.push(col);
      }
    });
    return { indices, labels: filtered };
  }

  function filterBasketballLabels(labels) {
    const wanted = new Set(BASKETBALL_COLS);
    const indices = [];
    const filtered = [];
    labels.forEach((label, i) => {
      if (wanted.has(label)) {
        indices.push(i);
        filtered.push(label);
      }
    });
    return { indices, labels: filtered.length ? filtered : labels.slice(0, 11) };
  }

  function renderPlayerName(row, linkPlayers, gameId, sport) {
    const name = row.athlete?.displayName || row.athlete?.shortName || '—';
    const athleteId = row.athlete?.id;

    if (!linkPlayers || !athleteId || name === '—') {
      return escapeHtml(name);
    }

    const href = `player.html?id=${encodeURIComponent(athleteId)}&gameId=${encodeURIComponent(gameId)}&sport=${encodeURIComponent(sport)}`;
    return `<a href="${escapeHtml(href)}" class="player-profile-link">${escapeHtml(name)}</a>`;
  }

  function renderPlayerTable(statBlock, preferBasketball, linkPlayers, gameId, sport) {
    const labels = statBlock.labels || statBlock.names || [];
    const athletes = statBlock.athletes || [];
    if (!athletes.length) return '';

    let displayLabels = labels;
    let colFilter = null;

    if (preferBasketball && labels.some((l) => BASKETBALL_COLS.includes(l))) {
      const filtered = filterBasketballLabels(labels);
      displayLabels = filtered.labels;
      colFilter = filtered.indices;
    }

    const starters = athletes.filter((a) => a.starter);
    const bench = athletes.filter((a) => !a.starter && !a.notPlaying);
    const dnp = athletes.filter((a) => a.notPlaying);

    function renderRows(rows) {
      return rows
        .map((row) => {
          let stats = row.stats || [];
          if (colFilter) stats = colFilter.map((i) => stats[i] ?? '—');
          const cells = stats.map((v) => `<td>${escapeHtml(v)}</td>`).join('');
          return `<tr><td class="player-name">${renderPlayerName(row, linkPlayers, gameId, sport)}</td>${cells}</tr>`;
        })
        .join('');
    }

    const head = displayLabels.map((l) => `<th>${escapeHtml(l)}</th>`).join('');

    let html = `<div class="boxscore-table-wrap"><table class="boxscore-table"><thead><tr><th>Player</th>${head}</tr></thead><tbody>`;

    if (starters.length) {
      html += `<tr><td colspan="${displayLabels.length + 1}" class="boxscore-group-title" style="padding:8px 10px;">Starters</td></tr>`;
      html += renderRows(starters);
    }
    if (bench.length) {
      html += `<tr><td colspan="${displayLabels.length + 1}" class="boxscore-group-title" style="padding:8px 10px;">Bench</td></tr>`;
      html += renderRows(bench);
    }
    if (dnp.length) {
      html += dnp
        .map((row) => {
          const reason = row.reason?.shortName || row.reason?.description || 'DNP';
          return `<tr><td class="player-name dnp" colspan="${displayLabels.length + 1}">${renderPlayerName(row, linkPlayers, gameId, sport)} — ${escapeHtml(reason)}</td></tr>`;
        })
        .join('');
    }

    html += '</tbody></table></div>';
    return html;
  }

  function renderCategoryTable(statBlock, wantedColumns, linkPlayers, gameId, sport) {
    const labels = statBlock.labels || statBlock.names || [];
    const athletes = statBlock.athletes || [];
    if (!athletes.length) return '';

    const { indices, labels: displayLabels } = filterColumns(labels, wantedColumns);
    const useLabels = displayLabels.length ? displayLabels : labels;
    const useIndices = displayLabels.length ? indices : labels.map((_, i) => i);

    const head = useLabels.map((l) => `<th>${escapeHtml(l)}</th>`).join('');
    const body = athletes
      .map((row) => {
        const stats = useIndices.map((i) => row.stats?.[i] ?? '—');
        const cells = stats.map((v) => `<td>${escapeHtml(v)}</td>`).join('');
        return `<tr><td class="player-name">${renderPlayerName(row, linkPlayers, gameId, sport)}</td>${cells}</tr>`;
      })
      .join('');

    return `<div class="boxscore-table-wrap"><table class="boxscore-table"><thead><tr><th>Player</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function getTeamPlaceName(team) {
    return team.location || team.shortDisplayName || team.name || team.displayName || 'Team';
  }

  function renderCategoryEmpty(teamPlace, categoryTitle) {
    return `<div class="boxscore-empty boxscore-category-empty">No ${escapeHtml(teamPlace)} ${escapeHtml(categoryTitle)}</div>`;
  }

  function renderTeamBoxscoreFootball(teamGroup, linkPlayers, gameId, sport) {
    const team = teamGroup.team || {};
    const teamPlace = getTeamPlaceName(team);
    const logo =
      team.logo ||
      team.logos?.find((l) => l.rel?.includes('default'))?.href ||
      team.logos?.[0]?.href ||
      '';
    const statsBlocks = teamGroup.statistics || [];
    const blocksByName = Object.fromEntries(
      statsBlocks.filter((block) => block.name).map((block) => [block.name, block])
    );

    const categoryHtml = NFL_CATEGORIES.map((category) => {
      const block = blocksByName[category.key];
      const athletes = block?.athletes || [];
      const inner = athletes.length
        ? renderCategoryTable(block, category.columns, linkPlayers, gameId, sport)
        : renderCategoryEmpty(teamPlace, category.title);

      return `
        <section class="boxscore-category">
          <h3 class="boxscore-group-title">${escapeHtml(category.title)}</h3>
          ${inner}
        </section>
      `;
    }).join('');

    const tableHtml = categoryHtml || '<div class="boxscore-empty">Player stats not yet available for this game.</div>';

    return `
      <section class="boxscore-team">
        <div class="boxscore-team-header">
          ${logo ? `<img src="${escapeHtml(logo)}" alt="" />` : ''}
          <h2>${escapeHtml(team.displayName || team.shortDisplayName || 'Team')}</h2>
        </div>
        ${tableHtml}
      </section>
    `;
  }

  function renderTeamBoxscore(teamGroup, preferBasketball, linkPlayers, gameId, sport) {
    if (sport === 'nfl') {
      return renderTeamBoxscoreFootball(teamGroup, linkPlayers, gameId, sport);
    }
    const team = teamGroup.team || {};
    const logo =
      team.logo ||
      team.logos?.find((l) => l.rel?.includes('default'))?.href ||
      team.logos?.[0]?.href ||
      '';
    const statsBlocks = teamGroup.statistics || [];
    const playerBlock = statsBlocks.find((s) => s.athletes?.length) || statsBlocks[0];

    let tableHtml = '';
    if (playerBlock?.athletes?.length) {
      tableHtml = renderPlayerTable(playerBlock, preferBasketball, linkPlayers, gameId, sport);
    } else {
      tableHtml = '<div class="boxscore-empty">Player stats not yet available for this game.</div>';
    }

    return `
      <section class="boxscore-team">
        <div class="boxscore-team-header">
          ${logo ? `<img src="${escapeHtml(logo)}" alt="" />` : ''}
          <h2>${escapeHtml(team.displayName || team.shortDisplayName || 'Team')}</h2>
        </div>
        ${tableHtml}
      </section>
    `;
  }

  function renderMain({ data, cfg, comp, sport, gameId, els }) {
    if ((sport === 'soccer' || cfg?.category === 'soccer') && window.GameSoccer?.renderMain) {
      window.GameSoccer.renderMain({ data, cfg, comp, sport, gameId, els });
      return;
    }

    const lineupSidebarEl = document.getElementById('game-lineup-sidebar');
    if (lineupSidebarEl) lineupSidebarEl.innerHTML = '';

    const preferBasketball = cfg.category === 'basketball';
    const linkPlayers = sport === 'nba' || sport === 'wnba';
    const playerGroups = data.boxscore?.players || [];
    const boxscoreHtml = playerGroups.length
      ? playerGroups.map((g) => renderTeamBoxscore(g, preferBasketball, linkPlayers, gameId, sport)).join('')
      : '<div class="boxscore-empty">Box score will be available once the game begins.</div>';

    const videos = window.VideoSidebar ? window.VideoSidebar.collectFromSummary(data) : [];
    const videoTitle = window.VideoSidebar
      ? window.VideoSidebar.buildGameVideoTitle(comp)
      : 'GAME HIGHLIGHTS';
    const videoHtml = window.VideoSidebar ? window.VideoSidebar.render(videos, videoTitle) : '';

    const mainEl = document.getElementById('game-main');
    const videoSidebarEl = document.getElementById('game-video-sidebar');

    if (mainEl) mainEl.innerHTML = boxscoreHtml;
    if (videoSidebarEl) videoSidebarEl.innerHTML = videoHtml;
    if (window.VideoSidebar) window.VideoSidebar.init(els.content);
  }

  initGamePage('boxscore', renderMain);
})();
