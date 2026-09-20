(function () {
  'use strict';

  const { initGamePage } = window.GameShared;

  function renderMain({ data, comp, els }) {
    const videos = window.VideoSidebar ? window.VideoSidebar.collectFromSummary(data) : [];
    const videoTitle = window.VideoSidebar
      ? window.VideoSidebar.buildGameVideoTitle(comp)
      : 'GAME HIGHLIGHTS';
    const videoHtml = window.VideoSidebar ? window.VideoSidebar.render(videos, videoTitle) : '';

    const mainEl = document.getElementById('game-main');
    const videoSidebarEl = document.getElementById('game-video-sidebar');
    const sidebarEl = document.getElementById('game-sidebar');

    if (videoSidebarEl) videoSidebarEl.innerHTML = '';
    if (sidebarEl) sidebarEl.classList.add('game-sidebar-videos-mode');
    if (mainEl) {
      mainEl.innerHTML = `<div class="game-videos-main">${videoHtml}</div>`;
    }
    if (window.VideoSidebar) window.VideoSidebar.init(els.content);
  }

  initGamePage('videos', renderMain);
})();
