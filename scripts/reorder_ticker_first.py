"""Move score-ticker block to the first element inside <body> (before nav)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def extract_ticker_block(text: str) -> tuple[str, str] | None:
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
                return text[start:i], text[:start] + text[i:]
    return None


for path in ROOT.rglob("*.html"):
    if "node_modules" in path.parts:
        continue
    text = path.read_text(encoding="utf-8")
    if 'id="score-ticker"' not in text:
        continue
    extracted = extract_ticker_block(text)
    if not extracted:
        continue
    block, text = extracted
    body = re.search(r"(<body[^>]*>\s*)", text, re.IGNORECASE)
    if not body:
        continue
    insert_at = body.end()
    if text[insert_at:].lstrip().startswith('<div class="score-ticker"'):
        continue
    block = "\n" + block.strip() + "\n\n"
    text = text[:insert_at] + block + text[insert_at:]
    path.write_text(text, encoding="utf-8")
    print("reordered", path.relative_to(ROOT))
