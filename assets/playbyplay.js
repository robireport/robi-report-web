(function () {
  'use strict';

  const { escapeHtml, getCompetitors, initGamePage } = window.GameShared;

  function renderPlays(plays, comp) {
    if (!plays?.length) {
      return '<div class="boxscore-empty">Play-by-play will be available once the game begins.</div>';
    }

    const { away, home } = getCompetitors(comp);
    const awayAbbr = away?.team?.abbreviation || 'AWY';
    const homeAbbr = home?.team?.abbreviation || 'HME';

    const items = [...plays].reverse().map((play) => {
      const period = play.period?.displayValue || play.period?.number ? `Q${play.period.number}` : '';
      const clock = play.clock?.displayValue || '';
      const scoringClass = play.scoringPlay ? ' is-scoring' : '';
      const text = play.text || play.shortDescription || '—';

      return `
        <article class="pbp-item${scoringClass}">
          <div class="pbp-item-top">
            <span class="pbp-clock">${escapeHtml([period, clock].filter(Boolean).join(' · '))}</span>
            <span class="pbp-score">${escapeHtml(awayAbbr)} ${escapeHtml(String(play.awayScore ?? '0'))} – ${escapeHtml(String(play.homeScore ?? '0'))} ${escapeHtml(homeAbbr)}</span>
          </div>
          <p class="pbp-text">${escapeHtml(text)}</p>
        </article>
      `;
    });

    return `<div class="pbp-feed">${items.join('')}</div>`;
  }

  function renderMain({ data, comp }) {
    const mainEl = document.getElementById('game-main');
    const videoSidebarEl = document.getElementById('game-video-sidebar');
    if (videoSidebarEl) videoSidebarEl.innerHTML = '';
    if (mainEl) {
      mainEl.innerHTML = `
        <section class="game-view-card">
          <div class="game-view-card-header"><h2>Play-by-Play</h2></div>
          ${renderPlays(data.plays, comp)}
        </section>
      `;
    }
  }

  initGamePage('playbyplay', renderMain);
})();
