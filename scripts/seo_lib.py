#!/usr/bin/env python3
"""SEO helpers: canonical URLs, VideoObject JSON-LD, and duplicate-path redirects."""

from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
SITE_ORIGIN = 'https://robireport.com'
PUBLISHER_LOGO = f'{SITE_ORIGIN}/assets/Squared%20logo.png'
YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@RobiReportt'

CATEGORY_HUB_LABELS: dict[str, str] = {
    'nba': 'NBA',
    'wnba': 'WNBA',
    'nfl': 'NFL',
    'ufc': 'UFC',
    'boxing': 'Boxing',
    'soccer': 'Soccer',
    'mlb': 'MLB',
}

SECTION_PAGE_SEO: dict[str, dict[str, str]] = {
    'index.html': {
        'title': 'Robi Report — Sports News, Analysis & Video',
        'description': (
            'Independent sports coverage from Robi Report — news, analysis, and video '
            'across the NBA, WNBA, NFL, UFC, boxing, soccer, MLB, and more.'
        ),
    },
    'nba.html': {
        'title': 'Robi Report NBA | NBA News, Analysis & Stories',
        'description': (
            'NBA news, analysis, and stories from Robi Report — league trends, player '
            'coverage, and commentary beyond the box score.'
        ),
        'breadcrumb': 'NBA',
    },
    'wnba.html': {
        'title': 'Robi Report WNBA | WNBA News, Analysis & Stories',
        'description': (
            'WNBA news, analysis, and stories from Robi Report — game coverage, player '
            'breakouts, and league storylines.'
        ),
        'breadcrumb': 'WNBA',
    },
    'nfl.html': {
        'title': 'Robi Report NFL | NFL News, Analysis & Stories',
        'description': (
            'NFL news, analysis, and stories from Robi Report — game recaps, draft takes, '
            'and commentary across the league.'
        ),
        'breadcrumb': 'NFL',
    },
    'ufc.html': {
        'title': 'Robi Report UFC | UFC News, Analysis & Stories',
        'description': (
            'UFC news, analysis, and fight coverage from Robi Report — cards, matchups, '
            'and mixed martial arts storylines.'
        ),
        'breadcrumb': 'UFC',
    },
    'boxing.html': {
        'title': 'Robi Report Boxing | Boxing News, Analysis & Stories',
        'description': (
            'Boxing news, analysis, and fight coverage from Robi Report — champions, '
            'matchups, and stories from the ring.'
        ),
        'breadcrumb': 'Boxing',
    },
    'soccer.html': {
        'title': 'Robi Report Soccer | Soccer News, Analysis & Stories',
        'description': (
            'Soccer news, analysis, and stories from Robi Report — clubs, leagues, and '
            'global football coverage.'
        ),
        'breadcrumb': 'Soccer',
    },
    'mlb.html': {
        'title': 'Robi Report MLB | MLB News, Analysis & Stories',
        'description': (
            'MLB news, analysis, and stories from Robi Report — baseball coverage and '
            'commentary across the league.'
        ),
        'breadcrumb': 'MLB',
    },
    'standard-of-greatness.html': {
        'title': 'Robi Report Standard of Greatness | Original Video Series',
        'description': (
            "Standard of Greatness — Robi Report's original video series on greatness "
            'in sports and culture.'
        ),
        'breadcrumb': 'Standard of Greatness',
    },
    'shop.html': {
        'title': 'Robi Report Shop | Official Merchandise',
        'description': (
            'Shop official Robi Report merchandise — apparel and gear from independent '
            'sports and media coverage.'
        ),
        'breadcrumb': 'Shop',
    },
    'about.html': {
        'title': 'Robi Report About | Team, Contact & Mission',
        'description': (
            'About Robi Report — our mission, team, contact information, and how we cover '
            'sports and media for fans.'
        ),
        'breadcrumb': 'About',
    },
}

HUB_BREADCRUMB_CSS = """
    .hub-breadcrumb {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }
    .hub-breadcrumb a {
      color: var(--text-secondary);
      text-decoration: none;
    }
    .hub-breadcrumb a:hover { color: var(--accent); }
"""

GAME_VIEW_STUBS = frozenset({'recap', 'gamecast', 'playbyplay', 'teamstats', 'videos'})
SKIP_CANONICAL = frozenset({'articles/template.html', '404.html'})

