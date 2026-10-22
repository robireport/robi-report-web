import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[1]
base = (root / "nba-scores.html").read_text(encoding="utf-8")

# Nav block is identical on every scoreboard page (do not rewrite hub filenames).
nav_start = base.index('<nav class="nav"')
nav_end = base.index("</nav>", nav_start) + len("</nav>")
NAV = base[nav_start:nav_end]

pages = [
    {
        "file": "wnba-scores.html",
        "sport": "WNBA",
        "hub": "wnba.html",
        "scores": "wnba-scores.html",
        "ticker": "wnba",
        "heading": "WNBA Scoreboard",
        "desc": "Live WNBA scores, schedules, game status, and lines from Robi Report.",
        "data": "data-wnba-scoreboard",
        "scripts": ["assets/espn-team-scoreboard.js", "assets/wnba-scoreboard.js"],
        "main_class": "wnba-scores-main",
        "header_class": "wnba-scores-header",
        "subnav_class": "wnba-scores-subnav",
        "footer_class": "wnba-scores-footer",
        "section": "WNBA",
    },
    {
        "file": "nfl-scores.html",
        "sport": "NFL",
        "hub": "nfl.html",
        "scores": "nfl-scores.html",
        "ticker": "nfl",
        "heading": "NFL Scoreboard",
        "desc": "Live NFL scores, schedules, game status, and lines from Robi Report.",
        "data": "data-nfl-scoreboard",
        "scripts": ["assets/espn-team-scoreboard.js", "assets/nfl-scoreboard.js"],
        "main_class": "nfl-scores-main",
        "header_class": "nfl-scores-header",
        "subnav_class": "nfl-scores-subnav",
        "footer_class": "nfl-scores-footer",
        "section": "NFL",
    },
    {
        "file": "mlb-scores.html",
        "sport": "MLB",
        "hub": "mlb.html",
        "scores": "mlb-scores.html",
        "ticker": "mlb",
        "heading": "MLB Scoreboard",
        "desc": "Live MLB scores, schedules, game status, and lines from Robi Report.",
        "data": "data-mlb-scoreboard",
        "scripts": ["assets/espn-team-scoreboard.js", "assets/mlb-scoreboard.js"],
        "main_class": "mlb-scores-main",
        "header_class": "mlb-scores-header",
        "subnav_class": "mlb-scores-subnav",
        "footer_class": "mlb-scores-footer",
        "section": "MLB",
    },
    {
        "file": "ufc-scores.html",
        "sport": "UFC",
        "hub": "ufc.html",
        "scores": "ufc-scores.html",
        "ticker": "ufc",
        "heading": "UFC Schedule & Results",
        "desc": "UFC event schedules, fight cards, and results from Robi Report.",
        "data": "data-ufc-scoreboard",
        "scripts": ["assets/espn-combat-scoreboard.js", "assets/ufc-scoreboard.js"],
        "main_class": "ufc-scores-main",
        "header_class": "ufc-scores-header",
        "subnav_class": "ufc-scores-subnav",
        "footer_class": "ufc-scores-footer",
        "section": "UFC",
    },
    {
        "file": "boxing-scores.html",
        "sport": "Boxing",
        "hub": "boxing.html",
        "scores": "boxing-scores.html",
        "ticker": "boxing",
        "heading": "Boxing Schedule & Results",
        "desc": "Boxing schedules and results from Robi Report when available from ESPN.",
        "data": "data-boxing-scoreboard",
        "scripts": ["assets/boxing-scoreboard.js"],
        "main_class": "boxing-scores-main",
        "header_class": "boxing-scores-header",
        "subnav_class": "boxing-scores-subnav",
        "footer_class": "boxing-scores-footer",
        "section": "Boxing",
    },
    {
        "file": "soccer-scores.html",
        "sport": "Soccer",
        "hub": "soccer.html",
        "scores": "soccer-scores.html",
        "ticker": "epl",
        "heading": "Soccer Scoreboard",
        "desc": "Live soccer scores and schedules from Robi Report — Premier League, MLS, and more.",
        "data": "data-soccer-scoreboard",
        "scripts": ["assets/espn-team-scoreboard.js", "assets/soccer-scoreboard.js"],
        "main_class": "soccer-scores-main",
        "header_class": "soccer-scores-header",
        "subnav_class": "soccer-scores-subnav",
        "footer_class": "soccer-scores-footer",
        "section": "Soccer",
        "body_extra_class": " soccer-scoreboard-wrap",
    },
]

