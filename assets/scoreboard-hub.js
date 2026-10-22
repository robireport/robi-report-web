(function () {
  'use strict';

  const LEAGUES = {
    nba: {
      label: 'NBA',
      sport: 'nba',
      url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      picker: 'days',
    },
    wnba: {
      label: 'WNBA',
      sport: 'wnba',
      url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard',
      picker: 'days',
    },
    nfl: {
      label: 'NFL',
      sport: 'nfl',
      url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      picker: 'week',
    },
  };

  const REFRESH_MS = 60000;
  const DAY_COUNT = 7;

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatYmd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  function parseYmd(ymd) {
    if (!/^\d{8}$/.test(ymd)) return null;
    const y = parseInt(ymd.slice(0, 4), 10);
    const m = parseInt(ymd.slice(4, 6), 10) - 1;
    const d = parseInt(ymd.slice(6, 8), 10);
    const date = new Date(y, m, d);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfLocalDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function buildDayStrip(center) {
    const start = addDays(center, -3);
    const days = [];
    for (let i = 0; i < DAY_COUNT; i += 1) {
      days.push(addDays(start, i));
    }
    return days;
  }

  function formatTimeET(isoDate) {
    try {
      return new Date(isoDate).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
      });
    } catch (_) {
      return '';
    }
  }

  function getLogo(team) {
    if (!team) return '';
    return team.logo || team.logos?.[0]?.href || '';
  }

  function getAbbr(entity) {
    return (
      entity?.abbreviation ||
      entity?.shortDisplayName ||
      entity?.displayName?.split(' ').pop() ||
      '—'
    );
  }

  function getRecord(competitor) {
    const records = competitor?.records || [];
    const total =
      records.find((r) => r.type === 'total' || r.name === 'overall') || records[0];
    return total?.summary || '';
  }

  function getBroadcast(comp) {
    const names = comp?.broadcasts?.[0]?.names;
    if (names?.length) return names[0];
    const media = comp?.geoBroadcasts?.[0]?.media?.shortName;
    return media || comp?.broadcast || '';
  }

  function getStatusText(event, comp) {
    const status = comp?.status?.type || event?.status?.type || {};
    const state = status.state;
    const detail = status.detail || status.description || '';
    const clock = comp?.status?.displayClock || '';

    if (/postponed/i.test(status.name || '') || /postponed/i.test(detail)) {
      return { text: 'Postponed', cls: 'is-scheduled' };
    }
    if (/cancel/i.test(status.name || '') || /cancel/i.test(detail)) {
      return { text: 'Canceled', cls: 'is-scheduled' };
    }
    if (state === 'post' || status.completed) {
      return { text: 'Final', cls: 'is-final' };
    }
    if (state === 'in') {
      const live = [clock, detail].filter(Boolean).join(' · ');
      return { text: live || 'Live', cls: 'is-live' };
    }
    const time = formatTimeET(event.date || comp?.date);
    return { text: time || 'Scheduled', cls: 'is-scheduled' };
  }

  function getOddsLine(comp) {
    const odds = comp?.odds?.[0];
    if (!odds) return '';
    const parts = [];
    if (odds.details) parts.push(odds.details);
    else if (odds.spread != null) {
      parts.push(`Spread ${odds.spread > 0 ? '+' : ''}${odds.spread}`);
    }
    if (odds.overUnder != null) parts.push(`O/U ${odds.overUnder}`);
    return parts.join(' · ');
  }

  function getNotesText(comp, event) {
    const headlines = (comp?.notes || [])
      .map((n) => n.headline || n.text)
      .filter(Boolean);
    if (headlines.length) return headlines.join(' · ');
    if (event?.shortName && event.shortName !== event.name) return event.shortName;
    return '';
  }

  function getPathPrefix() {
    return /\/articles\//.test(window.location.pathname) ? '../../' : '';
  }

  function gameUrl(event, sport) {
    const id = event?.id;
    if (!id || !sport) return '';
    const q = new URLSearchParams({ gameId: String(id), sport });
    return `${getPathPrefix()}game.html?${q.toString()}`;
  }

  function parseEvent(event, sport) {
    const comp = event?.competitions?.[0];
    if (!comp) return null;

    const competitors = [...(comp.competitors || [])].sort(
      (a, b) => (a.homeAway === 'home' ? 1 : 0) - (b.homeAway === 'home' ? 1 : 0)
    );
    if (competitors.length < 2) return null;

    const away = competitors.find((c) => c.homeAway === 'away') || competitors[0];
    const home = competitors.find((c) => c.homeAway === 'home') || competitors[1];
    const status = getStatusText(event, comp);
    const state = comp.status?.type?.state || event.status?.type?.state;
    const isFinal = state === 'post' || comp.status?.type?.completed;
    const awayScore = parseInt(away.score, 10);
    const homeScore = parseInt(home.score, 10);
    const awayWins = isFinal && !Number.isNaN(awayScore) && !Number.isNaN(homeScore) && awayScore > homeScore;
    const homeWins = isFinal && !Number.isNaN(awayScore) && !Number.isNaN(homeScore) && homeScore > awayScore;

    return {
      id: event.id,
      href: gameUrl(event, sport),
      status,
      isLive: state === 'in',
      broadcast: getBroadcast(comp),
      odds: getOddsLine(comp),
      notes: getNotesText(comp, event),
      away: {
        abbr: getAbbr(away.team),
        score: away.score ?? '—',
        logo: getLogo(away.team),
        record: getRecord(away),
        winner: awayWins,
      },
      home: {
        abbr: getAbbr(home.team),
        score: home.score ?? '—',
        logo: getLogo(home.team),
        record: getRecord(home),
        winner: homeWins,
      },
    };
  }

  function readDateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('date');
    if (q) {
      const parsed = parseYmd(q.replace(/-/g, ''));
      if (parsed) return startOfLocalDay(parsed);
    }
    return startOfLocalDay(new Date());
  }

  function writeDateToUrl(ymd) {
    const url = new URL(window.location.href);
    url.searchParams.set('date', ymd);
    window.history.replaceState({}, '', url.toString());
  }

  function renderDateButtons(days, selectedYmd) {
    return days
      .map((day) => {
        const ymd = formatYmd(day);
        const active = ymd === selectedYmd ? ' is-active' : '';
        const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = day.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        return `<button type="button" class="scoreboard-hub-date-btn${active}" data-date="${ymd}" aria-pressed="${ymd === selectedYmd}">
          <span class="day-name">${escapeHtml(dayName)}</span>
          <span class="day-num">${escapeHtml(dayNum)}</span>
        </button>`;
      })
      .join('');
  }

  function renderCard(game) {
    const liveCls = game.isLive ? ' is-live' : '';
    const statusCls = game.status.cls ? ` ${game.status.cls}` : '';
    const awayWin = game.away.winner ? ' is-winner' : '';
    const homeWin = game.home.winner ? ' is-winner' : '';
    const footParts = [];
    if (game.odds) footParts.push(`<strong>Line:</strong> ${escapeHtml(game.odds)}`);
    if (game.notes) footParts.push(escapeHtml(game.notes));
    const footHtml = footParts.length
      ? `<div class="scoreboard-hub-card-foot">${footParts.join('<br />')}</div>`
      : '';

    return `<a class="scoreboard-hub-card${liveCls}" href="${escapeHtml(game.href)}">
      <div class="scoreboard-hub-card-head">
        <span class="scoreboard-hub-card-status${statusCls}">${escapeHtml(game.status.text)}</span>
        <span class="scoreboard-hub-card-network">${escapeHtml(game.broadcast)}</span>
      </div>
      <div class="scoreboard-hub-team-row${awayWin}">
        ${game.away.logo ? `<img class="scoreboard-hub-team-logo" src="${escapeHtml(game.away.logo)}" alt="" loading="lazy" />` : '<span class="scoreboard-hub-team-logo"></span>'}
        <div class="scoreboard-hub-team-name">
          <div class="scoreboard-hub-team-abbr">${escapeHtml(game.away.abbr)}</div>
          ${game.away.record ? `<div class="scoreboard-hub-team-record">${escapeHtml(game.away.record)}</div>` : ''}
        </div>
        <span class="scoreboard-hub-team-score">${escapeHtml(String(game.away.score))}</span>
      </div>
      <div class="scoreboard-hub-team-row${homeWin}">
        ${game.home.logo ? `<img class="scoreboard-hub-team-logo" src="${escapeHtml(game.home.logo)}" alt="" loading="lazy" />` : '<span class="scoreboard-hub-team-logo"></span>'}
        <div class="scoreboard-hub-team-name">
          <div class="scoreboard-hub-team-abbr">${escapeHtml(game.home.abbr)}</div>
          ${game.home.record ? `<div class="scoreboard-hub-team-record">${escapeHtml(game.home.record)}</div>` : ''}
        </div>
        <span class="scoreboard-hub-team-score">${escapeHtml(String(game.home.score))}</span>
      </div>
      ${footHtml}
    </a>`;
  }

  function initHub(root) {
    const leagueKey = (root.dataset.league || '').toLowerCase();
    const cfg = LEAGUES[leagueKey];
    if (!cfg) return;

    let selectedDate = readDateFromUrl();
    let refreshTimer = null;
    let weekLabel = '';

    root.innerHTML = `
      <div class="scoreboard-hub-toolbar">
        <div>
          <h2 class="scoreboard-hub-title">${escapeHtml(cfg.label)} Scoreboard</h2>
          <div class="scoreboard-hub-week-label" data-week-label hidden></div>
        </div>
        ${
          cfg.picker === 'week'
            ? `<div class="scoreboard-hub-nfl-week-shift">
          <button type="button" data-shift="-7" aria-label="Previous week">← Week</button>
          <button type="button" data-shift="7" aria-label="Next week">Week →</button>
        </div>`
            : ''
        }
      </div>
      <div class="scoreboard-hub-date-nav" data-date-nav role="tablist" aria-label="Select date"></div>
      <div class="scoreboard-hub-status" data-status aria-live="polite"></div>
      <div class="scoreboard-hub-grid" data-grid></div>
    `;

    const dateNav = root.querySelector('[data-date-nav]');
    const grid = root.querySelector('[data-grid]');
    const statusEl = root.querySelector('[data-status]');
    const weekEl = root.querySelector('[data-week-label]');

    function renderDateNav() {
      const ymd = formatYmd(selectedDate);
      dateNav.innerHTML = renderDateButtons(buildDayStrip(selectedDate), ymd);
    }

    async function loadScoreboard() {
      const ymd = formatYmd(selectedDate);
      writeDateToUrl(ymd);
      renderDateNav();
      statusEl.textContent = 'Loading scores…';
      statusEl.classList.remove('is-error');
      grid.innerHTML = '';

      try {
        const res = await fetch(`${cfg.url}?dates=${ymd}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (cfg.picker === 'week' && data.week?.number) {
          weekLabel = `Week ${data.week.number}`;
          weekEl.textContent = weekLabel;
          weekEl.hidden = false;
        } else if (weekLabel) {
          weekEl.hidden = false;
        } else {
          weekEl.hidden = true;
        }

        const games = (data.events || [])
          .map((ev) => parseEvent(ev, cfg.sport))
          .filter(Boolean);

        if (!games.length) {
          grid.innerHTML =
            '<div class="scoreboard-hub-empty">No games scheduled for this date.</div>';
          statusEl.textContent = '';
          return;
        }

        grid.innerHTML = games.map(renderCard).join('');
        statusEl.textContent = `${games.length} game${games.length === 1 ? '' : 's'}`;
      } catch (err) {
        console.warn('Scoreboard hub fetch failed:', err);
        statusEl.textContent = 'Could not load scoreboard. Try again in a moment.';
        statusEl.classList.add('is-error');
        grid.innerHTML =
          '<div class="scoreboard-hub-empty">Scoreboard unavailable right now.</div>';
      }
    }

    function scheduleRefresh() {
      if (refreshTimer) clearInterval(refreshTimer);
      const isToday = formatYmd(selectedDate) === formatYmd(new Date());
      if (isToday) {
        refreshTimer = setInterval(loadScoreboard, REFRESH_MS);
      }
    }

    dateNav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-date]');
      if (!btn) return;
      const parsed = parseYmd(btn.dataset.date);
      if (!parsed) return;
      selectedDate = startOfLocalDay(parsed);
      loadScoreboard();
      scheduleRefresh();
    });

    root.addEventListener('click', (e) => {
      const shiftBtn = e.target.closest('[data-shift]');
      if (!shiftBtn) return;
      const delta = parseInt(shiftBtn.dataset.shift, 10);
      if (Number.isNaN(delta)) return;
      selectedDate = addDays(selectedDate, delta);
      loadScoreboard();
      scheduleRefresh();
    });

    renderDateNav();
    loadScoreboard();
    scheduleRefresh();
  }

  document.querySelectorAll('[data-scoreboard-hub]').forEach(initHub);
})();