CANONICAL_RE = re.compile(
    r'\s*<link\s+rel="canonical"\s+href="[^"]*"\s*/>\s*',
    re.I,
)
META_REFRESH_RE = re.compile(
    r'\s*<meta\s+http-equiv="refresh"\s+content="[^"]*"\s*/>\s*',
    re.I,
)
WWW_REDIRECT_RE = re.compile(
    r'\s*<script\s+id="robi-www-redirect"[^>]*>.*?</script>\s*',
    re.S | re.I,
)
ARTICLE_ALIAS_REDIRECT_RE = re.compile(
    r'\s*<script\s+id="robi-article-alias-redirect"[^>]*>.*?</script>\s*',
    re.S | re.I,
)
VIDEO_SCHEMA_RE = re.compile(
    r'\s*<script\s+type="application/ld\+json"\s+id="robi-video-schema"[^>]*>.*?</script>\s*',
    re.S | re.I,
)
ARTICLE_SCHEMA_RE = re.compile(
    r'\s*<script\s+type="application/ld\+json"\s+id="robi-article-schema"[^>]*>.*?</script>\s*',
    re.S | re.I,
)
BREADCRUMB_SCHEMA_RE = re.compile(
    r'\s*<script\s+type="application/ld\+json"\s+id="robi-breadcrumb-schema"[^>]*>.*?</script>\s*',
    re.S | re.I,
)
SITE_SCHEMA_RE = re.compile(
    r'\s*<script\s+type="application/ld\+json"\s+id="robi-site-schema"[^>]*>.*?</script>\s*',
    re.S | re.I,
)
HUB_SCHEMA_RE = re.compile(
    r'\s*<script\s+type="application/ld\+json"\s+id="robi-hub-schema"[^>]*>.*?</script>\s*',
    re.S | re.I,
)
TITLE_TAG_RE = re.compile(r'<title>[^<]*</title>', re.I)
META_DESCRIPTION_RE = re.compile(r'\s*<meta\s+name="description"[^>]*/>\s*', re.I)
META_ROBOTS_RE = re.compile(r'\s*<meta\s+name="robots"[^>]*/>\s*', re.I)
OG_META_RE = re.compile(r'\s*<meta\s+property="og:[^"]+"[^>]*/>\s*', re.I)
TWITTER_META_RE = re.compile(r'\s*<meta\s+name="twitter:[^"]+"[^>]*/>\s*', re.I)
ARTICLE_TITLE_RE = re.compile(r'<h1 class="article-title">(.*?)</h1>', re.S)
ARTICLE_TAG_RE = re.compile(r'<span class="article-tag">(.*?)</span>', re.S)
ARTICLE_META_RE = re.compile(r'<div class="article-meta">(.*?)</div>', re.S)
ARTICLE_HERO_RE = re.compile(
    r'<figure class="article-hero">\s*<img src="([^"]+)" alt="([^"]*)"',
    re.S,
)
ARTICLE_BODY_FIRST_P_RE = re.compile(
    r'<div class="article-body">\s*<p>(.*?)</p>',
    re.S,
)
IFRAME_TAG_RE = re.compile(
    r'<iframe\b[^>]*\bsrc="https?://(?:www\.)?youtube\.com/embed/([^"?/]+)[^"]*"[^>]*>',
    re.I,
)
BUTTON_VIDEO_RE = re.compile(
    r'<button\b[^>]*\bdata-video="([A-Za-z0-9_-]+)"[^>]*>',
    re.I,
)
LOCAL_VIDEO_TAG_RE = re.compile(r'<video\b[^>]*>.*?</video>', re.S | re.I)
DEFAULT_UPLOAD_DATE = '2024-01-01T00:00:00+00:00'

