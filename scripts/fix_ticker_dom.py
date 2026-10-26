"""Repair score-ticker HTML broken by naive reorder (nav nested inside ticker)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Nav was inserted inside .ticker-track-wrap before its closing </div>.
NAV_INSIDE_TICKER = re.compile(
    r'(<div class="ticker-track" id="ticker-track"></div>)\s*'
    r'(?:(<!--[^\n]*-->\s*))?'
    r'(<nav[\s\S]*?</nav>\s*<div class="nav-mobile-backdrop"[^>]*></div>)\s*'
    r'</div>\s*'
    r'(<button type="button" class="ticker-arrow ticker-arrow-right"[^>]*>[^<]*</button>\s*'
    r'</div>\s*'
    r'</div>)',
    re.MULTILINE,
)

# index.html: missing .ticker-track-wrap close (single stray </div>).
MISSING_WRAP_CLOSE = re.compile(
    r'(<div class="ticker-track" id="ticker-track"></div>)\s*'
    r'</div>\s*'
    r'(<button type="button" class="ticker-arrow ticker-arrow-right")',
    re.MULTILINE,
)

def extract_ticker_block(text: str) -> tuple[str, str] | None:
    """Return (block, rest) for first score-ticker div with balanced tags."""
    marker = '<div class="score-ticker"'
    start = text.find(marker)
    if start == -1:
        return None
    depth = 0
    i = start
    while i < len(text):
        open_div = text.find("<div", i)
        close_div = text.find("</div>", i)
        if close_div == -1:
            return None
        if open_div != -1 and open_div < close_div:
            depth += 1
            i = open_div + 4
        else:
            depth -= 1
            i = close_div + len("</div>")
            if depth == 0:
                block = text[start:i]
                return block, text[:start] + text[i:]
    return None


def move_ticker_first(text: str) -> str:
    extracted = extract_ticker_block(text)
    if not extracted:
        return text
    block, without = extracted
    body = re.search(r"(<body[^>]*>\s*)", without, re.IGNORECASE)
    if not body:
        return text
    insert_at = body.end()
    after_body = without[insert_at:].lstrip()
    if after_body.startswith(block.strip()[:40]):
        return without  # already first
    block = block if block.startswith("\n") else "\n" + block + "\n"
    return without[:insert_at] + block + without[insert_at:]


def fix_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    if NAV_INSIDE_TICKER.search(text):
        def repl(m: re.Match) -> str:
            comment = m.group(2) or "  <!-- Navigation -->\n  "
            nav = m.group(3).strip()
            return (
                f"{m.group(1)}\n      </div>\n      "
                f"{m.group(4).strip()}\n\n{comment}{nav}\n"
            )

        text = NAV_INSIDE_TICKER.sub(repl, text)

    if MISSING_WRAP_CLOSE.search(text) and not NAV_INSIDE_TICKER.search(original):
        text = MISSING_WRAP_CLOSE.sub(
            r"\1\n      </div>\n      \2",
            text,
        )

    text = move_ticker_first(text)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    for path in ROOT.rglob("*.html"):
        if "node_modules" in path.parts:
            continue
        if 'id="score-ticker"' not in path.read_text(encoding="utf-8"):
            continue
        if fix_file(path):
            print("fixed", path.relative_to(ROOT))
            changed += 1
    print("done,", changed, "files")


if __name__ == "__main__":
    main()
