#!/usr/bin/env python3
"""Scaffold a new article and sync its GitHub Pages directory URL."""

from __future__ import annotations

import argparse
import html
import re
import sys
from datetime import date
from pathlib import Path

from article_lib import (
    ARTICLES_DIR,
    HUBS,
    ROOT,
    VALID_CATEGORIES,
    directory_url,
    source_rel,
    sync_article,
)

TEMPLATE = ARTICLES_DIR / 'template.html'


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r'[^a-z0-9]+', '-', value)
    return value.strip('-')


def truncate(text: str, limit: int = 48) -> str:
    text = re.sub(r'\s+', ' ', text.strip())
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + '...'


def render_template(
    category: str,
    title: str,
    *,
    author: str,
    date_iso: str,
    date_display: str,
    read_time: str,
    hero_image: str,
    hero_alt: str,
    body_html: str,
    story_tag: str,
) -> str:
    hub_file, hub_label = HUBS[category]
    content = TEMPLATE.read_text(encoding='utf-8')

    replacements = {
        '{PAGE_TITLE}': html.escape(title),
        '{HUB_LINK}': hub_file,
        '{HUB_LABEL}': hub_label,
        '{BREADCRUMB}': html.escape(truncate(title)),
        '{{CATEGORY}}': html.escape(story_tag),
        '{{TITLE}}': html.escape(title),
        '{{AUTHOR}}': html.escape(author),
        '{{DATE_ISO}}': date_iso,
        '{{DATE_DISPLAY}}': html.escape(date_display),
        '{{READ_TIME}}': html.escape(read_time),
        '{{HERO_IMAGE}}': html.escape(hero_image, quote=True),
        '{{HERO_ALT}}': html.escape(hero_alt),
        '{{BODY_CONTENT}}': body_html,
    }

    for old, new in replacements.items():
        content = content.replace(old, new)

    for cat, (cat_hub_file, _) in HUBS.items():
        marker = f'href="../../{cat_hub_file}"'
        if cat == category:
            content = content.replace(
                f'<li><a {marker}>',
                f'<li><a {marker} class="active">',
                1,
            )

    return content


def default_body(title: str) -> str:
    safe_title = html.escape(title)
    return (
        f'        <p>Replace this paragraph with the opening of "{safe_title}".</p>\n'
        '        <p>Add more paragraphs, headings, and quotes here.</p>'
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Create articles/{category}/{slug}.html and sync its index.html copy.',
    )
    parser.add_argument('category', choices=sorted(VALID_CATEGORIES))
    parser.add_argument('slug', help='URL slug, e.g. curry-under-armour')
    parser.add_argument('title', help='Article headline')
    parser.add_argument('--author', default='Robi Report')
    parser.add_argument('--date', dest='date_iso', default=date.today().isoformat())
    parser.add_argument('--date-display', default=date.today().strftime('%B %d, %Y'))
    parser.add_argument('--read-time', default='4 min read')
    parser.add_argument('--tag', default='News', help='Story tag before the league label')
    parser.add_argument('--hero-image', default='https://via.placeholder.com/1200x630?text=Hero+Image')
    parser.add_argument('--hero-alt', default='')
    parser.add_argument('--body-file', type=Path, help='HTML file for article body (inside .article-body)')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    category = args.category.lower()
    slug = slugify(args.slug)

    if category not in VALID_CATEGORIES:
        print(f'Error: unsupported category "{args.category}".', file=sys.stderr)
        return 1

    if not slug:
        print('Error: slug must contain letters or numbers.', file=sys.stderr)
        return 1

    if not TEMPLATE.exists():
        print(f'Error: template missing at {TEMPLATE}', file=sys.stderr)
        return 1

    source = ARTICLES_DIR / category / f'{slug}.html'
    if source.exists():
        print(f'Error: article already exists: {source_rel(source)}', file=sys.stderr)
        return 1

    if args.body_file:
        body_html = args.body_file.read_text(encoding='utf-8').strip()
        if not body_html:
            print('Error: body file is empty.', file=sys.stderr)
            return 1
    else:
        body_html = default_body(args.title)

    _, hub_label = HUBS[category]
    story_tag = f'{args.tag} · {hub_label}'
    hero_alt = args.hero_alt or args.title

    rendered = render_template(
        category,
        args.title,
        author=args.author,
        date_iso=args.date_iso,
        date_display=args.date_display,
        read_time=args.read_time,
        hero_image=args.hero_image,
        hero_alt=hero_alt,
        body_html=body_html,
        story_tag=story_tag,
    )

    source.parent.mkdir(parents=True, exist_ok=True)
    source.write_text(rendered, encoding='utf-8')
    index_path = sync_article(source)

    print(f'Created {source_rel(source)}')
    print(f'Synced  {index_path.relative_to(ROOT).as_posix()}')
    print('')
    print('Next steps:')
    print(f'  1. Edit {source_rel(source)} with your full article content')
    print('  2. Run: npm run build:articles')
    print('  3. Run: python restore_articles.py   (refresh homepage + hub feeds)')
    print('  4. Add the article URL to sitemap.xml if needed')
    print('')
    print('Live URLs after deploy:')
    print(f'  https://robireport.com{directory_url(source)}')
    print(f'  https://robireport.com/{source_rel(source)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