# Known YouTube IDs with uploadDate + description overrides for Search Console.
YOUTUBE_METADATA: dict[str, dict[str, str]] = {
    'FmJ0Pm0SXXw': {
        'uploadDate': '2024-08-15',
        'description': (
            'Joel Cohen and Matthew Robi discuss football history and culture in '
            'The Occasionally Accurate Annals of Football, an original Robi Report video.'
        ),
    },
    'TdXr8Ka2weo': {
        'uploadDate': '2025-06-10',
        'description': (
            'Jaylen Brown: The Price of Thinking For Yourself — the series finale of '
            'Robi Report\'s Standard of Greatness philosophy series.'
        ),
    },
    'oVjPjgjQGQk': {
        'uploadDate': '2024-11-20',
        'description': 'Featured NBA analysis and commentary from Robi Report.',
    },
    'ZvxRpJmdR3A': {
        'uploadDate': '2024-09-05',
        'description': 'Featured WNBA analysis and commentary from Robi Report.',
    },
    'Ztguwlw6bNk': {
        'uploadDate': '2025-01-12',
        'description': (
            'Making the obvious case that Baker Mayfield is the MVP — NFL analysis from Robi Report.'
        ),
    },
    'Hv8c9dhZPTg': {
        'uploadDate': '2024-12-03',
        'description': (
            'Why the Baltimore Ravens struggled and what it means for the season — NFL analysis from Robi Report.'
        ),
    },
    'T3u1E9eQaRE': {
        'uploadDate': '2024-03-18',
        'description': 'Giannis Antetokounmpo profile — Episode 1 of The Philosophy Series by Robi Report.',
    },
    '97S3sy-cuL4': {
        'uploadDate': '2024-04-22',
        'description': 'LaMelo Ball profile — Episode 2 of The Philosophy Series by Robi Report.',
    },
    'FoIytsKYas0': {
        'uploadDate': '2024-05-30',
        'description': 'Kevin Love profile — Episode 3 of The Philosophy Series by Robi Report.',
    },
    '2-8csUPkx9E': {
        'uploadDate': '2024-07-08',
        'description': 'Cade Cunningham profile — Episode 4 of The Philosophy Series by Robi Report.',
    },
    'FJn9m4yyRH8': {
        'uploadDate': '2024-09-16',
        'description': 'Stephen Curry profile — Episode 5 of The Philosophy Series by Robi Report.',
    },
}

LOCAL_VIDEO_METADATA: dict[str, dict[str, str]] = {
    'assets/jaylen-brown-feedback.mp4': {
        'name': 'Featured feedback from NBA Finals MVP Jaylen Brown',
        'description': (
            'Exclusive featured feedback from NBA Finals MVP Jaylen Brown on Robi Report\'s '
            'Standard of Greatness series.'
        ),
        'uploadDate': '2025-06-10',
        'thumbnailUrl': f'{SITE_ORIGIN}/assets/logo.png',
    },
}


def normalize_rel_path(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    return rel.replace('\\', '/')


def is_source_article(rel_path: str) -> bool:
    match = re.fullmatch(r'articles/([^/]+)/([^/]+)\.html', rel_path)
    return bool(match and match.group(2) not in {'template'})


def is_article_index(rel_path: str) -> bool:
    return bool(re.fullmatch(r'articles/[^/]+/[^/]+/index\.html', rel_path))


def canonical_url_for_path(rel_path: str) -> str | None:
    if rel_path in SKIP_CANONICAL:
        return None

    if is_article_index(rel_path) or is_source_article(rel_path):
        if is_article_index(rel_path):
            parts = rel_path.split('/')
            return f'{SITE_ORIGIN}/articles/{parts[1]}/{parts[2]}/'
        parts = rel_path.split('/')
        slug = Path(parts[2]).stem
        return f'{SITE_ORIGIN}/articles/{parts[1]}/{slug}/'

    stem = Path(rel_path).stem
    if stem in GAME_VIEW_STUBS and Path(rel_path).suffix == '.html':
        return f'{SITE_ORIGIN}/game.html?view={stem}'

    if rel_path == 'index.html':
        return f'{SITE_ORIGIN}/'

    return f'{SITE_ORIGIN}/{rel_path}'


def build_site_redirects() -> dict[str, str]:
    """Client-side redirect targets for legacy paths (404 page + alias cleanup)."""
    redirects: dict[str, str] = {}

    for view in sorted(GAME_VIEW_STUBS):
        target = f'/game.html?view={view}'
        redirects[f'/{view}'] = target
        redirects[f'/{view}.html'] = target

    # Common host/path duplicates Search Console may report.
    redirects['/index.html'] = '/'
    redirects['/home'] = '/'
    redirects['/home.html'] = '/'

    return dict(sorted(redirects.items()))


def write_site_redirects() -> Path:
    target = ROOT / 'assets' / 'site-redirects.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(build_site_redirects(), indent=2, sort_keys=True) + '\n',
        encoding='utf-8',
    )
    return target


def _extract_attr(tag: str, attr: str) -> str:
    match = re.search(rf'\b{re.escape(attr)}="([^"]*)"', tag, re.I)
    return html.unescape(match.group(1)).strip() if match else ''


def format_upload_date(value: str) -> str:
    """Normalize dates to ISO 8601 with timezone for Google VideoObject schema."""
    cleaned = (value or '').strip()
    if not cleaned:
        return DEFAULT_UPLOAD_DATE

    if 'T' in cleaned:
        if cleaned.endswith('Z'):
            return cleaned[:-1] + '+00:00'
        if re.search(r'[+-]\d{2}:\d{2}$', cleaned):
            return cleaned
        return f'{cleaned}+00:00'

    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', cleaned):
        return f'{cleaned}T00:00:00+00:00'

    return DEFAULT_UPLOAD_DATE


