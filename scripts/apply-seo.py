#!/usr/bin/env python3
"""Apply canonical tags, VideoObject schema, and redirect helpers to all HTML pages."""

from __future__ import annotations

import sys

from seo_lib import ROOT, apply_seo_file, iter_html_files, write_site_redirects


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] in {'-h', '--help'}:
        print('Usage: python scripts/apply-seo.py')
        print('')
        print('Adds canonical URLs, VideoObject JSON-LD, and duplicate-path helpers')
        print('to every HTML file in the repository.')
        return 0

    updated_files: list[str] = []
    for path in iter_html_files():
        if apply_seo_file(path):
            updated_files.append(path.relative_to(ROOT).as_posix())

    redirects_path = write_site_redirects()

    if not updated_files:
        print('No HTML files needed SEO updates.')
    else:
        for rel in updated_files:
            print(f'Updated {rel}')
        print(f'Done. {len(updated_files)} HTML file(s) updated.')

    print(f'Wrote {redirects_path.relative_to(ROOT).as_posix()}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
