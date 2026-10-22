"""One-off: reshape league hub HTML into dedicated scoreboard layout."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

LEAGUES = [
    ("nba.html", "nba", "NBA"),
    ("wnba.html", "wnba", "WNBA"),
    ("nfl.html", "nfl", "NFL"),
]


def transform(path: Path, league: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if "data-scoreboard-page" in text:
        print(f"skip (already reshaped): {path.name}")
        return

    text = text.replace("<body>", '<body class="scoreboard-page">', 1)

    text = re.sub(
        r"\n  <!-- Live Score Ticker -->.*?</div>\n\n\n",
        "\n",
        text,
        count=1,
        flags=re.DOTALL,
    )

    m = re.search(r"<section class=\"hub-center\">(.*?)</section>", text, re.DOTALL)
    if not m:
        raise SystemExit(f"hub-center not found in {path.name}")
    articles_inner = m.group(1).strip()

    block = f"""
  <div class="scoreboard-page" data-scoreboard-page data-league="{league}">
    <h1 class="visually-hidden">{label} Scoreboard</h1>
    <div class="scoreboard-page-chrome" data-scoreboard-chrome></div>
    <div class="scoreboard-page-layout">
      <div class="scoreboard-page-scores" data-scoreboard-scores></div>
      <aside class="scoreboard-page-articles" aria-label="{label} news and analysis">
{articles_inner}
      </aside>
    </div>
  </div>

"""

    text = re.sub(
        r"  <!-- Page Header -->.*?  </main>\n",
        block,
        text,
        count=1,
        flags=re.DOTALL,
    )

    path.write_text(text, encoding="utf-8")
    print(f"updated {path.name}")


def main() -> None:
    for name, league, label in LEAGUES:
        transform(ROOT / name, league, label)


if __name__ == "__main__":
    main()
