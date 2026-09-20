(function (global) {
  'use strict';

  const { escapeHtml } = global.GameShared;

  const POSITION_GROUPS = [
    { key: 'forwards', title: 'Forwards' },
    { key: 'midfielders', title: 'Midfielders' },
    { key: 'defenders', title: 'Defenders' },
    { key: 'goalkeepers', title: 'Goalkeepers' },
  ];

  const OUTFIELD_COLS = [
    { label: 'TCH', keys: ['touches', 'TCH'] },
    { label: 'G', keys: ['totalGoals', 'G'] },
    { label: 'A', keys: ['goalAssists', 'A'] },
    { label: 'xG', keys: ['expectedGoals', 'xG'] },
    { label: 'xA', keys: ['expectedAssists', 'xA'] },
    { label: 'SOG', keys: ['shotsOnTarget', 'SOG'] },
    { label: 'SHOT', keys: ['totalShots', 'SHOT'] },
    { label: 'BCC', keys: ['bigChancesCreated', 'BCC'] },
    { label: 'DINT', keys: ['dispossessed', 'DINT', 'interceptions'] },
    { label: 'DUELW', keys: ['duelsWon', 'DUELW'] },
  ];

  const GK_COLS = [
    { label: 'GA', keys: ['goalsConceded', 'GA'] },
    { label: 'SV', keys: ['saves', 'SV'] },
    { label: 'SOGA', keys: ['shotsOnGoalAgainst', 'SOGA', 'shotsFaced', 'SHF'] },
    { label: 'xG C', keys: ['expectedGoalsConceded', 'xGC', 'xGConceded'] },
    { label: 'GP', keys: ['appearances', 'APP', 'GP'] },
    { label: 'BCC', keys: ['bigChancesCreated', 'BCC'] },
    { label: 'CLR', keys: ['clearances', 'CLR'] },
    { label: 'CC', keys: ['crossesClaimed', 'CC'] },
    { label: 'KS', keys: ['keeperSweeper', 'KS', 'sweeperKeeper'] },
  ];

  const FORMATION_COORDS = {
    1: { x: 50, y: 88 },
    2: { x: 12, y: 70 },
    3: { x: 32, y: 73 },
    4: { x: 68, y: 73 },
    5: { x: 88, y: 70 },
    6: { x: 32, y: 52 },
    7: { x: 68, y: 52 },
    8: { x: 12, y: 32 },
    9: { x: 50, y: 28 },
    10: { x: 88, y: 32 },
    11: { x: 50, y: 10 },
  };

  function getTeamLogo(team) {
    return (
      team?.logo ||
      team?.logos?.find((l) => l.rel?.includes('default'))?.href ||
      team?.logos?.[0]?.href ||
      ''
    );
  }

  function getStatValue(player, col) {
    for (const stat of player.stats || []) {
      if (col.keys.includes(stat.name) || col.keys.includes(stat.abbreviation)) {
        const val = stat.displayValue ?? stat.value;
        return val === undefined || val === null || val === '' ? '—' : String(val);
      }
    }
    return '—';
  }

  function getPositionGroup(player) {
    const abbr = (player.position?.abbreviation || '').toUpperCase();
    const name = (player.position?.name || '').toLowerCase();

    if (abbr === 'SUB') {
      const goals = Number(getStatValue(player, { keys: ['totalGoals', 'G'] })) || 0;
      const shots = Number(getStatValue(player, { keys: ['totalShots', 'SHOT'] })) || 0;
      const saves = Number(getStatValue(player, { keys: ['saves', 'SV'] })) || 0;
      if (saves > 0) return 'goalkeepers';
      if (goals > 0 || shots > 0) return 'forwards';
      return 'midfielders';
    }

    if (abbr === 'G' || name.includes('goalkeeper')) return 'goalkeepers';
    if (abbr === 'F' || name.includes('forward')) return 'forwards';
    if (
      ['AM', 'AM-L', 'AM-R', 'LM', 'RM', 'CM', 'DM', 'M', 'MF'].some(
        (p) => abbr === p || abbr.startsWith(`${p}-`)
      ) ||
      name.includes('midfield')
    ) {
      return 'midfielders';
    }
    if (
      ['CD-L', 'CD-R', 'LB', 'RB', 'CB', 'D', 'DF'].some(
        (p) => abbr === p || abbr.startsWith(`${p}-`)
      ) ||
      name.includes('defend') ||
      name.includes('back')
    ) {
      return 'defenders';
    }
    return 'midfielders';
  }

  function groupPlayers(roster) {
    const groups = { forwards: [], midfielders: [], defenders: [], goalkeepers: [] };
    for (const player of roster || []) {
      if (!player.stats?.length && !player.starter) continue;
      const key = getPositionGroup(player);
      groups[key].push(player);
    }
    return groups;
  }

  function renderPlayerRow(player, cols, subMaps) {
    const name = player.athlete?.displayName || player.athlete?.shortName || '—';
    const jersey = player.jersey ? `#${player.jersey} ` : '';
    const athleteId = player.athlete?.id;
    const subInMin = athleteId && subMaps?.subInMinutes?.[athleteId];
    const subOutMin = athleteId && subMaps?.subOutMinutes?.[athleteId];
    const subBadge = subInMin
      ? `<span class="soccer-sub-badge in">${escapeHtml(subInMin)}</span>`
      : subOutMin
        ? `<span class="soccer-sub-badge out">${escapeHtml(subOutMin)}</span>`
        : '';
    const cells = cols.map((col) => `<td>${escapeHtml(getStatValue(player, col))}</td>`).join('');
    return `<tr>
      <td class="player-name">
        <span class="soccer-player-cell">${escapeHtml(jersey + name)}${subBadge}</span>
      </td>
      ${cells}
    </tr>`;
  }

  function renderPositionTable(title, players, cols, subMaps) {
    if (!players.length) {
      return `<section class="boxscore-category">
        <h3 class="boxscore-group-title">${escapeHtml(title)}</h3>
        <div class="boxscore-empty boxscore-category-empty">No ${escapeHtml(title.toLowerCase())} recorded.</div>
      </section>`;
    }

    const head = cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
    const rows = players
      .sort((a, b) => {
        if (a.starter !== b.starter) return a.starter ? -1 : 1;
        return (a.jersey || 99) - (b.jersey || 99);
      })
      .map((p) => renderPlayerRow(p, cols, subMaps))
      .join('');

    return `<section class="boxscore-category">
      <h3 class="boxscore-group-title">${escapeHtml(title)}</h3>
      <div class="boxscore-table-wrap">
        <table class="boxscore-table soccer-boxscore-table">
          <thead><tr><th>Player</th>${head}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
  }

  function renderTeamBoxscore(rosterEntry, subMaps) {
    const team = rosterEntry.team || {};
    const logo = getTeamLogo(team);
    const groups = groupPlayers(rosterEntry.roster || []);

    const tables = POSITION_GROUPS.map(({ key, title }) => {
      const players = groups[key];
      const cols = key === 'goalkeepers' ? GK_COLS : OUTFIELD_COLS;
      return renderPositionTable(title, players, cols, subMaps);
    }).join('');

    return `
      <section class="boxscore-team soccer-boxscore-team">
        <div class="boxscore-team-header">
          ${logo ? `<img src="${escapeHtml(logo)}" alt="" />` : ''}
          <div class="soccer-team-header-meta">
            <h2>${escapeHtml(team.displayName || team.shortDisplayName || 'Team')}</h2>
            ${rosterEntry.formation ? `<span class="soccer-formation-pill">${escapeHtml(rosterEntry.formation)}</span>` : ''}
          </div>
        </div>
        ${tables}
      </section>
    `;
  }

  function parseSubstitutions(keyEvents) {
    return (keyEvents || [])
      .filter((event) => {
        const type = event.type;
        const typeText =
          typeof type === 'string' ? type : type?.type || type?.text || '';
        return String(typeText).toLowerCase().includes('substitution');
      })
      .map((event) => {
        const participants = event.participants || [];
        const playerInAth = participants[0]?.athlete;
        const playerOutAth = participants[1]?.athlete;
        return {
          minute: event.clock?.displayValue || '',
          team: event.team?.displayName || event.team?.abbreviation || '',
          teamId: event.team?.id,
          text: event.text || '',
          playerIn: playerInAth?.displayName || playerInAth?.shortName,
          playerInId: playerInAth?.id,
          playerOut: playerOutAth?.displayName || playerOutAth?.shortName,
          playerOutId: playerOutAth?.id,
        };
      });
  }

  function buildSubMinuteMaps(subs) {
    const subInMinutes = {};
    const subOutMinutes = {};
    for (const sub of subs) {
      if (sub.playerInId) subInMinutes[sub.playerInId] = sub.minute;
      if (sub.playerOutId) subOutMinutes[sub.playerOutId] = sub.minute;
    }
    return { subInMinutes, subOutMinutes };
  }

  function renderPitchPlayers(starters, subMaps) {
    return starters
      .filter((p) => p.formationPlace && FORMATION_COORDS[p.formationPlace])
      .map((p) => {
        const coord = FORMATION_COORDS[p.formationPlace];
        const name = p.athlete?.shortName || p.athlete?.displayName || '';
        const lastName = name.split(' ').pop() || name;
        const subbedOut = p.athlete?.id && subMaps?.subOutMinutes?.[p.athlete.id];
        const subbed = subbedOut ? ' is-subbed-out' : '';
        return `
          <div class="soccer-pitch-player${subbed}" style="left:${coord.x}%;top:${coord.y}%;" title="${escapeHtml(name)}">
            <span class="soccer-pitch-jersey">${escapeHtml(String(p.jersey || ''))}</span>
            <span class="soccer-pitch-name">${escapeHtml(lastName)}</span>
          </div>
        `;
      })
      .join('');
  }

  function renderBenchList(roster, subMaps) {
    const bench = (roster || []).filter((p) => !p.starter);
    if (!bench.length) return '<p class="soccer-bench-empty">No bench listed.</p>';

    return `<ul class="soccer-bench-list">
      ${bench
        .map((p) => {
          const name = p.athlete?.displayName || p.athlete?.shortName || '—';
          const subMin = p.athlete?.id && subMaps?.subInMinutes?.[p.athlete.id];
          const tag = subMin
            ? `<span class="soccer-bench-tag in">${escapeHtml(subMin)}</span>`
            : '';
          return `<li><span class="soccer-bench-num">${escapeHtml(String(p.jersey || '—'))}</span> ${escapeHtml(name)}${tag}</li>`;
        })
        .join('')}
    </ul>`;
  }

  function renderSubsTimeline(subs, teamName) {
    const teamSubs = subs.filter(
      (s) => s.team === teamName || s.text.includes(teamName)
    );
    if (!teamSubs.length) {
      return '<p class="soccer-subs-empty">No substitutions.</p>';
    }

    return `<ul class="soccer-subs-timeline">
      ${teamSubs
        .map(
          (s) => `
        <li class="soccer-sub-event">
          <span class="soccer-sub-minute">${escapeHtml(s.minute)}</span>
          <div class="soccer-sub-detail">
            ${s.playerIn ? `<span class="soccer-sub-in">↑ ${escapeHtml(s.playerIn)}</span>` : ''}
            ${s.playerOut ? `<span class="soccer-sub-out">↓ ${escapeHtml(s.playerOut)}</span>` : ''}
          </div>
        </li>`
        )
        .join('')}
    </ul>`;
  }

  function renderLineupSidebar(data) {
    const rosters = data.rosters || [];
    if (!rosters.length) return '';

    const subs = parseSubstitutions(data.keyEvents);
    const teams = rosters.map((r, i) => ({
      id: String(r.team?.id || i),
      name: r.team?.displayName || r.team?.shortDisplayName || `Team ${i + 1}`,
      abbr: r.team?.abbreviation || r.team?.shortDisplayName || '',
      logo: getTeamLogo(r.team),
      formation: r.formation || '—',
      roster: r.roster || [],
      homeAway: r.homeAway || '',
    }));

    const defaultTeam = teams.find((t) => t.homeAway === 'home') || teams[0];
    const teamOptions = teams
      .map(
        (t) =>
          `<button type="button" class="soccer-lineup-tab${t.id === defaultTeam.id ? ' is-active' : ''}" data-team-id="${escapeHtml(t.id)}" aria-pressed="${t.id === defaultTeam.id ? 'true' : 'false'}">${escapeHtml(t.abbr || t.name)}</button>`
      )
      .join('');

    const subMaps = buildSubMinuteMaps(subs);

    const panels = teams
      .map((t) => {
        const starters = (t.roster || []).filter((p) => p.starter);
        const hidden = t.id !== defaultTeam.id ? ' hidden' : '';
        return `
          <div class="soccer-lineup-panel${hidden}" data-team-panel="${escapeHtml(t.id)}">
            <div class="soccer-lineup-panel-head">
              ${t.logo ? `<img src="${escapeHtml(t.logo)}" alt="" />` : ''}
              <div>
                <strong>${escapeHtml(t.name)}</strong>
                <span class="soccer-formation-pill">${escapeHtml(t.formation)}</span>
              </div>
            </div>
            <div class="soccer-pitch-wrap">
              <div class="soccer-pitch" aria-label="Starting formation">
                <div class="soccer-pitch-markings"></div>
                ${renderPitchPlayers(starters, subMaps)}
              </div>
            </div>
            <div class="soccer-lineup-section">
              <h4>Substitutions</h4>
              ${renderSubsTimeline(subs, t.name)}
            </div>
            <div class="soccer-lineup-section">
              <h4>Bench</h4>
              ${renderBenchList(t.roster, subMaps)}
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="soccer-lineup-widget widget" id="soccer-lineup-widget">
        <div class="widget-header soccer-lineup-header">
          <span>Lineups</span>
          <div class="soccer-lineup-tabs" role="tablist">${teamOptions}</div>
        </div>
        <div class="widget-body soccer-lineup-body">${panels}</div>
      </div>
    `;
  }

  function initLineupSidebar(root) {
    const widget = root?.querySelector('#soccer-lineup-widget');
    if (!widget) return;

    widget.querySelectorAll('.soccer-lineup-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const teamId = tab.dataset.teamId;
        widget.querySelectorAll('.soccer-lineup-tab').forEach((t) => {
          const active = t === tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        widget.querySelectorAll('.soccer-lineup-panel').forEach((panel) => {
          panel.classList.toggle('hidden', panel.dataset.teamPanel !== teamId);
        });
      });
    });
  }

  function renderMain({ data, comp, sport, gameId, els }) {
    const rosters = data.rosters || [];
    const subMaps = buildSubMinuteMaps(parseSubstitutions(data.keyEvents));
    const boxscoreHtml = rosters.length
      ? rosters.map((entry) => renderTeamBoxscore(entry, subMaps)).join('')
      : '<div class="boxscore-empty">Box score will be available once lineups are confirmed.</div>';

    const videos = global.VideoSidebar ? global.VideoSidebar.collectFromSummary(data) : [];
    const videoTitle = global.VideoSidebar
      ? global.VideoSidebar.buildGameVideoTitle(comp)
      : 'GAME HIGHLIGHTS';
    const videoHtml = global.VideoSidebar ? global.VideoSidebar.render(videos, videoTitle) : '';
    const lineupHtml = renderLineupSidebar(data);

    const mainEl = document.getElementById('game-main');
    const videoSidebarEl = document.getElementById('game-video-sidebar');
    const lineupSidebarEl = document.getElementById('game-lineup-sidebar');

    if (mainEl) mainEl.innerHTML = boxscoreHtml;
    if (lineupSidebarEl) lineupSidebarEl.innerHTML = lineupHtml;
    if (videoSidebarEl) videoSidebarEl.innerHTML = videoHtml;
    if (global.VideoSidebar) global.VideoSidebar.init(els.content);
    initLineupSidebar(els.content);
  }

  global.GameSoccer = { renderMain };
})(window);
