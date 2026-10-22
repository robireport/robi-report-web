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

  function mondayOfWeek(anchor) {
    const d = startOfLocalDay(anchor);
    const weekday = d.getDay();
    const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
    return addDays(d, diffToMonday);
  }

  /** Calendar days Mon–Sun used when scanning for scheduled games. */
  function weekCandidateDays(anchor) {
    const monday = mondayOfWeek(anchor);
    const days = [];
    for (let i = 0; i < DAY_COUNT; i += 1) {
      days.push(addDays(monday, i));
    }
    return days;
  }

  function weekKey(anchor) {
    return formatYmd(mondayOfWeek(anchor));
  }

  async function fetchScoreboardJson(url, ymd) {
    const res = await fetch(`${url}?dates=${ymd}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function eventCount(data) {
    return (data?.events || []).length;
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

  function getDisplayName(entity) {
    return entity?.displayName || entity?.name || entity?.abbreviation || '—';
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

  function getOddsLines(comp) {
    const odds = comp?.odds?.[0];
    if (!odds) return { spread: '', moneyline: '', total: '' };

    const spread =
      odds.details ||
      (odds.spread != null ? `Spread ${odds.spread > 0 ? '+' : ''}${odds.spread}` : '');

    let moneyline = '';
    const ml = odds.moneyline;
    if (ml?.away?.close?.odds && ml?.home?.close?.odds) {
      moneyline = `ML ${ml.away.close.odds} / ${ml.home.close.odds}`;
    }

    let total = '';
    if (odds.overUnder != null) total = `O/U ${odds.overUnder}`;
    else if (odds.total?.over?.close?.line) {
      total = `Total ${odds.total.over.close.line}`;
    }

    return { spread, moneyline, total };
  }

  function getPlayersToWatch(comp) {
    const snippets = [];
    const seen = new Set();

    (comp?.competitors || []).forEach((c) => {
      const rating =
        (c.leaders || []).find((g) => g.name === 'rating') ||
        (c.leaders || []).find((g) => /rating/i.test(g.name || ''));
      const leader = rating?.leaders?.[0] || (c.leaders || [])[0]?.leaders?.[0];
      if (!leader?.athlete) return;
      const id = leader.athlete.id || leader.athlete.fullName;
      if (seen.has(id)) return;
      seen.add(id);
      const abbr = getAbbr(c.team);
      const stat =
        leader.displayValue ||
        [leader.athlete.shortName, rating?.shortDisplayName].filter(Boolean).join(' ');
      snippets.push(`${abbr}: ${leader.athlete.shortName || leader.athlete.displayName} (${stat})`);
    });

    const headlines = (comp?.notes || [])
      .map((n) => n.headline || n.text)
      .filter(Boolean);
    if (headlines.length && snippets.length < 2) {
      return headlines.join(' · ');
    }
    if (!snippets.length && headlines.length) return headlines.join(' · ');
    return snippets.slice(0, 3).join(' · ');
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
    const odds = getOddsLines(comp);

    return {
      id: event.id,
      href: gameUrl(event, sport),
      status,
      isLive: state === 'in',
      broadcast: getBroadcast(comp),
      odds,
      watch: getPlayersToWatch(comp),
      away: {
        abbr: getAbbr(away.team),
        name: getDisplayName(away.team),
        score: away.score ?? '—',
        logo: getLogo(away.team),
        record: getRecord(away),
        winner: awayWins,
      },
      home: {
        abbr: getAbbr(home.team),
        name: getDisplayName(home.team),
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
    if (!days.length) {
      return '<p class="scoreboard-hub-date-empty">No scheduled games this week.</p>';
    }
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

  function snapSelectedToGameDays(selectedDate, gameDays) {
    if (!gameDays.length) return selectedDate;
    const targetYmd = formatYmd(selectedDate);
    if (gameDays.some((d) => formatYmd(d) === targetYmd)) return selectedDate;

    const targetTs = startOfLocalDay(selectedDate).getTime();
    let fallback = gameDays[0];
    for (let i = 0; i < gameDays.length; i += 1) {
      const day = gameDays[i];
      fallback = day;
      if (startOfLocalDay(day).getTime() >= targetTs) return day;
    }
    return fallback;
  }

  function renderCard(game) {
    const liveCls = game.isLive ? ' is-live' : '';
    const statusCls = game.status.cls ? ` ${game.status.cls}` : '';
    const awayWin = game.away.winner ? ' is-winner' : '';
    const homeWin = game.home.winner ? ' is-winner' : '';

    const oddsRows = [];
    if (game.odds.spread) oddsRows.push(`<span><strong>Spread</strong> ${escapeHtml(game.odds.spread)}</span>`);
    if (game.odds.moneyline) {
      oddsRows.push(`<span><strong>ML</strong> ${escapeHtml(game.odds.moneyline.replace(/^ML\s/, ''))}</span>`);
    }
    if (game.odds.total) {
      const totalVal = game.odds.total.replace(/^(Total|O\/U)\s/, '');
      oddsRows.push(`<span><strong>Total</strong> ${escapeHtml(totalVal)}</span>`);
    }
    const oddsHtml = oddsRows.length
      ? `<div class="scoreboard-hub-card-odds">${oddsRows.join('')}</div>`
      : '';

    const watchHtml = game.watch
      ? `<div class="scoreboard-hub-card-watch"><strong>Players to watch:</strong> ${escapeHtml(game.watch)}</div>`
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
          <div class="scoreboard-hub-team-full">${escapeHtml(game.away.name)}</div>
          ${game.away.record ? `<div class="scoreboard-hub-team-record">${escapeHtml(game.away.record)}</div>` : ''}
        </div>
        <span class="scoreboard-hub-team-score">${escapeHtml(String(game.away.score))}</span>
      </div>
      <div class="scoreboard-hub-team-row${homeWin}">
        ${game.home.logo ? `<img class="scoreboard-hub-team-logo" src="${escapeHtml(game.home.logo)}" alt="" loading="lazy" />` : '<span class="scoreboard-hub-team-logo"></span>'}
        <div class="scoreboard-hub-team-name">
          <div class="scoreboard-hub-team-abbr">${escapeHtml(game.home.abbr)}</div>
          <div class="scoreboard-hub-team-full">${escapeHtml(game.home.name)}</div>
          ${game.home.record ? `<div class="scoreboard-hub-team-record">${escapeHtml(game.home.record)}</div>` : ''}
        </div>
        <span class="scoreboard-hub-team-score">${escapeHtml(String(game.home.score))}</span>
      </div>
      ${oddsHtml}
      ${watchHtml}
    </a>`;
  }

  function initPage(page) {
    const leagueKey = (page.dataset.league || '').toLowerCase();
    const cfg = LEAGUES[leagueKey];
    if (!cfg) return;

    const chrome = page.querySelector('[data-scoreboard-chrome]');
    const grid = page.querySelector('[data-scoreboard-scores]');
    if (!chrome || !grid) return;

    let selectedDate = readDateFromUrl();
    let refreshTimer = null;
    let weekLabel = '';
    let stripWeekKey = '';
    let gameDays = [];
    const dayCache = new Map();

    chrome.innerHTML = `
      <div class="scoreboard-hub-date-nav" data-date-nav role="tablist" aria-label="Select date"></div>
      <div class="scoreboard-hub-meta-row">
        <div class="scoreboard-hub-meta-left">
          <span class="scoreboard-hub-week-label" data-week-label hidden></span>
          <span class="scoreboard-hub-status" data-status aria-live="polite"></span>
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
    `;

    const dateNav = chrome.querySelector('[data-date-nav]');
    const statusEl = chrome.querySelector('[data-status]');
    const weekEl = chrome.querySelector('[data-week-label]');

    async function refreshGameDayStrip(anchor) {
      const key = weekKey(anchor);
      if (key === stripWeekKey && gameDays.length) return;

      stripWeekKey = key;
      dayCache.clear();
      gameDays = [];

      const candidates = weekCandidateDays(anchor);
      const results = await Promise.all(
        candidates.map(async (day) => {
          const ymd = formatYmd(day);
          try {
            const data = await fetchScoreboardJson(cfg.url, ymd);
            if (eventCount(data) > 0) {
              dayCache.set(ymd, data);
              return day;
            }
          } catch (_) {
            /* ignore per-day failures */
          }
          return null;
        })
      );

      gameDays = results.filter(Boolean);
    }

    function renderDateNav() {
      const ymd = formatYmd(selectedDate);
      const html = renderDateButtons(gameDays, ymd);
      dateNav.innerHTML = html;
      dateNav.classList.toggle('is-empty', gameDays.length === 0);
    }

    function applyWeekLabel(data) {
      if (cfg.picker === 'week' && data?.week?.number) {
        weekLabel = `Week ${data.week.number}`;
        weekEl.textContent = weekLabel;
        weekEl.hidden = false;
      } else if (weekLabel) {
        weekEl.hidden = false;
      } else {
        weekEl.hidden = true;
      }
    }

    async function loadScoreboard(options = {}) {
      const { rescanStrip = false } = options;
      statusEl.textContent = rescanStrip ? 'Loading schedule…' : 'Loading scores…';
      statusEl.classList.remove('is-error');
      grid.innerHTML = '';

      try {
        if (rescanStrip || weekKey(selectedDate) !== stripWeekKey) {
          await refreshGameDayStrip(selectedDate);
        }

        selectedDate = snapSelectedToGameDays(selectedDate, gameDays);
        const ymd = formatYmd(selectedDate);
        writeDateToUrl(ymd);
        renderDateNav();

        if (!gameDays.length) {
          grid.innerHTML =
            '<div class="scoreboard-hub-empty">No games scheduled this week.</div>';
          statusEl.textContent = '';
          weekEl.hidden = true;
          return;
        }

        let data = dayCache.get(ymd);
        if (!data) {
          data = await fetchScoreboardJson(cfg.url, ymd);
          dayCache.set(ymd, data);
        }

        applyWeekLabel(data);

        const games = (data.events || [])
          .map((ev) => parseEvent(ev, cfg.sport))
          .filter(Boolean);

        if (!games.length) {
          grid.innerHTML =
            '<div class="scoreboard-hub-empty">No games scheduled for this date.</div>';
          statusEl.textContent = '';
          return;
        }

        grid.innerHTML = `<div class="scoreboard-hub-grid">${games.map(renderCard).join('')}</div>`;
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
        refreshTimer = setInterval(() => {
          dayCache.delete(formatYmd(selectedDate));
          loadScoreboard({ rescanStrip: weekKey(selectedDate) === weekKey(new Date()) });
        }, REFRESH_MS);
      }
    }

    dateNav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-date]');
      if (!btn) return;
      const parsed = parseYmd(btn.dataset.date);
      if (!parsed) return;
      selectedDate = startOfLocalDay(parsed);
      loadScoreboard({ rescanStrip: weekKey(selectedDate) !== stripWeekKey });
      scheduleRefresh();
    });

    page.addEventListener('click', (e) => {
      const shiftBtn = e.target.closest('[data-shift]');
      if (!shiftBtn) return;
      const delta = parseInt(shiftBtn.dataset.shift, 10);
      if (Number.isNaN(delta)) return;
      selectedDate = addDays(selectedDate, delta);
      stripWeekKey = '';
      loadScoreboard({ rescanStrip: true });
      scheduleRefresh();
    });

    loadScoreboard({ rescanStrip: true });
    scheduleRefresh();
  }

  document.querySelectorAll('[data-scoreboard-page]').forEach(initPage);

  // Legacy mount (single root)
  document.querySelectorAll('[data-scoreboard-hub]:not([data-scoreboard-page] *)').forEach((root) => {
    const wrap = document.createElement('div');
    wrap.className = 'scoreboard-page scoreboard-page--legacy';
    wrap.dataset.scoreboardPage = '';
    wrap.dataset.league = root.dataset.league || '';
    wrap.innerHTML = `
      <div class="scoreboard-page-chrome" data-scoreboard-chrome></div>
      <div class="scoreboard-page-layout">
        <div class="scoreboard-page-scores" data-scoreboard-scores></div>
      </div>`;
    root.replaceWith(wrap);
    initPage(wrap);
  });
})();
