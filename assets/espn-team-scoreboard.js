(function (global) {
  'use strict';

  const WEEK_DAYS = 7;
  const REFRESH_MS = 60000;

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
    const cleaned = String(ymd || '').replace(/-/g, '');
    if (!/^\d{8}$/.test(cleaned)) return null;
    const y = parseInt(cleaned.slice(0, 4), 10);
    const m = parseInt(cleaned.slice(4, 6), 10) - 1;
    const d = parseInt(cleaned.slice(6, 8), 10);
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
    const diff = weekday === 0 ? -6 : 1 - weekday;
    return addDays(d, diff);
  }

  function weekCandidateDays(weekMonday) {
    const days = [];
    for (let i = 0; i < WEEK_DAYS; i += 1) {
      days.push(addDays(weekMonday, i));
    }
    return days;
  }

  function formatDisplayDate(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
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

  function getDisplayName(entity) {
    return entity?.displayName || entity?.name || entity?.abbreviation || '—';
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
    return media || '';
  }

  function getCompetitionLabel(comp, event) {
    return (
      comp?.series?.summary ||
      event?.name ||
      comp?.notes?.[0]?.headline ||
      ''
    );
  }

  function getStatus(event, comp) {
    const status = comp?.status?.type || event?.status?.type || {};
    const state = status.state;
    const detail = status.detail || status.description || '';
    const clock = comp?.status?.displayClock || event?.status?.displayClock || '';

    if (status.name === 'STATUS_POSTPONED' || /postponed/i.test(detail)) {
      return { text: 'Postponed', live: false, final: false, scheduled: true };
    }
    if (status.name === 'STATUS_CANCELED' || /cancel/i.test(detail)) {
      return { text: 'Canceled', live: false, final: false, scheduled: true };
    }
    if (state === 'post' || status.completed) {
      return { text: 'Final', live: false, final: true, scheduled: false };
    }
    if (state === 'in') {
      const liveText = [clock, detail].filter(Boolean).join(' · ');
      return {
        text: liveText || 'Live',
        live: true,
        final: false,
        scheduled: false,
      };
    }
    const time = formatTimeET(event.date || comp?.date);
    return {
      text: time || 'Scheduled',
      live: false,
      final: false,
      scheduled: true,
    };
  }

  function formatScore(value, scheduled) {
    if (value === undefined || value === null || value === '') {
      return scheduled ? '—' : '0';
    }
    return String(value);
  }

  function getOddsLines(comp) {
    const odds = comp?.odds?.[0];
    if (!odds) return [];

    const lines = [];
    if (odds.details) lines.push({ label: 'Line', value: odds.details });
    const ml = odds.moneyline;
    if (ml?.away?.close?.odds && ml?.home?.close?.odds) {
      lines.push({
        label: 'Moneyline',
        value: `${ml.away.close.odds} / ${ml.home.close.odds}`,
      });
    }
    if (odds.overUnder != null) {
      lines.push({ label: 'Total', value: String(odds.overUnder) });
    } else if (odds.total?.over?.close?.line) {
      lines.push({ label: 'Total', value: odds.total.over.close.line });
    }
    return lines;
  }

  function getLeaderLines(comp) {
    const parts = [];
    const seen = new Set();

    (comp?.competitors || []).forEach((c) => {
      const groups = c.leaders || [];
      const rating = groups.find((g) => g.name === 'rating') || groups[0];
      const leader = rating?.leaders?.[0];
      if (!leader?.athlete) return;
      const key = leader.athlete.id || leader.athlete.fullName;
      if (seen.has(key)) return;
      seen.add(key);
      const abbr = getAbbr(c.team);
      const name = leader.athlete.shortName || leader.athlete.displayName;
      const stat = leader.displayValue || rating?.shortDisplayName || '';
      if (name && stat) parts.push(`${abbr}: ${name} (${stat})`);
    });

    return parts.slice(0, 4);
  }

  function gameUrl(eventId, sport) {
    if (!eventId) return '';
    const q = new URLSearchParams({ gameId: String(eventId), sport });
    return `game.html?${q.toString()}`;
  }

  function parseGame(event, sport) {
    const comp = event?.competitions?.[0];
    if (!comp) return null;

    const competitors = [...(comp.competitors || [])].sort(
      (a, b) => (a.homeAway === 'home' ? 1 : 0) - (b.homeAway === 'home' ? 1 : 0)
    );
    if (competitors.length < 2) return null;

    const away = competitors.find((c) => c.homeAway === 'away') || competitors[0];
    const home = competitors.find((c) => c.homeAway === 'home') || competitors[1];
    const status = getStatus(event, comp);
    const awayScore = parseInt(away.score, 10);
    const homeScore = parseInt(home.score, 10);
    const awayWins =
      status.final &&
      !Number.isNaN(awayScore) &&
      !Number.isNaN(homeScore) &&
      awayScore > homeScore;
    const homeWins =
      status.final &&
      !Number.isNaN(awayScore) &&
      !Number.isNaN(homeScore) &&
      homeScore > awayScore;

    return {
      id: event.id,
      href: gameUrl(event.id, sport),
      competitionLabel: getCompetitionLabel(comp, event),
      status,
      broadcast: getBroadcast(comp),
      odds: getOddsLines(comp),
      leaders: getLeaderLines(comp),
      away: {
        abbr: getAbbr(away.team),
        name: getDisplayName(away.team),
        score: formatScore(away.score, status.scheduled),
        logo: getLogo(away.team),
        record: getRecord(away),
        winner: awayWins,
      },
      home: {
        abbr: getAbbr(home.team),
        name: getDisplayName(home.team),
        score: formatScore(home.score, status.scheduled),
        logo: getLogo(home.team),
        record: getRecord(home),
        winner: homeWins,
      },
    };
  }

  function readDateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('date');
    if (!raw) return { date: startOfLocalDay(new Date()), fromUrl: false };
    const parsed = parseYmd(raw);
    if (!parsed) return { date: startOfLocalDay(new Date()), fromUrl: false, invalidUrl: true };
    return { date: startOfLocalDay(parsed), fromUrl: true, raw };
  }

  function writeDateToUrl(ymd) {
    const url = new URL(window.location.href);
    url.searchParams.set('date', ymd);
    window.history.replaceState({}, '', url.toString());
  }

  function renderDateButtons(gameDays, selectedYmd) {
    if (!gameDays.length) {
      return '<p class="nba-scoreboard-empty">No scheduled games this week. Try another week.</p>';
    }
    return gameDays
      .map((day) => {
        const ymd = formatYmd(day);
        const active = ymd === selectedYmd ? ' is-active' : '';
        const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = day.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        return `<button type="button" class="nba-scoreboard-date-btn${active}" data-date="${ymd}" aria-pressed="${ymd === selectedYmd}">
          <span class="day-name">${escapeHtml(dayName)}</span>
          <span class="day-num">${escapeHtml(dayNum)}</span>
        </button>`;
      })
      .join('');
  }

  function renderCard(game, showCompetition) {
    const liveCls = game.status.live ? ' is-live' : '';
    const statusCls = game.status.live
      ? ' is-live'
      : game.status.final
        ? ' is-final'
        : '';
    const awayWin = game.away.winner ? ' is-winner' : '';
    const homeWin = game.home.winner ? ' is-winner' : '';

    const metaParts = [];
    if (game.odds.length) {
      metaParts.push(
        `<div><strong>Odds:</strong> ${game.odds
          .map((o) => `${escapeHtml(o.label)} ${escapeHtml(o.value)}`)
          .join(' · ')}</div>`
      );
    }
    if (game.leaders.length) {
      metaParts.push(
        `<div><strong>Leaders:</strong> ${escapeHtml(game.leaders.join(' · '))}</div>`
      );
    }
    const metaHtml = metaParts.length
      ? `<div class="nba-scoreboard-card-meta">${metaParts.join('')}</div>`
      : '';

    const href = game.href ? ` href="${escapeHtml(game.href)}"` : '';
    const tag = game.href ? 'a' : 'div';
    const compHtml =
      showCompetition && game.competitionLabel
        ? `<div class="nba-scoreboard-card-competition">${escapeHtml(game.competitionLabel)}</div>`
        : '';

    return `<${tag} class="nba-scoreboard-card${liveCls}"${href}>
      <div class="nba-scoreboard-card-head">
        <span class="nba-scoreboard-card-status${statusCls}">${escapeHtml(game.status.text)}</span>
        <span class="nba-scoreboard-card-network">${escapeHtml(game.broadcast)}</span>
      </div>
      ${compHtml}
      <div class="nba-scoreboard-team-row${awayWin}">
        ${game.away.logo ? `<img class="nba-scoreboard-team-logo" src="${escapeHtml(game.away.logo)}" alt="" loading="lazy" />` : '<span class="nba-scoreboard-team-logo" aria-hidden="true"></span>'}
        <div>
          <div class="nba-scoreboard-team-abbr">${escapeHtml(game.away.abbr)}</div>
          <div class="nba-scoreboard-team-name">${escapeHtml(game.away.name)}</div>
          ${game.away.record ? `<div class="nba-scoreboard-team-record">${escapeHtml(game.away.record)}</div>` : ''}
        </div>
        <span class="nba-scoreboard-team-score">${escapeHtml(game.away.score)}</span>
      </div>
      <div class="nba-scoreboard-team-row${homeWin}">
        ${game.home.logo ? `<img class="nba-scoreboard-team-logo" src="${escapeHtml(game.home.logo)}" alt="" loading="lazy" />` : '<span class="nba-scoreboard-team-logo" aria-hidden="true"></span>'}
        <div>
          <div class="nba-scoreboard-team-abbr">${escapeHtml(game.home.abbr)}</div>
          <div class="nba-scoreboard-team-name">${escapeHtml(game.home.name)}</div>
          ${game.home.record ? `<div class="nba-scoreboard-team-record">${escapeHtml(game.home.record)}</div>` : ''}
        </div>
        <span class="nba-scoreboard-team-score">${escapeHtml(game.home.score)}</span>
      </div>
      ${metaHtml}
    </${tag}>`;
  }

  function renderAttribution() {
    return `<p class="nba-scoreboard-attribution">Scores and schedules from ESPN public APIs. Data may be delayed or incomplete.</p>`;
  }

  function init(root, config) {
    const apiUrl = config.apiUrl;
    const sport = config.sport;
    const leagueName = config.leagueName || 'League';
    const showCompetition = Boolean(config.showCompetition);

    if (!apiUrl || !sport) return;

    const urlState = readDateFromUrl();
    let weekMonday = mondayOfWeek(urlState.date);
    let selectedDate = urlState.date;
    let gameDays = [];
    let dayCache = new Map();
    let scanFailures = 0;
    let refreshTimer = null;

    root.innerHTML = `
      <div class="nba-scoreboard-toolbar">
        <div class="nba-scoreboard-week-nav">
          <button type="button" data-week="-1" aria-label="Previous week">← Previous week</button>
          <button type="button" data-week="1" aria-label="Next week">Next week →</button>
        </div>
      </div>
      <div class="nba-scoreboard-date-nav" data-date-nav role="tablist" aria-label="Dates with ${escapeHtml(leagueName)} games"></div>
      <div data-notice hidden></div>
      <div class="nba-scoreboard-status" data-status aria-live="polite"></div>
      <div class="nba-scoreboard-grid" data-grid role="list"></div>
      ${renderAttribution()}
    `;

    const dateNav = root.querySelector('[data-date-nav]');
    const noticeEl = root.querySelector('[data-notice]');
    const statusEl = root.querySelector('[data-status]');
    const gridEl = root.querySelector('[data-grid]');

    async function fetchDay(ymd) {
      const res = await fetch(`${apiUrl}?dates=${ymd}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }

    async function scanWeek() {
      dayCache.clear();
      gameDays = [];
      scanFailures = 0;

      const candidates = weekCandidateDays(weekMonday);
      const results = await Promise.all(
        candidates.map(async (day) => {
          const ymd = formatYmd(day);
          try {
            const data = await fetchDay(ymd);
            const count = (data?.events || []).length;
            if (count > 0) {
              dayCache.set(ymd, data);
              return day;
            }
          } catch (_) {
            scanFailures += 1;
          }
          return null;
        })
      );

      gameDays = results.filter(Boolean);
    }

    function showNotice(message, info) {
      noticeEl.hidden = false;
      noticeEl.className = info ? 'nba-scoreboard-notice is-info' : 'nba-scoreboard-notice';
      noticeEl.textContent = message;
    }

    function hideNotice() {
      noticeEl.hidden = true;
      noticeEl.textContent = '';
    }

    function renderDateNav() {
      const ymd = formatYmd(selectedDate);
      dateNav.innerHTML = renderDateButtons(gameDays, ymd);
      dateNav.classList.toggle('is-empty', gameDays.length === 0);
    }

    function buildNotices() {
      const selectedYmd = formatYmd(selectedDate);
      const parts = [];

      if (urlState.invalidUrl) {
        parts.push(
          'The date in the URL was invalid. Showing the scoreboard week that contains today instead.'
        );
      }

      if (scanFailures > 0) {
        parts.push(
          `Some days this week could not be loaded (${scanFailures} of ${WEEK_DAYS}). Available game days may be incomplete.`
        );
      }

      const onGameDay = gameDays.some((d) => formatYmd(d) === selectedYmd);
      if (gameDays.length && !onGameDay) {
        parts.push(
          `No ${leagueName} games on ${formatDisplayDate(selectedDate)}. Select a highlighted date above, or use Previous / Next week.`
        );
      }

      if (!gameDays.length) {
        parts.push(
          `No scheduled ${leagueName} games found this week. Use Previous week or Next week to browse other dates.`
        );
      }

      if (parts.length) {
        showNotice(parts.join(' '), urlState.invalidUrl && parts.length === 1);
      } else {
        hideNotice();
      }
    }

    async function renderGames() {
      const ymd = formatYmd(selectedDate);
      writeDateToUrl(ymd);
      renderDateNav();
      buildNotices();

      const onGameDay = gameDays.some((d) => formatYmd(d) === ymd);
      if (!onGameDay) {
        gridEl.innerHTML =
          '<div class="nba-scoreboard-empty" role="status">No games to display for the selected date.</div>';
        statusEl.textContent = '';
        return;
      }

      statusEl.textContent = 'Loading games…';
      statusEl.classList.remove('is-error');
      gridEl.innerHTML = '';

      try {
        let data = dayCache.get(ymd);
        if (!data) {
          data = await fetchDay(ymd);
          dayCache.set(ymd, data);
        }

        const games = (data.events || []).map((ev) => parseGame(ev, sport)).filter(Boolean);
        if (!games.length) {
          gridEl.innerHTML =
            '<div class="nba-scoreboard-empty" role="status">No games scheduled for this date.</div>';
          statusEl.textContent = '';
          return;
        }

        gridEl.innerHTML = games.map((g) => renderCard(g, showCompetition)).join('');
        statusEl.textContent = `${games.length} game${games.length === 1 ? '' : 's'}`;
      } catch (err) {
        console.warn(`${leagueName} scoreboard load failed:`, err);
        statusEl.textContent = 'Could not load scoreboard. Please try again.';
        statusEl.classList.add('is-error');
        gridEl.innerHTML =
          '<div class="nba-scoreboard-empty" role="alert">Scoreboard unavailable right now.</div>';
      }
    }

    async function loadAll() {
      statusEl.textContent = 'Loading schedule…';
      statusEl.classList.remove('is-error');
      await scanWeek();
      await renderGames();
      scheduleRefresh();
    }

    function scheduleRefresh() {
      if (refreshTimer) clearInterval(refreshTimer);
      const isToday = formatYmd(selectedDate) === formatYmd(new Date());
      if (isToday) {
        refreshTimer = setInterval(async () => {
          dayCache.delete(formatYmd(selectedDate));
          await scanWeek();
          await renderGames();
        }, REFRESH_MS);
      }
    }

    dateNav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-date]');
      if (!btn) return;
      const parsed = parseYmd(btn.dataset.date);
      if (!parsed) return;
      selectedDate = startOfLocalDay(parsed);
      urlState.fromUrl = false;
      urlState.invalidUrl = false;
      renderGames();
      scheduleRefresh();
    });

    root.addEventListener('click', (e) => {
      const weekBtn = e.target.closest('[data-week]');
      if (!weekBtn) return;
      const delta = parseInt(weekBtn.dataset.week, 10);
      if (Number.isNaN(delta)) return;
      weekMonday = addDays(weekMonday, delta * 7);
      selectedDate = weekMonday;
      urlState.fromUrl = false;
      urlState.invalidUrl = false;
      loadAll();
    });

    loadAll();
  }

  global.EspnTeamScoreboard = { init };
})(window);