def _normalize_video_name(name: str, video_id: str = '') -> str:
    title = re.sub(r'\s+', ' ', html.unescape(name)).strip()
    title = re.sub(r'\s*[—-]\s*Robi Report\s*$', '', title, flags=re.I)
    if title:
        return title
    return f'Robi Report video {video_id}' if video_id else 'Robi Report video'


def _default_description(name: str) -> str:
    cleaned = _normalize_video_name(name)
    if cleaned.lower().endswith('robi report'):
        return f'{cleaned}. Independent sports analysis and original video from Robi Report.'
    return f'{cleaned} — independent sports analysis and original video from Robi Report.'


def _youtube_thumbnail(video_id: str) -> str:
    return f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg'


def _video_object_youtube(
    video_id: str,
    name: str,
    *,
    description: str = '',
    upload_date: str = '',
) -> dict[str, Any]:
    meta = YOUTUBE_METADATA.get(video_id, {})
    title = _normalize_video_name(name, video_id)
    resolved_description = (
        description
        or meta.get('description')
        or _default_description(title)
    )
    resolved_upload_date = format_upload_date(
        upload_date or meta.get('uploadDate', DEFAULT_UPLOAD_DATE)
    )

    return {
        '@type': 'VideoObject',
        'name': title,
        'description': resolved_description,
        'uploadDate': resolved_upload_date,
        'thumbnailUrl': _youtube_thumbnail(video_id),
        'embedUrl': f'https://www.youtube.com/embed/{video_id}',
        'contentUrl': f'https://www.youtube.com/watch?v={video_id}',
        'publisher': {
            '@type': 'Organization',
            'name': 'Robi Report',
            'logo': {
                '@type': 'ImageObject',
                'url': PUBLISHER_LOGO,
            },
        },
    }


def _video_object_local(
    src: str,
    name: str,
    *,
    description: str = '',
    upload_date: str = '',
) -> dict[str, Any]:
    rel_src = src.lstrip('/')
    meta = LOCAL_VIDEO_METADATA.get(rel_src, {})
    title = _normalize_video_name(meta.get('name') or name)
    resolved_description = (
        description
        or meta.get('description')
        or _default_description(title)
    )
    resolved_upload_date = format_upload_date(
        upload_date or meta.get('uploadDate', DEFAULT_UPLOAD_DATE)
    )
    content_url = f'{SITE_ORIGIN}/{rel_src}'
    thumbnail = meta.get('thumbnailUrl', PUBLISHER_LOGO)

    return {
        '@type': 'VideoObject',
        'name': title,
        'description': resolved_description,
        'uploadDate': resolved_upload_date,
        'thumbnailUrl': thumbnail,
        'contentUrl': content_url,
        'publisher': {
            '@type': 'Organization',
            'name': 'Robi Report',
            'logo': {
                '@type': 'ImageObject',
                'url': PUBLISHER_LOGO,
            },
        },
    }


def extract_video_objects(page_html: str, rel_path: str) -> list[dict[str, Any]]:
    videos: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for match in IFRAME_TAG_RE.finditer(page_html):
        iframe_tag = match.group(0)
        video_id = match.group(1)
        if video_id in {'videoseries'} or video_id in seen_ids:
            continue

        title = _extract_attr(iframe_tag, 'title')
        description = _extract_attr(iframe_tag, 'data-description')
        upload_date = _extract_attr(iframe_tag, 'data-upload-date')

        seen_ids.add(video_id)
        videos.append(
            _video_object_youtube(
                video_id,
                title,
                description=description,
                upload_date=upload_date,
            )
        )

    for match in BUTTON_VIDEO_RE.finditer(page_html):
        button_tag = match.group(0)
        video_id = match.group(1)
        if video_id in seen_ids:
            continue

        title = _extract_attr(button_tag, 'data-title')
        description = _extract_attr(button_tag, 'data-description')
        upload_date = _extract_attr(button_tag, 'data-upload-date')

        seen_ids.add(video_id)
        videos.append(
            _video_object_youtube(
                video_id,
                title,
                description=description,
                upload_date=upload_date,
            )
        )

    for video_tag in LOCAL_VIDEO_TAG_RE.findall(page_html):
        src = _extract_attr(video_tag, 'data-content-url')
        if not src:
            source_match = re.search(r'<source\s+src="([^"]+\.mp4)"', video_tag, re.I)
            src = source_match.group(1) if source_match else ''
        if not src or not src.endswith('.mp4'):
            continue

        label = _extract_attr(video_tag, 'aria-label')
        description = _extract_attr(video_tag, 'data-description')
        upload_date = _extract_attr(video_tag, 'data-upload-date')
        videos.append(
            _video_object_local(
                src,
                label,
                description=description,
                upload_date=upload_date,
            )
        )

    return videos


