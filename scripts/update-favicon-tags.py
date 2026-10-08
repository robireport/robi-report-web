#!/usr/bin/env python3
"""Standardize favicon, PWA manifest, and mobile bookmark tags across HTML pages."""

from __future__ import annotations

import json
import re
from pathlib import Path

from seo_lib import ROOT, build_head_icon_link_tags

ICON_BLOCK = re.compile(
    r'\s*(?:<meta name="theme-color"[^>]*/>\s*)?'
    r'(?:<link rel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*/>\s*)+'
    r'(?:<link rel="manifest"[^>]*/>\s*)*',
    re.I,
)


def update_file(path: Path) -> bool:
    content = path.read_text(encoding='utf-8')
    block = '\n' + build_head_icon_link_tags()
    updated, count = ICON_BLOCK.subn(block, content, count=1)
    if count:
        if updated != content:
            path.write_text(updated, encoding='utf-8')
            return True
        return False

    marker = '<meta name="apple-mobile-web-app-title" content="Robi Report" />'
    if marker in content:
        if 'rel="apple-touch-icon"' not in content:
            updated = content.replace(marker, marker + block.rstrip(), 1)
            path.write_text(updated, encoding='utf-8')
            return True

    return False


def verify_manifest_icons() -> None:
    brand_logo = ROOT / 'assets' / 'images' / 'emerald-r-logo.png'
    if not brand_logo.is_file():
        raise SystemExit(f'Missing canonical brand logo: {brand_logo.relative_to(ROOT).as_posix()}')

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
