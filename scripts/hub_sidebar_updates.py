import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIDEO_ID = "e8KPKNIxEmE"
VIDEO_TITLE = "Are the Rockets and Pacers ACTUALLY Contenders?, Robi Report"
VIDEO_DESC = "Featured analysis: Are the Rockets and Pacers actually contenders? From Robi Report."
EMBED = f"https://www.youtube.com/embed/{VIDEO_ID}"
WATCH = f"https://www.youtube.com/watch?v={VIDEO_ID}"
THUMB = f"https://i.ytimg.com/vi/{VIDEO_ID}/hqdefault.jpg"

FEATURED_BLOCK = """      <div class="widget widget-videos">
        <div class="widget-header">{label} FEATURED CONTENT</div>
        <div class="widget-body widget-videos-body">
          <div class="video-feature">
            <div class="video-embed-wrap">
              <iframe
                src="{embed}"
                title="{title}"
                data-description="{desc}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen
              ></iframe>
            </div>
            <a
              href="{watch}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-primary btn-block btn-youtube-more"
            >Watch on YouTube</a>
          </div>
        </div>
      </div>

"""

PREMIUM_RE = re.compile(
    r'\s*<div class="widget">\s*<div class="subscribe-card">\s*<h3>Go Premium</h3>.*?</div>\s*</div>\s*',
    re.DOTALL,
)

IFRAME_SRC_RE = re.compile(r'https://www\.youtube\.com/embed/[A-Za-z0-9_-]+')

SCHEMA_VIDEO_RE = re.compile(
    r'"name": "[^"]*",\s*"description": "[^"]*",\s*"uploadDate": "[^"]*",\s*"thumbnailUrl": "[^"]*",\s*"embedUrl": "[^"]*",\s*"contentUrl": "[^"]*"',
    re.DOTALL,
)

SCHEMA_REPLACEMENT = (
    f'"name": "{VIDEO_TITLE}",\n'
    f'  "description": "{VIDEO_DESC}",\n'
    f'  "uploadDate": "2026-10-01T00:00:00+00:00",\n'
    f'  "thumbnailUrl": "{THUMB}",\n'
    f'  "embedUrl": "{EMBED}",\n'
    f'  "contentUrl": "{WATCH}"'
)

HUB_LABELS = {
    "nba.html": "NBA",
    "wnba.html": "WNBA",
    "nfl.html": "NFL",
    "mlb.html": "MLB",
    "soccer.html": "SOCCER",
    "ufc.html": "UFC",
    "boxing.html": "BOXING",
}

HAS_VIDEO = {"nba.html", "wnba.html", "nfl.html"}


def update_iframe_attrs(text: str) -> str:
    text = IFRAME_SRC_RE.sub(EMBED, text, count=0)
    text = re.sub(
        r'title="[^"]*Robi Report[^"]*"',
        f'title="{VIDEO_TITLE}"',
        text,
    )
    text = re.sub(
        r'data-description="[^"]*"',
        f'data-description="{VIDEO_DESC}"',
        text,
        count=0,
    )
    return text


for filename, label in HUB_LABELS.items():
    path = ROOT / filename
    text = path.read_text(encoding="utf-8")
    text, removed = PREMIUM_RE.subn("\n", text)
    if SCHEMA_VIDEO_RE.search(text):
        text = SCHEMA_VIDEO_RE.sub(SCHEMA_REPLACEMENT, text, count=1)

    if filename in HAS_VIDEO:
        text = update_iframe_attrs(text)
        if filename == "nfl.html":
            # Keep a single featured embed (remove second NFL-only feature block).
            second = text.find('<div class="video-feature">', text.find('<div class="video-feature">') + 1)
            if second != -1:
                end = text.find("</div>\n\n        </div>\n      </div>", second)
                if end != -1:
                    text = text[:second] + text[end + len("</div>\n\n        </div>\n      </div>") :]
    else:
        insert = FEATURED_BLOCK.format(
            label=label,
            embed=EMBED,
            title=VIDEO_TITLE,
            desc=VIDEO_DESC,
            watch=WATCH,
        )
        marker = "    <aside class=\"hub-left\">"
        if marker in text and "widget-videos" not in text:
            text = text.replace(marker, marker + "\n" + insert, 1)

    path.write_text(text, encoding="utf-8")
    print(f"updated {filename} (premium removed: {removed})")
