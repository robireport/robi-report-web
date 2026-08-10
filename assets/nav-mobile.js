(function () {
  var MOBILE_MQ = window.matchMedia('(max-width: 768px)');

  function isMobile() {
    return MOBILE_MQ.matches;
  }

  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav-toggle');
  var backdrop = document.querySelector('.nav-mobile-backdrop');
  var navInner = nav && nav.querySelector('.nav-inner');
  var navActions = nav && nav.querySelector('.nav-actions');
  var navLinks = nav && nav.querySelector('.nav-links');
  var dropdownItems = document.querySelectorAll('.nav-item.has-dropdown');

  if (!nav || !toggle || !navLinks || !navInner || !navActions) return;

  function setToggleIcon(open) {
    var bar = toggle.querySelector('.nav-toggle-bar');
    if (bar) bar.textContent = open ? '\u2715' : '\u2630';
  }

  function mountMenuPanel() {
    if (navLinks.parentElement !== document.body) {
      document.body.appendChild(navLinks);
    }
  }

  function restoreMenuPanel() {
    if (navLinks.parentElement === document.body) {
      navInner.insertBefore(navLinks, navActions);
    }
  }

  function closeNav() {
    nav.classList.remove('nav-open');
    navLinks.classList.remove('is-mobile-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    setToggleIcon(false);
    if (backdrop) {
      backdrop.classList.remove('is-visible');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('nav-menu-open');
    restoreMenuPanel();
    dropdownItems.forEach(function (item) {
      item.classList.remove('open');
      var t = item.querySelector('.nav-dropdown-toggle');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  function openNav() {
    mountMenuPanel();
    nav.classList.add('nav-open');
    navLinks.classList.add('is-mobile-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    setToggleIcon(true);
    if (backdrop) {
      backdrop.classList.add('is-visible');
      backdrop.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('nav-menu-open');
  }

  toggle.addEventListener('click', function (e) {
    if (!isMobile()) return;
    e.stopPropagation();
    if (nav.classList.contains('nav-open')) {
      closeNav();
    } else {
      openNav();
    }
  });

  if (backdrop) {
    backdrop.addEventListener('click', function () {
      if (isMobile()) closeNav();
    });
  }

  navLinks.querySelectorAll('a[href]').forEach(function (link) {
    link.addEventListener('click', function () {
      if (isMobile()) closeNav();
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('nav-open') && isMobile()) {
      closeNav();
    }
  });

  MOBILE_MQ.addEventListener('change', function () {
    if (!isMobile()) closeNav();
  });
})();
