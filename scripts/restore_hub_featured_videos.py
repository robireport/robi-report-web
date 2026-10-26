"""Restore sport-specific featured sidebar videos (remove global NBA override)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FEATURED_WIDGET = """      <div class="widget widget-videos">
        <div class="widget-header">{label} FEATURED CONTENT</div>
        <div class="widget-body widget-videos-body">
          <div class="video-feature">
            <div class="video-embed-wrap">
              <iframe
                src="https://www.youtube.com/embed/{video_id}"
                title="{title}"
                data-description="{description}"
                data-upload-date="{upload_date}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen
              ></iframe>
            </div>
            <a
              href="https://www.youtube.com/watch?v={video_id}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-primary btn-block btn-youtube-more"
            >Watch on YouTube</a>
          </div>
        </div>
      </div>

"""

HUBS = {
    "nba.html": {
        "label": "NBA",
        "video_id": "e8KPKNIxEmE",
        "title": "Are the Rockets and Pacers ACTUALLY Contenders?, Robi Report",
        "description": "Featured analysis: Are the Rockets and Pacers actually contenders? From Robi Report.",
        "upload_date": "2026-10-01T00:00:00+00:00",
        "schema": True,
    },
    "wnba.html": {
        "label": "WNBA",
        "video_id": "ZvxRpJmdR3A",
        "title": "The Seattle Storm Have A Serious Rebounding Problem, Robi Report",
        "description": "Featured WNBA analysis and commentary from Robi Report.",
        "upload_date": "2024-09-05T00:00:00+00:00",
        "schema": True,
    },
    "nfl.html": {
        "label": "NFL",
        "video_id": "Ztguwlw6bNk",
        "title": "Making The OBVIOUS Case That Baker Mayfield IS The MVP!, Robi Report",
        "description": "Making the obvious case that Baker Mayfield is the MVP, NFL analysis from Robi Report.",
        "upload_date": "2025-01-12T00:00:00+00:00",
        "schema": True,
        "schema_graph": True,
        "second_video": {
            "video_id": "Hv8c9dhZPTg",
            "title": "The Ravens Are TERRIBLE And We ALL Know Why, Robi Report",
            "description": "Why the Baltimore Ravens struggled and what it means for the season, NFL analysis from Robi Report.",
            "upload_date": "2024-12-03T00:00:00+00:00",
        },
    },
}

NO_FEATURED = ("boxing.html", "ufc.html", "mlb.html", "soccer.html")

ROCKETS_BLOCK_START = '<div class="widget widget-videos">'
ROCKETS_EMBED = "e8KPKNIxEmE"


def replace_featured_block(text: str, cfg: dict) -> str:
    start = text.find(ROCKETS_BLOCK_START)
    if start == -1:
        return text
    # End after first widget-videos closes (League Shortcuts follows).
    end_marker = "      </div>\n\n      <div class=\"widget\">"
    end = text.find(end_marker, start)
    if end == -1:
        return text
    block = FEATURED_WIDGET.format(**cfg)
    return text[:start] + block + text[end:]


def remove_featured_block(text: str) -> str:
    start = text.find(ROCKETS_BLOCK_START)
    if start == -1:
        return text
    end_marker = "      </div>\n\n      <div class=\"widget\">"
    end = text.find(end_marker, start)
    if end == -1:
        return text
    return text[:start] + text[end:]


def schema_single(cfg: dict) -> str:
    vid = cfg["video_id"]
    return f"""{{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "{cfg['title']}",
  "description": "{cfg['description']}",
  "uploadDate": "{cfg['upload_date']}",
  "thumbnailUrl": "https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
  "embedUrl": "https://www.youtube.com/embed/{vid}",
  "contentUrl": "https://www.youtube.com/watch?v={vid}",
  "publisher": {{
    "@type": "Organization",
    "name": "Robi Report",
    "logo": {{
      "@type": "ImageObject",
      "@id": "https://robireport.com/#brand-logo",
      "url": "https://robireport.com/assets/images/emerald-r-logo.png",
      "contentUrl": "https://robireport.com/assets/images/emerald-r-logo.png",
      "width": 1024,
      "height": 1024,
      "caption": "Robi Report — emerald R mark on white"
    }}
  }}
}}"""


def schema_nfl(cfg: dict) -> str:
    v1 = cfg["video_id"]
    v2 = cfg["second_video"]["video_id"]
    s2 = cfg["second_video"]
    return f"""{{
  "@context": "https://schema.org",
  "@graph": [
    {{
      "@type": "VideoObject",
      "name": "{cfg['title']}",
      "description": "{cfg['description']}",
      "uploadDate": "{cfg['upload_date']}",
      "thumbnailUrl": "https://i.ytimg.com/vi/{v1}/hqdefault.jpg",
      "embedUrl": "https://www.youtube.com/embed/{v1}",
      "contentUrl": "https://www.youtube.com/watch?v={v1}",
      "publisher": {{
        "@type": "Organization",
        "name": "Robi Report",
        "logo": {{
          "@type": "ImageObject",
          "@id": "https://robireport.com/#brand-logo",
          "url": "https://robireport.com/assets/images/emerald-r-logo.png",
          "contentUrl": "https://robireport.com/assets/images/emerald-r-logo.png",
          "width": 1024,
          "height": 1024,
          "caption": "Robi Report — emerald R mark on white"
        }}
      }}
    }},
    {{
      "@type": "VideoObject",
      "name": "{s2['title']}",
      "description": "{s2['description']}",
      "uploadDate": "{s2['upload_date']}",
      "thumbnailUrl": "https://i.ytimg.com/vi/{v2}/hqdefault.jpg",
      "embedUrl": "https://www.youtube.com/embed/{v2}",
      "contentUrl": "https://www.youtube.com/watch?v={v2}",
      "publisher": {{
        "@type": "Organization",
        "name": "Robi Report",
        "logo": {{
          "@type": "ImageObject",
          "@id": "https://robireport.com/#brand-logo",
          "url": "https://robireport.com/assets/images/emerald-r-logo.png",
          "contentUrl": "https://robireport.com/assets/images/emerald-r-logo.png",
          "width": 1024,
          "height": 1024,
          "caption": "Robi Report — emerald R mark on white"
        }}
      }}
    }}
  ]
}}"""


def update_schema(text: str, filename: str, cfg: dict) -> str:
    marker = '<script type="application/ld+json" id="robi-video-schema">'
    start = text.find(marker)
    if start == -1:
        return text
    start += len(marker)
    end = text.find("</script>", start)
    if end == -1:
        return text
    body = schema_nfl(cfg) if cfg.get("schema_graph") else schema_single(cfg)
    return text[:start] + "\n" + body + "\n" + text[end:]


def main() -> None:
    for filename, cfg in HUBS.items():
        path = ROOT / filename
        text = path.read_text(encoding="utf-8")
        if ROCKETS_EMBED not in text and filename == "nba.html":
            continue
        text = replace_featured_block(text, cfg)
        if cfg.get("schema"):
            text = update_schema(text, filename, cfg)
        path.write_text(text, encoding="utf-8")
        print("updated", filename)

    for filename in NO_FEATURED:
        path = ROOT / filename
        text = path.read_text(encoding="utf-8")
        if ROCKETS_EMBED in text:
            text = remove_featured_block(text)
            path.write_text(text, encoding="utf-8")
            print("removed featured widget from", filename)


if __name__ == "__main__":
    main()
