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

  function formatEventDate(iso) {
    try {
      return new Date(iso).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
        timeZoneName: 'short',
      });
    } catch (_) {
      return '';
    }
  }

  function getStatus(event) {
    const status = event?.status?.type || {};
    const state = status.state;
    const detail = status.detail || status.description || '';

    if (state === 'post' || status.completed) {
      return { text: 'Final', live: false, final: true };
    }
    if (state === 'in') {
      return { text: detail || 'Live', live: true, final: false };
    }
    return { text: 'Scheduled', live: false, final: false };
  }

  function fighterName(competitor) {
    const a = competitor?.athlete || competitor?.team || {};
    return a.displayName || a.fullName || competitor?.displayName || 'TBD';
  }

  function fightStatus(comp) {
    const status = comp?.status?.type || {};
    if (status.completed || status.state === 'post') {
      const winner = (comp.competitors || []).find((c) => c.winner);
      if (winner) {
        return `Final · ${fighterName(winner)} wins`;
      }
      return 'Final';
    }
    if (status.state === 'in') {
      return status.detail || 'Live';
    }
    const wc = comp.type?.abbreviation || comp.type?.text || '';
    return wc || 'Scheduled';
  }

  function gameUrl(eventId, sport) {
    if (!eventId || !sport) return '';
    const q = new URLSearchParams({ gameId: String(eventId), sport });
    return `game.html?${q.toString()}`;
  }

  function renderFightRow(comp) {
    const competitors = [...(comp.competitors || [])].sort(
      (a, b) => (a.order || 99) - (b.order || 99)
    );
    if (competitors.length < 2) return '';
    const a = competitors[0];
    const b = competitors[1];
    const statusText = fightStatus(comp);
    return `<li class="combat-fight-row">
      <span class="combat-fighters">${escapeHtml(fighterName(a))} vs ${escapeHtml(fighterName(b))}</span>
      <span class="combat-fight-status">${escapeHtml(statusText)}</span>
    </li>`;
  }

  function renderEventCard(event, sport) {
    const status = getStatus(event);
    const venue = event.competitions?.[0]?.venue?.fullName || '';
    const city = event.competitions?.[0]?.venue?.address?.city || '';
    const location = [venue, city].filter(Boolean).join(' · ');
    const fights = (event.competitions || []).slice(0, 12);
    const fightList = fights.map(renderFightRow).filter(Boolean).join('');
    const href = gameUrl(event.id, sport);
    const headLive = status.live ? ' is-live' : '';

    return `<article class="combat-event-card${headLive}">
      <header class="combat-event-head">
        <div>
          <h2 class="combat-event-title">${escapeHtml(event.name || event.shortName || 'Event')}</h2>
          <p class="combat-event-meta">${escapeHtml(formatEventDate(event.date))}${location ? ` · ${escapeHtml(location)}` : ''}</p>
        </div>
        <span class="combat-event-status${status.live ? ' is-live' : ''}">${escapeHtml(status.text)}</span>
      </header>
      ${fightList ? `<ul class="combat-fight-list">${fightList}</ul>` : '<p class="combat-event-empty">Fight card details are not available yet.</p>'}
      ${href ? `<p class="combat-event-link"><a href="${escapeHtml(href)}">Open event in game center →</a></p>` : ''}
    </article>`;
  }

  function renderAttribution() {
    return `<p class="nba-scoreboard-attribution">Event schedules and results from ESPN public APIs. Data may be delayed or incomplete.</p>`;
  }

  function init(root, config) {
    const apiUrl = config.apiUrl;
    const sport = config.sport;
    const leagueName = config.leagueName || 'Events';

    const urlState = (() => {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('date');
      if (!raw) return { date: startOfLocalDay(new Date()), invalidUrl: false };
      const parsed = parseYmd(raw);
      if (!parsed) return { date: startOfLocalDay(new Date()), invalidUrl: true };
      return { date: startOfLocalDay(parsed), invalidUrl: false };
    })();

    let weekMonday = mondayOfWeek(urlState.date);
    let selectedDate = urlState.date;
    let eventDays = [];
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
      <div class="nba-scoreboard-date-nav" data-date-nav role="tablist" aria-label="Dates with ${escapeHtml(leagueName)} events"></div>
      <div data-notice hidden></div>
      <div class="nba-scoreboard-status" data-status aria-live="polite"></div>
      <div class="combat-event-grid" data-grid></div>
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

    function renderDateButtons() {
      const selectedYmd = formatYmd(selectedDate);
      if (!eventDays.length) {
        dateNav.innerHTML =
          '<p class="nba-scoreboard-empty">No events this week. Try another week.</p>';
        dateNav.classList.add('is-empty');
        return;
      }
      dateNav.classList.remove('is-empty');
      dateNav.innerHTML = eventDays
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

    async function scanWeek() {
      dayCache.clear();
      eventDays = [];
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
      eventDays = results.filter(Boolean);
    }

    function buildNotices() {
      const parts = [];
      if (urlState.invalidUrl) {
        parts.push('The date in the URL was invalid. Showing this week instead.');
      }
      if (scanFailures > 0) {
        parts.push(
          `Some days could not be loaded (${scanFailures} of ${WEEK_DAYS}). The schedule may be incomplete.`
        );
      }
      const ymd = formatYmd(selectedDate);
      const onDay = eventDays.some((d) => formatYmd(d) === ymd);
      if (eventDays.length && !onDay) {
        parts.push(
          `No ${leagueName} events on ${formatDisplayDate(selectedDate)}. Pick a highlighted date or change weeks.`
        );
      }
      if (!eventDays.length) {
        parts.push(`No ${leagueName} events found this week. Try Previous or Next week.`);
      }
      if (parts.length) {
        noticeEl.hidden = false;
        noticeEl.className = 'nba-scoreboard-notice';
        noticeEl.textContent = parts.join(' ');
      } else {
        noticeEl.hidden = true;
      }
    }

    async function renderEvents() {
      const ymd = formatYmd(selectedDate);
      const url = new URL(window.location.href);
      url.searchParams.set('date', ymd);
      window.history.replaceState({}, '', url.toString());

      renderDateButtons();
      buildNotices();

      const onDay = eventDays.some((d) => formatYmd(d) === ymd);
      if (!onDay) {
        gridEl.innerHTML =
          '<div class="nba-scoreboard-empty" role="status">No events for the selected date.</div>';
        statusEl.textContent = '';
        return;
      }

      statusEl.textContent = 'Loading events…';
      gridEl.innerHTML = '';
      try {
        let data = dayCache.get(ymd);
        if (!data) {
          data = await fetchDay(ymd);
          dayCache.set(ymd, data);
        }
        const events = data.events || [];
        if (!events.length) {
          gridEl.innerHTML =
            '<div class="nba-scoreboard-empty" role="status">No events scheduled for this date.</div>';
          statusEl.textContent = '';
          return;
        }
        gridEl.innerHTML = events.map((ev) => renderEventCard(ev, sport)).join('');
        statusEl.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;
      } catch (err) {
        console.warn(`${leagueName} schedule load failed:`, err);
        statusEl.textContent = 'Could not load schedule. Please try again.';
        statusEl.classList.add('is-error');
        gridEl.innerHTML =
          '<div class="nba-scoreboard-empty" role="alert">Schedule unavailable right now.</div>';
      }
    }

    async function loadAll() {
      statusEl.textContent = 'Loading schedule…';
      statusEl.classList.remove('is-error');
      await scanWeek();
      await renderEvents();
      if (refreshTimer) clearInterval(refreshTimer);
      const isToday = formatYmd(selectedDate) === formatYmd(new Date());
      if (isToday) {
        refreshTimer = setInterval(loadAll, REFRESH_MS);
      }
    }

    dateNav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-date]');
      if (!btn) return;
      const parsed = parseYmd(btn.dataset.date);
      if (!parsed) return;
      selectedDate = startOfLocalDay(parsed);
      urlState.invalidUrl = false;
      renderEvents();
    });

    root.addEventListener('click', (e) => {
      const weekBtn = e.target.closest('[data-week]');
      if (!weekBtn) return;
      const delta = parseInt(weekBtn.dataset.week, 10);
      if (Number.isNaN(delta)) return;
      weekMonday = addDays(weekMonday, delta * 7);
      selectedDate = weekMonday;
      urlState.invalidUrl = false;
      loadAll();
    });

    loadAll();
  }

  global.EspnCombatScoreboard = { init };
})(window);
