#!/usr/bin/env python3
"""Article publishing utilities for Robi Report (static HTML on GitHub Pages)."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLES_DIR = ROOT / 'articles'
REDIRECTS_FILE = ROOT / 'assets' / 'article-redirects.json'

VALID_CATEGORIES = frozenset({'nba', 'wnba', 'nfl', 'ufc', 'boxing', 'soccer', 'mlb'})

HUBS = {
    'nba': ('nba.html', 'NBA'),
    'wnba': ('wnba.html', 'WNBA'),
    'nfl': ('nfl.html', 'NFL'),
    'ufc': ('ufc.html', 'UFC'),
    'boxing': ('boxing.html', 'BOXING'),
    'soccer': ('soccer.html', 'SOCCER'),
    'mlb': ('mlb.html', 'MLB'),
}


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


def sync_article(source: Path) -> Path:
    if not is_source_article(source):
        raise ValueError(f'Not a source article: {source}')

    index_path = source.parent / source.stem / 'index.html'
    index_path.parent.mkdir(parents=True, exist_ok=True)
    content = source.read_text(encoding='utf-8')
    index_path.write_text(source_to_index_content(content), encoding='utf-8')
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
