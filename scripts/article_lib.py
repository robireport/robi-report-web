#!/usr/bin/env python3
"""Article publishing utilities for Robi Report (static HTML on GitHub Pages)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLES_DIR = ROOT / 'articles'

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
    rel = source.relative_to(ARTICLES_DIR)
    return f'/articles/{rel.parent.as_posix()}/{rel.stem}/'
