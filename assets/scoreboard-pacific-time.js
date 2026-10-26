(function (global) {
  'use strict';

  const TZ = 'America/Los_Angeles';

  const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  function pacificYmd(instant) {
    return ymdFormatter.format(new Date(instant)).replace(/-/g, '');
  }

  function formatTimePT(isoDate) {
    try {
      const time = new Date(isoDate).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: TZ,
      });
      return time ? `${time} PT` : '';
    } catch (_) {
      return '';
    }
  }

  function formatEventDateTimePT(isoDate) {
    try {
      const text = new Date(isoDate).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: TZ,
      });
      return text ? `${text} PT` : '';
    } catch (_) {
      return '';
    }
  }

  function parsePacificYmd(ymd) {
    const cleaned = String(ymd || '').replace(/-/g, '');
    if (!/^\d{8}$/.test(cleaned)) return null;

    const y = parseInt(cleaned.slice(0, 4), 10);
    const m = parseInt(cleaned.slice(4, 6), 10) - 1;
    const d = parseInt(cleaned.slice(6, 8), 10);

    let t = Date.UTC(y, m, d, 20, 0, 0);
    for (let i = 0; i < 72; i += 1) {
      if (pacificYmd(t) === cleaned) return new Date(t);
      t -= 3600000;
    }
    return new Date(y, m, d);
  }

  function startOfPacificDay(instant) {
    return parsePacificYmd(pacificYmd(instant));
  }

  function addPacificDays(anchor, days) {
    const ymd = pacificYmd(anchor);
    const y = parseInt(ymd.slice(0, 4), 10);
    const m = parseInt(ymd.slice(4, 6), 10);
    const d = parseInt(ymd.slice(6, 8), 10);
    const utc = Date.UTC(y, m - 1, d + days, 12, 0, 0);
    return new Date(utc);
  }

  function pacificWeekdayIndex(instant) {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      weekday: 'short',
    }).format(new Date(instant));
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[weekday] ?? 0;
  }

  function mondayOfPacificWeek(anchor) {
    const day = startOfPacificDay(anchor);
    const weekday = pacificWeekdayIndex(day);
    const diff = weekday === 0 ? -6 : 1 - weekday;
    return addPacificDays(day, diff);
  }

  function weekCandidateDays(weekMonday, count) {
    const days = [];
    for (let i = 0; i < count; i += 1) {
      days.push(addPacificDays(weekMonday, i));
    }
    return days;
  }

  function formatDisplayDatePacific(anchor) {
    return new Date(anchor).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: TZ,
    });
  }

  function formatYmd(anchor) {
    return pacificYmd(anchor);
  }

  function eventPacificYmd(event) {
    const iso = event?.date || event?.competitions?.[0]?.date;
    if (!iso) return '';
    return pacificYmd(iso);
  }

  function filterEventsForPacificYmd(events, ymd) {
    return (events || []).filter((event) => eventPacificYmd(event) === ymd);
  }

  global.ScoreboardPacific = {
    TZ,
    pacificYmd,
    formatTimePT,
    formatEventDateTimePT,
    parsePacificYmd,
    startOfPacificDay,
    addPacificDays,
    mondayOfPacificWeek,
    weekCandidateDays,
    formatDisplayDatePacific,
    formatYmd,
    eventPacificYmd,
    filterEventsForPacificYmd,
  };
})(window);
