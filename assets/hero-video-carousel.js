(function () {
  var viewport = document.getElementById('hero-video-viewport');
  if (!viewport) return;

  var track = document.getElementById('hero-video-track');
  if (!track) return;

  var slides = track.querySelectorAll('.hero-video-slide');
  if (!slides.length) return;

  var prevBtn = document.getElementById('hero-video-prev');
  var nextBtn = document.getElementById('hero-video-next');
  var dots = document.querySelectorAll('.hero-video-dot');

  var activeIndex = 0;
  var scrollLock = false;

  function slideCenter(slide) {
    return slide.offsetLeft + slide.offsetWidth / 2;
  }

  function loadIframe(slide) {
    var iframe = slide.querySelector('iframe[data-src]');
    if (!iframe) return;
    var src = iframe.getAttribute('data-src');
    if (src && !iframe.getAttribute('src')) {
      iframe.setAttribute('src', src);
    }
  }

  function pauseIframe(slide) {
    var iframe = slide.querySelector('iframe');
    if (!iframe) return;
    var src = iframe.getAttribute('src');
    if (!src) return;
    if (!iframe.getAttribute('data-src')) {
      iframe.setAttribute('data-src', src);
    }
    iframe.removeAttribute('src');
  }

  function setActiveIndex(index, scroll) {
    var next = (index + slides.length) % slides.length;
    if (next === activeIndex) return;

    pauseIframe(slides[activeIndex]);
    activeIndex = next;
    loadIframe(slides[activeIndex]);

    dots.forEach(function (dot, i) {
      var selected = i === activeIndex;
      dot.classList.toggle('is-active', selected);
      dot.setAttribute('aria-selected', selected ? 'true' : 'false');
    });

    if (scroll !== false) {
      scrollLock = true;
      viewport.scrollTo({
        left: slides[activeIndex].offsetLeft,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
      window.setTimeout(function () {
        scrollLock = false;
      }, 450);
    }
  }

  function syncFromScroll() {
    if (scrollLock) return;
    var center = viewport.scrollLeft + viewport.clientWidth / 2;
    var closest = activeIndex;
    var closestDistance = Infinity;

    slides.forEach(function (slide, i) {
      var distance = Math.abs(center - slideCenter(slide));
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = i;
      }
    });

    if (closest !== activeIndex) {
      setActiveIndex(closest, false);
    }
  }

  loadIframe(slides[0]);

  viewport.addEventListener(
    'scroll',
    function () {
      window.requestAnimationFrame(syncFromScroll);
    },
    { passive: true }
  );

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      setActiveIndex(activeIndex - 1, true);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      setActiveIndex(activeIndex + 1, true);
    });
  }

  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () {
      setActiveIndex(i, true);
    });
  });

  viewport.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveIndex(activeIndex - 1, true);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveIndex(activeIndex + 1, true);
    }
  });
})();
