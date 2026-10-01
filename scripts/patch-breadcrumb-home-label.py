#!/usr/bin/env python3
"""Replace Home with Robi Report in article breadcrumb nav only."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATTERN = re.compile(
    r'(<nav class="article-breadcrumb"[^>]*>\s*'
    r'<a href="(?:\.\./)+index\.html">)Home(</a>)',
    re.I,
)


def main() -> int:
    updated = 0
    for path in ROOT.rglob('*.html'):
        if 'node_modules' in path.parts:
            continue
        text = path.read_text(encoding='utf-8')
        new_text, count = PATTERN.subn(r'\1Robi Report\2', text)
        if count:
            path.write_text(new_text, encoding='utf-8')
            updated += 1
    print(f'Updated breadcrumb label in {updated} file(s).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
