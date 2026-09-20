(function () {
  var preview = document.getElementById('hat-preview');
  var swatches = document.querySelectorAll('.color-swatch');
  var galleryFace = document.getElementById('gallery-face');
  var gallerySide = document.getElementById('gallery-side');
  var galleryBack = document.getElementById('gallery-back');
  var buyBtn = document.getElementById('buy-now-btn');

  if (!preview || !swatches.length) return;

  var colors = {
    green: {
      preview: 'assets/shop/green-hat-face.png',
      face: 'assets/shop/green-hat-face.png',
      side: 'assets/shop/green-hat-side.png',
      back: 'assets/shop/green-hat-back.png',
      label: 'Green'
    },
    blue: {
      preview: 'assets/shop/blue-hat-face.png',
      face: 'assets/shop/blue-hat-face.png',
      side: 'assets/shop/blue-hat-side.png',
      back: 'assets/shop/blue-hat-back.png',
      label: 'Blue'
    }
  };

  function setColor(colorKey) {
    var color = colors[colorKey];
    if (!color) return;

    preview.classList.add('is-switching');
    preview.src = color.preview;
    preview.alt = 'Seattle Loves Ball Robi Report Hat — ' + color.label;

    if (galleryFace) {
      galleryFace.src = color.face;
      galleryFace.alt = 'Front view — ' + color.label + ' hat';
    }
    if (gallerySide) {
      gallerySide.src = color.side;
      gallerySide.alt = 'Side view — ' + color.label + ' hat';
    }
    if (galleryBack) {
      galleryBack.src = color.back;
      galleryBack.alt = 'Back view — ' + color.label + ' hat';
    }

    swatches.forEach(function (swatch) {
      var isActive = swatch.dataset.color === colorKey;
      swatch.classList.toggle('is-active', isActive);
      swatch.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    if (buyBtn) {
      buyBtn.href =
        'mailto:matthew.robi@robireport.com?subject=' +
        encodeURIComponent('Order: Seattle Loves Ball Hat (' + color.label + ')') +
        '&body=' +
        encodeURIComponent(
          'Hi Robi Report,\n\nI would like to order the Seattle Loves Ball hat in ' +
            color.label +
            '.\n\nSize: \nQuantity: \n\nThanks!'
        );
    }
  }

  preview.addEventListener('load', function () {
    preview.classList.remove('is-switching');
  });

  swatches.forEach(function (swatch) {
    swatch.addEventListener('click', function () {
      setColor(swatch.dataset.color);
    });
  });

  setColor('green');
})();
