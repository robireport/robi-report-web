(function (global) {
  'use strict';

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDuration(seconds) {
    const total = Number(seconds);
    if (!Number.isFinite(total) || total <= 0) return '';
    const mins = Math.floor(total / 60);
    const secs = Math.floor(total % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function formatTimestamp(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch (_) {
      return '';
    }
  }

  const PUBLISHER_LOGO = 'https://robireport.com/assets/Squared%20logo.png';
  const DEFAULT_UPLOAD_DATE = '2024-01-01T00:00:00+00:00';

  function formatUploadDate(value) {
    const cleaned = String(value || '').trim();
    if (!cleaned) return DEFAULT_UPLOAD_DATE;

    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      return `${cleaned}T00:00:00+00:00`;
    }

    try {
      const date = new Date(cleaned);
      if (Number.isNaN(date.getTime())) return DEFAULT_UPLOAD_DATE;
      return date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
    } catch (_) {
      return DEFAULT_UPLOAD_DATE;
    }
  }

  function normalizeVideoName(value, fallbackId) {
    const title = String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s*[—-]\s*Robi Report\s*$/i, '');
    return title || (fallbackId ? `Robi Report video ${fallbackId}` : 'Robi Report video');
  }

  function defaultVideoDescription(name) {
    const cleaned = normalizeVideoName(name);
    if (/robi report\s*$/i.test(cleaned)) {
      return `${cleaned}. Independent sports analysis and original video from Robi Report.`;
    }
    return `${cleaned} — independent sports analysis and original video from Robi Report.`;
  }

  function buildVideoObject(video) {
    const name = normalizeVideoName(video.headline, video.id);
    const description = String(video.description || '').trim() || defaultVideoDescription(name);
    const uploadDate = formatUploadDate(video.published);
    const item = {
      '@type': 'VideoObject',
      name,
      description,
      uploadDate,
      publisher: {
        '@type': 'Organization',
        name: 'Robi Report',
        logo: {
          '@type': 'ImageObject',
          url: PUBLISHER_LOGO,
        },
      },
    };

    if (video.thumbnail) item.thumbnailUrl = video.thumbnail;
    if (video.webUrl) item.contentUrl = video.webUrl;
    else if (video.mp4) item.contentUrl = video.mp4;
    if (video.mp4 || video.hls) item.embedUrl = video.mp4 || video.hls;

    return item;
  }

  function injectVideoSchema(videos) {
    const objects = (videos || [])
      .slice(0, 12)
      .map(buildVideoObject)
      .filter((item) => item.name && item.description && item.uploadDate);

    if (!objects.length) return;

    let script = document.getElementById('robi-video-schema');
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'robi-video-schema';
      document.head.appendChild(script);
    }

    const payload =
      objects.length === 1
        ? { '@context': 'https://schema.org', ...objects[0] }
        : { '@context': 'https://schema.org', '@graph': objects };

    script.textContent = JSON.stringify(payload);
  }

  function getVideoSourceLinks(links) {
    const source = links?.source || {};
    return {
      mp4: source.href || source.HD?.href || links?.mobile?.source?.href || '',
      hls: source.HLS?.href || source.HLS?.HD?.href || '',
      web: links?.web?.href || '',
    };
  }

  function normalizeEspnVideo(raw) {
    if (!raw) return null;

    const links = getVideoSourceLinks(raw.links || {});
    const published = raw.originalPublishDate || raw.lastModified || raw.published || '';

    return {
      id: String(raw.id || ''),
      headline: raw.headline || raw.description || 'Highlight',
      description: raw.description || '',
      duration: Number(raw.duration) || 0,
      thumbnail: raw.thumbnail || raw.images?.[0]?.url || '',
      published,
      mp4: links.mp4,
      hls: links.hls,
      webUrl: links.web,
      tracking: raw.tracking || {},
    };
  }

  function dedupeVideos(videos) {
    const seen = new Set();
    return videos.filter((video) => {
      if (!video?.id || seen.has(video.id)) return false;
      seen.add(video.id);
      return true;
    });
  }

  function sortVideos(videos) {
    return [...videos].sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0));
  }

  function collectFromSummary(summaryData, filterFn) {
    const raw = summaryData?.videos || [];
    return sortVideos(
      dedupeVideos(
        raw
          .map(normalizeEspnVideo)
          .filter(Boolean)
          .filter((video) => (filterFn ? filterFn(video) : true))
      )
    );
  }

  function extractVideoIdFromHref(href) {
    if (!href) return '';
    const match = String(href).match(/\/id\/(\d+)/);
    return match ? match[1] : '';
  }

  function articleMatchesAthlete(article, athleteId) {
    const pid = String(athleteId);
    return (article?.categories || []).some((cat) => {
      const id = cat.athleteId || cat.athlete?.id;
      return String(id || '') === pid;
    });
  }

  function videoMatchesPlayer(video, bio) {
    const parts = String(bio?.name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return true;

    const haystack = [video.headline, video.description, video.tracking?.trackingName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const full = parts.join(' ').toLowerCase();
    const last = parts[parts.length - 1].toLowerCase();

    return haystack.includes(full) || (last.length > 2 && haystack.includes(last));
  }

  function normalizeNewsVideo(article) {
    const webUrl = article?.links?.web?.href || '';
    const id = extractVideoIdFromHref(webUrl);
    if (!id) return null;

    return {
      id,
      headline: article.headline || 'Highlight',
      description: article.description || '',
      duration: 0,
      thumbnail: article.images?.[0]?.url || '',
      published: article.published || article.lastModified || '',
      mp4: '',
      hls: '',
      webUrl,
      tracking: {},
    };
  }

  async function fetchJsonSafe(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  async function enrichVideoClip(video) {
    if (!video?.id || (video.mp4 && video.thumbnail)) return video;

    const data = await fetchJsonSafe(`https://content.core.api.espn.com/v1/video/clips/${video.id}`);
    const normalized = normalizeEspnVideo(data?.videos?.[0]);
    if (!normalized) return video;

    return {
      ...video,
      ...normalized,
      headline: normalized.headline || video.headline,
      thumbnail: normalized.thumbnail || video.thumbnail,
      published: normalized.published || video.published,
    };
  }

  async function collectPlayerVideos({ bio, athleteId, summaryData, extraSummaries, newsData }) {
    let videos = [];

    if (summaryData) {
      videos = videos.concat(
        collectFromSummary(summaryData, (video) => videoMatchesPlayer(video, bio))
      );
    }

    for (const summary of extraSummaries || []) {
      videos = videos.concat(
        collectFromSummary(summary, (video) => videoMatchesPlayer(video, bio))
      );
    }

    const newsVideos = (newsData?.articles || [])
      .filter((article) => article.type === 'Media' && articleMatchesAthlete(article, athleteId))
      .map(normalizeNewsVideo)
      .filter(Boolean);

    videos = dedupeVideos([...videos, ...newsVideos]);

    const needsEnrichment = videos.filter((video) => !video.mp4).slice(0, 8);
    if (needsEnrichment.length) {
      const enriched = await Promise.all(needsEnrichment.map(enrichVideoClip));
      const enrichedMap = new Map(enriched.map((video) => [video.id, video]));
      videos = videos.map((video) => enrichedMap.get(video.id) || video);
    }

    return sortVideos(dedupeVideos(videos));
  }

  function buildGameVideoTitle(comp) {
    const { away, home } = getCompetitors(comp);
    const awayAbbr = away?.team?.abbreviation || away?.team?.shortDisplayName || 'AWY';
    const homeAbbr = home?.team?.abbreviation || home?.team?.shortDisplayName || 'HME';
    return `${awayAbbr} @ ${homeAbbr} VIDEOS`;
  }

  function getCompetitors(comp) {
    const list = comp?.competitors || [];
    return {
      away: list.find((c) => c.homeAway === 'away') || list[0],
      home: list.find((c) => c.homeAway === 'home') || list[1],
    };
  }

  function renderVideoSidebar(videos, title) {
    if (!videos?.length) {
      return `
        <section class="video-sidebar">
          <div class="video-sidebar-header"><h3>${escapeHtml(title || 'Latest Videos')}</h3></div>
          <div class="video-sidebar-empty">No highlights available right now.</div>
        </section>
      `;
    }

    injectVideoSchema(videos);

    const first = videos[0];
    const listHtml = videos
      .map((video, index) => {
        const duration = formatDuration(video.duration);
        const thumb = video.thumbnail
          ? `<img class="video-sidebar-item-thumb" src="${escapeHtml(video.thumbnail)}" alt="" loading="lazy" />`
          : `<div class="video-sidebar-item-thumb-fallback">Clip</div>`;

        return `
          <li>
            <button
              type="button"
              class="video-sidebar-item${index === 0 ? ' is-active' : ''}"
              data-video-id="${escapeHtml(video.id)}"
              data-headline="${escapeHtml(video.headline)}"
              data-thumbnail="${escapeHtml(video.thumbnail)}"
              data-mp4="${escapeHtml(video.mp4)}"
              data-hls="${escapeHtml(video.hls)}"
              data-web="${escapeHtml(video.webUrl)}"
              data-duration="${escapeHtml(duration)}"
              data-published="${escapeHtml(video.published || '')}"
              data-description="${escapeHtml(video.description || '')}"
            >
              <div class="video-sidebar-item-thumb-wrap">
                ${thumb}
                ${duration ? `<span class="video-sidebar-item-dur">${escapeHtml(duration)}</span>` : ''}
              </div>
              <span class="video-sidebar-item-body">
                <span class="video-sidebar-item-title">${escapeHtml(video.headline)}</span>
                <span class="video-sidebar-item-time">${escapeHtml(formatTimestamp(video.published))}</span>
              </span>
            </button>
          </li>
        `;
      })
      .join('');

    const firstDuration = formatDuration(first.duration);

    return `
      <section class="video-sidebar" data-video-sidebar>
        <div class="video-sidebar-header"><h3>${escapeHtml(title || 'Latest Videos')}</h3></div>
        <div class="video-sidebar-player-wrap">
          <div class="video-sidebar-player">
            <video class="video-sidebar-video hidden" playsinline controls preload="metadata"></video>
            <div class="video-sidebar-poster">
              ${
                first.thumbnail
                  ? `<img class="video-sidebar-poster-img" src="${escapeHtml(first.thumbnail)}" alt="" />`
                  : ''
              }
              <button type="button" class="video-sidebar-play" aria-label="Play video">&#9654;</button>
              ${firstDuration ? `<span class="video-sidebar-duration-badge">${escapeHtml(firstDuration)}</span>` : ''}
            </div>
          </div>
          <p class="video-sidebar-active-title">${escapeHtml(first.headline)}</p>
        </div>
        <ul class="video-sidebar-list">${listHtml}</ul>
      </section>
    `;
  }

  function initVideoSidebars(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-video-sidebar]').forEach(initVideoSidebar);
  }

  function initVideoSidebar(root) {
    if (!root || root.dataset.videoSidebarReady === 'true') return;
    root.dataset.videoSidebarReady = 'true';

    const videoEl = root.querySelector('.video-sidebar-video');
    const poster = root.querySelector('.video-sidebar-poster');
    const playBtn = root.querySelector('.video-sidebar-play');
    const posterImg = root.querySelector('.video-sidebar-poster-img');
    const titleEl = root.querySelector('.video-sidebar-active-title');
    const durationBadge = root.querySelector('.video-sidebar-duration-badge');
    const items = [...root.querySelectorAll('.video-sidebar-item')];

    if (!items.length) return;

    function showPoster() {
      if (poster) poster.classList.remove('hidden');
      if (videoEl) videoEl.classList.add('hidden');
    }

    function hidePoster() {
      if (poster) poster.classList.add('hidden');
      if (videoEl) videoEl.classList.remove('hidden');
    }

    function setActiveItem(item, autoplay) {
      items.forEach((entry) => entry.classList.toggle('is-active', entry === item));

      const headline = item.dataset.headline || 'Highlight';
      const thumbnail = item.dataset.thumbnail || '';
      const mp4 = item.dataset.mp4 || '';
      const hls = item.dataset.hls || '';
      const web = item.dataset.web || '';
      const duration = item.dataset.duration || '';

      if (titleEl) titleEl.textContent = headline;
      if (durationBadge) durationBadge.textContent = duration;
      if (posterImg) {
        if (thumbnail) {
          posterImg.src = thumbnail;
          posterImg.alt = headline;
        } else {
          posterImg.removeAttribute('src');
        }
      }

      if (!videoEl) return;

      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.innerHTML = '';

      const sourceUrl = mp4 || hls;
      if (sourceUrl) {
        videoEl.src = sourceUrl;
        showPoster();
        if (autoplay) {
          videoEl
            .play()
            .then(hidePoster)
            .catch(() => showPoster());
        }
      } else if (web) {
        showPoster();
      } else {
        showPoster();
      }
    }

    function playActive() {
      const active = items.find((item) => item.classList.contains('is-active')) || items[0];
      const mp4 = active.dataset.mp4 || '';
      const hls = active.dataset.hls || '';
      const web = active.dataset.web || '';

      if (videoEl && (mp4 || hls)) {
        if (!videoEl.src) videoEl.src = mp4 || hls;
        videoEl
          .play()
          .then(hidePoster)
          .catch(() => showPoster());
        return;
      }

      if (web) window.open(web, '_blank', 'noopener,noreferrer');
    }

    items.forEach((item) => {
      item.addEventListener('click', () => setActiveItem(item, true));
    });

    playBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      playActive();
    });

    poster?.addEventListener('click', () => playActive());

    videoEl?.addEventListener('playing', hidePoster);
    videoEl?.addEventListener('pause', () => {
      if (videoEl.currentTime > 0 && !videoEl.ended) showPoster();
    });
    videoEl?.addEventListener('ended', showPoster);

    setActiveItem(items[0], false);
  }

  global.VideoSidebar = {
    normalizeEspnVideo,
    collectFromSummary,
    collectPlayerVideos,
    buildGameVideoTitle,
    render: renderVideoSidebar,
    init: initVideoSidebars,
    injectVideoSchema,
    formatDuration,
    formatTimestamp,
    formatUploadDate,
  };
})(window);
