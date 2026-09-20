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
  var lightboxBackdrop = document.getElementById('lightbox-backdrop');
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
  var dragStartScroll = 0;
  var didDrag = false;

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
  }

  function openLightbox(key) {
    if (!lightbox) return;
    syncLightboxImage(key || activeThumbKey);
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
    dragStartScroll = carousel.scrollLeft;
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
      setActiveSlide(slide.dataset.image, false);
      openLightbox(slide.dataset.image);
    });
  });

  swatches.forEach(function (swatch) {
    swatch.addEventListener('click', function () {
      setColor(swatch.dataset.color);
    });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }

  if (lightboxBackdrop) {
    lightboxBackdrop.addEventListener('click', closeLightbox);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lightbox && !lightbox.hidden) {
      closeLightbox();
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
