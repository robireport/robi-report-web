(function (global) {
  'use strict';

  const LINKABLE_SPORTS = new Set(['nba', 'wnba', 'nfl', 'mlb', 'soccer', 'ufc']);

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isLinkableSport(sport) {
    return LINKABLE_SPORTS.has(String(sport || '').toLowerCase());
  }

  function buildPlayerUrl(athleteId, sport, gameId) {
    const params = new URLSearchParams({
      id: String(athleteId),
      sport: String(sport).toLowerCase(),
    });
    if (gameId) params.set('gameId', String(gameId));
    return `player.html?${params.toString()}`;
  }

  function navigateToPlayer(athleteId, sport, gameId) {
    if (!athleteId || !isLinkableSport(sport)) return;
    window.location.assign(buildPlayerUrl(athleteId, sport, gameId));
  }

  function renderPlayerName(name, athleteId, sport, gameId, options) {
    const opts = options || {};
    const displayName = String(name ?? '').trim() || '—';
    const id = athleteId ? String(athleteId) : '';

    if (!id || displayName === '—' || !isLinkableSport(sport)) {
      return escapeHtml(displayName);
    }

    const extraClass = opts.extraClass ? ` ${opts.extraClass}` : '';
    const gameAttr = gameId ? escapeHtml(String(gameId)) : '';

    return (
      `<button type="button" class="player-profile-link${extraClass}"` +
      ` data-athlete-id="${escapeHtml(id)}"` +
      ` data-sport="${escapeHtml(String(sport).toLowerCase())}"` +
      ` data-game-id="${gameAttr}"` +
      `>${escapeHtml(displayName)}</button>`
    );
  }

  function init(container) {
    const root =
      container ||
      document.getElementById('game-content') ||
      document.getElementById('game-app') ||
      document.body;

    if (!root || root.dataset.playerLinksBound === 'true') return root;
    root.dataset.playerLinksBound = 'true';

    root.addEventListener('click', (event) => {
      const trigger = event.target.closest('.player-profile-link[data-athlete-id]');
      if (!trigger || !root.contains(trigger)) return;

      const athleteId = trigger.dataset.athleteId;
      const sport = trigger.dataset.sport;
      const gameId = trigger.dataset.gameId || '';
      if (!athleteId || !sport) return;

      event.preventDefault();
      navigateToPlayer(athleteId, sport, gameId);
    });

    return root;
  }

  global.PlayerLinks = {
    init,
    renderPlayerName,
    buildPlayerUrl,
    navigateToPlayer,
    isLinkableSport,
  };

  function bindGameContainer() {
    init(document.getElementById('game-content') || document.getElementById('game-app'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindGameContainer);
  } else {
    bindGameContainer();
  }
})(window);
