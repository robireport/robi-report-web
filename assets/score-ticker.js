(function () {
  'use strict';

  const LEAGUE_LABELS = {
    nba: 'NBA',
    wnba: 'WNBA',
    nfl: 'NFL',
    mlb: 'MLB',
    ufc: 'UFC',
    boxing: 'BOXING',
    epl: 'PREMIER LEAGUE',
  };

  const LEAGUE_HUBS = {
    nba: 'nba.html',
    wnba: 'wnba.html',
    nfl: 'nfl.html',
    ufc: 'ufc.html',
    boxing: 'boxing.html',
    epl: 'soccer.html',
    mlb: 'mlb.html',
  };

  const LEAGUE_SPORT_CODES = {
    nba: 'nba',
    wnba: 'wnba',
    nfl: 'nfl',
    mlb: 'mlb',
    ufc: 'ufc',
    boxing: 'boxing',
    epl: 'soccer',
  };

  const LEAGUES = {
    nba: {
      url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      mode: 'team',
    },
    wnba: {
      url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard',
      mode: 'team',
    },
    nfl: {
      url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      mode: 'team',
    },
    mlb: {
      url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
      mode: 'team',
    },
    ufc: {
      url: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',
      mode: 'fighter',
    },
    boxing: {
      url: 'https://site.api.espn.com/apis/site/v2/sports/boxing/scoreboard',
      mode: 'fighter',
    },
    epl: {
      url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
      mode: 'team',
    },
  };

  const ALL_KEYS = Object.keys(LEAGUES);
  const REFRESH_MS = 60000;

  const ticker = document.getElementById('score-ticker');
  const track = document.getElementById('ticker-track');
  if (!ticker || !track) return;

  let activeFilter = (ticker.dataset.default || 'all').toLowerCase();
  let refreshTimer = null;
  let cache = {};
  let isDragging = false;
  let dragStartX = 0;
  let scrollStart = 0;

  function formatTimeET(isoDate) {
    try {
      return new Date(isoDate).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
        timeZoneName: 'short',
      });
    } catch (_) {
      return '';
    }
  }

  function getLogo(entity) {
    if (!entity) return '';
    return (
      entity.logo ||
      entity.logos?.[0]?.href ||
      entity.headshot?.href ||
      entity.athlete?.headshot?.href ||
      ''
    );
  }

  function getAbbr(entity, fallback) {
    if (!entity) return fallback || '—';
    return (
      entity.abbreviation ||
      entity.shortDisplayName ||
      entity.displayName?.split(' ').pop() ||
      fallback ||
      '—'
    );
  }

  function getBroadcast(comp) {
    const names = comp?.broadcasts?.[0]?.names;
    if (names?.length) return names[0];
    const market = comp?.geoBroadcasts?.[0]?.market?.shortName;
    const media = comp?.geoBroadcasts?.[0]?.media?.shortName;
    if (market && media) return `${media}`;
    return '';
  }

  function getStatusText(event, comp) {
    const status = comp?.status?.type || event?.status?.type || {};
    const state = status.state;
    const detail = status.detail || status.description || '';
    const clock = comp?.status?.displayClock || event?.status?.displayClock || '';

    if (status.name === 'STATUS_POSTPONED' || /postponed/i.test(detail)) {
      return { text: 'POSTPONED', cls: 'is-scheduled' };
    }
    if (status.name === 'STATUS_CANCELED' || /canceled/i.test(detail)) {
      return { text: 'CANCELED', cls: 'is-scheduled' };
    }
    if (state === 'post' || status.completed) {
      return { text: 'FINAL', cls: 'is-final' };
    }
    if (state === 'in') {
      const live = clock ? `${clock}${detail ? ' • ' + detail : ''}` : detail || 'LIVE';
      return { text: live.toUpperCase(), cls: '' };
    }
    const time = formatTimeET(event.date || comp?.date);
    return { text: time || 'SCHEDULED', cls: 'is-scheduled' };
  }

  function getPathPrefix() {
    return /\/articles\//.test(window.location.pathname) ? '../../' : '';
  }

  function getGamePageUrl(event, leagueKey) {
    const id = event?.id;
    const sportCode = LEAGUE_SPORT_CODES[leagueKey];
    if (!id || !sportCode) return '';
    const params = new URLSearchParams({ gameId: id, sport: sportCode });
    return `${getPathPrefix()}game.html?${params.toString()}`;
  }

  function parseTeamEvent(event) {
    const comp = event.competitions?.[0];
    if (!comp) return null;

    const competitors = [...(comp.competitors || [])].sort(
      (a, b) => (a.homeAway === 'home' ? 1 : 0) - (b.homeAway === 'home' ? 1 : 0)
    );
    if (competitors.length < 2) return null;

    const away = competitors.find((c) => c.homeAway === 'away') || competitors[0];
    const home = competitors.find((c) => c.homeAway === 'home') || competitors[1];
    const status = getStatusText(event, comp);
    const state = comp.status?.type?.state || event.status?.type?.state;

    return {
      away: {
        abbr: getAbbr(away.team, away.team?.displayName),
        score: away.score ?? '',
        logo: getLogo(away.team),
      },
      home: {
        abbr: getAbbr(home.team, home.team?.displayName),
        score: home.score ?? '',
        logo: getLogo(home.team),
      },
      status,
      broadcast: getBroadcast(comp),
      isLive: state === 'in',
    };
  }

  function parseFighterEvent(event) {
    const comp = event.competitions?.[0];
    if (!comp) return null;

    const competitors = comp.competitors || [];
    if (competitors.length < 2) {
      return {
        away: { abbr: event.shortName || 'TBD', score: '', logo: '' },
        home: { abbr: '', score: '', logo: '' },
        status: getStatusText(event, comp),
        broadcast: getBroadcast(comp),
        isLive: false,
        singleLine: true,
        label: event.name || event.shortName || 'Match',
      };
    }

    const c1 = competitors[0];
    const c2 = competitors[1];
    const t1 = c1.athlete || c1.team || {};
    const t2 = c2.athlete || c2.team || {};
    const status = getStatusText(event, comp);
    const state = comp.status?.type?.state || event.status?.type?.state;

    return {
      away: {
        abbr: getAbbr(t1, c1.displayName || 'TBD'),
        score: c1.winner ? 'W' : c1.score || '',
        logo: getLogo(t1),
        headshot: true,
      },
      home: {
        abbr: getAbbr(t2, c2.displayName || 'TBD'),
        score: c2.winner ? 'W' : c2.score || '',
        logo: getLogo(t2),
        headshot: true,
      },
      status,
      broadcast: getBroadcast(comp),
      isLive: state === 'in',
    };
  }

  function parseEvents(data, mode, leagueKey) {
    const events = data?.events || [];
    return events
      .map((ev) => {
        const parsed = mode === 'fighter' ? parseFighterEvent(ev) : parseTeamEvent(ev);
        if (parsed) parsed.gameUrl = getGamePageUrl(ev, leagueKey);
        return parsed;
      })
      .filter(Boolean);
  }

  async function fetchLeague(key) {
    if (cache[key]?.fetchedAt && Date.now() - cache[key].fetchedAt < REFRESH_MS - 5000) {
      return cache[key].cards;
    }
    const cfg = LEAGUES[key];
    const res = await fetch(cfg.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cards = parseEvents(data, cfg.mode, key);
    cache[key] = { cards, fetchedAt: Date.now() };
    return cards;
  }

  function buildSection(leagueKey, cards) {
    return {
      league: leagueKey,
      label: LEAGUE_LABELS[leagueKey] || leagueKey.toUpperCase(),
      cards: cards || [],
    };
  }

  async function loadSections(filter) {
    track.classList.add('ticker-loading');
    try {
      if (filter === 'all') {
        const results = await Promise.allSettled(ALL_KEYS.map((k) => fetchLeague(k)));
        const sections = [];
        results.forEach((r, i) => {
          const key = ALL_KEYS[i];
          if (r.status === 'fulfilled' && r.value.length) {
            sections.push(buildSection(key, r.value));
          }
        });
        return sections.length ? sections : null;
      }
      const cards = await fetchLeague(filter);
      return [buildSection(filter, cards)];
    } catch (err) {
      console.warn('Score ticker fetch failed:', err);
      throw err;
    } finally {
      track.classList.remove('ticker-loading');
    }
  }

  function createScoreCardElement(item) {
    const hasLink = Boolean(item.gameUrl);
    const el = document.createElement(hasLink ? 'a' : 'div');
    el.className = 'score-card' + (item.isLive ? ' is-live' : '');

    if (hasLink) {
      el.href = item.gameUrl;
    }

    return el;
  }

  function renderCard(item) {
    if (item.singleLine) {
      const card = createScoreCardElement(item);
      card.classList.add('is-placeholder');
      if (item.gameUrl) {
        card.setAttribute('aria-label', `${item.label} game center`);
      }
      card.innerHTML = `<span>${item.label}</span>`;
      return card;
    }

    const card = createScoreCardElement(item);
    if (item.gameUrl) {
      card.setAttribute(
        'aria-label',
        `${item.away.abbr} vs ${item.home.abbr} game center`
      );
    }

    const logoClass = (headshot) => (headshot ? 'score-logo is-headshot' : 'score-logo');
    const showScores = item.status.cls !== 'is-scheduled' || item.away.score || item.home.score;

    card.innerHTML = `
      <div class="score-teams">
        <div class="score-row">
          ${item.away.logo ? `<img class="${logoClass(item.away.headshot)}" src="${item.away.logo}" alt="" loading="lazy" draggable="false" />` : `<span class="${logoClass(item.away.headshot)}" aria-hidden="true"></span>`}
          <span class="score-abbr">${item.away.abbr}</span>
          ${showScores ? `<span class="score-val">${item.away.score ?? ''}</span>` : ''}
        </div>
        <div class="score-row">
          ${item.home.logo ? `<img class="${logoClass(item.home.headshot)}" src="${item.home.logo}" alt="" loading="lazy" draggable="false" />` : `<span class="${logoClass(item.home.headshot)}" aria-hidden="true"></span>`}
          <span class="score-abbr">${item.home.abbr}</span>
          ${showScores ? `<span class="score-val">${item.home.score ?? ''}</span>` : ''}
        </div>
      </div>
      <div class="score-meta">
        <span class="score-status ${item.status.cls}">${item.status.text}</span>
        ${item.broadcast ? `<span class="score-broadcast">${item.broadcast}</span>` : ''}
      </div>
    `;
    return card;
  }

  function renderPlaceholder(message, type) {
    const card = document.createElement('div');
    card.className = `score-card is-${type}`;
    card.textContent = message;
    return card;
  }

  function getHubHref(leagueKey) {
    const page = LEAGUE_HUBS[leagueKey];
    if (!page) return '#';
    return `${getPathPrefix()}${page}`;
  }

  function renderOrganizer(leagueKey, label) {
    const link = document.createElement('a');
    link.className = 'ticker-organizer';
    link.href = getHubHref(leagueKey);
    link.setAttribute('aria-label', `${label} hub`);

    const text = document.createElement('span');
    text.className = 'ticker-organizer-label';
    if (label.length > 6) text.classList.add('is-long');
    text.textContent = label;

    link.appendChild(text);
    return link;
  }

  function renderSection(section) {
    const wrap = document.createElement('div');
    wrap.className = 'ticker-section';
    wrap.dataset.league = section.league;

    wrap.appendChild(renderOrganizer(section.league, section.label));

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'ticker-section-cards';

    if (section.cards.length) {
      section.cards.forEach((c) => cardsWrap.appendChild(renderCard(c)));
    } else {
      cardsWrap.appendChild(renderPlaceholder('No matches scheduled today', 'placeholder'));
    }

    wrap.appendChild(cardsWrap);
    return wrap;
  }

  function renderTrack(sections, error) {
    track.innerHTML = '';
    if (error) {
      track.appendChild(renderPlaceholder('Unable to load scores', 'error'));
      return;
    }
    if (!sections || !sections.length) {
      track.appendChild(renderPlaceholder('No matches scheduled today', 'placeholder'));
      return;
    }
    sections.forEach((section) => track.appendChild(renderSection(section)));
  }

  async function refresh() {
    try {
      const sections = await loadSections(activeFilter);
      renderTrack(sections, false);
    } catch (_) {
      renderTrack(null, true);
    }
  }

  // Scroll arrows
  const leftBtn = ticker.querySelector('.ticker-arrow-left');
  const rightBtn = ticker.querySelector('.ticker-arrow-right');
  if (leftBtn) {
    leftBtn.addEventListener('click', () => {
      track.scrollBy({ left: -260, behavior: 'smooth' });
    });
  }
  if (rightBtn) {
    rightBtn.addEventListener('click', () => {
      track.scrollBy({ left: 260, behavior: 'smooth' });
    });
  }

  // Touch / mouse drag scroll
  track.addEventListener('mousedown', (e) => {
    if (e.target.closest('a.ticker-organizer, a.score-card')) return;
    isDragging = true;
    dragStartX = e.pageX;
    scrollStart = track.scrollLeft;
    track.classList.add('is-dragging');
  });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    track.scrollLeft = scrollStart - (e.pageX - dragStartX);
  });
  window.addEventListener('mouseup', () => {
    isDragging = false;
    track.classList.remove('is-dragging');
  });

  track.addEventListener('touchstart', (e) => {
    dragStartX = e.touches[0].pageX;
    scrollStart = track.scrollLeft;
  }, { passive: true });
  track.addEventListener('touchmove', (e) => {
    track.scrollLeft = scrollStart - (e.touches[0].pageX - dragStartX);
  }, { passive: true });

  refresh();
  refreshTimer = setInterval(refresh, REFRESH_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(refreshTimer);
    } else {
      refresh();
      refreshTimer = setInterval(refresh, REFRESH_MS);
    }
  });
})();
