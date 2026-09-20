#!/usr/bin/env python3
"""Point favicon and apple-touch-icon tags at padded icon assets."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FAVICON_32 = '/assets/squared-logo-icon-32.png?v=1'
APPLE_TOUCH_ICON = '/assets/squared-logo-icon-180.png?v=1'

ICON_BLOCK = re.compile(
    r'\s*<link rel="icon" type="image/png" sizes="32x32" href="[^"]+" />\s*'
    r'<link rel="shortcut icon" href="[^"]+" type="image/png" />\s*'
    r'<link rel="apple-touch-icon"[^>]*href="[^"]+"[^>]*/>\s*',
    re.I,
)

STANDALONE_APPLE_TOUCH = re.compile(
    r'\s*<link rel="apple-touch-icon"[^>]*href="[^"]+"[^>]*/>\s*',
    re.I,
)


def build_icon_block() -> str:
    return (
        '\n'
        f'  <link rel="icon" type="image/png" sizes="32x32" href="{FAVICON_32}" />\n'
        f'  <link rel="shortcut icon" href="{FAVICON_32}" type="image/png" />\n'
        f'  <link rel="apple-touch-icon" href="{APPLE_TOUCH_ICON}" />\n'
    )


def build_apple_touch_tag() -> str:
    return f'  <link rel="apple-touch-icon" href="{APPLE_TOUCH_ICON}" />\n'


def update_file(path: Path) -> bool:
    content = path.read_text(encoding='utf-8')
    block = build_icon_block()
    updated, count = ICON_BLOCK.subn(block, content, count=1)
    if count:
        path.write_text(updated, encoding='utf-8')
        return True

    if STANDALONE_APPLE_TOUCH.search(content):
        updated = STANDALONE_APPLE_TOUCH.sub(build_apple_touch_tag(), content, count=1)
        if updated != content:
            path.write_text(updated, encoding='utf-8')
            return True

    # Game view stubs and other minimal heads: insert after apple-mobile-web-app-title.
    marker = '<meta name="apple-mobile-web-app-title" content="Robi Report" />'
    if marker in content and 'rel="apple-touch-icon"' not in content:
        updated = content.replace(
            marker,
            marker + '\n' + build_apple_touch_tag().rstrip(),
            1,
        )
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
