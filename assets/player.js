(function () {
  'use strict';

  const SPORT_CONFIG = {
    wnba: { category: 'basketball', league: 'wnba', hub: 'wnba.html', label: 'WNBA' },
    nba: { category: 'basketball', league: 'nba', hub: 'nba.html', label: 'NBA' },
    nfl: { category: 'football', league: 'nfl', hub: 'nfl.html', label: 'NFL' },
    mlb: { category: 'baseball', league: 'mlb', hub: 'mlb.html', label: 'MLB' },
    soccer: { category: 'soccer', league: 'eng.1', hub: 'soccer.html', label: 'Premier League' },
    ufc: { category: 'mma', league: 'ufc', hub: 'ufc.html', label: 'UFC' },
    boxing: { category: 'mma', league: 'ufc', hub: 'boxing.html', label: 'Boxing' },
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
  const seasonParam = params.get('season');

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
    if (val === null || val === undefined || val === '') return placeholder || '-';
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
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_) {
      return '-';
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

  function buildUrls(cfg, id, gamelogSeasonYear) {
    const siteBase = `https://site.api.espn.com/apis/common/v3/sports/${cfg.category}/${cfg.league}/athletes/${id}`;
    const seasonYear = gamelogSeasonYear || currentSeasonYear();
    return {
      siteAthlete: siteBase,
      overview: `${siteBase}/overview`,
      coreAthlete: `https://sports.core.api.espn.com/v2/sports/${cfg.category}/leagues/${cfg.league}/athletes/${id}`,
      stats: `${siteBase}/stats`,
      gamelog: `${siteBase}/gamelog?season=${seasonYear}`,
      summary: (eventId) =>
        `https://site.api.espn.com/apis/site/v2/sports/${cfg.category}/${cfg.league}/summary?event=${eventId}`,
    };
  }

  function playerProfileUrl(id, extraParams) {
    const q = new URLSearchParams({ id: String(id), sport });
    if (extraParams) {
      Object.entries(extraParams).forEach(([k, v]) => {
        if (v != null && v !== '') q.set(k, String(v));
      });
    }
    return `player.html?${q.toString()}`;
  }

  function parseAwards(overviewData) {
    const raw = overviewData?.awards || [];
    const career = [];
    const byYear = new Map();

    raw.forEach((award) => {
      const name = award.name || award.displayName || '';
      if (!name) return;
      career.push({
        name,
        displayCount: award.displayCount || '',
        seasons: (award.seasons || []).map(String),
      });
      (award.seasons || []).forEach((seasonYear) => {
        const y = parseInt(String(seasonYear), 10);
        if (!y) return;
        if (!byYear.has(y)) byYear.set(y, []);
        byYear.get(y).push(name);
      });
    });

    byYear.forEach((list, y) => {
      byYear.set(
        y,
        [...new Set(list)].sort((a, b) => a.localeCompare(b))
      );
    });

    return { career, byYear };
  }

  function abbreviateAward(name) {
    const shortcuts = {
      'Rookie of the Year': 'ROY',
      'Most Improved Player': 'MIP',
      'Defensive Player of the Year': 'DPOY',
      'Sixth Man of the Year': '6MOY',
      'All-Rookie 1st Team': 'All-Rookie 1st',
      'All-Rookie 2nd Team': 'All-Rookie 2nd',
    };
    if (shortcuts[name]) return shortcuts[name];
    return name.replace(/ Team$/, '').replace(/^All-NBA /, 'NBA ');
  }

  function annotateSeasonAwards(rows, awardsByYear) {
    return rows.map((row) => {
      const list = awardsByYear.get(row.year) || [];
      let seasonAwards = [];
      if (list.length) {
        if (row.isSeasonTotal) {
          seasonAwards = list;
        } else {
          const hasTotal = rows.some((r) => r.year === row.year && r.isSeasonTotal);
          if (!hasTotal) seasonAwards = list;
        }
      }
      return { ...row, seasonAwards };
    });
  }

  function resolveSelectedSeason(seasonQuery, avgRows) {
    if (!seasonQuery || !avgRows.length) return null;
    const q = decodeURIComponent(seasonQuery).trim().toLowerCase();
    const match =
      avgRows.find((r) => r.season.toLowerCase() === q) ||
      avgRows.find((r) => String(r.year) === q) ||
      avgRows.find((r) => r.season.toLowerCase().replace(/\s+/g, '') === q.replace(/\s+/g, ''));
    if (!match) return null;
    return { displayName: match.season, year: match.year };
  }

  function findSeasonAverageRow(avgRows, year) {
    const yearRows = avgRows.filter((r) => r.year === year);
    return yearRows.find((r) => r.isSeasonTotal) || yearRows[0] || null;
  }

  function computeSeasonHighs(gamelogData, labels) {
    const { rows } = parseGamelog(gamelogData);
    if (!rows.length) return [];
    const track = [
      { key: 'PTS', label: 'Points' },
      { key: 'REB', label: 'Rebounds' },
      { key: 'AST', label: 'Assists' },
    ];
    const highs = [];
    track.forEach(({ key, label }) => {
      const idx = labels.indexOf(key);
      if (idx < 0) return;
      let best = null;
      rows.forEach((row) => {
        const raw = row.stats[idx];
        const num = parseFloat(String(raw).replace(/[^\d.-]/g, ''));
        if (Number.isNaN(num)) return;
        if (!best || num > best.value) {
          best = { value: num, display: fallback(raw), date: row.date, opponent: row.opponent, atVs: row.atVs };
        }
      });
      if (best) highs.push({ label, ...best });
    });
    return highs;
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

  function parseShootingHand(athlete, core) {
    const hand = athlete?.hand || core?.hand;
    if (!hand) return '';

    const raw =
      hand.displayValue ||
      hand.displayName ||
      hand.abbreviation ||
      hand.type ||
      (typeof hand === 'string' ? hand : '');
    const normalized = String(raw).trim();
    if (!normalized) return '';

    const map = {
      left: 'Left',
      right: 'Right',
      both: 'Both',
      l: 'Left',
      r: 'Right',
      b: 'Both',
    };
    const mapped = map[normalized.toLowerCase()] || normalized;
    if (!/^(left|right|both)$/i.test(mapped)) return '';
    return `Shoots: ${mapped.charAt(0).toUpperCase()}${mapped.slice(1).toLowerCase()}`;
  }

  function parseNicknames(athlete, core) {
    const names = [];
    const push = (value) => {
      const cleaned = String(value ?? '').trim();
      if (!cleaned) return;
      if (!names.some((n) => n.toLowerCase() === cleaned.toLowerCase())) {
        names.push(cleaned);
      }
    };

    for (const src of [athlete, core]) {
      if (!src) continue;
      for (const key of ['nicknames', 'nickname', 'nickName', 'alternateDisplayName', 'displayNickName']) {
        const val = src[key];
        if (Array.isArray(val)) val.forEach(push);
        else if (val) push(val);
      }
    }

    const displayName = athlete?.displayName || core?.displayName || '';
    const fullName = athlete?.fullName || core?.fullName || '';
    const paren = fullName.match(/\(([^)]+)\)/);
    if (paren?.[1]) push(paren[1]);

    if (displayName && fullName && displayName !== fullName) {
      const stripped = fullName.replace(displayName, '').trim();
      if (stripped.startsWith('(') && stripped.endsWith(')')) {
        push(stripped.slice(1, -1));
      }
    }

    return names.filter((n) => n.length > 1);
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
      nicknames: parseNicknames(a, c),
      shootingHand: parseShootingHand(a, c),
    };
  }

  function padStatsArray(stats, len) {
    const out = (stats || []).slice();
    while (out.length < len) out.push('');
    return out;
  }

  function statGamesPlayed(labels, stats) {
    const i = labels.indexOf('GP');
    if (i < 0) return null;
    const v = stats[i];
    if (v === undefined || v === null || v === '') return null;
    const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
    return Number.isNaN(n) ? null : n;
  }

  function statsCategoryMode(categoryName) {
    return categoryName.includes('Averages') ? 'avg' : 'tot';
  }

  function buildZeroStatsForLabels(labels, mode) {
    return labels.map((label) => {
      if (label === 'GP' || label === 'GS') return '0';
      if (label.includes('%')) return '';
      if (label === 'FG' || label === '3PT' || label === 'FT') return '0-0';
      if (label === 'MIN' && mode === 'avg') return '0.0';
      if (/^(MIN|PTS|REB|AST|STL|BLK|TO|OR|DR|PF)$/.test(label)) return '0';
      return '0';
    });
  }

  function seasonDisplayFromLabelStart(labelStart, league, sampleDisplayNames) {
    const year = labelStart + 1;
    const usesHyphenSeason = (sampleDisplayNames || []).some((name) => /^\d{4}-\d{2}$/.test(name));
    if (usesHyphenSeason || league === 'nba' || league === 'nfl') {
      return { year, displayName: `${labelStart}-${String(labelStart + 1).slice(-2)}` };
    }
    return { year, displayName: String(year) };
  }

  function expandTeamHistorySeasons(teamHistory, league, sampleDisplayNames) {
    const expected = [];
    for (const stint of teamHistory || []) {
      const range = stint.seasons || '';
      const teamId = stint.id != null ? String(stint.id) : null;
      const teamSlug = stint.slug || '';
      const parts = range.split('-').map((p) => parseInt(p, 10));
      if (parts.length < 2 || !parts[0] || !parts[1]) continue;
      const [start, end] = parts;
      for (let labelStart = start; labelStart < end; labelStart += 1) {
        const season = seasonDisplayFromLabelStart(labelStart, league, sampleDisplayNames);
        expected.push({ ...season, teamId, teamSlug });
      }
    }
    return expected;
  }

  function inactiveNoteForSeason(siteAthlete, seasonYear) {
    const injuries = siteAthlete?.athlete?.injuries || [];
    if (!injuries.length) return 'DNP - Injury';
    const currentYear = currentSeasonYear();
    if (seasonYear < currentYear - 1) return 'DNP - Injury';
    const inj = injuries[0];
    const detail = inj?.details?.type || inj?.shortComment?.split(' ').slice(0, 3).join(' ') || 'Injury';
    return `DNP - ${detail}`;
  }

  function applyCareerTimelineEnrichment(statsData, siteAthlete, bioData, league) {
    if (!statsData?.categories?.length) return statsData;

    const avgCat = statsData.categories.find((c) => c.displayName === 'Regular Season Averages');
    const sampleNames = (avgCat?.statistics || []).map((s) => s.season?.displayName).filter(Boolean);
    const teamHistory = bioData?.teamHistory || [];
    let expected = expandTeamHistorySeasons(teamHistory, league, sampleNames);

    const athlete = siteAthlete?.athlete;
    const currentTeam = athlete?.team;
    if (currentTeam?.id) {
      const y = currentSeasonYear();
      const displayName =
        avgCat?.statistics?.find((s) => s.season?.year === y)?.season?.displayName ||
        seasonDisplayFromLabelStart(y - 1, league, sampleNames).displayName;
      expected.push({
        year: y,
        displayName,
        teamId: String(currentTeam.id),
        teamSlug: currentTeam.slug || '',
      });
    }

    const seen = new Set();
    expected = expected.filter((e) => {
      const key = `${e.year}|${e.teamId || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const enrichCategory = (cat) => {
      if (!cat?.statistics || !cat.labels?.length) return;
      const labels = cat.labels;
      const mode = statsCategoryMode(cat.displayName);
      const hasGp = labels.includes('GP');

      const hasRow = (year, teamId) =>
        cat.statistics.some((s) => {
          if (s.season?.year !== year) return false;
          if (/totals/i.test(s.teamSlug || '')) return false;
          if (teamId && String(s.teamId) !== String(teamId)) return false;
          return true;
        });

      expected.forEach((exp) => {
        if (hasRow(exp.year, exp.teamId)) return;
        cat.statistics.push({
          teamId: exp.teamId,
          teamSlug: exp.teamSlug,
          season: { year: exp.year, displayName: exp.displayName },
          stats: buildZeroStatsForLabels(labels, mode),
          _robiInactive: true,
          _robiInactiveNote: inactiveNoteForSeason(siteAthlete, exp.year),
        });
      });

      cat.statistics = cat.statistics.map((s) => {
        const stats = padStatsArray(s.stats, labels.length);
        const gp = hasGp ? statGamesPlayed(labels, stats) : null;
        const isInactive = Boolean(s._robiInactive) || gp === 0;
        if (!isInactive) return { ...s, stats };
        return {
          ...s,
          stats: buildZeroStatsForLabels(labels, mode),
          _robiInactive: true,
          _robiInactiveNote: s._robiInactiveNote || inactiveNoteForSeason(siteAthlete, s.season?.year),
        };
      });
    };

    statsData.categories.forEach((cat) => {
      if (cat.displayName === 'Regular Season Averages' || cat.displayName === 'Regular Season Totals') {
        enrichCategory(cat);
      }
    });

    return statsData;
  }

  function formatCareerStatDisplay(row, label, value) {
    if (!row.isInactiveSeason) return fallback(value);
    if (label === 'GP') {
      return row.inactiveNote || '0';
    }
    if (label.includes('%') || value === '' || value === null || value === undefined) return '-';
    if (label === 'FG' || label === '3PT' || label === 'FT') return '0-0';
    if (label === 'MIN' && row.statsMode === 'avg') return '0.0';
    if (/^(GS|MIN|PTS|REB|AST|STL|BLK|TO|OR|DR|PF)$/.test(label)) return '0';
    return '-';
  }

  function parseStatsCategory(statsData, categoryName) {
    const cat = statsData?.categories?.find((c) => c.displayName === categoryName);
    if (!cat) return { labels: [], rows: [] };

    const labels = cat.labels || [];
    const mode = statsCategoryMode(categoryName);
    const rows = (cat.statistics || [])
      .map((s) => {
        const teamSlug = s.teamSlug || '';
        const teamId = s.teamId != null && s.teamId !== '' ? String(s.teamId) : null;
        const stats = padStatsArray(s.stats, labels.length);
        const gp = statGamesPlayed(labels, stats);
        const isInactiveSeason = Boolean(s._robiInactive) || gp === 0;
        return {
          season: s.season?.displayName || String(s.season?.year || '-'),
          year: s.season?.year || 0,
          stats: isInactiveSeason ? buildZeroStatsForLabels(labels, mode) : stats,
          teamId,
          teamSlug,
          isSeasonTotal: !teamId && /totals/i.test(teamSlug),
          isInactiveSeason,
          inactiveNote: isInactiveSeason ? s._robiInactiveNote || 'DNP - Injury' : '',
          statsMode: mode,
        };
      })
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        if (a.isSeasonTotal && !b.isSeasonTotal) return 1;
        if (b.isSeasonTotal && !a.isSeasonTotal) return -1;
        return (a.teamSlug || '').localeCompare(b.teamSlug || '');
      });

    return { labels, rows };
  }

  function statAt(labels, stats, label) {
    const i = labels.indexOf(label);
    return i >= 0 ? fallback(stats[i]) : '-';
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

  function slugToAbbrFallback(teamSlug) {
    if (!teamSlug || /totals/i.test(teamSlug)) return '';
    const parts = teamSlug.split('-').filter(Boolean);
    if (!parts.length) return '';
    const last = parts[parts.length - 1];
    if (last.length <= 4) return last.toUpperCase();
    return parts
      .map((p) => p[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
  }

  function renderTeamCell(row, teamMap) {
    if (row.isSeasonTotal) {
      return '<td class="player-team-cell"><span class="player-team-total">Total</span></td>';
    }
    if (!row.teamId) {
      return '<td class="player-team-cell"><span class="player-team-abbr">—</span></td>';
    }
    const meta = teamMap?.get(row.teamId);
    const abbr = meta?.abbr || slugToAbbrFallback(row.teamSlug) || '-';
    const logo = meta?.logo || '';
    const logoHtml = logo
      ? `<img class="player-team-logo" src="${escapeHtml(logo)}" alt="" width="24" height="24" loading="lazy" />`
      : '';
    return `<td class="player-team-cell"><span class="player-team-chip">${logoHtml}<span class="player-team-abbr">${escapeHtml(abbr)}</span></span></td>`;
  }

  async function fetchTeamLogoMap(cfg, rows) {
    const ids = [...new Set((rows || []).map((r) => r.teamId).filter(Boolean))];
    const map = new Map();
    await Promise.all(
      ids.map(async (id) => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.category}/${cfg.league}/teams/${id}`;
        const data = await fetchJsonSafe(url);
        const team = data?.team;
        if (!team) return;
        map.set(id, {
          abbr: team.abbreviation || team.shortDisplayName || '',
          logo: getTeamLogo(team),
          name: team.displayName || team.shortDisplayName || '',
        });
      })
    );
    return map;
  }

  function renderAwardsCell(awardNames) {
    if (!awardNames?.length) {
      return '<td class="player-awards-cell"><span class="player-awards-empty">—</span></td>';
    }
    const chips = awardNames
      .map(
        (name) =>
          `<span class="player-award-chip" title="${escapeHtml(name)}">${escapeHtml(abbreviateAward(name))}</span>`
      )
      .join('');
    return `<td class="player-awards-cell"><div class="player-awards-chips">${chips}</div></td>`;
  }

  function buildStatsTable(labels, rows, firstColLabel, firstColFn, highlightLabels, tableOpts) {
    if (!rows.length) {
      return '<div class="player-empty">Statistics not available.</div>';
    }

    const opts = tableOpts || {};
    const teamMap = opts.teamMap;
    const showAwards = opts.showAwards;
    const seasonLinks = opts.seasonLinks;
    const highlight = new Set(highlightLabels || []);
    const teamHead = teamMap ? '<th>Team</th>' : '';
    const awardsHead = showAwards ? '<th>Awards</th>' : '';
    const head = labels.map((l) => `<th>${escapeHtml(l)}</th>`).join('');
    const body = rows
      .map((row) => {
        let first = firstColFn(row);
        if (seasonLinks && !row.isSeasonTotal && row.season) {
          const href = playerProfileUrl(playerId, { season: row.season });
          first = `<a class="player-season-link" href="${escapeHtml(href)}">${escapeHtml(row.season)}</a>`;
        }
        const teamCell = teamMap ? renderTeamCell(row, teamMap) : '';
        const awardsCell = showAwards ? renderAwardsCell(row.seasonAwards) : '';
        const cells = row.stats
          .map((v, i) => {
            const label = labels[i];
            const display = formatCareerStatDisplay(row, label, v);
            let cls = highlight.has(label) ? 'stat-highlight' : '';
            if (row.isInactiveSeason && (label === 'GP' || display.startsWith('DNP'))) {
              cls = cls ? `${cls} player-stat-inactive` : 'player-stat-inactive';
            }
            const clsAttr = cls ? ` class="${cls}"` : '';
            return `<td${clsAttr}>${escapeHtml(display)}</td>`;
          })
          .join('');
        let rowCls = '';
        if (opts.highlightYear && row.year === opts.highlightYear) rowCls = 'player-season-row-active';
        if (row.isInactiveSeason) rowCls = rowCls ? `${rowCls} player-season-row-inactive` : 'player-season-row-inactive';
        const rowClsAttr = rowCls ? ` class="${rowCls}"` : '';
        return `<tr${rowClsAttr}><td class="player-name">${first}</td>${teamCell}${awardsCell}${cells}</tr>`;
      })
      .join('');

    return `<div class="player-table-wrap"><table class="player-table"><thead><tr><th>${escapeHtml(firstColLabel)}</th>${teamHead}${awardsHead}${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function buildFilteredStatsTable(allLabels, rows, wantedCols, firstColLabel, firstColFn, tableOpts) {
    if (!rows.length) {
      return '<div class="player-empty">Statistics not available.</div>';
    }

    const { indices, labels } = filterColumns(allLabels, wantedCols);
    if (!labels.length) {
      return '<div class="player-empty">Statistics not available.</div>';
    }

    const filteredRows = rows.map((row) => ({
      ...row,
      stats: indices.map((i) => row.stats[i] ?? '-'),
    }));

    return buildStatsTable(labels, filteredRows, firstColLabel, firstColFn, ['PTS', 'REB', 'AST'], tableOpts);
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
            opponent: meta.opponent?.abbreviation || meta.opponent?.displayName || '-',
            atVs: meta.atVs || '',
            result: meta.gameResult || '-',
            score: meta.score || '-',
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
          : '-';

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
      awayScore: away?.score ?? '-',
      homeScore: home?.score ?? '-',
      status: comp.status?.type?.shortDetail || comp.status?.type?.detail || '',
      date: comp.date,
    };
  }

  function renderHeroAwards(careerAwards) {
    if (!careerAwards?.length) return '';
    const badges = careerAwards
      .map(
        (a) =>
          `<span class="player-award-badge" title="${escapeHtml(a.name)}"><span class="player-award-badge-name">${escapeHtml(a.name)}</span>${a.displayCount ? `<span class="player-award-badge-count">${escapeHtml(a.displayCount)}</span>` : ''}</span>`
      )
      .join('');
    return `
      <aside class="player-hero-awards" aria-labelledby="player-awards-heading">
        <h2 id="player-awards-heading">Awards &amp; Honors</h2>
        <div class="player-award-badges">${badges}</div>
      </aside>
    `;
  }

  function renderHero(bio, cfg, careerAwards) {
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
    const awardsHtml = renderHeroAwards(careerAwards);

    return `
      <section class="player-hero" style="--team-color:${escapeHtml(bio.teamColor)};">
        <div class="player-hero-bg"></div>
        <div class="player-hero-inner${awardsHtml ? ' player-hero-inner--with-awards' : ''}">
          <div class="player-headshot-wrap">${headshotHtml}</div>
          <div class="player-hero-main">
            <div class="player-hero-meta">
              <span>${escapeHtml(cfg.label)}</span>
              ${bio.position ? `<span>${escapeHtml(bio.position)}</span>` : ''}
              ${bio.jersey ? `<span>#${escapeHtml(bio.jersey)}</span>` : ''}
              ${bio.shootingHand ? `<span>${escapeHtml(bio.shootingHand)}</span>` : ''}
              <span class="${statusCls}">${escapeHtml(fallback(bio.status, 'Unknown'))}</span>
            </div>
            <h1 class="player-name">${escapeHtml(bio.name)}</h1>
            ${
              bio.nicknames?.length
                ? `<p class="player-nickname">${bio.nicknames
                    .map((n) => `"${escapeHtml(n)}"`)
                    .join(' · ')}</p>`
                : ''
            }
            ${
              bio.teamName
                ? `<div class="player-team-row">
              ${bio.teamLogo ? `<img src="${escapeHtml(bio.teamLogo)}" alt="" />` : ''}
              <span>${escapeHtml(bio.teamName)}</span>
            </div>`
                : ''
            }
          </div>
          ${awardsHtml}
        </div>
      </section>
    `;
  }

  function renderSeasonBanner(selectedSeason) {
    const backHref = playerProfileUrl(playerId);
    return `
      <section class="player-season-banner">
        <a class="player-season-back" href="${escapeHtml(backHref)}">← Full career profile</a>
        <h2>${escapeHtml(selectedSeason.displayName)} <span>Season Summary</span></h2>
      </section>
    `;
  }

  function renderSeasonMilestones(awards, highs) {
    const awardItems = (awards || [])
      .map((name) => `<li>${escapeHtml(name)}</li>`)
      .join('');
    const highItems = (highs || [])
      .map(
        (h) =>
          `<li><strong>${escapeHtml(h.label)}:</strong> ${escapeHtml(h.display)} <span class="player-milestone-meta">(${escapeHtml(formatGameDate(h.date))} ${escapeHtml(h.atVs)} ${escapeHtml(h.opponent)})</span></li>`
      )
      .join('');

    if (!awardItems && !highItems) {
      return '<div class="player-empty">No milestones recorded for this season.</div>';
    }

    return `
      <div class="player-season-milestones">
        ${
          awardItems
            ? `<div class="player-milestone-block"><h3>Awards</h3><ul>${awardItems}</ul></div>`
            : ''
        }
        ${
          highItems
            ? `<div class="player-milestone-block"><h3>Season highs</h3><ul>${highItems}</ul></div>`
            : ''
        }
      </div>
    `;
  }

  function renderBioSidebar(bio, videos) {
    const videoHtml = window.VideoSidebar
      ? window.VideoSidebar.render(videos, `${bio.name.split(' ').pop() || 'Player'} Highlights`)
      : '';

    const items = [
      ['Height', bio.height],
      ['Weight', bio.weight],
      ...(bio.shootingHand
        ? [['Shoots', bio.shootingHand.replace(/^Shoots:\s*/i, '')]]
        : []),
      ['Born', bio.dob],
      ['Birthplace', bio.birthPlace],
      ['College', bio.college],
      ['Draft', bio.draft],
      ['Status', bio.status],
    ];

    return `
      <aside class="player-sidebar">
        ${videoHtml}
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

  function renderPage({
    bio,
    statsData,
    gamelogData,
    summaryData,
    cfg,
    videos,
    teamMap,
    awards,
    selectedSeason,
  }) {
    const avgCategory = parseStatsCategory(statsData, 'Regular Season Averages');
    const totalsCategory = parseStatsCategory(statsData, 'Regular Season Totals');
    const avgRows = annotateSeasonAwards(avgCategory.rows, awards.byYear);

    if (selectedSeason) {
      document.title = `${bio.name} (${selectedSeason.displayName}) | Robi Report`;
    } else {
      document.title = `${bio.name} | Robi Report`;
    }

    const careerTableOpts = {
      teamMap,
      showAwards: true,
      seasonLinks: true,
      highlightYear: selectedSeason?.year,
    };

    const careerHtml = buildFilteredStatsTable(
      avgCategory.labels,
      avgRows,
      CAREER_TABLE_COLS,
      'Season',
      (row) => escapeHtml(row.season),
      careerTableOpts
    );

    const totalsHtml = buildFilteredStatsTable(
      totalsCategory.labels,
      totalsCategory.rows,
      ['GP', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK'],
      'Season',
      (row) => escapeHtml(row.season)
    );

    const seasonMode = Boolean(selectedSeason);
    const seasonAvgRow = seasonMode ? findSeasonAverageRow(avgCategory.rows, selectedSeason.year) : null;
    const seasonCard = seasonMode
      ? seasonAvgRow
        ? {
            season: selectedSeason.displayName,
            pills: SEASON_PILL_STATS.map((key) => ({
              label: key,
              value: statAt(avgCategory.labels, seasonAvgRow.stats, key),
            })),
          }
        : null
      : buildSeasonAveragesCard(statsData);

    const gamelogSub = seasonMode ? `${selectedSeason.displayName} Regular Season` : `${currentSeasonYear()} Season`;
    const gamelogHtml = buildGamelogTable(gamelogData);
    const seasonAwards = seasonMode ? awards.byYear.get(selectedSeason.year) || [] : [];
    const seasonHighs = seasonMode ? computeSeasonHighs(gamelogData, gamelogData?.labels || []) : [];

    els.content.innerHTML = `
      ${renderHero(bio, cfg, awards.career)}
      ${seasonMode ? renderSeasonBanner(selectedSeason) : ''}
      <div class="player-layout">
        <div class="player-main">
          ${seasonMode ? '' : renderGamePerformance(summaryData, bio.id)}
          ${renderSeasonAverages(seasonCard)}
          ${
            seasonMode
              ? `<section class="player-card">
            <div class="player-card-header">
              <h2>Milestones</h2>
              <span class="sub">${escapeHtml(selectedSeason.displayName)}</span>
            </div>
            <div class="player-card-body">${renderSeasonMilestones(seasonAwards, seasonHighs)}</div>
          </section>`
              : ''
          }
          <section class="player-card">
            <div class="player-card-header">
              <h2>${seasonMode ? 'Season Game Log' : 'Career Averages'}</h2>
              <span class="sub">${seasonMode ? 'Regular Season' : 'Regular Season · click a season for details'}</span>
            </div>
            ${seasonMode ? gamelogHtml : careerHtml}
          </section>
          ${
            seasonMode
              ? `<section class="player-card">
            <div class="player-card-header">
              <h2>Career Averages</h2>
              <span class="sub">Highlighted: ${escapeHtml(selectedSeason.displayName)}</span>
            </div>
            ${careerHtml}
          </section>`
              : `<section class="player-card">
            <div class="player-card-header">
              <h2>Career Totals</h2>
              <span class="sub">Regular Season</span>
            </div>
            ${totalsHtml}
          </section>
          <section class="player-card">
            <div class="player-card-header">
              <h2>Game Log</h2>
              <span class="sub">${escapeHtml(gamelogSub)}</span>
            </div>
            ${gamelogHtml}
          </section>`
          }
        </div>
        ${renderBioSidebar(bio, videos)}
      </div>
    `;

    if (window.VideoSidebar) window.VideoSidebar.init(els.content);
  }

  async function init() {
    if (!playerId || !SPORT_CONFIG[sport]) {
      showError('Missing or invalid URL parameters. Use ?id={playerId}&sport=nba|wnba|nfl|mlb|soccer|ufc (optional: &gameId={eventId})');
      return;
    }

    const cfg = SPORT_CONFIG[sport];

    const newsUrl = `https://site.api.espn.com/apis/site/v2/sports/${cfg.category}/${cfg.league}/news?limit=50`;

    const [siteAthlete, coreAthlete, statsDataRaw, bioData, overviewData, summaryData, newsData] = await Promise.all([
      fetchJsonSafe(`https://site.api.espn.com/apis/common/v3/sports/${cfg.category}/${cfg.league}/athletes/${playerId}`),
      fetchJsonSafe(`https://sports.core.api.espn.com/v2/sports/${cfg.category}/leagues/${cfg.league}/athletes/${playerId}`),
      fetchJsonSafe(`https://site.api.espn.com/apis/common/v3/sports/${cfg.category}/${cfg.league}/athletes/${playerId}/stats`),
      fetchJsonSafe(`https://site.api.espn.com/apis/common/v3/sports/${cfg.category}/${cfg.league}/athletes/${playerId}/bio`),
      fetchJsonSafe(`https://site.api.espn.com/apis/common/v3/sports/${cfg.category}/${cfg.league}/athletes/${playerId}/overview`),
      gameId
        ? fetchJsonSafe(
            `https://site.api.espn.com/apis/site/v2/sports/${cfg.category}/${cfg.league}/summary?event=${gameId}`
          )
        : Promise.resolve(null),
      fetchJsonSafe(newsUrl),
    ]);

    const statsData = applyCareerTimelineEnrichment(statsDataRaw, siteAthlete, bioData, cfg.league);

    const avgCategoryPreview = parseStatsCategory(statsData, 'Regular Season Averages');
    const selectedSeason = resolveSelectedSeason(seasonParam, avgCategoryPreview.rows);
    const gamelogSeasonYear = selectedSeason?.year || currentSeasonYear();
    const urls = buildUrls(cfg, playerId, gamelogSeasonYear);
    const gamelogData = await fetchJsonSafe(urls.gamelog);

    if (!siteAthlete?.athlete && !coreAthlete?.displayName && !coreAthlete?.fullName) {
      showError(`Player not found (ID: ${playerId}). Verify the player ID and league (sport=${sport}).`);
      return;
    }

    const bio = mergeBio(siteAthlete, coreAthlete);

    const recentEventIds = parseGamelog(gamelogData)
      .rows.slice(0, 3)
      .map((row) => row.eventId)
      .filter((id) => id && id !== gameId);

    const extraSummaries = recentEventIds.length
      ? await Promise.all(recentEventIds.map((id) => fetchJsonSafe(urls.summary(id))))
      : [];

    const videos = window.VideoSidebar
      ? await window.VideoSidebar.collectPlayerVideos({
          bio,
          athleteId: bio.id,
          summaryData,
          extraSummaries: extraSummaries.filter(Boolean),
          newsData,
        })
      : [];

    const avgRows = avgCategoryPreview.rows;
    const teamMap = await fetchTeamLogoMap(cfg, avgRows);
    const awards = parseAwards(overviewData);

    hideLoading();
    renderPage({
      bio,
      statsData,
      gamelogData,
      summaryData,
      cfg,
      videos,
      teamMap,
      awards,
      selectedSeason,
    });

    const ticker = document.getElementById('score-ticker');
    if (ticker) {
      const tickerSportMap = {
        nba: 'nba',
        wnba: 'wnba',
        nfl: 'nfl',
        mlb: 'mlb',
        ufc: 'ufc',
        soccer: 'epl',
      };
      if (tickerSportMap[sport]) ticker.dataset.default = tickerSportMap[sport];
    }
  }

  init();
})();
