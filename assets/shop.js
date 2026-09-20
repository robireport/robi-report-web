(function () {
  var viewer = document.getElementById('product-viewer-img');
  if (!viewer) return;

  var viewerBtn = document.getElementById('product-viewer-btn');
  var thumbs = document.querySelectorAll('.product-thumb');
  var swatches = document.querySelectorAll('.color-swatch');
  var colorLabel = document.getElementById('color-selected-name');
  var buyBtn = document.getElementById('buy-now-btn');
  var cartBtn = document.getElementById('add-to-cart-btn');
  var toast = document.getElementById('cart-toast');
  var lightbox = document.getElementById('image-lightbox');
  var lightboxImg = document.getElementById('lightbox-img');
  var lightboxClose = document.getElementById('lightbox-close');
  var lightboxBackdrop = document.getElementById('lightbox-backdrop');

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

  var activeColor = 'green';
  var activeThumbKey = 'face';

  function getThumbSrc(key) {
    if (key === 'face' || key === 'side' || key === 'back') {
      return colors[activeColor][key];
    }
    return staticImages[key];
  }

  function syncLightboxImage() {
    if (!lightboxImg) return;
    lightboxImg.src = viewer.src;
    lightboxImg.alt = viewer.alt;
  }

  function setViewerImage(src, alt) {
    viewer.classList.add('is-switching');
    viewer.src = src;
    viewer.alt = alt;
    syncLightboxImage();
  }

  function openLightbox() {
    if (!lightbox) return;
    syncLightboxImage();
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
    if (viewerBtn) viewerBtn.focus();
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

  function refreshColorDependentImages() {
    ['face', 'side', 'back'].forEach(function (key) {
      var thumb = document.querySelector('.product-thumb[data-image="' + key + '"]');
      if (thumb) {
        var img = thumb.querySelector('img');
        if (img) img.src = colors[activeColor][key];
      }
    });

    if (activeThumbKey === 'face' || activeThumbKey === 'side' || activeThumbKey === 'back') {
      setViewerImage(
        colors[activeColor][activeThumbKey],
        'Seattle Loves Ball Robi Report Hat — ' + colors[activeColor].label
      );
    }

    updateBuyLink();
  }

  function setColor(colorKey) {
    if (!colors[colorKey]) return;
    activeColor = colorKey;

    swatches.forEach(function (swatch) {
      var isActive = swatch.dataset.color === colorKey;
      swatch.classList.toggle('is-active', isActive);
      swatch.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    if (colorLabel) colorLabel.textContent = colors[colorKey].label;
    refreshColorDependentImages();
  }

  function setActiveThumb(thumb) {
    var key = thumb.dataset.image;
    activeThumbKey = key;

    thumbs.forEach(function (t) {
      t.classList.toggle('is-active', t === thumb);
      t.setAttribute('aria-selected', t === thumb ? 'true' : 'false');
    });

    var src = getThumbSrc(key);
    var altMap = {
      face: 'Front view',
      side: 'Side view',
      back: 'Back view',
      composite: 'All angles',
      kd: 'Kevin Durant wearing the hat',
      jsn: 'JSN and Flau\'jae Johnson wearing the hat'
    };
    setViewerImage(src, altMap[key] || 'Seattle Loves Ball Robi Report Hat');
  }

  viewer.addEventListener('load', function () {
    viewer.classList.remove('is-switching');
  });

  thumbs.forEach(function (thumb) {
    thumb.addEventListener('click', function () {
      setActiveThumb(thumb);
    });
  });

  swatches.forEach(function (swatch) {
    swatch.addEventListener('click', function () {
      setColor(swatch.dataset.color);
    });
  });

  if (viewerBtn) {
    viewerBtn.addEventListener('click', openLightbox);
  }

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
  if (thumbs.length) setActiveThumb(thumbs[0]);
})();
