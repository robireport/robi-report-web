#!/usr/bin/env python3
"""Regenerate sitemap.xml and news-sitemap.xml."""

from __future__ import annotations

from sitemap_lib import write_sitemaps


def main() -> int:
    sitemap_path, news_path = write_sitemaps()
    print(f'Wrote {sitemap_path.name}')
    print(f'Wrote {news_path.name}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
