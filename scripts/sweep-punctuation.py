#!/usr/bin/env python3
"""Run sitewide punctuation cleanup (em dashes, leading paragraph dashes)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] in {'-h', '--help'}:
        print('Usage: python scripts/sweep-punctuation.py')
        print('')
        print('Regenerates SEO tags and article indexes with copy sanitization enabled.')
        return 0

    for script in ('apply-seo.py', 'build-articles.py', 'verify-seo.py'):
        path = ROOT / 'scripts' / script
        result = subprocess.run([sys.executable, str(path)], cwd=ROOT, check=False)
        if result.returncode != 0:
            return result.returncode
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
