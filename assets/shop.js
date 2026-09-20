(function () {
  var carousel = document.getElementById('product-carousel');
  if (!carousel) return;

  var slides = document.querySelectorAll('.product-carousel-slide');
  var thumbs = document.querySelectorAll('.product-thumb');
  var swatches = document.querySelectorAll('.color-swatch');
  var colorLabels = document.querySelectorAll('.color-selected-name');
  var buyBtn = document.getElementById('buy-now-btn');
  var cartBtn = document.getElementById('add-to-cart-btn');
  var toast = document.getElementById('cart-toast');
  var lightbox = document.getElementById('image-lightbox');
  var lightboxImg = document.getElementById('lightbox-img');
  var lightboxClose = document.getElementById('lightbox-close');
  var lightboxPrev = document.getElementById('lightbox-prev');
  var lightboxNext = document.getElementById('lightbox-next');
  var lightboxBackdrop = document.getElementById('lightbox-backdrop');
  var lightboxContent = document.getElementById('lightbox-content');
  var lightboxCounter = document.getElementById('lightbox-counter');
  var carouselPrev = document.getElementById('carousel-prev');
  var carouselNext = document.getElementById('carousel-next');
  var dots = document.querySelectorAll('.carousel-dot');

  var imageKeys = ['face', 'side', 'back', 'composite', 'kd', 'jsn'];

  var colors = {
    green: {
      face: 'assets/shop/green-hat-face.png',
      side: 'assets/shop/green-hat-side.png',
      back: 'assets/shop/green-hat-back.png',
      label: 'Green'
    },
    blue: {
      face: 'assets/shop/blue-hat-face.png',
      side: 'assets/shop/blue-hat-side.png',
      back: 'assets/shop/blue-hat-back.png',
      label: 'Blue'
    }
  };

  var staticImages = {
    composite: 'assets/shop/hat-grid-composite.png',
    kd: 'assets/shop/kd-x-rr.png',
    jsn: 'assets/shop/jsn-flaujae-x-rr.png'
  };

  var altMap = {
    face: 'Front view — Seattle Loves Ball hat',
    side: 'Side view — Seattle Loves Ball hat',
    back: 'Back view — Seattle Loves Ball hat',
    composite: 'All angles — Seattle Loves Ball hat',
    kd: 'Kevin Durant wearing the Seattle Loves Ball hat',
    jsn: 'JSN and Flau\'jae Johnson wearing the Seattle Loves Ball hat'
  };

  var activeColor = 'green';
  var activeThumbKey = 'face';
  var scrollSyncLock = false;
  var dragStartX = 0;
  var didDrag = false;
  var lightboxDragStartX = 0;
  var lightboxDidDrag = false;

  function getImageSrc(key) {
    if (key === 'face' || key === 'side' || key === 'back') {
      return colors[activeColor][key];
    }
    return staticImages[key];
  }

  function getSlideIndex(key) {
    return imageKeys.indexOf(key);
  }

  function syncLightboxImage(key) {
    if (!lightboxImg) return;
    var slideKey = key || activeThumbKey;
    lightboxImg.src = getImageSrc(slideKey);
    lightboxImg.alt = altMap[slideKey] || 'Seattle Loves Ball Robi Report Hat';
  }

  function updateLightboxCounter() {
    if (!lightboxCounter) return;
    var index = getSlideIndex(activeThumbKey) + 1;
    lightboxCounter.textContent = index + ' / ' + imageKeys.length;
  }

  function updateDots(index) {
    dots.forEach(function (dot, i) {
      dot.classList.toggle('is-active', i === index);
    });
  }

  function updateSlideImages() {
    ['face', 'side', 'back'].forEach(function (key) {
      var slideImg = document.querySelector('.product-carousel-slide[data-image="' + key + '"] img');
      if (slideImg) slideImg.src = colors[activeColor][key];

      var thumb = document.querySelector('.product-thumb[data-image="' + key + '"]');
      if (thumb) {
        var thumbImg = thumb.querySelector('img');
        if (thumbImg) thumbImg.src = colors[activeColor][key];
      }
    });
  }

  function scrollToSlide(key, smooth) {
    var index = getSlideIndex(key);
    if (index < 0) return;

    scrollSyncLock = true;
    var slide = slides[index];
    if (slide) {
      carousel.scrollTo({
        left: slide.offsetLeft,
        behavior: smooth === false ? 'auto' : 'smooth'
      });
    }
    updateDots(index);

    window.setTimeout(function () {
      scrollSyncLock = false;
    }, smooth === false ? 0 : 400);
  }

  function setActiveSlide(key, shouldScroll) {
    if (getSlideIndex(key) < 0) return;
    activeThumbKey = key;

    thumbs.forEach(function (thumb) {
      var isActive = thumb.dataset.image === key;
      thumb.classList.toggle('is-active', isActive);
      thumb.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    updateDots(getSlideIndex(key));

    if (shouldScroll !== false) {
      scrollToSlide(key, true);
    }

    syncLightboxImage(key);
    updateLightboxCounter();
  }

  function navigateLightbox(direction) {
    var currentIndex = getSlideIndex(activeThumbKey);
    if (currentIndex < 0) return;
    var nextIndex = (currentIndex + direction + imageKeys.length) % imageKeys.length;
    setActiveSlide(imageKeys[nextIndex], true);
  }

  function openLightbox(key) {
    if (!lightbox) return;
    setActiveSlide(key || activeThumbKey, false);
    syncLightboxImage(key || activeThumbKey);
    updateLightboxCounter();
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    if (lightboxClose) lightboxClose.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
  }

  function isLightboxOpen() {
    return lightbox && !lightbox.hidden;
  }

  function updateBuyLink() {
    var label = colors[activeColor].label;
    var mailto =
      'mailto:matthew.robi@robireport.com?subject=' +
      encodeURIComponent('Order: Seattle Loves Ball Hat (' + label + ')') +
      '&body=' +
      encodeURIComponent(
        'Hi Robi Report,\n\nI would like to order the Seattle Loves Ball hat in ' +
          label +
          '.\n\nSize: \nQuantity: \n\nThanks!'
      );
    if (buyBtn) buyBtn.href = mailto;
  }

  function setColor(colorKey) {
    if (!colors[colorKey]) return;
    activeColor = colorKey;

    swatches.forEach(function (swatch) {
      var isActive = swatch.dataset.color === colorKey;
      swatch.classList.toggle('is-active', isActive);
      swatch.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    colorLabels.forEach(function (label) {
      label.textContent = colors[colorKey].label;
    });

    updateSlideImages();
    syncLightboxImage(activeThumbKey);
    updateBuyLink();
  }

  function syncActiveFromScroll() {
    if (scrollSyncLock || !slides.length) return;

    var center = carousel.scrollLeft + carousel.clientWidth / 2;
    var closestKey = activeThumbKey;
    var closestDistance = Infinity;

    slides.forEach(function (slide) {
      var slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      var distance = Math.abs(center - slideCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestKey = slide.dataset.image;
      }
    });

    if (closestKey !== activeThumbKey) {
      setActiveSlide(closestKey, false);
    }
  }

  carousel.addEventListener('scroll', function () {
    window.requestAnimationFrame(syncActiveFromScroll);
  }, { passive: true });

  carousel.addEventListener('pointerdown', function (e) {
    dragStartX = e.clientX;
    didDrag = false;
  });

  carousel.addEventListener('pointermove', function (e) {
    if (Math.abs(e.clientX - dragStartX) > 8) {
      didDrag = true;
    }
  });

  thumbs.forEach(function (thumb) {
    thumb.addEventListener('click', function () {
      setActiveSlide(thumb.dataset.image, true);
    });
  });

  slides.forEach(function (slide) {
    slide.addEventListener('click', function () {
      if (didDrag) return;
      openLightbox(slide.dataset.image);
    });
  });

  swatches.forEach(function (swatch) {
    swatch.addEventListener('click', function () {
      setColor(swatch.dataset.color);
    });
  });

  if (carouselPrev) {
    carouselPrev.addEventListener('click', function (e) {
      e.stopPropagation();
      navigateLightbox(-1);
    });
  }

  if (carouselNext) {
    carouselNext.addEventListener('click', function (e) {
      e.stopPropagation();
      navigateLightbox(1);
    });
  }

  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }

  if (lightboxPrev) {
    lightboxPrev.addEventListener('click', function (e) {
      e.stopPropagation();
      navigateLightbox(-1);
    });
  }

  if (lightboxNext) {
    lightboxNext.addEventListener('click', function (e) {
      e.stopPropagation();
      navigateLightbox(1);
    });
  }

  if (lightboxBackdrop) {
    lightboxBackdrop.addEventListener('click', closeLightbox);
  }

  if (lightboxContent) {
    lightboxContent.addEventListener('pointerdown', function (e) {
      lightboxDragStartX = e.clientX;
      lightboxDidDrag = false;
    });

    lightboxContent.addEventListener('pointermove', function (e) {
      if (Math.abs(e.clientX - lightboxDragStartX) > 8) {
        lightboxDidDrag = true;
      }
    });

    lightboxContent.addEventListener('pointerup', function (e) {
      if (!isLightboxOpen() || !lightboxDidDrag) return;
      var delta = e.clientX - lightboxDragStartX;
      if (Math.abs(delta) >= 50) {
        navigateLightbox(delta > 0 ? -1 : 1);
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!isLightboxOpen()) return;

    if (e.key === 'Escape') {
      closeLightbox();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateLightbox(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateLightbox(1);
    }
  });

  if (cartBtn) {
    cartBtn.addEventListener('click', function () {
      if (toast) {
        toast.textContent =
          'Added Seattle Loves Ball Hat (' + colors[activeColor].label + ') to cart';
        toast.classList.add('is-visible');
        window.setTimeout(function () {
          toast.classList.remove('is-visible');
        }, 2800);
      }
    });
  }

  setColor('green');
  setActiveSlide('face', false);
  scrollToSlide('face', false);
})();
