(function (global) {
  'use strict';

  const { escapeHtml, formatGameTime } = global.GameShared;

  const SEGMENT_LABELS = {
    main: 'Main Card',
    prelims: 'Prelims',
    early: 'Early Prelims',
  };

  const SCOREBOARD_BASE = {
    ufc: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',
    boxing: 'https://site.api.espn.com/apis/site/v2/sports/boxing/scoreboard',
  };

  function collectCompetitions(data) {
    if (!data) return [];

    if (Array.isArray(data.competitions) && data.competitions.length) {
      return [...data.competitions];
    }

    const nested = (data.events || []).flatMap((event) => event.competitions || []);
    if (nested.length) return nested;

    return [];
  }

  function normalizeEventPayload(data) {
    if (!data) return null;

    const competitions = collectCompetitions(data);
    if (!competitions.length) return null;

    const firstEvent = (data.events || [])[0];
    return {
      id: data.id || firstEvent?.id || '',
      name: data.name || firstEvent?.name || data.shortName || firstEvent?.shortName || '',
      shortName: data.shortName || firstEvent?.shortName || '',
      date: data.date || firstEvent?.date || competitions[0]?.date || '',
      status: data.status || firstEvent?.status || competitions[0]?.status,
      competitions,
    };
  }

  async function fetchCombatCard(sport, gameId) {
    const base = SCOREBOARD_BASE[sport];
    if (!base || !gameId) return null;

    try {
      const directRes = await fetch(`${base}/${encodeURIComponent(gameId)}`);
      if (directRes.ok) {
        const directData = await directRes.json();
        const normalized = normalizeEventPayload(directData);
        if (normalized) return normalized;
      } else if (directRes.status !== 404) {
        console.warn(`${sport} card HTTP ${directRes.status} for event ${gameId}`);
      }

      const listRes = await fetch(base);
      if (!listRes.ok) {
        console.warn(`${sport} scoreboard HTTP ${listRes.status}`);
        return null;
      }

      const list = await listRes.json();
      const event = (list.events || []).find((ev) => String(ev.id) === String(gameId));
      if (!event) return null;

      return normalizeEventPayload({
        ...event,
        competitions: event.competitions || [],
      });
    } catch (err) {
      console.warn(`${sport} card fetch failed:`, err);
      return null;
    }
  }

  function renderFighterName(name, athleteId, sport, gameId) {
    if (global.PlayerLinks?.renderPlayerName) {
      return global.PlayerLinks.renderPlayerName(name, athleteId, sport, gameId, {
        extraClass: 'combat-fighter-link',
      });
    }
    return escapeHtml(name);
  }

  function getCompetitors(fight) {
    return [...(fight.competitors || [])].sort(
      (a, b) => (a.order || 99) - (b.order || 99)
    );
  }

  function getRecord(competitor) {
    return (
      competitor?.records?.find((r) => r.type === 'total')?.summary ||
      competitor?.records?.[0]?.summary ||
      ''
    );
  }

  function getWeightClass(fight) {
    return fight.type?.abbreviation || fight.type?.text || fight.note || 'Catchweight';
  }

  function getResultMethod(fight) {
    const details = fight.details || [];
    const resultDetail = details.find((detail) => {
      const typeId = String(detail?.type?.id || '');
      return typeId === '20' || typeId === '21' || typeId === '22';
    });

    if (!resultDetail) return '';

    const text = resultDetail.type?.text || '';
    if (/submission/i.test(text)) return 'SUB';
    if (/kotko|knockout|tko/i.test(text)) return 'KO/TKO';
    if (/decision/i.test(text)) return 'U Dec';
    return text.replace(/^Unofficial Winner\s+/i, '').trim();
  }

  function getResultTiming(fight) {
    const status = fight.status || {};
    const state = status.type?.state;
    if (state !== 'post') return '';

    const period = status.period;
    const clock = status.displayClock;
    if (period && clock) return `R${period} ${clock}`;
    if (period) return `R${period}`;
    return '';
  }

  function getFightStatus(fight) {
    const status = fight.status?.type || {};
    const state = status.state;

    if (state === 'in') {
      const clock = fight.status?.displayClock || '';
      const period = fight.status?.period ? `R${fight.status.period}` : '';
      return [period, clock, status.shortDetail || status.detail || 'Live']
        .filter(Boolean)
        .join(' · ');
    }

    if (state === 'post') {
      const method = getResultMethod(fight);
      const timing = getResultTiming(fight);
      return [method, timing].filter(Boolean).join(' · ');
    }

    return status.shortDetail || status.detail || 'Scheduled';
  }

  function getFightStartKey(fight) {
    return fight.startDate || fight.date || '';
  }

  function inferSegmentKey(startKey, uniqueStarts) {
    if (!startKey) return 'main';
    if (uniqueStarts.length <= 1) return 'main';

    const index = uniqueStarts.indexOf(startKey);
    if (index === -1) return 'main';
    if (index <= 0) return 'early';
    if (index >= uniqueStarts.length - 1) return 'main';
    return 'prelims';
  }

  function sortFights(items) {
    return items.sort((a, b) => {
      const af = a.fight;
      const bf = b.fight;
      const featuredDiff =
        Number(Boolean(bf.status?.featured)) - Number(Boolean(af.status?.featured));
      if (featuredDiff !== 0) return featuredDiff;

      const roundsDiff =
        (bf.format?.regulation?.periods || 0) - (af.format?.regulation?.periods || 0);
      if (roundsDiff !== 0) return roundsDiff;

      const orderDiff = (bf.order || 0) - (af.order || 0);
      if (orderDiff !== 0) return orderDiff;

      return b.index - a.index;
    });
  }

  function parseCombatCard(data) {
    const competitions = collectCompetitions(data).map((fight, index) => ({
      fight,
      index,
      startKey: getFightStartKey(fight),
    }));

    if (!competitions.length) return [];

    const uniqueStarts = [
      ...new Set(competitions.map((item) => item.startKey).filter(Boolean)),
    ].sort();

    const segments = {
      main: [],
      prelims: [],
      early: [],
    };

    competitions.forEach((item) => {
      const segment = inferSegmentKey(item.startKey, uniqueStarts);
      segments[segment].push(item);
    });

    const sections = [
      { key: 'main', label: SEGMENT_LABELS.main, fights: sortFights(segments.main) },
      { key: 'prelims', label: SEGMENT_LABELS.prelims, fights: sortFights(segments.prelims) },
      { key: 'early', label: SEGMENT_LABELS.early, fights: sortFights(segments.early) },
    ].filter((section) => section.fights.length);

    const assigned = sections.reduce((sum, section) => sum + section.fights.length, 0);
    if (assigned === competitions.length) return sections;

    return [
      {
        key: 'full',
        label: 'Full Card',
        fights: sortFights([...competitions]),
      },
    ];
  }

  function renderFighter(competitor, gameId, fightState, sport) {
    const athlete = competitor?.athlete || {};
    const name = athlete.displayName || athlete.shortName || 'TBD';
    const athleteId = competitor?.id || athlete.id || '';
    const record = getRecord(competitor);
    const flag = athlete.flag?.href || '';
    const isComplete = fightState === 'post';
    const isWinner = isComplete && Boolean(competitor?.winner);
    const isLoser = isComplete && competitor?.winner === false;

    return `
      <div class="combat-fighter${isWinner ? ' is-winner' : ''}${isLoser ? ' is-loser' : ''}">
        <div class="combat-fighter-top">
          ${flag ? `<img class="combat-fighter-flag" src="${escapeHtml(flag)}" alt="" loading="lazy" />` : ''}
          <div class="combat-fighter-name">${renderFighterName(name, athleteId, sport, gameId)}</div>
          ${isWinner ? '<span class="combat-fighter-badge" aria-label="Winner">W</span>' : ''}
        </div>
        ${record ? `<div class="combat-fighter-record">${escapeHtml(record)}</div>` : ''}
      </div>
    `;
  }

  function renderFightRow(fight, gameId, sport) {
    const competitors = getCompetitors(fight);
    const fighterOne = competitors[0];
    const fighterTwo = competitors[1];
    const weightClass = getWeightClass(fight);
    const resultText = getFightStatus(fight);
    const state = fight.status?.type?.state || 'pre';
    const stateClass =
      state === 'post' ? 'is-final' : state === 'in' ? 'is-live' : 'is-scheduled';

    return `
      <article class="combat-fight-row">
        <div class="combat-fight-weight">${escapeHtml(weightClass)}</div>
        <div class="combat-fight-matchup">
          ${fighterOne ? renderFighter(fighterOne, gameId, state, sport) : '<div class="combat-fighter"><div class="combat-fighter-name">TBD</div></div>'}
          <div class="combat-fight-divider" aria-hidden="true">vs</div>
          ${fighterTwo ? renderFighter(fighterTwo, gameId, state, sport) : '<div class="combat-fighter"><div class="combat-fighter-name">TBD</div></div>'}
        </div>
        <div class="combat-fight-result ${stateClass}">${escapeHtml(resultText)}</div>
      </article>
    `;
  }

  function renderCardSegment(section, gameId, sport) {
    const rows = section.fights
      .map(({ fight }) => renderFightRow(fight, gameId, sport))
      .join('');

    return `
      <section class="combat-card-segment" data-segment="${escapeHtml(section.key)}">
        <header class="combat-card-segment-header">
          <h3>${escapeHtml(section.label)}</h3>
          <span class="combat-card-segment-count">${section.fights.length} bout${section.fights.length === 1 ? '' : 's'}</span>
        </header>
        <div class="combat-fight-list">${rows}</div>
      </section>
    `;
  }

  function renderCombatHero(data, cfg) {
    const title = data?.name || data?.shortName || cfg.label;
    const status = data?.status?.type || {};
    const statusText = status.shortDetail || status.detail || 'Upcoming';
    const dateText = data?.date ? formatGameTime(data.date) : '';
    const fightCount = collectCompetitions(data).length;

    return `
      <section class="game-hero combat-hero">
        <div class="game-hero-inner">
          <div class="game-hero-meta">
            <span>${escapeHtml(cfg.label)}</span>
            ${fightCount ? `<span>${fightCount} bouts</span>` : ''}
          </div>
          <h1 class="combat-event-title">${escapeHtml(title)}</h1>
          <div class="game-status">${escapeHtml(statusText)}</div>
          ${dateText ? `<p class="combat-event-date">${escapeHtml(dateText)}</p>` : ''}
        </div>
      </section>
    `;
  }

  function renderCombatCard(data, gameId, sport) {
    const sections = parseCombatCard(data);
    const body = sections.map((section) => renderCardSegment(section, gameId, sport)).join('');

    return `
      <section class="game-view-card combat-card">
        <div class="game-view-card-header"><h2>Fight Card</h2></div>
        <div class="combat-card-body">
          ${
            body ||
            '<p class="boxscore-empty">Check back soon for bout details.</p>'
          }
        </div>
      </section>
    `;
  }

  function renderFallback(cfg) {
    return `
      <section class="game-view-card combat-fallback">
        <div class="game-view-card-header"><h2>Upcoming Cards</h2></div>
        <p class="boxscore-empty">Check back soon for ${escapeHtml(cfg.label)} cards, schedules, and results.</p>
        <p class="combat-fallback-sub">
          <a href="${escapeHtml(cfg.hub)}">Browse ${escapeHtml(cfg.label)} coverage</a>
        </p>
      </section>
    `;
  }

  async function renderCombatPage(ctx) {
    const { cfg, sport, gameId, els } = ctx;
    const heroEl = document.getElementById('game-hero');
    const mainEl = document.getElementById('game-main');
    const lineupSidebarEl = document.getElementById('game-lineup-sidebar');
    const videoSidebarEl = document.getElementById('game-video-sidebar');

    if (lineupSidebarEl) lineupSidebarEl.innerHTML = '';
    if (videoSidebarEl) videoSidebarEl.innerHTML = '';

    const isCombatSport = sport === 'ufc' || sport === 'boxing';

    if (isCombatSport && gameId) {
      const card = await fetchCombatCard(sport, gameId);
      if (card && collectCompetitions(card).length) {
        document.title = `${card.name || cfg.label} — Robi Report`;
        if (heroEl) heroEl.innerHTML = renderCombatHero(card, cfg);
        if (mainEl) mainEl.innerHTML = renderCombatCard(card, gameId, sport);
        if (global.PlayerLinks) global.PlayerLinks.init(els?.content || document);
        return;
      }
    }

    document.title = `${cfg.label} — Robi Report`;
    if (heroEl) heroEl.innerHTML = renderCombatHero({ name: 'Upcoming Cards' }, cfg);
    if (mainEl) mainEl.innerHTML = renderFallback(cfg);
  }

  global.GameCombat = {
    fetchCombatCard,
    parseCombatCard,
    renderCombatPage,
    // Back-compat for any callers/tests
    fetchUfcCard: (gameId) => fetchCombatCard('ufc', gameId),
    parseUfcCard: parseCombatCard,
  };
})(window);
