#!/usr/bin/env python3
"""Restore real article feeds from articles/ HTML files."""
import html
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

PT = ZoneInfo('America/Los_Angeles')

ROOT = Path(__file__).parent
ARTICLES_DIR = ROOT / 'articles'
SCRIPTS = ROOT / 'scripts'
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))
from article_lib import is_source_article, public_article_href, sync_all_articles, write_redirect_map
from seo_lib import extract_article_metadata
from sitemap_lib import write_sitemaps

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
    'nba': 'articles/nba/lakers-blazers-luka-doncic-124-118.html',
    'wnba': 'articles/wnba/awa-fam-breakout-mercury.html',
    'nfl': 'articles/nfl/2023-draft-winners-losers.html',
    'ufc': 'articles/ufc/ufc-business-model.html',
    'boxing': 'articles/boxing/how-to-fix-boxing.html',
    'soccer': 'articles/soccer/emma-hayes-shebelieves-roster.html',
    'mlb': 'articles/mlb/mariners-2022-campaign.html',
}

INDEX_FEATURED_ORDER = [
    'articles/nba/lakers-blazers-luka-doncic-124-118.html',
    'articles/nba/blazers-nuggets-denver-118-110.html',
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
    meta_m = re.search(r'<div class="article-meta"[^>]*>(.*?)</div>', text, re.S)
    img_m = re.search(
        r'<figure class="article-hero">.*?<img src="([^"]+)" alt="([^"]*)"',
        text,
        re.S,
    )
    body_m = re.search(r'<div class="article-body">\s*<p>(.*?)</p>', text, re.S)
    cap_m = re.search(
        r'<figcaption class="article-hero-caption">(.*?)</figcaption>',
        text,
        re.S,
    )

    title = html.unescape(re.sub(r'\s+', ' ', title_m.group(1))).strip() if title_m else path.stem
    tag_raw = html.unescape(tag_m.group(1)).strip() if tag_m else 'News'
    tag_parts = [p.strip() for p in tag_raw.replace('·', '·').split('·')]
    story_tag = tag_parts[0] if tag_parts else 'News'
    league = tag_parts[-1].upper() if len(tag_parts) > 1 else path.parent.name.upper()

    seo_meta = extract_article_metadata(text) or {}
    author = seo_meta.get('author') or 'Matthew Robi'
    date_iso = seo_meta.get('date_published') or ''
    date_label = seo_meta.get('date_display') or ''
    read_time = ''
    if meta_m:
        meta = meta_m.group(1)
        read_m = re.search(r'<span>(\d+\s*min read)</span>', meta)
        if read_m:
            read_time = read_m.group(1)

    hero_src = img_m.group(1) if img_m else ''
    alt = html.unescape(img_m.group(2)).strip() if img_m else title
    photo_credit = (
        html.unescape(re.sub(r'\s+', ' ', cap_m.group(1))).strip() if cap_m else ''
    )
    excerpt_raw = body_m.group(1) if body_m else ''
    excerpt = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', html.unescape(excerpt_raw))).strip()
    if len(excerpt) > 160:
        excerpt = excerpt[:157].rsplit(' ', 1)[0] + '...'

    sport = path.parent.name
    return {
        'rel': rel,
        'href': public_article_href(path),
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
        'photo_credit': photo_credit,
        'excerpt': excerpt,
    }


def resize_wix(url: str, w: int, h: int) -> str:
    if not url:
        return url
    return re.sub(r'/v1/fill/w_\d+,h_\d+', f'/v1/fill/w_{w},h_{h}', url)


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def parse_iso_dt(date_iso: str) -> datetime | None:
    if not date_iso:
        return None
    try:
        normalized = date_iso.replace('Z', '+00:00')
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(PT)
    except ValueError:
        return None


def relative_time_label(date_iso: str, now: datetime | None = None) -> str:
    now = now or datetime.now(PT)
    dt = parse_iso_dt(date_iso)
    if not dt:
        return ''
    delta = now - dt
    if delta.total_seconds() < 0:
        return dt.strftime('%b %d, %Y') + ' PT'
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return 'Just now'
    minutes = seconds // 60
    if minutes < 60:
        suffix = 's' if minutes != 1 else ''
        return f'{minutes} minute{suffix} ago'
    hours = minutes // 60
    if hours < 24:
        suffix = 's' if hours != 1 else ''
        return f'{hours} hour{suffix} ago'
    days = hours // 24
    if days < 7:
        suffix = 's' if days != 1 else ''
        return f'{days} day{suffix} ago'
    return dt.strftime('%b %d, %Y') + ' PT'


def is_live_story(date_iso: str, now: datetime | None = None) -> bool:
    now = now or datetime.now(PT)
    dt = parse_iso_dt(date_iso)
    if not dt:
        return False
    return (now - dt) <= timedelta(hours=12)


def editorial_badge_html(a: dict, now: datetime | None = None) -> str:
    if is_live_story(a.get('date_iso', ''), now):
        return '<span class="editorial-badge editorial-badge--live">LIVE</span>'
    label = esc(a.get('league') or a.get('story_tag') or 'News')
    return f'<span class="editorial-badge">{label}</span>'


def editorial_time_html(a: dict, now: datetime | None = None) -> str:
    date_iso = a.get('date_iso') or ''
    dt = parse_iso_dt(date_iso)
    title = dt.strftime('%b %d, %Y %I:%M %p PT') if dt else ''
    label = relative_time_label(date_iso, now)
    if not label:
        return ''
    dt_attr = esc(date_iso)
    title_attr = esc(title)
    return (
        f'<time class="editorial-time" datetime="{dt_attr}" '
        f'data-published="{dt_attr}" title="{title_attr}">{esc(label)}</time>'
    )


def editorial_left_item_html(a: dict, now: datetime | None = None) -> str:
    return f'''          <li class="editorial-list-item">
            <a href="{esc(a["href"])}" class="editorial-list-link">
              {editorial_badge_html(a, now)}
              <span class="editorial-list-headline">{esc(a["title"])}</span>
              {editorial_time_html(a, now)}
            </a>
          </li>'''


def editorial_sidebar_item_html(a: dict, now: datetime | None = None) -> str:
    return f'''          <li class="editorial-sidebar-item">
            <a href="{esc(a["href"])}" class="editorial-sidebar-link">
              <span class="editorial-sidebar-headline">{esc(a["title"])}</span>
              {editorial_time_html(a, now)}
            </a>
          </li>'''


def editorial_spotlight_html(a: dict, now: datetime | None = None) -> str:
    img = resize_wix(a['hero_src'], 1200, 675)
    kicker_bits = [esc(a['league'])]
    if a.get('story_tag') and a['story_tag'].upper() != a['league']:
        kicker_bits.append(esc(a['story_tag']))
    kicker = ' · '.join(kicker_bits)
    return f'''        <article class="editorial-spotlight">
          <a href="{esc(a["href"])}" class="editorial-spotlight-link">
            <figure class="editorial-spotlight-media">
              <img src="{esc(img)}" alt="{esc(a["alt"])}" loading="lazy" />
            </figure>
            <div class="editorial-spotlight-body">
              <p class="editorial-kicker">{kicker}</p>
              <h3 class="editorial-spotlight-title">{esc(a["title"])}</h3>
              <p class="editorial-spotlight-dek">{esc(a["excerpt"])}</p>
              {editorial_time_html(a, now)}
            </div>
          </a>
        </article>'''


def hub_feed_published_dt(a: dict) -> datetime | None:
    date_iso = a.get('date_iso') or ''
    if not date_iso:
        return None
    if 'T' not in date_iso and re.match(r'^\d{4}-\d{2}-\d{2}$', date_iso):
        day = datetime.fromisoformat(date_iso)
        return day.replace(tzinfo=PT, hour=9, minute=1)
    return parse_iso_dt(date_iso)


def hub_feed_time_html(a: dict) -> str:
    dt = hub_feed_published_dt(a)
    if dt:
        hour = dt.strftime('%I').lstrip('0') or '12'
        minute = dt.strftime('%M')
        ampm = dt.strftime('%p').lower()
        label = f'{dt.strftime("%B")} {dt.day}, {dt.year} at {hour}:{minute} {ampm} PT'
        dt_attr = esc(a.get('date_iso') or '')
        return f'<time class="hub-feed-time" datetime="{dt_attr}">{esc(label)}</time>'
    if a.get('date_label'):
        return f'<time class="hub-feed-time">{esc(a["date_label"])}</time>'
    return ''


def hub_feed_category(a: dict) -> str:
    league = (a.get('league') or a.get('sport') or 'News').upper()
    return f'SPORTS | {league}'


def hub_feed_row_html(a: dict) -> str:
    img = resize_wix(a['hero_src'], 440, 280)
    excerpt = a.get('excerpt') or ''
    if len(excerpt) > 220:
        excerpt = excerpt[:217].rsplit(' ', 1)[0] + '...'
    return f'''        <article class="hub-feed-item">
          <a href="{esc(a["href"])}" class="hub-feed-link">
            <div class="hub-feed-thumb">
              <img src="{esc(img)}" alt="{esc(a["alt"])}" loading="lazy" />
            </div>
            <div class="hub-feed-body">
              <p class="hub-feed-category">{esc(hub_feed_category(a))}</p>
              {hub_feed_time_html(a)}
              <h3 class="hub-feed-title">{esc(a["title"])}</h3>
              <p class="hub-feed-excerpt">{esc(excerpt)}</p>
            </div>
          </a>
        </article>'''


def lead_html(a: dict) -> str:
    img = resize_wix(a['hero_src'], 960, 540)
    meta_bits = [f'<strong>{esc(a["author"])}</strong>']
    if a['date_label']:
        meta_bits.append(f'<span class="dot"></span><span>{esc(a["date_label"])}</span>')
    if a['read_time']:
        meta_bits.append(f'<span class="dot"></span><span>{esc(a["read_time"])}</span>')
    return f'''      <article class="lead-story">
        <a href="{esc(a["href"])}">
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
          <a href="{esc(a["href"])}" class="news-row-link">
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
        <a href="{esc(a["href"])}">
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
    rest.sort(key=lambda x: x.get('date_iso') or '', reverse=True)
    ordered = [lead, *rest]

    rows = '\n'.join(hub_feed_row_html(a) for a in ordered)
    stack = f'\n      <div class="hub-feed-list">\n{rows}\n      </div>'

    return f'''    <section class="hub-center hub-feed">
      <div class="articles-feed-header">
        <h2>LATEST ANALYSIS &amp; ARTICLES</h2>
      </div>
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

    now = datetime.now(PT)
    lead = ordered[0]
    left_items = ordered[1:7]
    right_items = sorted(
        [a for a in ordered if a['rel'] != lead['rel']],
        key=lambda x: x.get('date_iso') or '',
        reverse=True,
    )[:8]

    left_rows = '\n'.join(editorial_left_item_html(a, now) for a in left_items)
    right_rows = '\n'.join(editorial_sidebar_item_html(a, now) for a in right_items)
    spotlight = editorial_spotlight_html(lead, now)

    left_col = (
        f'''      <div class="editorial-board-col editorial-board-col--left">
        <ul class="editorial-headline-list">
{left_rows}
        </ul>
      </div>'''
        if left_items
        else ''
    )
    right_col = (
        f'''      <aside class="editorial-board-col editorial-board-col--right" aria-labelledby="editorial-latest-heading">
        <h3 class="editorial-sidebar-label" id="editorial-latest-heading">LATEST</h3>
        <ul class="editorial-sidebar-list">
{right_rows}
        </ul>
        <a href="nba.html" class="editorial-view-more">VIEW MORE &gt;</a>
      </aside>'''
        if right_items
        else ''
    )

    return f'''  <section class="featured articles-feed editorial-board" id="latest-articles">
    <div class="articles-feed-header">
      <h2>LATEST ANALYSIS &amp; ARTICLES</h2>
    </div>
    <div class="editorial-board-grid">
{left_col}
      <div class="editorial-board-col editorial-board-col--center">
{spotlight}
      </div>
{right_col}
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
        r'    <section class="hub-center[^"]*">.*?</section>',
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
        r'  <!-- Featured Content -->\s*<section class="featured articles-feed(?: editorial-board)?" id="(?:featured|latest-articles)">.*?</section>',
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

    for path in sorted(ARTICLES_DIR.glob('*/*.html')):
        if not is_source_article(path):
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

    synced = sync_all_articles()
    print(f'Synced {len(synced)} article index file(s) for GitHub Pages')

    redirects_path = write_redirect_map()
    print(f'Updated {redirects_path.relative_to(ROOT).as_posix()}')

    sitemap_path, news_path = write_sitemaps()
    print(f'Wrote {sitemap_path.relative_to(ROOT).as_posix()}')
    print(f'Wrote {news_path.relative_to(ROOT).as_posix()}')

    print('Done.')


if __name__ == '__main__':
    main()
