#!/usr/bin/env python3
"""Standardize favicon, PWA manifest, and mobile bookmark tags across HTML pages."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

THEME_COLOR = '#10B981'
MANIFEST_HREF = '/site.webmanifest'
MANIFEST_JSON_HREF = '/manifest.json'


def build_icon_block() -> str:
    return (
        '\n'
        f'  <meta name="theme-color" content="{THEME_COLOR}" />\n'
        '  <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />\n'
        '  <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />\n'
        '  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />\n'
        '  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />\n'
        '  <link rel="icon" href="/favicon.ico" sizes="any" />\n'
        '  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />\n'
        f'  <link rel="manifest" href="{MANIFEST_HREF}" />\n'
        f'  <link rel="manifest" href="{MANIFEST_JSON_HREF}" />\n'
    )


ICON_BLOCK = re.compile(
    r'\s*(?:<meta name="theme-color"[^>]*/>\s*)?'
    r'(?:<link rel="icon"[^>]*/>\s*)+'
    r'<link rel="apple-touch-icon"[^>]*/>\s*'
    r'(?:<link rel="manifest"[^>]*/>\s*)*',
    re.I,
)


def update_file(path: Path) -> bool:
    content = path.read_text(encoding='utf-8')
    block = build_icon_block()
    updated, count = ICON_BLOCK.subn(block, content, count=1)
    if count:
        if updated != content:
            path.write_text(updated, encoding='utf-8')
            return True
        return False

    marker = '<meta name="apple-mobile-web-app-title" content="Robi Report" />'
    if marker in content:
        if 'rel="apple-touch-icon"' not in content:
            updated = content.replace(marker, marker + build_icon_block().rstrip(), 1)
            path.write_text(updated, encoding='utf-8')
            return True
        if 'name="theme-color"' not in content:
            standalone = re.compile(
                r'\s*<link rel="apple-touch-icon"[^>]*/>\s*',
                re.I,
            )
            updated, count = standalone.subn(build_icon_block(), content, count=1)
            if count:
                path.write_text(updated, encoding='utf-8')
                return True

    return False


def verify_manifest_icons() -> None:
    for name in ('site.webmanifest', 'manifest.json'):
        path = ROOT / name
        data = json.loads(path.read_text(encoding='utf-8'))
        sizes = {entry.get('sizes') for entry in data.get('icons', [])}
        if '192x192' not in sizes or '512x512' not in sizes:
            raise SystemExit(f'{name} missing required 192x192 or 512x512 icon entries.')


def main() -> int:
    verify_manifest_icons()
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