def _ensure_video_fields(video: dict[str, Any]) -> dict[str, Any]:
    name = _normalize_video_name(str(video.get('name') or ''))
    description = str(video.get('description') or '').strip() or _default_description(name)
    upload_date = format_upload_date(str(video.get('uploadDate') or ''))
    return {
        **video,
        'name': name,
        'description': description,
        'uploadDate': upload_date,
    }


def build_video_schema_script(page_html: str, rel_path: str) -> str:
    videos = [_ensure_video_fields(video) for video in extract_video_objects(page_html, rel_path)]
    if not videos:
        return ''

    payload: dict[str, Any]
    if len(videos) == 1:
        payload = {
            '@context': 'https://schema.org',
            **videos[0],
        }
    else:
        payload = {
            '@context': 'https://schema.org',
            '@graph': videos,
        }

    json_text = json.dumps(payload, indent=2, ensure_ascii=False)
    return (
        f'  <script type="application/ld+json" id="robi-video-schema">\n'
        f'{json_text}\n'
        f'  </script>\n'
    )


def build_canonical_tag(canonical_url: str) -> str:
    return f'  <link rel="canonical" href="{html.escape(canonical_url, quote=True)}" />\n'


def build_www_redirect_script() -> str:
    return (
        '  <script id="robi-www-redirect">\n'
        '    (function () {\n'
        "      if (location.hostname === 'www.robireport.com') {\n"
        "        location.replace('https://robireport.com' + location.pathname + location.search + location.hash);\n"
        '      }\n'
        '    })();\n'
        '  </script>\n'
    )


def build_article_alias_redirect(canonical_url: str) -> str:
    return (
        '  <script id="robi-article-alias-redirect">\n'
        '    (function () {\n'
        f"      var target = '{canonical_url}';\n"
        '      if (location.pathname.endsWith(".html")) {\n'
        '        location.replace(target + location.search + location.hash);\n'
        '      }\n'
        '    })();\n'
        '  </script>\n'
    )


def build_meta_refresh(canonical_url: str) -> str:
    escaped = html.escape(canonical_url, quote=True)
    return f'  <meta http-equiv="refresh" content="0;url={escaped}" />\n'


def _clean_text(value: str) -> str:
    return re.sub(r'\s+', ' ', html.unescape(value or '')).strip()


def _truncate(text: str, limit: int = 160) -> str:
    if len(text) <= limit:
        return text
    trimmed = text[: limit - 3].rsplit(' ', 1)[0]
    return f'{trimmed}...'


def article_category_from_rel(rel_path: str) -> str:
    match = re.match(r'articles/([^/]+)/', rel_path)
    return match.group(1) if match else ''


def extract_article_metadata(page_html: str) -> dict[str, Any] | None:
    if 'class="article-title"' not in page_html:
        return None

    title_match = ARTICLE_TITLE_RE.search(page_html)
    if not title_match:
        return None

    headline = _clean_text(title_match.group(1))
    tag_match = ARTICLE_TAG_RE.search(page_html)
    tag_raw = _clean_text(tag_match.group(1)) if tag_match else 'News'
    is_news = bool(re.search(r'\bnews\b', tag_raw, re.I))

    author = 'Robi Report'
    date_published = ''
    date_display = ''
    meta_match = ARTICLE_META_RE.search(page_html)
    if meta_match:
        meta_block = meta_match.group(1)
        author_match = re.search(r'<strong>(.*?)</strong>', meta_block, re.S)
        time_match = re.search(r'<time datetime="([^"]+)">([^<]*)</time>', meta_block)
        if author_match:
            author = _clean_text(author_match.group(1))
        if time_match:
            date_published = time_match.group(1).strip()
            date_display = _clean_text(time_match.group(2))

    hero_match = ARTICLE_HERO_RE.search(page_html)
    image_url = hero_match.group(1).strip() if hero_match else ''
    image_alt = _clean_text(hero_match.group(2)) if hero_match else headline

    description = ''
    body_match = ARTICLE_BODY_FIRST_P_RE.search(page_html)
    if body_match:
        description = _truncate(_clean_text(re.sub(r'<[^>]+>', '', body_match.group(1))))

    return {
        'headline': headline,
        'description': description,
        'author': author,
        'date_published': date_published,
        'date_display': date_display,
        'image_url': image_url,
        'image_alt': image_alt,
        'story_tag': tag_raw,
        'is_news': is_news,
    }


