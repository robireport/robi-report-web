(function () {
  'use strict';

  const API_URL = 'https://site.api.espn.com/apis/site/v2/sports/boxing/scoreboard';
  const ESPN_SCHEDULE = 'https://www.espn.com/boxing/schedule';

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  document.querySelectorAll('[data-boxing-scoreboard]').forEach((root) => {
    root.innerHTML = `
      <div class="nba-scoreboard-status" data-status aria-live="polite">Checking for schedule data…</div>
      <div data-grid></div>
      <p class="nba-scoreboard-attribution">Robi Report does not invent fight results. When ESPN’s public boxing scoreboard API is unavailable, use the trusted schedule link below.</p>
    `;

    const statusEl = root.querySelector('[data-status]');
    const gridEl = root.querySelector('[data-grid]');

    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const events = data?.events || [];
        if (!events.length) {
          throw new Error('No events');
        }
        statusEl.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;
        gridEl.innerHTML = events
          .map(
            (ev) => `<article class="combat-event-card">
              <header class="combat-event-head">
                <h2 class="combat-event-title">${escapeHtml(ev.name || ev.shortName || 'Boxing event')}</h2>
                <p class="combat-event-meta">${escapeHtml(ev.date || '')}</p>
              </header>
            </article>`
          )
          .join('');
      })
      .catch(() => {
        statusEl.textContent = '';
        gridEl.innerHTML = `<div class="nba-scoreboard-empty" role="status">
          <p>Live boxing schedules are not available from ESPN’s public scoreboard API right now.</p>
          <p style="margin-top:12px"><a href="${escapeHtml(ESPN_SCHEDULE)}" target="_blank" rel="noopener noreferrer">View boxing schedule on ESPN →</a></p>
        </div>`;
      });
  });
})();
