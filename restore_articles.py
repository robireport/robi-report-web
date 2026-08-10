#!/usr/bin/env python3
"""Restore real article feeds from articles/ HTML files."""
import html
import re
from pathlib import Path

ROOT = Path(__file__).parent
ARTICLES_DIR = ROOT / 'articles'

HUBS = {
    'nba.html': 'nba',
    'wnba.html': 'wnba',
    'nfl.html': 'nfl',
    'ufc.html': 'ufc',
    'boxing.html': 'boxing',
    'soccer.html': 'soccer',
    'mlb.html': 'mlb',
}

# Prefer lead story per hub (relative path under articles/)
LEAD_ORDER = {
    'nba': 'articles/nba/curry-under-armour.html',
    'wnba': 'articles/wnba/awa-fam-breakout-mercury.html',
    'nfl': 'articles/nfl/2023-draft-winners-losers.html',
    'ufc': 'articles/ufc/ufc-business-model.html',
    'boxing': 'articles/boxing/how-to-fix-boxing.html',
    'soccer': 'articles/soccer/emma-hayes-shebelieves-roster.html',
    'mlb': 'articles/mlb/mariners-2022-campaign.html',
}

INDEX_FEATURED_ORDER = [
    'articles/wnba/awa-fam-breakout-mercury.html',
    'articles/wnba/mystics-storm-physicality.html',
    'articles/wnba/awa-fam-storm-debut.html',
    'articles/nba/curry-under-armour.html',
    'articles/soccer/emma-hayes-shebelieves-roster.html',
    'articles/nba/basketball-sucks-fix.html',
    'articles/nfl/2023-draft-winners-losers.html',
    'articles/boxing/how-to-fix-boxing.html',
]


def parse_article(path: Path) -> dict:
    text = path.read_text(encoding='utf-8')
    rel = path.relative_to(ROOT).as_posix()

    title_m = re.search(r'<h1 class="article-title">(.*?)</h1>', text, re.S)
    tag_m = re.search(r'<span class="article-tag">(.*?)</span>', text, re.S)
    meta_m = re.search(r'<div class="article-meta">(.*?)</div>', text, re.S)
    img_m = re.search(r'<figure class="article-hero">\s*<img src="([^"]+)" alt="([^"]*)"', text, re.S)
    body_m = re.search(r'<div class="article-body">\s*<p>(.*?)</p>', text, re.S)

    title = html.unescape(re.sub(r'\s+', ' ', title_m.group(1))).strip() if title_m else path.stem
    tag_raw = html.unescape(tag_m.group(1)).strip() if tag_m else 'News'
    tag_parts = [p.strip() for p in tag_raw.replace('·', '·').split('·')]
    story_tag = tag_parts[0] if tag_parts else 'News'
    league = tag_parts[-1].upper() if len(tag_parts) > 1 else path.parent.name.upper()

    author = 'Robi Report'
    date_iso = ''
    date_label = ''
    read_time = ''
    if meta_m:
        meta = meta_m.group(1)
        author_m = re.search(r'<strong>(.*?)</strong>', meta, re.S)
        time_m = re.search(r'<time datetime="([^"]+)">([^<]+)</time>', meta)
        read_m = re.search(r'<span>(\d+\s*min read)</span>', meta)
        if author_m:
            author = html.unescape(author_m.group(1)).strip()
        if time_m:
            date_iso = time_m.group(1)
            date_label = html.unescape(time_m.group(2)).strip()
        if read_m:
            read_time = read_m.group(1)

    hero_src = img_m.group(1) if img_m else ''
    alt = html.unescape(img_m.group(2)).strip() if img_m else title
    excerpt_raw = body_m.group(1) if body_m else ''
    excerpt = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', html.unescape(excerpt_raw))).strip()
    if len(excerpt) > 160:
        excerpt = excerpt[:157].rsplit(' ', 1)[0] + '...'

    sport = path.parent.name
    return {
        'rel': rel,
        'sport': sport,
        'title': title,
        'story_tag': story_tag,
        'league': league,
        'author': author,
        'date_iso': date_iso,
        'date_label': date_label,
        'read_time': read_time,
        'hero_src': hero_src,
        'alt': alt,
        'excerpt': excerpt,
    }


