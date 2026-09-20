(function () {
  'use strict';

  const { escapeHtml, initGamePage } = window.GameShared;

  function stripStoryHtml(html) {
    if (!html) return '';
    return String(html)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\?\?\?/g, '')
      .trim();
  }

  function renderRecap(article) {
    if (!article) {
      return '<div class="boxscore-empty">Recap article is not yet available for this game.</div>';
    }

    const image = article.images?.[0]?.url || '';
    const headline = article.headline || 'Game Recap';
    const description = article.description || '';
    const story = stripStoryHtml(article.story);
    const published = article.published || article.lastModified || '';

    let publishedText = '';
    if (published) {
      try {
        publishedText = new Date(published).toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      } catch (_) {
        publishedText = '';
      }
    }

    return `
      <article class="recap-article">
        ${image ? `<div class="recap-image"><img src="${escapeHtml(image)}" alt="" loading="lazy" /></div>` : ''}
        <h2 class="recap-headline">${escapeHtml(headline)}</h2>
        ${publishedText ? `<p class="recap-meta">${escapeHtml(publishedText)}</p>` : ''}
        ${description ? `<p class="recap-dek">${escapeHtml(description.replace(/\?\?\?/g, '').trim())}</p>` : ''}
        ${story ? `<div class="recap-body"><p>${escapeHtml(story)}</p></div>` : ''}
      </article>
    `;
  }

  function renderMain({ data }) {
    const mainEl = document.getElementById('game-main');
    const videoSidebarEl = document.getElementById('game-video-sidebar');
    if (videoSidebarEl) videoSidebarEl.innerHTML = '';

    if (mainEl) {
      mainEl.innerHTML = `
        <section class="game-view-card">
          <div class="game-view-card-header"><h2>Recap</h2></div>
          ${renderRecap(data.article)}
        </section>
      `;
    }
  }

  initGamePage('recap', renderMain);
})();
