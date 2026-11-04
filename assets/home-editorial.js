(function () {
  var times = document.querySelectorAll('.editorial-board time[data-published]');
  if (!times.length) return;

  var ptFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  function parsePublished(value) {
    if (!value) return null;
    var dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function relativeLabel(published, now) {
    var deltaMs = now.getTime() - published.getTime();
    if (deltaMs < 0) {
      return ptFormatter.format(published);
    }
    var seconds = Math.floor(deltaMs / 1000);
    if (seconds < 60) return 'Just now';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return minutes + ' minute' + (minutes === 1 ? '' : 's') + ' ago';
    }
    var hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
    }
    var days = Math.floor(hours / 24);
    if (days < 7) {
      return days + ' day' + (days === 1 ? '' : 's') + ' ago';
    }
    return ptFormatter.format(published);
  }

  function refresh() {
    var now = new Date();
    times.forEach(function (el) {
      var published = parsePublished(el.getAttribute('data-published'));
      if (!published) return;
      el.textContent = relativeLabel(published, now);
      el.setAttribute('title', ptFormatter.format(published));
    });
  }

  refresh();
  window.setInterval(refresh, 60000);
})();
