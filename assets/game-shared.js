(function (global) {
  'use strict';

  const SPORT_CONFIG = {
    nba: { category: 'basketball', league: 'nba', hub: 'nba.html', label: 'NBA' },
    wnba: { category: 'basketball', league: 'wnba', hub: 'wnba.html', label: 'WNBA' },
    nfl: { category: 'football', league: 'nfl', hub: 'nfl.html', label: 'NFL' },
    mlb: { category: 'baseball', league: 'mlb', hub: 'mlb.html', label: 'MLB' },
    ufc: { category: 'mma', league: 'ufc', hub: 'ufc.html', label: 'UFC', combat: true },
    boxing: { category: 'boxing', league: 'boxing', hub: 'boxing.html', label: 'Boxing', combat: true },
    soccer: { category: 'soccer', league: 'eng.1', hub: 'soccer.html', label: 'Premier League' },
  };

  const COMBAT_SPORTS = new Set(['ufc', 'boxing']);

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

  function getCompetition(data) {
    const header = data.header || {};
    return header.competitions?.[0] || data.boxscore?.teams?.[0]?.competition || {};
  }

  function getGameStatus(comp) {
    const status = comp?.status || {};
    const statusType = status.type || {};
    const state = statusType.state || '';
    const detail = String(statusType.shortDetail || statusType.detail || '').toUpperCase();
    const isFinal =
      statusType.completed === true ||
      state === 'post' ||
      detail === 'FT' ||
      detail.includes('FULL TIME') ||
      detail.includes('FINAL');
    const isLive = state === 'in';
    const isScheduled = state === 'pre' || state === 'scheduled' || (!isFinal && !isLive && state !== 'post');
    return { status, statusType, state, detail, isFinal, isLive, isScheduled };
  }

  function hasGameSummaryData(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.header || data.boxscore) return true;
    if (Array.isArray(data.rosters) && data.rosters.length) return true;
    return false;
  }

  function extractSoccerRosters(data) {
    if (Array.isArray(data?.rosters) && data.rosters.length) {
      return data.rosters;
    }
    if (Array.isArray(data?.boxscore?.rosters) && data.boxscore.rosters.length) {
      return data.boxscore.rosters;
    }
    return [];
  }

  function buildSummaryUrl(cfg, id) {
    return `https://site.api.espn.com/apis/site/v2/sports/${cfg.category}/${cfg.league}/summary?event=${id}`;
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

    const awayLines = (away.linescores || [])
      .map(
        (ls, i) =>
          `<span class="game-linescore-pill">Q${i + 1}: ${escapeHtml(ls.displayValue ?? ls.value ?? '')}</span>`
      )
      .join('');

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

  function renderInfoSidebar(data, comp, cfg) {
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
    `;
  }

  function mountShell(ctx) {
    const { data, cfg, comp, sport, gameId } = ctx;
    const { away, home } = getCompetitors(comp);
    const awayName = away?.team?.displayName || 'Away';
    const homeName = home?.team?.displayName || 'Home';
    document.title = `${awayName} vs ${homeName} — Robi Report`;

    const heroEl = document.getElementById('game-hero');
    const tabsEl = document.getElementById('game-tabs');
    const infoSidebarEl = document.getElementById('game-info-sidebar');

    if (heroEl) heroEl.innerHTML = renderHero(data, comp, cfg);
    if (tabsEl && global.GameNav) tabsEl.innerHTML = global.GameNav.renderTabs(ctx.activeTab, sport, gameId);
    if (infoSidebarEl) infoSidebarEl.innerHTML = renderInfoSidebar(data, comp, cfg);
  }

  function initGamePage(activeTab, renderMain) {
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

    async function run() {
      if (!SPORT_CONFIG[sport]) {
        showError('Missing or invalid URL parameters. Use ?sport=nba&gameId=401705722');
        return;
      }
      if (!gameId && !COMBAT_SPORTS.has(sport)) {
        showError('Missing or invalid URL parameters. Use ?sport=nba&gameId=401705722');
        return;
      }

      const cfg = SPORT_CONFIG[sport];

      try {
        if (COMBAT_SPORTS.has(sport)) {
          hideLoading();
          const tabsEl = document.getElementById('game-tabs');
          if (tabsEl && global.GameNav) {
            tabsEl.innerHTML = global.GameNav.renderTabs(activeTab, sport, gameId);
          }
          const infoSidebarEl = document.getElementById('game-info-sidebar');
          if (infoSidebarEl) infoSidebarEl.innerHTML = '';

          if (global.GameCombat) {
            await global.GameCombat.renderCombatPage({
              data: null,
              cfg,
              comp: {},
              sport,
              gameId,
              els,
              activeTab,
            });
          } else {
            showError('Check back soon for upcoming cards.');
          }

          if (global.PlayerLinks) global.PlayerLinks.init(els.content);

          const ticker = document.getElementById('score-ticker');
          if (ticker) {
            const tickerSportMap = {
              ufc: 'ufc',
              boxing: 'boxing',
            };
            if (tickerSportMap[sport]) ticker.dataset.default = tickerSportMap[sport];
          }
          return;
        }

        const res = await fetch(buildSummaryUrl(cfg, gameId));
        if (!res.ok) throw new Error(`ESPN API returned ${res.status}`);
        const data = await res.json();
        if (!hasGameSummaryData(data)) throw new Error('No game data found for this event.');

        const comp = getCompetition(data);
        hideLoading();
        mountShell({ data, cfg, comp, sport, gameId, activeTab });

        const ctx = { data, cfg, comp, sport, gameId, els, activeTab };
        if (
          sport === 'soccer' &&
          activeTab === 'boxscore' &&
          global.GameSoccer?.renderMain
        ) {
          global.GameSoccer.renderMain(ctx);
        } else {
          renderMain(ctx);
        }

        if (global.PlayerLinks) global.PlayerLinks.init(els.content);

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

    run();
  }

  global.GameShared = {
    SPORT_CONFIG,
    COMBAT_SPORTS,
    escapeHtml,
    formatGameTime,
    getCompetitors,
    getCompetition,
    getGameStatus,
    hasGameSummaryData,
    extractSoccerRosters,
    renderHero,
    renderInfoSidebar,
    initGamePage,
  };
})(window);
