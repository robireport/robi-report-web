#!/usr/bin/env python3
"""Generate sitemap.xml and news-sitemap.xml for Robi Report."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

from article_lib import iter_source_articles, parse_article_title
from seo_lib import (
    ROOT,
    SITE_ORIGIN,
    canonical_url_for_path,
    extract_article_metadata,
    format_upload_date,
    is_article_index,
    normalize_rel_path,
)

NEWS_WINDOW = timedelta(hours=48)

PUBLIC_PAGES: list[tuple[str, str, str]] = [
    ('index.html', 'weekly', '1.0'),
    ('about.html', 'monthly', '0.7'),
    ('shop.html', 'weekly', '0.8'),
    ('product-seattle-hat.html', 'weekly', '0.7'),
    ('nba.html', 'weekly', '0.8'),
    ('wnba.html', 'weekly', '0.8'),
    ('nfl.html', 'weekly', '0.8'),
    ('ufc.html', 'weekly', '0.8'),
    ('boxing.html', 'weekly', '0.8'),
    ('soccer.html', 'weekly', '0.8'),
    ('mlb.html', 'weekly', '0.8'),
    ('standard-of-greatness.html', 'monthly', '0.7'),
]


def _iso_date_from_mtime(path: Path) -> str:
    stamp = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    return stamp.date().isoformat()


def _article_lastmod(source: Path, index_path: Path) -> str:
    meta = extract_article_metadata(index_path.read_text(encoding='utf-8'))
    if meta and meta.get('date_modified'):
        return meta['date_modified'][:10]
    stamps = [source.stat().st_mtime, index_path.stat().st_mtime]
    stamp = datetime.fromtimestamp(max(stamps), tz=timezone.utc)
    return stamp.date().isoformat()


def _append_url(
    urlset: ET.Element,
    loc: str,
    lastmod: str,
    changefreq: str,
    priority: str,
) -> None:
    url = ET.SubElement(urlset, 'url')
    ET.SubElement(url, 'loc').text = loc
    ET.SubElement(url, 'lastmod').text = lastmod
    ET.SubElement(url, 'changefreq').text = changefreq
    ET.SubElement(url, 'priority').text = priority


def collect_article_urls() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for source in iter_source_articles():
        index_path = source.parent / source.stem / 'index.html'
        if not index_path.exists():
            continue
        rel = normalize_rel_path(index_path)
        canonical = canonical_url_for_path(rel)
        if not canonical:
            continue
        meta = extract_article_metadata(index_path.read_text(encoding='utf-8'))
        rows.append(
            {
                'loc': canonical,
                'lastmod': _article_lastmod(source, index_path),
                'title': meta['headline'] if meta else parse_article_title(source),
                'date_published': meta.get('date_published', '') if meta else '',
                'is_news': meta.get('is_news', False) if meta else False,
            }
        )
    rows.sort(key=lambda row: row['loc'])
    return rows


def build_sitemap_xml(now: datetime | None = None) -> str:
    _ = now
    urlset = ET.Element(
        'urlset',
        xmlns='http://www.sitemaps.org/schemas/sitemap/0.9',
    )

    for rel_path, changefreq, priority in PUBLIC_PAGES:
        path = ROOT / rel_path
        if not path.exists():
            continue
        canonical = canonical_url_for_path(rel_path)
        if not canonical:
            continue
        _append_url(urlset, canonical, _iso_date_from_mtime(path), changefreq, priority)

    for article in collect_article_urls():
        _append_url(
            urlset,
            article['loc'],
            article['lastmod'],
            'monthly',
            '0.7',
        )

    ET.indent(urlset, space='  ')
    xml_body = ET.tostring(urlset, encoding='unicode')
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml_body + '\n'


def build_news_sitemap_xml(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    cutoff = now - NEWS_WINDOW

    urlset = ET.Element('urlset')
    urlset.set('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
    urlset.set('xmlns:news', 'http://www.google.com/schemas/sitemap-news/0.9')
    news_ns = 'http://www.google.com/schemas/sitemap-news/0.9'

    for article in collect_article_urls():
        if not article.get('is_news'):
            continue
        published_raw = article.get('date_published') or ''
        if not published_raw:
            continue
        published_dt = datetime.fromisoformat(format_upload_date(published_raw))
        if published_dt < cutoff:
            continue

        url = ET.SubElement(urlset, 'url')
        ET.SubElement(url, 'loc').text = article['loc']
        news = ET.SubElement(url, f'{{{news_ns}}}news')
        publication = ET.SubElement(news, f'{{{news_ns}}}publication')
        ET.SubElement(publication, f'{{{news_ns}}}name').text = 'Robi Report'
        ET.SubElement(publication, f'{{{news_ns}}}language').text = 'en'
        ET.SubElement(news, f'{{{news_ns}}}publication_date').text = format_upload_date(
            published_raw
        )
        ET.SubElement(news, f'{{{news_ns}}}title').text = article['title']

    ET.indent(urlset, space='  ')
    xml_body = ET.tostring(urlset, encoding='unicode')
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml_body + '\n'


def write_sitemaps(now: datetime | None = None) -> tuple[Path, Path]:
    sitemap_path = ROOT / 'sitemap.xml'
    news_path = ROOT / 'news-sitemap.xml'
    sitemap_path.write_text(build_sitemap_xml(now=now), encoding='utf-8')
    news_path.write_text(build_news_sitemap_xml(now=now), encoding='utf-8')
    return sitemap_path, news_path


def expected_indexable_article_urls() -> set[str]:
    urls: set[str] = set()
    for source in iter_source_articles():
        index_path = source.parent / source.stem / 'index.html'
        rel = normalize_rel_path(index_path)
        if is_article_index(rel):
            canonical = canonical_url_for_path(rel)
            if canonical:
                urls.add(canonical)
    return urls