def resize_wix(url: str, w: int, h: int) -> str:
    if not url:
        return url
    return re.sub(r'/v1/fill/w_\d+,h_\d+', f'/v1/fill/w_{w},h_{h}', url)


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def lead_html(a: dict) -> str:
    img = resize_wix(a['hero_src'], 960, 540)
    meta_bits = [f'<strong>{esc(a["author"])}</strong>']
    if a['date_label']:
        meta_bits.append(f'<span class="dot"></span><span>{esc(a["date_label"])}</span>')
    if a['read_time']:
        meta_bits.append(f'<span class="dot"></span><span>{esc(a["read_time"])}</span>')
    return f'''      <article class="lead-story">
        <a href="{esc(a["rel"])}">
        <div class="lead-story-image">
          <img src="{esc(img)}" alt="{esc(a["alt"])}" />
        </div>
        <div class="lead-story-body">
          <span class="story-tag">{esc(a["story_tag"])}</span>
          <h2>{esc(a["title"])}</h2>
          <p class="subtitle">{esc(a["excerpt"])}</p>
          <div class="author-meta">
            {' '.join(meta_bits)}
          </div>
        </div>
        </a>
      </article>'''


def news_row_html(a: dict) -> str:
    img = resize_wix(a['hero_src'], 280, 210)
    meta = a['story_tag']
    if a['read_time']:
        meta += f' · {a["read_time"]}'
    return f'''        <article class="news-row">
          <a href="{esc(a["rel"])}" class="news-row-link">
          <div class="news-row-thumb">
            <img src="{esc(img)}" alt="{esc(a["alt"])}" />
          </div>
          <div class="news-row-body">
            <h3>{esc(a["title"])}</h3>
            <p>{esc(a["excerpt"])}</p>
            <div class="news-row-meta">{esc(meta)}</div>
          </div>
          </a>
        </article>'''


def card_html(a: dict, featured: bool = False) -> str:
    w, h = (900, 506) if featured else (600, 375)
    img = resize_wix(a['hero_src'], w, h)
    cls = 'card card-featured' if featured else 'card'
    meta_bits = [f'<span>{esc(a["league"])}</span>']
    if a['read_time']:
        meta_bits.append(f'<span class="dot"></span><span>{esc(a["read_time"])}</span>')
    if a['date_label']:
        meta_bits.append(f'<span class="dot"></span><span>{esc(a["date_label"])}</span>')
    return f'''      <article class="{cls}">
        <a href="{esc(a["rel"])}">
        <div class="card-image">
          <img src="{esc(img)}" alt="{esc(a["alt"])}" />
          <span class="card-tag">{esc(a["league"] if not featured else a["story_tag"])}</span>
        </div>
        <div class="card-body">
          <div class="card-meta">
            {' '.join(meta_bits)}
          </div>
          <h3>{esc(a["title"])}</h3>
          <p>{esc(a["excerpt"])}</p>
        </div>
        </a>
      </article>'''


def hub_center_html(articles: list[dict], sport: str) -> str:
    if not articles:
        return '''    <section class="hub-center">
      <div class="articles-feed-header">
        <h2>LATEST ANALYSIS &amp; ARTICLES</h2>
      </div>
      <div class="articles-empty">
        <div class="articles-empty-card">
          <h3>Written Coverage Coming Soon</h3>
          <p>In-depth editorial breakdowns, film studies, and features are currently in production. In the meantime, check out our original video series and podcast coverage.</p>
          <a href="standard-of-greatness.html" class="btn btn-primary btn-lg">Watch &lsquo;The Standard of Greatness&rsquo;</a>
        </div>
      </div>
    </section>'''

    by_rel = {a['rel']: a for a in articles}
    lead_rel = LEAD_ORDER.get(sport)
    lead = by_rel.get(lead_rel) if lead_rel in by_rel else articles[0]
    rest = [a for a in articles if a['rel'] != lead['rel']]
    rest.sort(key=lambda x: x['date_iso'], reverse=True)

    rows = '\n'.join(news_row_html(a) for a in rest)
    stack = f'\n      <div class="news-stack">\n{rows}\n      </div>' if rest else ''

    return f'''    <section class="hub-center">
      <div class="articles-feed-header">
        <h2>LATEST ANALYSIS &amp; ARTICLES</h2>
      </div>

{lead_html(lead)}
{stack}
    </section>'''