def _author_schema(author_name: str) -> dict[str, Any]:
    if author_name.lower() == 'robi report':
        return {'@type': 'Organization', 'name': 'Robi Report'}
    return {'@type': 'Person', 'name': author_name}


def build_article_schema_payload(
    metadata: dict[str, Any],
    canonical_url: str,
    *,
    date_modified: str = '',
) -> dict[str, Any]:
    schema_type = 'NewsArticle' if metadata.get('is_news') else 'BlogPosting'
    published = format_upload_date(metadata.get('date_published', ''))
    modified = format_upload_date(date_modified or metadata.get('date_published', ''))

    payload: dict[str, Any] = {
        '@context': 'https://schema.org',
        '@type': schema_type,
        'headline': metadata['headline'],
        'description': metadata.get('description') or metadata['headline'],
        'datePublished': published,
        'dateModified': modified,
        'author': _author_schema(metadata.get('author', 'Robi Report')),
        'publisher': {
            '@type': 'Organization',
            'name': 'Robi Report',
            'logo': {
                '@type': 'ImageObject',
                'url': PUBLISHER_LOGO,
            },
        },
        'mainEntityOfPage': {
            '@type': 'WebPage',
            '@id': canonical_url,
        },
        'url': canonical_url,
        'inLanguage': 'en-US',
    }

    image_url = metadata.get('image_url') or ''
    if image_url:
        payload['image'] = [image_url]

    return payload


def hub_label_for_category(category: str) -> str:
    if not category:
        return 'Articles'
    return CATEGORY_HUB_LABELS.get(category, category.replace('-', ' ').title())


def build_organization_node() -> dict[str, Any]:
    return {
        '@type': 'Organization',
        '@id': f'{SITE_ORIGIN}/#organization',
        'name': 'Robi Report',
        'url': f'{SITE_ORIGIN}/',
        'logo': {
            '@type': 'ImageObject',
            'url': PUBLISHER_LOGO,
        },
        'sameAs': [YOUTUBE_CHANNEL_URL],
    }


def build_website_schema_payload() -> dict[str, Any]:
    org = build_organization_node()
    return {
        '@context': 'https://schema.org',
        '@graph': [
            org,
            {
                '@type': 'WebSite',
                '@id': f'{SITE_ORIGIN}/#website',
                'name': 'Robi Report',
                'url': f'{SITE_ORIGIN}/',
                'publisher': {'@id': org['@id']},
                'inLanguage': 'en-US',
            },
        ],
    }


def build_site_schema_script() -> str:
    json_text = json.dumps(build_website_schema_payload(), indent=2, ensure_ascii=False)
    return (
        f'  <script type="application/ld+json" id="robi-site-schema">\n'
        f'{json_text}\n'
        f'  </script>\n'
    )


def build_section_breadcrumb_schema(breadcrumb_label: str, page_url: str) -> dict[str, Any]:
    return {
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {
                '@type': 'ListItem',
                'position': 1,
                'name': 'Robi Report',
                'item': f'{SITE_ORIGIN}/',
            },
            {
                '@type': 'ListItem',
                'position': 2,
                'name': breadcrumb_label,
                'item': page_url,
            },
        ],
    }


def build_hub_schema_script(
    breadcrumb_label: str,
    page_url: str,
    *,
    title: str,
    description: str,
) -> str:
    breadcrumb = build_section_breadcrumb_schema(breadcrumb_label, page_url)
    web_page: dict[str, Any] = {
        '@type': 'WebPage',
        '@id': page_url,
        'url': page_url,
        'name': title,
        'description': description,
        'isPartOf': {'@id': f'{SITE_ORIGIN}/#website'},
        'about': {'@id': f'{SITE_ORIGIN}/#organization'},
        'inLanguage': 'en-US',
        'breadcrumb': breadcrumb,
    }
    graph = {
        '@context': 'https://schema.org',
        '@graph': [web_page, breadcrumb],
    }
    json_text = json.dumps(graph, indent=2, ensure_ascii=False)
    return (
        f'  <script type="application/ld+json" id="robi-hub-schema">\n'
        f'{json_text}\n'
        f'  </script>\n'
    )


