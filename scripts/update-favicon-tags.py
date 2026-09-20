#!/usr/bin/env python3
"""Point favicon and apple-touch-icon tags at padded icon assets."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

OLD_ICON_BLOCK = re.compile(
    r'\s*<link rel="icon" type="image/png" sizes="32x32" href="[^"]+" />\s*'
    r'<link rel="shortcut icon" href="[^"]+" type="image/png" />\s*'
    r'<link rel="apple-touch-icon" sizes="180x180" href="[^"]+" />\s*',
    re.I,
)

ICON_PREFIX = {
    'root': 'assets/',
    'article-source': '../../assets/',
    'article-index': '../../../assets/',
}


def prefix_for(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel.startswith('articles/') and rel.endswith('/index.html'):
        return ICON_PREFIX['article-index']
    if rel.startswith('articles/') and rel.count('/') == 2 and rel.endswith('.html'):
        return ICON_PREFIX['article-source']
    return ICON_PREFIX['root']


def build_icon_block(prefix: str) -> str:
    return (
        '\n'
        f'  <link rel="icon" type="image/png" sizes="32x32" '
        f'href="{prefix}squared-logo-icon-32.png?v=1" />\n'
        f'  <link rel="shortcut icon" href="{prefix}squared-logo-icon-32.png?v=1" '
        f'type="image/png" />\n'
        f'  <link rel="apple-touch-icon" sizes="180x180" '
        f'href="{prefix}squared-logo-icon-180.png?v=1" />\n'
    )


def update_file(path: Path) -> bool:
    content = path.read_text(encoding='utf-8')
    prefix = prefix_for(path)
    block = build_icon_block(prefix)
    updated, count = OLD_ICON_BLOCK.subn(block, content, count=1)
    if count:
        path.write_text(updated, encoding='utf-8')
        return True
    return False


def main() -> int:
    updated: list[str] = []
    for path in sorted(ROOT.rglob('*.html')):
        if 'node_modules' in path.parts:
            continue
        if update_file(path):
            updated.append(path.relative_to(ROOT).as_posix())

    for rel in updated:
        print(f'Updated {rel}')
    print(f'Done. {len(updated)} HTML file(s) updated.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