def index_featured_html(all_articles: dict[str, dict]) -> str:
    ordered = []
    seen = set()
    for rel in INDEX_FEATURED_ORDER:
        if rel in all_articles:
            ordered.append(all_articles[rel])
            seen.add(rel)
    for rel, a in sorted(all_articles.items(), key=lambda kv: kv[1]['date_iso'], reverse=True):
        if rel not in seen:
            ordered.append(a)

    if not ordered:
        return '''  <section class="featured articles-feed" id="featured">
    <div class="articles-feed-header">
      <h2>LATEST ANALYSIS &amp; ARTICLES</h2>
    </div>
    <div class="articles-empty">
      <div class="articles-empty-card">
        <h3>Written Coverage Coming Soon</h3>
        <p>In-depth editorial breakdowns, film studies, and features are currently in production. In the meantime, check out our original video series and podcast coverage.</p>
        <a href="standard-of-greatness.html" class="btn btn-primary btn-lg">Watch &lsquo;The Standard of Greatness&rsquo;</a>
      </div>
    </div>
  </section>'''

    cards = [card_html(ordered[0], featured=True)]
    cards.extend(card_html(a) for a in ordered[1:])
    grid = '\n\n'.join(cards)
    return f'''  <section class="featured articles-feed" id="featured">
    <div class="articles-feed-header">
      <h2>LATEST ANALYSIS &amp; ARTICLES</h2>
    </div>
    <div class="content-grid">
{grid}
    </div>
  </section>'''


def sog_articles_html(all_articles: dict[str, dict]) -> str:
    ordered = []
    for rel in INDEX_FEATURED_ORDER:
        if rel in all_articles:
            ordered.append(all_articles[rel])
    if not ordered:
        return '''      <div class="articles-empty">
        <div class="articles-empty-card">
          <h3>Written Coverage Coming Soon</h3>
          <p>In-depth editorial breakdowns, film studies, and features are currently in production. In the meantime, check out our original video series and podcast coverage.</p>
          <a href="#philosophy-series" class="btn btn-primary btn-lg">Watch &lsquo;The Standard of Greatness&rsquo;</a>
        </div>
      </div>'''

    cards = [card_html(ordered[0], featured=True)]
    cards.extend(card_html(a) for a in ordered[1:6])
    grid = '\n\n'.join(cards)
    return f'''      <div class="content-grid articles-feed-grid">
{grid}
      </div>'''


def patch_hub(path: Path, sport: str, articles: list[dict]) -> None:
    text = path.read_text(encoding='utf-8')
    replacement = hub_center_html(articles, sport)
    text = re.sub(
        r'    <section class="hub-center">.*?</section>',
        replacement,
        text,
        count=1,
        flags=re.DOTALL,
    )
    path.write_text(text, encoding='utf-8')


def patch_index(all_articles: dict[str, dict]) -> None:
    path = ROOT / 'index.html'
    text = path.read_text(encoding='utf-8')
    replacement = index_featured_html(all_articles)
    text = re.sub(
        r'  <!-- Featured Content -->\s*<section class="featured articles-feed" id="featured">.*?</section>',
        '  <!-- Featured Content -->\n' + replacement,
        text,
        count=1,
        flags=re.DOTALL,
    )
    path.write_text(text, encoding='utf-8')


def patch_sog(all_articles: dict[str, dict]) -> None:
    path = ROOT / 'standard-of-greatness.html'
    text = path.read_text(encoding='utf-8')
    replacement = sog_articles_html(all_articles)
    text = re.sub(
        r'      <div class="articles-empty">.*?</div>\s*\n\s*<section class="sog-series"',
        replacement + '\n\n      <section class="sog-series"',
        text,
        count=1,
        flags=re.DOTALL,
    )
    path.write_text(text, encoding='utf-8')


def main() -> None:
    all_articles: dict[str, dict] = {}
    by_sport: dict[str, list[dict]] = {}

    for path in sorted(ARTICLES_DIR.rglob('*.html')):
        if path.name == 'template.html':
            continue
        article = parse_article(path)
        all_articles[article['rel']] = article
        by_sport.setdefault(article['sport'], []).append(article)

    for sport, items in by_sport.items():
        items.sort(key=lambda x: x['date_iso'], reverse=True)

    for hub_file, sport in HUBS.items():
        hub_path = ROOT / hub_file
        if hub_path.exists():
            patch_hub(hub_path, sport, by_sport.get(sport, []))
            print(f'Restored {hub_file} ({len(by_sport.get(sport, []))} articles)')

    patch_index(all_articles)
    print(f'Restored index.html ({len(all_articles)} articles available)')

    patch_sog(all_articles)
    print('Restored standard-of-greatness.html article grid')

    print('Done.')


if __name__ == '__main__':
    main()