def build_page_head_tags(
    *,
    title: str,
    description: str,
    canonical_url: str,
    og_type: str = 'website',
) -> str:
    image = PUBLISHER_LOGO
    lines = [
        f'  <meta name="description" content="{html.escape(description, quote=True)}" />',
        '  <meta name="robots" content="index, follow, max-image-preview:large" />',
        f'  <meta property="og:type" content="{html.escape(og_type, quote=True)}" />',
        '  <meta property="og:site_name" content="Robi Report" />',
        f'  <meta property="og:title" content="{html.escape(title, quote=True)}" />',
        f'  <meta property="og:description" content="{html.escape(description, quote=True)}" />',
        f'  <meta property="og:url" content="{html.escape(canonical_url, quote=True)}" />',
        f'  <meta property="og:image" content="{html.escape(image, quote=True)}" />',
        f'  <meta name="twitter:card" content="summary_large_image" />',
        f'  <meta name="twitter:title" content="{html.escape(title, quote=True)}" />',
        f'  <meta name="twitter:description" content="{html.escape(description, quote=True)}" />',
        f'  <meta name="twitter:image" content="{html.escape(image, quote=True)}" />',
    ]
    return '\n'.join(lines) + '\n'


def replace_title_tag(content: str, title: str) -> str:
    tag = f'<title>{html.escape(title)}</title>'
    if TITLE_TAG_RE.search(content):
        return TITLE_TAG_RE.sub(tag, content, count=1)
    return content


def ensure_hub_breadcrumb_html(content: str, breadcrumb_label: str) -> str:
    if 'class="hub-breadcrumb"' in content:
        return content
    if 'class="page-header-inner"' not in content:
        return content

    if '.hub-breadcrumb' not in content:
        content = content.replace('  </style>', f'{HUB_BREADCRUMB_CSS}  </style>', 1)

    nav = (
        '      <nav class="hub-breadcrumb" aria-label="Breadcrumb">\n'
        '        <a href="index.html">Robi Report</a> / '
        f'<span aria-current="page">{html.escape(breadcrumb_label)}</span>\n'
        '      </nav>\n'
    )
    marker = '    <div class="page-header-inner">\n'
    if marker in content:
        return content.replace(marker, marker + nav, 1)
    return content


def build_breadcrumb_schema_payload(
    metadata: dict[str, Any],
    canonical_url: str,
    rel_path: str,
) -> dict[str, Any]:
    category = article_category_from_rel(rel_path)
    category_label = hub_label_for_category(category)
    hub_url = f'{SITE_ORIGIN}/{category}.html' if category else f'{SITE_ORIGIN}/'

    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {
                '@type': 'ListItem',
                'position': 1,
                'name': 'Robi Report',
                'item': f'{SITE_ORIGIN}/',
            },
            {
                '@type': 'ListItem',
                'position': 2,
                'name': category_label,
                'item': hub_url,
            },
            {
                '@type': 'ListItem',
                'position': 3,
                'name': metadata['headline'],
                'item': canonical_url,
            },
        ],
    }


def build_article_head_tags(
    metadata: dict[str, Any],
    canonical_url: str,
) -> str:
    description = metadata.get('description') or metadata['headline']
    title = f"{metadata['headline']} — Robi Report"
    image = metadata.get('image_url') or PUBLISHER_LOGO

    lines = [
        f'  <meta name="description" content="{html.escape(description, quote=True)}" />',
        '  <meta name="robots" content="index, follow, max-image-preview:large" />',
        f'  <meta property="og:type" content="article" />',
        f'  <meta property="og:site_name" content="Robi Report" />',
        f'  <meta property="og:title" content="{html.escape(title, quote=True)}" />',
        f'  <meta property="og:description" content="{html.escape(description, quote=True)}" />',
        f'  <meta property="og:url" content="{html.escape(canonical_url, quote=True)}" />',
        f'  <meta property="og:image" content="{html.escape(image, quote=True)}" />',
        f'  <meta name="twitter:card" content="summary_large_image" />',
        f'  <meta name="twitter:title" content="{html.escape(title, quote=True)}" />',
        f'  <meta name="twitter:description" content="{html.escape(description, quote=True)}" />',
        f'  <meta name="twitter:image" content="{html.escape(image, quote=True)}" />',
    ]

    if metadata.get('date_published'):
        published = format_upload_date(metadata['date_published'])
        lines.append(
            f'  <meta property="article:published_time" content="{html.escape(published, quote=True)}" />'
        )

    return '\n'.join(lines) + '\n'


