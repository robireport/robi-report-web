(function () {
  var MOBILE_MQ = window.matchMedia('(max-width: 768px)');

  function isMobile() {
    return MOBILE_MQ.matches;
  }

  function setToggleIcon(open) {
    var bar = toggle.querySelector('.nav-toggle-bar');
    if (bar) bar.textContent = open ? '\u2715' : '\u2630';
  }

  function closeNav(nav, toggle, backdrop) {
    nav.classList.remove('nav-open');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      setToggleIcon(false);
    }
    if (backdrop) {
      backdrop.classList.remove('is-visible');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('nav-menu-open');
    document.querySelectorAll('.nav-item.has-dropdown.open').forEach(function (item) {
      item.classList.remove('open');
      var t = item.querySelector('.nav-dropdown-toggle');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  function openNav(nav, toggle, backdrop) {
    nav.classList.add('nav-open');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      setToggleIcon(true);
    }
    if (backdrop) {
      backdrop.classList.add('is-visible');
      backdrop.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('nav-menu-open');
  }

  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav-toggle');
  var backdrop = document.querySelector('.nav-mobile-backdrop');
  var dropdownItems = document.querySelectorAll('.nav-item.has-dropdown');

  if (!nav || !toggle) return;

  toggle.addEventListener('click', function (e) {
    if (!isMobile()) return;
    e.stopPropagation();
    if (nav.classList.contains('nav-open')) {
      closeNav(nav, toggle, backdrop);
    } else {
      openNav(nav, toggle, backdrop);
    }
  });

  if (backdrop) {
    backdrop.addEventListener('click', function () {
      if (isMobile()) closeNav(nav, toggle, backdrop);
    });
  }

  nav.querySelectorAll('.nav-links a[href]').forEach(function (link) {
    link.addEventListener('click', function () {
      if (isMobile()) closeNav(nav, toggle, backdrop);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('nav-open') && isMobile()) {
      closeNav(nav, toggle, backdrop);
    }
  });

  dropdownItems.forEach(function (item) {
    var ddToggle = item.querySelector('.nav-dropdown-toggle');
    if (!ddToggle) return;

    ddToggle.addEventListener('click', function (e) {
      if (!isMobile()) return;
      e.preventDefault();
      e.stopPropagation();
      var isOpen = item.classList.contains('open');
      dropdownItems.forEach(function (i) {
        i.classList.remove('open');
        var t = i.querySelector('.nav-dropdown-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        ddToggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  MOBILE_MQ.addEventListener('change', function () {
    if (!isMobile()) closeNav(nav, toggle, backdrop);
  });
})();
