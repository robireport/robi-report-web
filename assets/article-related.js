(function () {
  'use strict';

  function initCarousel(section) {
    const track = section.querySelector('.article-related-track');
    if (!track) return;

    const prev = section.querySelector('.article-related-scroll-btn[data-direction="prev"]');
    const next = section.querySelector('.article-related-scroll-btn[data-direction="next"]');
    const scrollAmount = () => Math.max(260, track.clientWidth * 0.75);

    if (prev) {
      prev.addEventListener('click', () => {
        track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
      });
    }

    if (next) {
      next.addEventListener('click', () => {
        track.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
      });
    }
  }

  function initAll() {
    document.querySelectorAll('.article-related').forEach(initCarousel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
