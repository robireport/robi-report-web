(function () {
  'use strict';

  const SPORT_CONFIG = {
    nba: { category: 'basketball', league: 'nba', hub: 'nba.html', label: 'NBA' },
    wnba: { category: 'basketball', league: 'wnba', hub: 'wnba.html', label: 'WNBA' },
    nfl: { category: 'football', league: 'nfl', hub: 'nfl.html', label: 'NFL' },
    mlb: { category: 'baseball', league: 'mlb', hub: 'mlb.html', label: 'MLB' },
    ufc: { category: 'mma', league: 'ufc', hub: 'ufc.html', label: 'UFC' },
    boxing: { category: 'boxing', league: 'boxing', hub: 'boxing.html', label: 'Boxing' },
    soccer: { category: 'soccer', league: 'eng.1', hub: 'soccer.html', label: 'Premier League' },
  };

  const BASKETBALL_COLS = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', '+/-'];

  const els = {
    loading: document.getElementById('game-loading'),
    error: document.getElementById('game-error'),
    errorMsg: document.getElementById('game-error-msg'),
    content: document.getElementById('game-content'),
  };

  if (!els.loading || !els.content) return;

  const params = new URLSearchParams(window.location.search);
  const gameId = params.get('gameId');
  const sport = (params.get('sport') || '').toLowerCase();

  function showError(msg) {
    els.loading.classList.add('hidden');
    els.content.classList.add('hidden');
    els.error.classList.remove('hidden');
    if (els.errorMsg) els.errorMsg.textContent = msg;
  }

  function hideLoading() {
    els.loading.classList.add('hidden');
    els.error.classList.add('hidden');
    els.content.classList.remove('hidden');
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getTeamLogo(team) {
    return (
      team?.logo ||
      team?.logos?.find((l) => l.rel?.includes('default'))?.href ||
      team?.logos?.[0]?.href ||
      ''
    );
  }

  function getTeamColor(team) {
    const c = team?.color || team?.primaryColor;
    return c ? (c.startsWith('#') ? c : `#${c}`) : '#111111';
  }

  function getRecord(competitor) {
    const rec =
      competitor?.records?.find((r) => r.type === 'total')?.summary ||
      competitor?.record?.[0]?.summary ||
      teamRecord(competitor?.team);
    return rec || '';
  }

  function teamRecord(team) {
    if (!team?.record?.length) return '';
    return team.record.find((r) => r.type === 'total')?.summary || team.record[0]?.summary || '';
  }

  function formatGameTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch (_) {
      return '';
    }
  }

  function getBroadcasts(data, comp) {
    const pools = [...(data.broadcasts || []), ...(comp?.broadcasts || [])];
    const names = pools
      .map((b) => b.media?.shortName || b.names?.[0] || b.shortName)
      .filter(Boolean);
    return [...new Set(names)].slice(0, 4).join(' · ');
  }

  function getCompetitors(comp) {
    const list = comp?.competitors || [];
    const away = list.find((c) => c.homeAway === 'away') || list[0];
    const home = list.find((c) => c.homeAway === 'home') || list[1];
    return { away, home };
  }

  function buildSummaryUrl(cfg, id) {
    return `https://site.api.espn.com/apis/site/v2/sports/${cfg.category}/${cfg.league}/summary?event=${id}`;
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

  function renderPlayerTable(statBlock, preferBasketball) {
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
          const name = row.athlete?.displayName || row.athlete?.shortName || '—';
          let stats = row.stats || [];
          if (colFilter) stats = colFilter.map((i) => stats[i] ?? '—');
          const cells = stats.map((v) => `<td>${escapeHtml(v)}</td>`).join('');
          return `<tr><td class="player-name">${escapeHtml(name)}</td>${cells}</tr>`;
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
          const name = row.athlete?.displayName || '—';
          const reason = row.reason?.shortName || row.reason?.description || 'DNP';
          return `<tr><td class="player-name dnp" colspan="${displayLabels.length + 1}">${escapeHtml(name)} — ${escapeHtml(reason)}</td></tr>`;
        })
        .join('');
    }

    html += '</tbody></table></div>';
    return html;
  }

  function renderTeamBoxscore(teamGroup, preferBasketball) {
    const team = teamGroup.team || {};
    const logo = getTeamLogo(team);
    const statsBlocks = teamGroup.statistics || [];
    const playerBlock = statsBlocks.find((s) => s.athletes?.length) || statsBlocks[0];

    let tableHtml = '';
    if (playerBlock?.athletes?.length) {
      tableHtml = renderPlayerTable(playerBlock, preferBasketball);
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

  function renderSidebar(data, comp, cfg) {
    const gi = data.gameInfo || {};
    const venue = gi.venue || comp?.venue || {};
    const city = venue.address?.city;
    const state = venue.address?.state;
    const location = [venue.fullName, city && state ? `${city}, ${state}` : city]
      .filter(Boolean)
      .join(' · ');

    const officials = (gi.officials || comp?.officials || [])
      .map((o) => o.displayName || o.fullName)
      .filter(Boolean);

    const seriesList = data.seasonseries || [];
    const series = seriesList[0] || null;

    const attendance = gi.attendance || comp?.attendance;

    return `
      <aside class="game-sidebar">
        <div class="game-info-card">
          <h3>Game Information</h3>
          <ul class="game-info-list">
            ${attendance ? `<li><span class="label">Attendance</span><span class="value">${Number(attendance).toLocaleString()}</span></li>` : ''}
            ${location ? `<li><span class="label">Venue</span><span class="value">${escapeHtml(location)}</span></li>` : ''}
            ${comp?.date ? `<li><span class="label">Date</span><span class="value">${escapeHtml(formatGameTime(comp.date))}</span></li>` : ''}
            <li><span class="label">League</span><span class="value">${escapeHtml(cfg.label)}</span></li>
          </ul>
        </div>
        ${
          officials.length
            ? `<div class="game-info-card">
          <h3>Officiating</h3>
          <ul class="game-info-list officials">
            ${officials.map((o) => `<li><span class="value">${escapeHtml(o)}</span></li>`).join('')}
          </ul>
        </div>`
            : ''
        }
        ${
          series
            ? `<div class="game-info-card">
          <h3>Series &amp; Matchup History</h3>
          <div class="series-summary">
            <strong>${escapeHtml(series.title || 'Season Series')}</strong>
            ${escapeHtml(series.summary || series.shortSummary || series.seriesScore || '—')}
          </div>
        </div>`
            : ''
        }
      </aside>
    `;
  }

  function renderHero(data, comp, cfg) {
    const { away, home } = getCompetitors(comp);
    if (!away || !home) return '';

    const awayTeam = away.team || {};
    const homeTeam = home.team || {};
    const status = comp.status || {};
    const statusType = status.type || {};
    const isLive = statusType.state === 'in';
    const isFinal = statusType.completed || statusType.state === 'post';

    const awayScore = away.score ?? '—';
    const homeScore = home.score ?? '—';
    const statusText = isLive
      ? `${status.displayClock || ''} ${statusType.shortDetail || statusType.detail || 'Live'}`.trim()
      : statusType.shortDetail || statusType.detail || formatGameTime(comp.date);

    const broadcasts = getBroadcasts(data, comp);
    const venue = data.gameInfo?.venue || comp.venue || {};

    const awayLines = (away.linescores || []).map((ls, i) =>
      `<span class="game-linescore-pill">Q${i + 1}: ${escapeHtml(ls.displayValue ?? ls.value ?? '')}</span>`
    ).join('');

    return `
      <section class="game-hero" style="--away-color:${getTeamColor(awayTeam)};--home-color:${getTeamColor(homeTeam)};">
        <div class="game-hero-bg"></div>
        <div class="game-hero-inner">
          <div class="game-hero-meta">
            <span>${escapeHtml(cfg.label)}</span>
            ${isLive ? '<span class="live-badge">Live</span>' : ''}
            ${comp.season?.year ? `<span>${escapeHtml(String(comp.season.year))} Season</span>` : ''}
          </div>
          <div class="game-matchup">
            <div class="game-team away">
              <img class="game-team-logo" src="${escapeHtml(getTeamLogo(awayTeam))}" alt="" />
              <div class="game-team-name">${escapeHtml(awayTeam.displayName || awayTeam.abbreviation)}</div>
              <div class="game-team-record">${escapeHtml(getRecord(away))}</div>
            </div>
            <div class="game-scoreboard">
              <div class="game-scores">
                <span>${escapeHtml(String(awayScore))}</span>
                <span class="sep">–</span>
                <span>${escapeHtml(String(homeScore))}</span>
              </div>
              <div class="game-status${isFinal ? ' is-final' : ''}">${escapeHtml(statusText)}</div>
              ${awayLines ? `<div class="game-linescores">${awayLines}</div>` : ''}
            </div>
            <div class="game-team home">
              <img class="game-team-logo" src="${escapeHtml(getTeamLogo(homeTeam))}" alt="" />
              <div class="game-team-name">${escapeHtml(homeTeam.displayName || homeTeam.abbreviation)}</div>
              <div class="game-team-record">${escapeHtml(getRecord(home))}</div>
            </div>
          </div>
          <div class="game-hero-footer">
            ${venue.fullName ? `<span><strong>Arena:</strong> ${escapeHtml(venue.fullName)}</span>` : ''}
            ${broadcasts ? `<span><strong>Broadcast:</strong> ${escapeHtml(broadcasts)}</span>` : ''}
          </div>
        </div>
      </section>
    `;
  }

  function renderPage(data, cfg) {
    const header = data.header || {};
    const comp = header.competitions?.[0] || data.boxscore?.teams?.[0]?.competition || {};
    const preferBasketball = cfg.category === 'basketball';

    const playerGroups = data.boxscore?.players || [];
    const boxscoreHtml = playerGroups.length
      ? playerGroups.map((g) => renderTeamBoxscore(g, preferBasketball)).join('')
      : '<div class="boxscore-empty">Box score will be available once the game begins.</div>';

    const awayName = comp.competitors?.find((c) => c.homeAway === 'away')?.team?.displayName || 'Away';
    const homeName = comp.competitors?.find((c) => c.homeAway === 'home')?.team?.displayName || 'Home';
    document.title = `${awayName} vs ${homeName} — Robi Report`;

    els.content.innerHTML = `
      ${renderHero(data, comp, cfg)}
      <div class="game-layout">
        <div class="game-main">${boxscoreHtml}</div>
        ${renderSidebar(data, comp, cfg)}
      </div>
    `;
  }

  async function init() {
    if (!gameId || !SPORT_CONFIG[sport]) {
      showError('Missing or invalid URL parameters. Use ?sport=nba&gameId=401705722');
      return;
    }

    const cfg = SPORT_CONFIG[sport];
    const url = buildSummaryUrl(cfg, gameId);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`ESPN API returned ${res.status}`);
      const data = await res.json();
      if (!data.header && !data.boxscore) throw new Error('No game data found for this event.');
      hideLoading();
      renderPage(data, cfg);

      const ticker = document.getElementById('score-ticker');
      if (ticker) {
        const tickerSportMap = {
          nba: 'nba',
          wnba: 'wnba',
          nfl: 'nfl',
          mlb: 'mlb',
          ufc: 'ufc',
          boxing: 'boxing',
          soccer: 'epl',
        };
        if (tickerSportMap[sport]) ticker.dataset.default = tickerSportMap[sport];
      }
    } catch (err) {
      console.warn('Game load failed:', err);
      showError(err.message || 'Failed to load game summary. Please try again.');
    }
  }

  init();
})();
