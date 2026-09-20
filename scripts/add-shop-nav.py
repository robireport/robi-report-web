"""Insert Shop nav link before About across all site HTML files."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ROOT_INSERT = (
    '        <li><a href="standard-of-greatness.html">',
    '        <li><a href="shop.html">Shop</a></li>\n        <li><a href="about.html">',
)
ARTICLE_INSERT = (
    '        <li><a href="../../standard-of-greatness.html">',
    '        <li><a href="../../shop.html">Shop</a></li>\n        <li><a href="../../about.html">',
)


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    if path.name == 'shop.html':
        return False

    original = text

    if '../../about.html' in text and 'href="../../shop.html"' not in text:
        sog_line = None
        for line in text.splitlines():
            if '../../standard-of-greatness.html' in line and '<li>' in line:
                sog_line = line
                break
        if sog_line:
            text = text.replace(
                sog_line + '\n        <li><a href="../../about.html">',
                sog_line + '\n        <li><a href="../../shop.html">Shop</a></li>\n        <li><a href="../../about.html">',
                1,
            )
    elif 'href="about.html"' in text and 'href="shop.html"' not in text:
        sog_line = None
        for line in text.splitlines():
            if 'standard-of-greatness.html' in line and '<li>' in line and '../../' not in line:
                sog_line = line
                break
        if sog_line:
            text = text.replace(
                sog_line + '\n        <li><a href="about.html">',
                sog_line + '\n        <li><a href="shop.html">Shop</a></li>\n        <li><a href="about.html">',
                1,
            )

    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def main() -> None:
    updated = []
    for path in sorted(ROOT.rglob('*.html')):
        if path.name in {'404.html'}:
            continue
        if patch_file(path):
            updated.append(path.relative_to(ROOT))
    print(f'Updated {len(updated)} files:')
    for rel in updated:
        print(f'  {rel}')


if __name__ == '__main__':
    main()