def build_article_schema_script(
    metadata: dict[str, Any],
    canonical_url: str,
    rel_path: str,
    *,
    date_modified: str = '',
) -> str:
    article_payload = build_article_schema_payload(
        metadata,
        canonical_url,
        date_modified=date_modified,
    )
    breadcrumb_payload = build_breadcrumb_schema_payload(metadata, canonical_url, rel_path)
    article_payload.pop('@context', None)
    breadcrumb_payload.pop('@context', None)
    graph = {
        '@context': 'https://schema.org',
        '@graph': [article_payload, breadcrumb_payload],
    }
    json_text = json.dumps(graph, indent=2, ensure_ascii=False)
    return (
        f'  <script type="application/ld+json" id="robi-article-schema">\n'
        f'{json_text}\n'
        f'  </script>\n'
    )


def _mtime_iso(path: Path | None) -> str:
    if not path or not path.exists():
        return ''
    stamp = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    return stamp.replace(microsecond=0).isoformat()


def _strip_existing_seo(content: str) -> str:
    content = CANONICAL_RE.sub('\n', content)
    content = META_REFRESH_RE.sub('\n', content)
    content = WWW_REDIRECT_RE.sub('\n', content)
    content = ARTICLE_ALIAS_REDIRECT_RE.sub('\n', content)
    content = VIDEO_SCHEMA_RE.sub('\n', content)
    content = ARTICLE_SCHEMA_RE.sub('\n', content)
    content = BREADCRUMB_SCHEMA_RE.sub('\n', content)
    content = SITE_SCHEMA_RE.sub('\n', content)
    content = HUB_SCHEMA_RE.sub('\n', content)
    content = META_DESCRIPTION_RE.sub('\n', content)
    content = META_ROBOTS_RE.sub('\n', content)
    content = OG_META_RE.sub('\n', content)
    content = TWITTER_META_RE.sub('\n', content)
    return content


def _insert_after_manifest(content: str, block: str) -> str:
    marker = '<link rel="manifest"'
    idx = content.find(marker)
    if idx == -1:
        marker = '</head>'
        idx = content.find(marker)
        if idx == -1:
            return content
        return content[:idx] + block + content[idx:]

    line_end = content.find('\n', idx)
    if line_end == -1:
        return content + block
    insert_at = line_end + 1
    return content[:insert_at] + block + content[insert_at:]


def apply_seo(content: str, rel_path: str, *, source_path: Path | None = None) -> str:
    canonical = canonical_url_for_path(rel_path)
    content = _strip_existing_seo(content)

    head_blocks = build_www_redirect_script()

    if canonical:
        head_blocks += build_canonical_tag(canonical)
        if is_source_article(rel_path):
            head_blocks += build_meta_refresh(canonical)
            head_blocks += build_article_alias_redirect(canonical)

    metadata = extract_article_metadata(content)
    if metadata and canonical and (is_article_index(rel_path) or is_source_article(rel_path)):
        modified_iso = _mtime_iso(source_path) if source_path else ''
        metadata = dict(metadata)
        if modified_iso:
            metadata['date_modified'] = modified_iso
        head_blocks += build_article_head_tags(metadata, canonical)
        head_blocks += build_article_schema_script(
            metadata,
            canonical,
            rel_path,
            date_modified=modified_iso,
        )

    video_schema = build_video_schema_script(content, rel_path)
    if video_schema:
        head_blocks += video_schema

    section_cfg = SECTION_PAGE_SEO.get(rel_path)
    if section_cfg and canonical:
        title = section_cfg['title']
        description = section_cfg['description']
        content = replace_title_tag(content, title)
        head_blocks += build_page_head_tags(
            title=title,
            description=description,
            canonical_url=canonical,
        )
        if rel_path == 'index.html':
            head_blocks += build_site_schema_script()
        elif section_cfg.get('breadcrumb'):
            head_blocks += build_hub_schema_script(
                section_cfg['breadcrumb'],
                canonical,
                title=title,
                description=description,
            )
            content = ensure_hub_breadcrumb_html(content, section_cfg['breadcrumb'])

    if not head_blocks.strip():
        return content

    return _insert_after_manifest(content, head_blocks)


def apply_seo_file(path: Path) -> bool:
    rel_path = normalize_rel_path(path)
    if rel_path == 'articles/template.html':
        return False

    source_path: Path | None = None
    if is_article_index(rel_path):
        parts = rel_path.split('/')
        if len(parts) >= 4:
            source_path = ROOT / 'articles' / parts[1] / f'{parts[2]}.html'

    original = path.read_text(encoding='utf-8')
    updated = apply_seo(original, rel_path, source_path=source_path)
    if updated != original:
        path.write_text(updated, encoding='utf-8')
        return True
    return False


def iter_html_files() -> list[Path]:
    return sorted(
        path
        for path in ROOT.rglob('*.html')
        if path.is_file() and 'node_modules' not in path.parts
    )