head_template = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="Robi Report" />
  <meta name="theme-color" content="#10B981" />
  <link rel="icon" href="https://robireport.com/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" href="https://robireport.com/favicon-48x48.png" sizes="48x48" />
  <link rel="icon" type="image/png" href="https://robireport.com/favicon-32x32.png" sizes="32x32" />
  <link rel="icon" type="image/png" href="https://robireport.com/favicon-16x16.png" sizes="16x16" />
  <link rel="icon" type="image/png" href="https://robireport.com/favicon-v3.png" sizes="512x512" />
  <link rel="apple-touch-icon" type="image/png" href="https://robireport.com/apple-touch-icon.png" sizes="180x180" />
  <link rel="shortcut icon" href="https://robireport.com/favicon.ico" />
  <link rel="manifest" href="https://robireport.com/site.webmanifest?v=3" />
  <script id="robi-www-redirect">
    (function () {{
      if (location.hostname === 'www.robireport.com') {{
        location.replace('https://robireport.com' + location.pathname + location.search + location.hash);
      }}
    }})();
  </script>
  <link rel="canonical" href="https://robireport.com/{scores}" />
  <meta name="description" content="{desc}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Robi Report" />
  <meta property="og:title" content="Robi Report {sport} Scoreboard | Live Scores &amp; Schedules" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:url" content="https://robireport.com/{scores}" />
  <meta property="og:image" content="https://robireport.com/assets/images/og-cover-v3.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Robi Report {sport} Scoreboard" />
  <meta name="twitter:description" content="{desc}" />
  <meta name="twitter:image" content="https://robireport.com/assets/images/og-cover-v3.png" />
  <title>Robi Report {sport} Scoreboard | Live Scores &amp; Schedules</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="assets/score-ticker.css" />
  <link rel="stylesheet" href="assets/nav-mobile.css" />
  <link rel="stylesheet" href="assets/nba-scoreboard.css" />
</head>
<body class="scores-page{body_extra}">
"""

for p in pages:
    body_extra = p.get("body_extra_class", "")
    head = head_template.format(
        scores=p["scores"],
        desc=p["desc"],
        sport=p["sport"],
        body_extra=body_extra,
    )
    scripts = "\n".join(
        f'  <script src="{s}"></script>'
        for s in ["assets/nav-mobile.js", "assets/score-ticker.js"] + p["scripts"]
    )
    html = f"""{head}
  {NAV}
  <div class="nav-mobile-backdrop" aria-hidden="true"></div>

  <div class="score-ticker" id="score-ticker" data-default="{p["ticker"]}">
    <div class="ticker-viewport">
      <button type="button" class="ticker-arrow ticker-arrow-left" aria-label="Scroll left">&#8249;</button>
      <div class="ticker-track-wrap">
        <div class="ticker-track" id="ticker-track"></div>
      </div>
      <button type="button" class="ticker-arrow ticker-arrow-right" aria-label="Scroll right">&#8250;</button>
    </div>
  </div>

  <main class="{p["main_class"]} nba-scores-main" id="main-content">
    <header class="{p["header_class"]} nba-scores-header">
      <nav class="{p["subnav_class"]} nba-scores-subnav" aria-label="{p["section"]} section">
        <a href="{p["scores"]}" aria-current="page">Scoreboard</a>
        <a href="{p["hub"]}">News &amp; Articles</a>
      </nav>
      <h1>{p["heading"]}</h1>
      <p>Live scores and schedules from Robi Report.</p>
    </header>

    <div class="nba-scoreboard-root" {p["data"]}></div>
  </main>

  <footer class="{p["footer_class"]} nba-scores-footer">
    <p><a href="{p["hub"]}">← {p["section"]} News &amp; Articles</a> · <a href="index.html">Robi Report Home</a></p>
    <p>&copy; 2026 Robi Report</p>
  </footer>

{scripts}
</body>
</html>
"""
    (root / p["file"]).write_text(html, encoding="utf-8")
    print("wrote", p["file"])
