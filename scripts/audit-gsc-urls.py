#!/usr/bin/env python3
"""Audit URL/canonical coverage for Search Console troubleshooting."""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / 'scripts'
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from article_lib import canonical_article_url, iter_source_articles  # noqa: E402
from seo_lib import SITE_ORIGIN  # noqa: E402

CANON = re.compile(r'<link rel="canonical" href="([^"]+)"', re.I)
ROBOTS = re.compile(r'<meta name="robots" content="([^"]+)"', re.I)
REFRESH = re.compile(r'<meta http-equiv="refresh"', re.I)


def load_sitemap_urls() -> set[str]:
    tree = ET.parse(ROOT / 'sitemap.xml')
    urls: set[str] = set()
    for el in tree.getroot().iter():
        if el.tag.endswith('loc') and el.text:
            urls.add(el.text.strip())
    return urls


def main() -> int:
    missing_canonical: list[str] = []
    noindex: list[str] = []
    canonical_by_file: dict[str, str] = {}

    for path in sorted(ROOT.rglob('*.html')):
        if 'node_modules' in path.parts:
            continue
        rel = path.relative_to(ROOT).as_posix()
        if rel == 'articles/template.html':
            continue
        text = path.read_text(encoding='utf-8')
        match = CANON.search(text)
        if match:
            canonical_by_file[rel] = match.group(1)
        else:
            missing_canonical.append(rel)
        robots = ROBOTS.search(text)
        if robots and 'noindex' in robots.group(1).lower():
            noindex.append(rel)

    print('=== Missing canonical tag ===')
    for rel in missing_canonical:
        print(rel)

    print('\n=== Noindex pages ===')
    for rel in noindex:
        print(rel)

    print('\n=== Article URL variants ===')
    sitemap = load_sitemap_urls()
    for source in iter_source_articles():
        slug = source.stem
        sport = source.parent.name
        canonical = f'{SITE_ORIGIN}{canonical_article_url(source)}'
        variants = {
            'canonical_dir': canonical,
            'source_html': f'{SITE_ORIGIN}/articles/{sport}/{slug}.html',
            'dir_no_slash': f'{SITE_ORIGIN}/articles/{sport}/{slug}',
            'index_explicit': f'{SITE_ORIGIN}/articles/{sport}/{slug}/index.html',
            'www_canonical': canonical.replace('https://robireport.com', 'https://www.robireport.com'),
        }
        src_rel = source.relative_to(ROOT).as_posix()
        idx_rel = f'articles/{sport}/{slug}/index.html'
        print(f'\n{canonical}')
        print(f'  in_sitemap: {canonical in sitemap}')
        print(f'  source_canonical_points_to: {canonical_by_file.get(src_rel, "MISSING")}')
        print(f'  index_canonical_points_to: {canonical_by_file.get(idx_rel, "MISSING")}')
        print(f'  source_has_refresh: {bool(REFRESH.search(source.read_text(encoding="utf-8")[:5000]))}')

    print('\n=== Site redirect targets (intentional) ===')
    site = json.loads((ROOT / 'assets/site-redirects.json').read_text(encoding='utf-8'))
    for src, dst in site.items():
        print(f'{SITE_ORIGIN}{src} -> {SITE_ORIGIN}{dst}')

    print('\n=== Legacy redirect count ===')
    article = json.loads((ROOT / 'assets/article-redirects.json').read_text(encoding='utf-8'))
    print(f'article-redirects.json entries: {len(article)}')

    print('\n=== Sitemap URLs not matching article canonical set ===')
    expected = {f'{SITE_ORIGIN}{canonical_article_url(s)}' for s in iter_source_articles()}
    article_sm = {u for u in sitemap if '/articles/' in u}
    print('missing:', sorted(expected - article_sm))
    print('extra:', sorted(article_sm - expected))

    print('\n=== Hub pages in sitemap ===')
    for rel in ['game.html', 'player.html', 'recap.html', 'gamecast.html']:
        url = f'{SITE_ORIGIN}/{rel}'
        print(f'{url}: {"yes" if url in sitemap else "no"} canonical={canonical_by_file.get(rel, "MISSING")}')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
