#!/usr/bin/env python3
"""Sync GitHub Pages directory URLs for every source article."""

from __future__ import annotations

import sys

from article_lib import ROOT, iter_source_articles, sync_all_articles, sync_article


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] in {'-h', '--help'}:
        print('Usage: python scripts/build-articles.py [path/to/article.html ...]')
        print('')
        print('Regenerates articles/{category}/{slug}/index.html from each source')
        print('articles/{category}/{slug}.html file (one ../ level deeper).')
        print('Run with no arguments to sync all articles.')
        return 0

    if len(sys.argv) > 1:
        synced = []
        for arg in sys.argv[1:]:
            source = (ROOT / arg).resolve()
            if not source.exists():
                print(f'Error: file not found: {arg}', file=sys.stderr)
                return 1
            synced.append(sync_article(source))
    else:
        synced = sync_all_articles()

    if not synced:
        print('No source articles found under articles/{category}/{slug}.html')
        return 0

    for path in synced:
        print(f'Synced {path.relative_to(ROOT).as_posix()}')

    print(f'Done. {len(synced)} index file(s) updated.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
