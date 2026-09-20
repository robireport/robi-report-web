#!/usr/bin/env python3
"""SEO helpers: canonical URLs, VideoObject JSON-LD, and duplicate-path redirects."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
SITE_ORIGIN = 'https://robireport.com'
PUBLISHER_LOGO = f'{SITE_ORIGIN}/assets/Squared%20logo.png'

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
IFRAME_EMBED_RE = re.compile(
    r'<iframe\b[^>]*\bsrc="https?://(?:www\.)?youtube\.com/embed/([^"?/]+)[^"]*"[^>]*\btitle="([^"]*)"',
    re.I,
)
DATA_VIDEO_RE = re.compile(
    r'data-video="([A-Za-z0-9_-]+)"\s+data-title="([^"]*)"',
    re.I,
)
LOCAL_VIDEO_RE = re.compile(
    r'<video\b[^>]*>(?:\s*<source\s+src="([^"]+\.mp4)"[^>]*>)?',
    re.S | re.I,
)
VIDEO_ARIA_RE = re.compile(
    r'<video\b[^>]*\baria-label="([^"]*)"',
    re.I,
)

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


def _default_description(name: str) -> str:
    cleaned = re.sub(r'\s+', ' ', html.unescape(name)).strip(' —-')
    if cleaned.lower().endswith('robi report'):
        return f'{cleaned}. Independent sports analysis and original video from Robi Report.'
    return f'{cleaned} — independent sports analysis and original video from Robi Report.'


def _youtube_thumbnail(video_id: str) -> str:
    return f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg'


def _video_object_youtube(video_id: str, name: str) -> dict[str, Any]:
    meta = YOUTUBE_METADATA.get(video_id, {})
    title = html.unescape(name).strip() or f'Robi Report video {video_id}'
    description = meta.get('description') or _default_description(title)
    upload_date = meta.get('uploadDate', '2024-01-01')

    return {
        '@type': 'VideoObject',
        'name': title,
        'description': description,
        'uploadDate': upload_date,
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


def _video_object_local(src: str, name: str) -> dict[str, Any]:
    rel_src = src.lstrip('/')
    meta = LOCAL_VIDEO_METADATA.get(rel_src, {})
    title = meta.get('name') or html.unescape(name).strip() or 'Robi Report video'
    description = meta.get('description') or _default_description(title)
    upload_date = meta.get('uploadDate', '2024-01-01')
    content_url = f'{SITE_ORIGIN}/{rel_src}'
    thumbnail = meta.get('thumbnailUrl', PUBLISHER_LOGO)

    return {
        '@type': 'VideoObject',
        'name': title,
        'description': description,
        'uploadDate': upload_date,
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

    for video_id, title in IFRAME_EMBED_RE.findall(page_html):
        if video_id in {'videoseries'} or video_id in seen_ids:
            continue
        seen_ids.add(video_id)
        videos.append(_video_object_youtube(video_id, title))

    for video_id, title in DATA_VIDEO_RE.findall(page_html):
        if video_id in seen_ids:
            continue
        seen_ids.add(video_id)
        videos.append(_video_object_youtube(video_id, title))

    for match in LOCAL_VIDEO_RE.finditer(page_html):
        src = match.group(1)
        if not src or not src.endswith('.mp4'):
            continue
        aria = VIDEO_ARIA_RE.search(match.group(0))
        label = aria.group(1) if aria else ''
        videos.append(_video_object_local(src, label))

    return videos


def build_video_schema_script(page_html: str, rel_path: str) -> str:
    videos = extract_video_objects(page_html, rel_path)
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


def _strip_existing_seo(content: str) -> str:
    content = CANONICAL_RE.sub('\n', content)
    content = META_REFRESH_RE.sub('\n', content)
    content = WWW_REDIRECT_RE.sub('\n', content)
    content = ARTICLE_ALIAS_REDIRECT_RE.sub('\n', content)
    content = VIDEO_SCHEMA_RE.sub('\n', content)
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


def apply_seo(content: str, rel_path: str) -> str:
    canonical = canonical_url_for_path(rel_path)
    content = _strip_existing_seo(content)

    head_blocks = build_www_redirect_script()

    if canonical:
        head_blocks += build_canonical_tag(canonical)
        if is_source_article(rel_path):
            head_blocks += build_meta_refresh(canonical)
            head_blocks += build_article_alias_redirect(canonical)

    video_schema = build_video_schema_script(content, rel_path)
    if video_schema:
        head_blocks += video_schema

    if not head_blocks.strip():
        return content

    return _insert_after_manifest(content, head_blocks)


def apply_seo_file(path: Path) -> bool:
    rel_path = normalize_rel_path(path)
    if rel_path == 'articles/template.html':
        return False

    original = path.read_text(encoding='utf-8')
    updated = apply_seo(original, rel_path)
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
