#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

for path in ROOT.rglob('*.html'):
    if 'node_modules' in path.parts:
        continue
    text = path.read_text(encoding='utf-8')
    updated = text.replace('Robi Report" />  <link', 'Robi Report" />\n  <link')
    updated = updated.replace(
        'apple-touch-icon.png" />\n<link rel="manifest"',
        'apple-touch-icon.png" />\n  <link rel="manifest"',
    )
    if updated != text:
        path.write_text(updated, encoding='utf-8')
        print(path.relative_to(ROOT).as_posix())
