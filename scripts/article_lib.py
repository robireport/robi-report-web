#!/usr/bin/env python3
"""Article publishing utilities for Robi Report (static HTML on GitHub Pages)."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from seo_lib import apply_seo, ensure_article_byline, extract_article_metadata, normalize_rel_path

RELATED_SECTION_RE = re.compile(
    r'\n?\s*<section class="article-related"[^>]*>.*?</section>\s*',
    re.S | re.I,
)
READ_TIME_RE = re.compile(r'(\d+\s*min\s*read)', re.I)
EM_DASH = '\u2014'
EM_DASH_ENTITY_RE = re.compile(r'&(?:mdash|#8212|#x2014);', re.I)
ARTICLE_BODY_RE = re.compile(
    r'(<div class="article-body"[^>]*>)(.*?)(</div>)',
    re.S | re.I,
)
ARTICLE_HERO_RE = re.compile(
    r'(<figure class="article-hero"[^>]*>.*?<img\b[^>]*\balt=")([^"]*)(")',
    re.S | re.I,
)
ARTICLE_TITLE_RE = re.compile(
    r'(<h1 class="article-title">)(.*?)(</h1>)',
    re.S | re.I,
)
ROOT = Path(__file__).resolve().parent.parent
ARTICLES_DIR = ROOT / 'articles'
REDIRECTS_FILE = ROOT / 'assets' / 'article-redirects.json'

VALID_CATEGORIES = frozenset({'nba', 'wnba', 'nfl', 'ufc', 'boxing', 'soccer', 'mlb'})

HUBS = {
    'nba': ('nba.html', 'NBA'),
    'wnba': ('wnba.html', 'WNBA'),
    'nfl': ('nfl.html', 'NFL'),
    'ufc': ('ufc.html', 'UFC'),
    'boxing': ('boxing.html', 'Boxing'),
    'soccer': ('soccer.html', 'Soccer'),
    'mlb': ('mlb.html', 'MLB'),
}


def normalize_em_dash_characters(text: str) -> str:
    text = EM_DASH_ENTITY_RE.sub(EM_DASH, text)
    text = re.sub(r'\s*[–—]\s*', f' {EM_DASH} ', text)
    text = re.sub(rf'{EM_DASH}(\w)', rf'{EM_DASH} \1', text)
    text = re.sub(rf'(\w){EM_DASH}', rf'\1 {EM_DASH}', text)
    text = re.sub(rf'\s*{EM_DASH}\s*', f' {EM_DASH} ', text)
    return text


def sanitize_em_dash_prose(text: str) -> str:
    """Rewrite em dashes into commas, colons, or parentheses for natural flow."""
    text = normalize_em_dash_characters(text)
    if EM_DASH not in text:
        return text

    while True:
        match = re.search(rf' {EM_DASH} ([^{EM_DASH}]+?) {EM_DASH} ', text)
        if not match:
            break
        inner = match.group(1).strip()
        text = text[: match.start()] + f' ({inner}) ' + text[match.end() :]

    replacements = [
        (rf' {EM_DASH} (and|but|or)\b', r', \1'),
        (rf' {EM_DASH} (who|which|where|when)\b', r', \1'),
        (rf' {EM_DASH} (how|what|whether|why)\b', r': \1'),
        (rf' {EM_DASH} (it|their|two|we|I)\b', r': \1'),
        (rf' {EM_DASH} (a|an|the|her|his|my|your)\b', r', \1'),
    ]
    for pattern, repl in replacements:
        text = re.sub(pattern, repl, text)

    text = re.sub(rf' {EM_DASH} ', ', ', text)
    text = text.replace(EM_DASH, ', ')
    text = re.sub(r',\s*,+', ',', text)
    text = re.sub(r',\s+([,.;:!?])', r'\1', text)
    text = re.sub(r':\s+,', ':', text)
    text = re.sub(r'\(\s+,', '(', text)
    return text


def _sanitize_html_text_nodes(fragment: str, tag: str) -> str:
    pattern = re.compile(rf'<{tag}>(.*?)</{tag}>', re.S | re.I)

    def repl(match: re.Match[str]) -> str:
        return f'<{tag}>{sanitize_em_dash_prose(match.group(1))}</{tag}>'

    return pattern.sub(repl, fragment)


def sanitize_article_content_html(html: str) -> str:
    """Strip em dashes from visible article fields (body, title, hero alt)."""

    def body_repl(match: re.Match[str]) -> str:
        inner = match.group(2)
        inner = _sanitize_html_text_nodes(inner, 'p')
        inner = _sanitize_html_text_nodes(inner, 'li')
        inner = _sanitize_html_text_nodes(inner, 'blockquote')
        return match.group(1) + inner + match.group(3)

    html = ARTICLE_BODY_RE.sub(body_repl, html)

    def title_repl(match: re.Match[str]) -> str:
        return match.group(1) + sanitize_em_dash_prose(match.group(2)) + match.group(3)

    html = ARTICLE_TITLE_RE.sub(title_repl, html)

    def hero_repl(match: re.Match[str]) -> str:
        return match.group(1) + sanitize_em_dash_prose(match.group(2)) + match.group(3)

    html = ARTICLE_HERO_RE.sub(hero_repl, html)
    return html


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r'[^a-z0-9]+', '-', value)
    return value.strip('-')


def is_source_article(path: Path) -> bool:
    """True for articles/{category}/{slug}.html source files only."""
    if path.name in {'template.html', 'index.html'}:
        return False
    try:
        rel = path.relative_to(ARTICLES_DIR)
    except ValueError:
        return False
    return len(rel.parts) == 2 and rel.suffix == '.html'


def iter_source_articles() -> list[Path]:
    return sorted(
        path
        for path in ARTICLES_DIR.glob('*/*.html')
        if is_source_article(path)
    )


def parse_article_title(source: Path) -> str:
    text = source.read_text(encoding='utf-8')
    match = re.search(r'<h1 class="article-title">(.*?)</h1>', text, re.S)
    if not match:
        return source.stem.replace('-', ' ').title()
    return re.sub(r'\s+', ' ', html.unescape(match.group(1))).strip()


def canonical_article_url(source: Path) -> str:
    rel = source.relative_to(ARTICLES_DIR)
    return f'/articles/{rel.parent.as_posix()}/{rel.stem}/'


def public_article_href(source: Path) -> str:
    rel = source.relative_to(ARTICLES_DIR)
    return f'articles/{rel.parent.as_posix()}/{rel.stem}/'


def build_redirect_map() -> dict[str, str]:
    """Map legacy/title-based slugs to canonical article directory URLs."""
    redirects: dict[str, str] = {}

    for source in iter_source_articles():
        rel = source.relative_to(ARTICLES_DIR)
        category = rel.parts[0]
        file_slug = source.stem
        title_slug = slugify(parse_article_title(source))
        canonical = canonical_article_url(source)

        aliases = {file_slug, title_slug}
        for alias in aliases:
            if not alias:
                continue
            redirects[f'/articles/{category}/{alias}'] = canonical
            redirects[f'/articles/{category}/{alias}.html'] = canonical

        # Common Wix-style /post/{slug} paths
        for alias in aliases:
            if alias:
                redirects[f'/post/{alias}'] = canonical
                redirects[f'/post/{alias}.html'] = canonical

    return dict(sorted(redirects.items()))


def write_redirect_map() -> Path:
    redirects = build_redirect_map()
    REDIRECTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    REDIRECTS_FILE.write_text(
        json.dumps(redirects, indent=2, sort_keys=True) + '\n',
        encoding='utf-8',
    )
    return REDIRECTS_FILE


def source_to_index_content(content: str) -> str:
    """Deepen relative paths by one level for slug/index.html copies."""
    return content.replace('../../', '../../../')


def parse_read_time(source_html: str) -> str:
    match = READ_TIME_RE.search(source_html)
    return match.group(1) if match else '5 min read'


def ensure_article_related_assets(content: str, asset_prefix: str) -> str:
    if 'assets/article-related.css' in content:
        return content
    insert = (
        f'  <link rel="stylesheet" href="{asset_prefix}assets/article-related.css" />\n'
        f'  <script src="{asset_prefix}assets/article-related.js" defer></script>\n'
    )
    marker = 'assets/nav-mobile.css" />'
    if marker not in content:
        return content
    return content.replace(marker, marker + '\n' + insert, 1)


def build_related_card_html(peer: Path) -> str:
    peer_html = peer.read_text(encoding='utf-8')
    metadata = extract_article_metadata(peer_html) or {}
    href = f'/{public_article_href(peer)}'
    title = metadata.get('headline') or parse_article_title(peer)
    tag = metadata.get('story_tag') or 'News'
    read_time = parse_read_time(peer_html)
    image_url = metadata.get('image_url') or ''
    image_alt = metadata.get('image_alt') or title

    if image_url:
        thumb_inner = (
            f'<img src="{html.escape(image_url, quote=True)}" '
            f'alt="{html.escape(image_alt, quote=True)}" loading="lazy" />'
        )
    else:
        thumb_inner = '<div class="article-related-thumb-fallback" aria-hidden="true"></div>'

    return (
        '          <li class="article-related-card">\n'
        f'            <a class="article-related-card-link" href="{html.escape(href, quote=True)}">\n'
        f'              <div class="article-related-thumb">{thumb_inner}</div>\n'
        '              <div class="article-related-body">\n'
        f'                <span class="article-related-tag">{html.escape(tag)}</span>\n'
        f'                <h3 class="article-related-title">{html.escape(title)}</h3>\n'
        f'                <span class="article-related-meta">{html.escape(read_time)}</span>\n'
        '              </div>\n'
        '            </a>\n'
        '          </li>'
    )


def build_related_articles_html(source: Path, limit: int = 6) -> str:
    category = source.parent.name
    peers = [
        candidate
        for candidate in iter_source_articles()
        if candidate.parent.name == category and candidate != source
    ]
    peers.sort(key=lambda path: path.stat().st_mtime, reverse=True)
    peers = peers[:limit]
    if not peers:
        return ''

    hub_label = HUBS.get(category, ('', category.upper()))[1]
    items = [build_related_card_html(peer) for peer in peers]

    return (
        '\n      <section class="article-related" aria-label="Related articles">\n'
        '        <div class="article-related-header">\n'
        f'          <h2>More from {html.escape(hub_label)}</h2>\n'
        '          <div class="article-related-controls">\n'
        '            <button type="button" class="article-related-scroll-btn" data-direction="prev" aria-label="Scroll related articles left">&#8249;</button>\n'
        '            <button type="button" class="article-related-scroll-btn" data-direction="next" aria-label="Scroll related articles right">&#8250;</button>\n'
        '          </div>\n'
        '        </div>\n'
        '        <div class="article-related-track-wrap">\n'
        '          <ul class="article-related-track">\n'
        f'{chr(10).join(items)}\n'
        '          </ul>\n'
        '        </div>\n'
        '      </section>\n'
    )


def inject_related_articles(content: str, source: Path) -> str:
    content = RELATED_SECTION_RE.sub('\n', content)
    block = build_related_articles_html(source)
    if not block:
        return content
    marker = '  </main>'
    if marker not in content:
        marker = '<footer class="footer">'
        if marker not in content:
            return content
        return content.replace(marker, block + '\n  ' + marker, 1)
    return content.replace(marker, block + marker, 1)


def sync_article(source: Path) -> Path:
    if not is_source_article(source):
        raise ValueError(f'Not a source article: {source}')

    index_path = source.parent / source.stem / 'index.html'
    index_path.parent.mkdir(parents=True, exist_ok=True)
    content = source.read_text(encoding='utf-8')
    content = sanitize_article_content_html(content)
    content = ensure_article_byline(content)
    content = ensure_article_related_assets(content, '../../')
    source_rel_path = normalize_rel_path(source)
    source.write_text(
        apply_seo(content, source_rel_path, source_path=source),
        encoding='utf-8',
    )
    index_content = apply_seo(
        source_to_index_content(content),
        normalize_rel_path(index_path),
        source_path=source,
    )
    index_content = ensure_article_related_assets(index_content, '../../../')
    index_content = inject_related_articles(index_content, source)
    index_path.write_text(index_content, encoding='utf-8')
    return index_path


def sync_all_articles() -> list[Path]:
    synced: list[Path] = []
    for source in iter_source_articles():
        synced.append(sync_article(source))
    return synced


def source_rel(source: Path) -> str:
    return source.relative_to(ROOT).as_posix()


def directory_url(source: Path) -> str:
    return canonical_article_url(source)
