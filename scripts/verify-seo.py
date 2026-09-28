#!/usr/bin/env python3
"""Validate SEO artifacts for Robi Report."""

from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

from article_lib import iter_source_articles
from seo_lib import (
    ROOT,
    canonical_url_for_path,
    extract_article_metadata,
    normalize_rel_path,
)
from sitemap_lib import NEWS_WINDOW, expected_indexable_article_urls

CANONICAL_RE = re.compile(r'<link rel="canonical" href="([^"]+)"', re.I)
ROBOTS_RE = re.compile(r'<meta name="robots" content="([^"]+)"', re.I)
ARTICLE_SCHEMA_RE = re.compile(r'id="robi-article-schema"', re.I)
META_DESC_RE = re.compile(r'<meta name="description" content="([^"]+)"', re.I)
INTERNAL_ARTICLE_LINK_RE = re.compile(r'href="(?:/)?articles/[^"]+"')


def load_sitemap_urls(path: Path) -> set[str]:
    tree = ET.parse(path)
    root = tree.getroot()
    ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    urls: set[str] = set()
    for loc in root.findall('.//sm:loc', ns):
        if loc.text:
            urls.add(loc.text.strip())
    if not urls:
        for loc in root.iter():
            if loc.tag.endswith('loc') and loc.text:
                urls.add(loc.text.strip())
    return urls


def verify_robots() -> list[str]:
    errors: list[str] = []
    robots = (ROOT / 'robots.txt').read_text(encoding='utf-8')
    if 'Sitemap: https://robireport.com/sitemap.xml' not in robots:
        errors.append('robots.txt missing main sitemap reference')
    if 'news-sitemap.xml' not in robots:
        errors.append('robots.txt missing news sitemap reference')
    if re.search(r'Disallow:\s*/', robots, re.I):
        errors.append('robots.txt appears to disallow public paths')
    return errors


def verify_sitemaps() -> list[str]:
    errors: list[str] = []
    expected = expected_indexable_article_urls()
    sitemap_urls = load_sitemap_urls(ROOT / 'sitemap.xml')

    missing = sorted(expected - sitemap_urls)
    if missing:
        errors.append(f'sitemap.xml missing {len(missing)} article URL(s), e.g. {missing[0]}')

    duplicate_html = [url for url in sitemap_urls if url.endswith('.html') and '/articles/' in url]
    if duplicate_html:
        errors.append('sitemap.xml contains legacy .html article URLs')

    news_path = ROOT / 'news-sitemap.xml'
    if not news_path.exists():
        errors.append('news-sitemap.xml is missing')
        return errors

    news_urls = load_sitemap_urls(news_path)
    now = datetime.now(timezone.utc)
    cutoff = now - NEWS_WINDOW

    for source in iter_source_articles():
        index_path = source.parent / source.stem / 'index.html'
        meta = extract_article_metadata(index_path.read_text(encoding='utf-8'))
        if not meta:
            continue
        canonical = canonical_url_for_path(normalize_rel_path(index_path))
        published = meta.get('date_published') or ''
        if not published:
            continue
        published_dt = datetime.fromisoformat(f'{published}T00:00:00+00:00')
        is_recent_news = meta.get('is_news') and published_dt >= cutoff
        if is_recent_news and canonical not in news_urls:
            errors.append(f'news-sitemap.xml missing recent news article: {canonical}')
        if (not is_recent_news or not meta.get('is_news')) and canonical in news_urls:
            errors.append(f'news-sitemap.xml incorrectly includes old/non-news URL: {canonical}')

    return errors


def verify_articles() -> list[str]:
    errors: list[str] = []
    for source in iter_source_articles():
        index_path = source.parent / source.stem / 'index.html'
        rel = normalize_rel_path(index_path)
        html = index_path.read_text(encoding='utf-8')
        canonical = canonical_url_for_path(rel)

        if not CANONICAL_RE.search(html):
            errors.append(f'{rel}: missing canonical tag')
        elif canonical and CANONICAL_RE.search(html).group(1) != canonical:
            errors.append(f'{rel}: canonical mismatch')

        if not META_DESC_RE.search(html):
            errors.append(f'{rel}: missing meta description')

        robots = ROBOTS_RE.search(html)
        if not robots or 'noindex' in robots.group(1).lower():
            errors.append(f'{rel}: missing or blocking robots meta')

        if not ARTICLE_SCHEMA_RE.search(html):
            errors.append(f'{rel}: missing article JSON-LD')

        category = source.parent.name
        peer_count = sum(
            1
            for peer in iter_source_articles()
            if peer.parent.name == category and peer != source
        )
        if peer_count and 'class="article-related"' not in html:
            errors.append(f'{rel}: missing related-articles section')

    return errors


def verify_internal_links() -> list[str]:
    errors: list[str] = []
    for page in (ROOT / 'index.html', ROOT / 'wnba.html'):
        text = page.read_text(encoding='utf-8')
        if not INTERNAL_ARTICLE_LINK_RE.search(text):
            errors.append(f'{page.name}: no crawlable article links found')
        if 'articles/' in text and '.html"' in text and re.search(r'href="articles/[^"]+\.html"', text):
            errors.append(f'{page.name}: still links to legacy .html article aliases')
    return errors


def main() -> int:
    checks = [
        ('robots.txt', verify_robots),
        ('sitemaps', verify_sitemaps),
        ('article metadata', verify_articles),
        ('internal links', verify_internal_links),
    ]

    failures: list[str] = []
    for label, fn in checks:
        result = fn()
        if result:
            failures.extend(f'[{label}] {msg}' for msg in result)
        else:
            print(f'OK: {label}')

    if failures:
        print('SEO verification failed:', file=sys.stderr)
        for msg in failures:
            print(f'  - {msg}', file=sys.stderr)
        return 1

    print('All SEO checks passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
