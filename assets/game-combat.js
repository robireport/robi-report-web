(function (global) {
  'use strict';

  const { escapeHtml, formatGameTime } = global.GameShared;

  async function fetchUfcCard(gameId) {
    if (!gameId) return null;

    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard/${encodeURIComponent(gameId)}`
      );
      if (!res.ok) return null;

      const data = await res.json();
      if (!data?.id || !Array.isArray(data.competitions)) return null;
      return data;
    } catch (err) {
      console.warn('UFC card fetch failed:', err);
      return null;
    }
  }

  function renderCombatHero(data, cfg) {
    const title = data?.name || data?.shortName || cfg.label;
    const status = data?.status?.type || {};
    const statusText = status.shortDetail || status.detail || 'Upcoming';
    const dateText = data?.date ? formatGameTime(data.date) : '';

    return `
      <section class="game-hero combat-hero">
        <div class="game-hero-inner">
          <div class="game-hero-meta">
            <span>${escapeHtml(cfg.label)}</span>
          </div>
          <h1 class="combat-event-title">${escapeHtml(title)}</h1>
          <div class="game-status">${escapeHtml(statusText)}</div>
          ${dateText ? `<p class="combat-event-date">${escapeHtml(dateText)}</p>` : ''}
        </div>
      </section>
    `;
  }

  function renderFightRow(fight) {
    const competitors = fight.competitors || [];
    const away = competitors[0]?.athlete || {};
    const home = competitors[1]?.athlete || {};
    const awayName = away.displayName || away.shortName || 'TBD';
    const homeName = home.displayName || home.shortName || 'TBD';
    const status = fight.status?.type?.shortDetail || fight.status?.type?.detail || 'Scheduled';
    const note = fight.type?.abbreviation || fight.type?.text || fight.note || '';

    return `
      <article class="combat-fight-row">
        <div class="combat-fight-names">
          <span>${escapeHtml(awayName)}</span>
          <span class="combat-fight-vs">vs</span>
          <span>${escapeHtml(homeName)}</span>
        </div>
        <div class="combat-fight-meta">
          ${note ? `<span class="combat-fight-note">${escapeHtml(note)}</span>` : ''}
          <span class="combat-fight-status">${escapeHtml(status)}</span>
        </div>
      </article>
    `;
  }

  function renderUfcCard(data, cfg) {
    const fights = (data.competitions || []).map(renderFightRow).join('');

    return `
      <section class="game-view-card">
        <div class="game-view-card-header"><h2>Fight Card</h2></div>
        <div class="combat-fight-list">
          ${
            fights ||
            '<p class="boxscore-empty">Check back soon for bout details.</p>'
          }
        </div>
      </section>
    `;
  }

  function renderFallback(cfg) {
    return `
      <section class="game-view-card combat-fallback">
        <div class="game-view-card-header"><h2>Upcoming Cards</h2></div>
        <p class="boxscore-empty">Check back soon for ${escapeHtml(cfg.label)} cards, schedules, and results.</p>
        <p class="combat-fallback-sub">
          <a href="${escapeHtml(cfg.hub)}">Browse ${escapeHtml(cfg.label)} coverage</a>
        </p>
      </section>
    `;
  }

  async function renderCombatPage(ctx) {
    const { cfg, sport, gameId } = ctx;
    const heroEl = document.getElementById('game-hero');
    const mainEl = document.getElementById('game-main');
    const lineupSidebarEl = document.getElementById('game-lineup-sidebar');
    const videoSidebarEl = document.getElementById('game-video-sidebar');

    if (lineupSidebarEl) lineupSidebarEl.innerHTML = '';
    if (videoSidebarEl) videoSidebarEl.innerHTML = '';

    if (sport === 'ufc' && gameId) {
      const card = await fetchUfcCard(gameId);
      if (card) {
        document.title = `${card.name || cfg.label} — Robi Report`;
        if (heroEl) heroEl.innerHTML = renderCombatHero(card, cfg);
        if (mainEl) mainEl.innerHTML = renderUfcCard(card, cfg);
        return;
      }
    }

    document.title = `${cfg.label} — Robi Report`;
    if (heroEl) heroEl.innerHTML = renderCombatHero({ name: 'Upcoming Cards' }, cfg);
    if (mainEl) mainEl.innerHTML = renderFallback(cfg);
  }

  global.GameCombat = {
    fetchUfcCard,
    renderCombatPage,
  };
})(window);
