#!/usr/bin/env python3
"""Add hub-feed.css and remove breadcrumb from sport hub pages."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HUBS = [
    'nba.html',
    'wnba.html',
    'nfl.html',
    'soccer.html',
    'ufc.html',
    'boxing.html',
    'mlb.html',
]

CSS_LINK = '  <link rel="stylesheet" href="assets/hub-feed.css" />\n'
BREADCRUMB_RE = re.compile(
    r'\s*<nav class="hub-breadcrumb" aria-label="Breadcrumb">.*?</nav>\s*',
    re.S,
)
BREADCRUMB_CSS_RE = re.compile(
    r'\n    \.hub-breadcrumb \{.*?\n    \.hub-breadcrumb a:hover \{ color: var\(--accent\); \}\n',
    re.S,
)


def patch(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    text = BREADCRUMB_RE.sub('\n', text)
    text = BREADCRUMB_CSS_RE.sub('\n', text)
    if 'assets/hub-feed.css' not in text:
        text = text.replace(
            '  <link rel="stylesheet" href="assets/articles-empty.css" />\n',
            '  <link rel="stylesheet" href="assets/articles-empty.css" />\n' + CSS_LINK,
        )
    path.write_text(text, encoding='utf-8')


def main() -> None:
    for name in HUBS:
        patch(ROOT / name)
        print(f'Patched {name}')


if __name__ == '__main__':
    main()
