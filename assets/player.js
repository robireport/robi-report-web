(function () {
  'use strict';

  const SPORT_CONFIG = {
    wnba: { category: 'basketball', league: 'wnba', hub: 'wnba.html', label: 'WNBA' },
    nba: { category: 'basketball', league: 'nba', hub: 'nba.html', label: 'NBA' },
  };

  const SEASON_PILL_STATS = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'MIN', 'FG%', '3P%', 'FT%'];
  const GAME_PERF_STATS = ['PTS', 'REB', 'AST', 'STL', 'BLK', '+/-'];
  const CAREER_TABLE_COLS = ['GP', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG%', '3P%', 'FT%'];
  const GAMELOG_COLS = ['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FG', '3PT', 'FT'];

  const els = {
    loading: document.getElementById('player-loading'),
    error: document.getElementById('player-error'),
    errorMsg: document.getElementById('player-error-msg'),
    content: document.getElementById('player-content'),
  };

  if (!els.loading || !els.content) return;

  const params = new URLSearchParams(window.location.search);
  const playerId = params.get('id');
  const gameId = params.get('gameId');
  const sport = (params.get('sport') || 'wnba').toLowerCase();

  function showError(msg) {
    els.loading.classList.add('hidden');
    els.content.classList.add('hidden');
    els.error.classList.remove('hidden');
    if (els.errorMsg) els.errorMsg.textContent = msg;
  }

  function hideLoading() {
    els.loading.classList.add('hidden');
    els.error.classList.add('hidden');
    els.content.classList.remove('hidden');
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fallback(val, placeholder) {
    if (val === null || val === undefined || val === '') return placeholder || '—';
    return val;
  }

  function formatDob(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_) {
      return '';
    }
  }

  function formatGameDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_) {
      return '—';
    }
  }

  function currentSeasonYear() {
    return new Date().getFullYear();
  }

  async function fetchJsonSafe(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('Fetch failed:', url, err);
      return null;
    }
  }

  function buildUrls(cfg, id) {
    const siteBase = `https://site.api.espn.com/apis/common/v3/sports/${cfg.category}/${cfg.league}/athletes/${id}`;
    return {
      siteAthlete: siteBase,
      coreAthlete: `https://sports.core.api.espn.com/v2/sports/${cfg.category}/leagues/${cfg.league}/athletes/${id}`,
      stats: `${siteBase}/stats`,
      gamelog: `${siteBase}/gamelog?season=${currentSeasonYear()}`,
      summary: (eventId) =>
        `https://site.api.espn.com/apis/site/v2/sports/${cfg.category}/${cfg.league}/summary?event=${eventId}`,
    };
  }

  function getTeamLogo(team) {
    if (!team?.logos?.length) return '';
    return (
      team.logos.find((l) => l.rel?.includes('default'))?.href ||
      team.logos[0]?.href ||
      ''
    );
  }

  function getTeamColor(team) {
    const c = team?.color;
    if (!c) return '#266092';
    return c.startsWith('#') ? c : `#${c}`;
  }

  function mergeBio(siteData, coreData) {
    const a = siteData?.athlete || {};
    const c = coreData || {};
    const team = a.team || {};

    let birthPlace = a.displayBirthPlace;
    if (!birthPlace && c.birthPlace) {
      const bp = c.birthPlace;
      birthPlace = [bp.city, bp.state || bp.country].filter(Boolean).join(', ');
    }

    const active = a.active ?? c.active;
    const statusName = a.status?.abbreviation || a.status?.name || (active === false ? 'Inactive' : 'Active');

    return {
      id: a.id || c.id || playerId,
      name: a.displayName || a.fullName || c.displayName || c.fullName || 'Unknown Player',
      headshot: a.headshot?.href || c.headshot?.href || '',
      position: a.position?.abbreviation || a.position?.displayName || c.position?.abbreviation || '',
      jersey: a.jersey || c.jersey || '',
      teamName: team.displayName || team.shortDisplayName || '',
      teamLogo: getTeamLogo(team),
      teamColor: getTeamColor(team),
      height: a.displayHeight || c.displayHeight || '',
      weight: a.displayWeight || c.displayWeight || '',
      dob: a.displayDOB || formatDob(c.dateOfBirth) || '',
      birthPlace: birthPlace || '',
      college: a.college?.shortName || a.college?.name || c.college?.name || '',
      draft: a.displayDraft || '',
      active,
      status: statusName,
    };
  }

  function parseStatsCategory(statsData, categoryName) {
    const cat = statsData?.categories?.find((c) => c.displayName === categoryName);
    if (!cat) return { labels: [], rows: [] };

    const labels = cat.labels || [];
    const rows = (cat.statistics || [])
      .map((s) => ({
        season: s.season?.displayName || String(s.season?.year || '—'),
        year: s.season?.year || 0,
        stats: s.stats || [],
      }))
      .sort((a, b) => b.year - a.year);

    return { labels, rows };
  }

  function statAt(labels, stats, label) {
    const i = labels.indexOf(label);
    return i >= 0 ? fallback(stats[i]) : '—';
  }

  function filterColumns(labels, wanted) {
    const indices = [];
    const filtered = [];
    wanted.forEach((w) => {
      const i = labels.indexOf(w);
      if (i >= 0) {
        indices.push(i);
        filtered.push(w);
      }
    });
    return { indices, labels: filtered };
  }

  function buildStatsTable(labels, rows, firstColLabel, firstColFn, highlightLabels) {
    if (!rows.length) {
      return '<div class="player-empty">Statistics not available.</div>';
    }

    const highlight = new Set(highlightLabels || []);
    const head = labels.map((l) => `<th>${escapeHtml(l)}</th>`).join('');
    const body = rows
      .map((row) => {
        const first = firstColFn(row);
        const cells = row.stats
          .map((v, i) => {
            const label = labels[i];
            const cls = highlight.has(label) ? ' class="stat-highlight"' : '';
            return `<td${cls}>${escapeHtml(fallback(v))}</td>`;
          })
          .join('');
        return `<tr><td class="player-name">${first}</td>${cells}</tr>`;
      })
      .join('');

    return `<div class="player-table-wrap"><table class="player-table"><thead><tr><th>${escapeHtml(firstColLabel)}</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function buildFilteredStatsTable(allLabels, rows, wantedCols, firstColLabel, firstColFn) {
    if (!rows.length) {
      return '<div class="player-empty">Statistics not available.</div>';
    }

    const { indices, labels } = filterColumns(allLabels, wantedCols);
    if (!labels.length) {
      return '<div class="player-empty">Statistics not available.</div>';
    }

    const filteredRows = rows.map((row) => ({
      ...row,
      stats: indices.map((i) => row.stats[i] ?? '—'),
    }));

    return buildStatsTable(labels, filteredRows, firstColLabel, firstColFn, ['PTS', 'REB', 'AST']);
  }

  function buildSeasonAveragesCard(statsData) {
    const { labels, rows } = parseStatsCategory(statsData, 'Regular Season Averages');
    if (!rows.length) return null;

    const latest = rows[0];
    const pills = SEASON_PILL_STATS.map((key) => ({
      label: key,
      value: statAt(labels, latest.stats, key),
    }));

    return { season: latest.season, pills };
  }

  function parseGamelog(gamelogData) {
    const labels = gamelogData?.labels || [];
    const eventsMap = gamelogData?.events || {};
    const gameRows = [];

    for (const st of gamelogData?.seasonTypes || []) {
      for (const cat of st.categories || []) {
        for (const ev of cat.events || []) {
          const meta = eventsMap[ev.eventId] || {};
          gameRows.push({
            eventId: ev.eventId,
            date: meta.gameDate,
            opponent: meta.opponent?.abbreviation || meta.opponent?.displayName || '—',
            atVs: meta.atVs || '',
            result: meta.gameResult || '—',
            score: meta.score || '—',
            stats: ev.stats || [],
          });
        }
      }
    }

    gameRows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return { labels, rows: gameRows };
  }

  function buildGamelogTable(gamelogData) {
    const { labels, rows } = parseGamelog(gamelogData);
    if (!rows.length) {
      return '<div class="player-empty">No game log entries for this season.</div>';
    }

    const { indices, labels: displayLabels } = filterColumns(labels, GAMELOG_COLS);
    const head = displayLabels.map((l) => `<th>${escapeHtml(l)}</th>`).join('');

    const body = rows
      .map((row) => {
        const opp = `${escapeHtml(row.atVs)} ${escapeHtml(row.opponent)}`;
        const resultCls = row.result === 'W' ? 'result-w' : row.result === 'L' ? 'result-l' : '';
        const statCells = indices.map((i) => `<td>${escapeHtml(fallback(row.stats[i]))}</td>`).join('');
        const gameLink = row.eventId
          ? `<a class="game-link" href="game.html?sport=${escapeHtml(sport)}&gameId=${escapeHtml(row.eventId)}">Box</a>`
          : '—';

        return `<tr>
          <td class="player-name">${escapeHtml(formatGameDate(row.date))}</td>
          <td>${opp}</td>
          <td class="${resultCls}">${escapeHtml(row.result)}</td>
          <td>${escapeHtml(row.score)}</td>
          ${statCells}
          <td>${gameLink}</td>
        </tr>`;
      })
      .join('');

    return `<div class="player-table-wrap"><table class="player-table"><thead><tr><th>Date</th><th>Opp</th><th>W/L</th><th>Score</th>${head}<th></th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function findPlayerInSummary(summaryData, id) {
    const pid = String(id);
    for (const tg of summaryData?.boxscore?.players || []) {
      for (const block of tg.statistics || []) {
        for (const row of block.athletes || []) {
          if (String(row.athlete?.id || '') === pid) {
            return {
              labels: block.labels || [],
              stats: row.stats || [],
              team: tg.team,
            };
          }
        }
      }
    }
    return null;
  }

  function getGameMeta(summaryData) {
    const comp = summaryData?.header?.competitions?.[0] || {};
    const away = comp.competitors?.find((c) => c.homeAway === 'away');
    const home = comp.competitors?.find((c) => c.homeAway === 'home');
    return {
      away: away?.team?.displayName || away?.team?.abbreviation || 'Away',
      home: home?.team?.displayName || home?.team?.abbreviation || 'Home',
      awayScore: away?.score ?? '—',
      homeScore: home?.score ?? '—',
      status: comp.status?.type?.shortDetail || comp.status?.type?.detail || '',
      date: comp.date,
    };
  }

  function renderHero(bio, cfg) {
    const initials = bio.name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const headshotHtml = bio.headshot
      ? `<img class="player-headshot" src="${escapeHtml(bio.headshot)}" alt="${escapeHtml(bio.name)}" loading="lazy" />`
      : `<div class="player-headshot-fallback" aria-hidden="true">${escapeHtml(initials)}</div>`;

    const statusCls = bio.active !== false ? 'status-active' : 'status-inactive';

    return `
      <section class="player-hero" style="--team-color:${escapeHtml(bio.teamColor)};">
        <div class="player-hero-bg"></div>
        <div class="player-hero-inner">
          <div class="player-headshot-wrap">${headshotHtml}</div>
          <div class="player-hero-main">
            <div class="player-hero-meta">
              <span>${escapeHtml(cfg.label)}</span>
              ${bio.position ? `<span>${escapeHtml(bio.position)}</span>` : ''}
              ${bio.jersey ? `<span>#${escapeHtml(bio.jersey)}</span>` : ''}
              <span class="${statusCls}">${escapeHtml(fallback(bio.status, 'Unknown'))}</span>
            </div>
            <h1 class="player-name">${escapeHtml(bio.name)}</h1>
            ${
              bio.teamName
                ? `<div class="player-team-row">
              ${bio.teamLogo ? `<img src="${escapeHtml(bio.teamLogo)}" alt="" />` : ''}
              <span>${escapeHtml(bio.teamName)}</span>
            </div>`
                : ''
            }
          </div>
        </div>
      </section>
    `;
  }

  function renderBioSidebar(bio) {
    const items = [
      ['Height', bio.height],
      ['Weight', bio.weight],
      ['Born', bio.dob],
      ['Birthplace', bio.birthPlace],
      ['College', bio.college],
      ['Draft', bio.draft],
      ['Status', bio.status],
    ];

    return `
      <aside class="player-sidebar">
        <section class="player-card">
          <div class="player-card-header"><h2>Biography</h2></div>
          <ul class="player-bio-list">
            ${items
              .map(
                ([label, value]) =>
                  `<li><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(fallback(value))}</span></li>`
              )
              .join('')}
          </ul>
        </section>
      </aside>
    `;
  }

  function renderSeasonAverages(card) {
    if (!card) {
      return `
        <section class="player-card">
          <div class="player-card-header"><h2>Season Averages</h2></div>
          <div class="player-empty">Season averages not available.</div>
        </section>
      `;
    }

    return `
      <section class="player-card">
        <div class="player-card-header">
          <h2>Season Averages</h2>
          <span class="sub">${escapeHtml(card.season)} Regular Season</span>
        </div>
        <div class="player-card-body">
          <div class="player-stat-grid">
            ${card.pills
              .map(
                (p) =>
                  `<div class="player-stat-pill"><span class="val">${escapeHtml(p.value)}</span><span class="lbl">${escapeHtml(p.label)}</span></div>`
              )
              .join('')}
          </div>
        </div>
      </section>
    `;
  }

  function renderGamePerformance(summaryData, id) {
    if (!gameId) return '';

    const perf = findPlayerInSummary(summaryData, id);
    const meta = summaryData ? getGameMeta(summaryData) : null;

    if (!summaryData) {
      return `
        <section class="player-card">
          <div class="player-card-header"><h2>Game Performance</h2></div>
          <div class="player-empty">Could not load game data for event ${escapeHtml(gameId)}.</div>
        </section>
      `;
    }

    if (!perf) {
      return `
        <section class="player-card">
          <div class="player-card-header"><h2>Game Performance</h2></div>
          <div class="player-empty">This player did not appear in the box score for this game.</div>
          <p class="player-game-meta">
            <a class="player-game-link" href="game.html?sport=${escapeHtml(sport)}&gameId=${escapeHtml(gameId)}">View full box score →</a>
          </p>
        </section>
      `;
    }

    const pills = GAME_PERF_STATS.map((key) => ({
      label: key,
      value: statAt(perf.labels, perf.stats, key),
    }));

    return `
      <section class="player-card">
        <div class="player-card-header">
          <h2>Game Performance</h2>
          <span class="sub">Event ${escapeHtml(gameId)}</span>
        </div>
        ${
          meta
            ? `<p class="player-game-meta">
          <strong>${escapeHtml(meta.away)} ${escapeHtml(String(meta.awayScore))} – ${escapeHtml(String(meta.homeScore))} ${escapeHtml(meta.home)}</strong><br />
          ${escapeHtml(formatGameDate(meta.date))}${meta.status ? ` · ${escapeHtml(meta.status)}` : ''}
        </p>`
            : ''
        }
        <div class="player-card-body">
          <div class="player-game-perf">
            ${pills
              .map(
                (p) =>
                  `<div class="player-stat-pill"><span class="val">${escapeHtml(p.value)}</span><span class="lbl">${escapeHtml(p.label)}</span></div>`
              )
              .join('')}
          </div>
          <a class="player-game-link" href="game.html?sport=${escapeHtml(sport)}&gameId=${escapeHtml(gameId)}">View full box score →</a>
        </div>
      </section>
    `;
  }

  function renderPage({ bio, statsData, gamelogData, summaryData, cfg }) {
    document.title = `${bio.name} — Robi Report`;

    const seasonCard = buildSeasonAveragesCard(statsData);
    const avgCategory = parseStatsCategory(statsData, 'Regular Season Averages');
    const totalsCategory = parseStatsCategory(statsData, 'Regular Season Totals');

    const careerHtml = buildFilteredStatsTable(
      avgCategory.labels,
      avgCategory.rows,
      CAREER_TABLE_COLS,
      'Season',
      (row) => escapeHtml(row.season)
    );

    const totalsHtml = buildFilteredStatsTable(
      totalsCategory.labels,
      totalsCategory.rows,
      ['GP', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK'],
      'Season',
      (row) => escapeHtml(row.season)
    );

    const gamelogHtml = buildGamelogTable(gamelogData);

    els.content.innerHTML = `
      ${renderHero(bio, cfg)}
      <div class="player-layout">
        <div class="player-main">
          ${renderGamePerformance(summaryData, bio.id)}
          ${renderSeasonAverages(seasonCard)}
          <section class="player-card">
            <div class="player-card-header">
              <h2>Career Averages</h2>
              <span class="sub">Regular Season</span>
            </div>
            ${careerHtml}
          </section>
          <section class="player-card">
            <div class="player-card-header">
              <h2>Career Totals</h2>
              <span class="sub">Regular Season</span>
            </div>
            ${totalsHtml}
          </section>
          <section class="player-card">
            <div class="player-card-header">
              <h2>Game Log</h2>
              <span class="sub">${currentSeasonYear()} Season</span>
            </div>
            ${gamelogHtml}
          </section>
        </div>
        ${renderBioSidebar(bio)}
      </div>
    `;
  }

  async function init() {
    if (!playerId || !SPORT_CONFIG[sport]) {
      showError('Missing or invalid URL parameters. Use ?id={playerId}&sport=wnba (optional: &gameId={eventId})');
      return;
    }

    const cfg = SPORT_CONFIG[sport];
    const urls = buildUrls(cfg, playerId);

    const [siteAthlete, coreAthlete, statsData, gamelogData, summaryData] = await Promise.all([
      fetchJsonSafe(urls.siteAthlete),
      fetchJsonSafe(urls.coreAthlete),
      fetchJsonSafe(urls.stats),
      fetchJsonSafe(urls.gamelog),
      gameId ? fetchJsonSafe(urls.summary(gameId)) : Promise.resolve(null),
    ]);

    if (!siteAthlete?.athlete && !coreAthlete?.displayName && !coreAthlete?.fullName) {
      showError(`Player not found (ID: ${playerId}). Verify the player ID and league (sport=${sport}).`);
      return;
    }

    const bio = mergeBio(siteAthlete, coreAthlete);
    hideLoading();
    renderPage({ bio, statsData, gamelogData, summaryData, cfg });

    const ticker = document.getElementById('score-ticker');
    if (ticker) {
      if (sport === 'wnba') ticker.dataset.default = 'wnba';
      if (sport === 'nba') ticker.dataset.default = 'nba';
    }
  }

  init();
})();
