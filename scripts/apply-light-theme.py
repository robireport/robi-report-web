#!/usr/bin/env python3
"""Switch Robi Report from dark to light theme tokens and common hardcoded surfaces."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ROOT_BLOCK_OLD = """      --bg-primary: #000000;
      --bg-secondary: #0a0a0a;
      --bg-card: #111111;
      --bg-card-hover: #1a1a1a;
      --border: rgba(255, 255, 255, 0.06);
      --border-hover: rgba(255, 255, 255, 0.12);
      --text-primary: #ffffff;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --accent: #10B981;
      --accent-hover: #34D399;
      --accent-glow: rgba(16, 185, 129, 0.25);"""

ROOT_BLOCK_NEW = """      --bg-primary: #F9FAFB;
      --bg-secondary: #FFFFFF;
      --bg-card: #FFFFFF;
      --bg-card-hover: #F3F4F6;
      --border: rgba(15, 23, 42, 0.08);
      --border-hover: rgba(15, 23, 42, 0.14);
      --text-primary: #111827;
      --text-secondary: #4B5563;
      --text-muted: #6B7280;
      --accent: #10B981;
      --accent-hover: #34D399;
      --accent-glow: rgba(16, 185, 129, 0.28);
      --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
      --shadow-md: 0 4px 16px rgba(15, 23, 42, 0.08);
      --shadow-lg: 0 12px 32px rgba(15, 23, 42, 0.1);"""

REPLACEMENTS: list[tuple[str, str]] = [
    (ROOT_BLOCK_OLD, ROOT_BLOCK_NEW),
    (
        "--gradient-hero: linear-gradient(135deg, #000000 0%, #0a0a0a 50%, #000a12 100%);",
        "--gradient-hero: linear-gradient(135deg, #FFFFFF 0%, #F9FAFB 45%, #ECFDF5 100%);",
    ),
    (
        "background: rgba(0, 0, 0, 0.85);",
        "background: rgba(255, 255, 255, 0.92);",
    ),
    (
        "background: rgba(0, 0, 0, 0.97);",
        "background: rgba(255, 255, 255, 0.98);",
    ),
    (
        "background: rgba(255, 255, 255, 0.03);",
        "background: rgba(15, 23, 42, 0.04);",
    ),
    (
        "background: rgba(255, 255, 255, 0.02);",
        "background: rgba(15, 23, 42, 0.03);",
    ),
    (
        "box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);",
        "box-shadow: var(--shadow-lg);",
    ),
    (
        "box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);",
        "box-shadow: var(--shadow-lg);",
    ),
    (
        "box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);",
        "box-shadow: var(--shadow-lg);",
    ),
    (
        "box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);",
        "box-shadow: var(--shadow-md);",
    ),
    (
        "linear-gradient(135deg, var(--accent) 0%, #b8e4ff 100%);",
        "linear-gradient(135deg, var(--accent) 0%, #6EE7B7 100%);",
    ),
    (
        ".card-tag {\n      position: absolute;\n      top: 14px;\n      left: 14px;\n      padding: 4px 10px;\n      background: rgba(0, 0, 0, 0.7);\n      backdrop-filter: blur(8px);\n      border-radius: 100px;\n      font-size: 0.7rem;\n      font-weight: 700;\n      text-transform: uppercase;\n      letter-spacing: 0.06em;\n      color: var(--text-primary);",
        ".card-tag {\n      position: absolute;\n      top: 14px;\n      left: 14px;\n      padding: 4px 10px;\n      background: rgba(17, 24, 39, 0.72);\n      backdrop-filter: blur(8px);\n      border-radius: 100px;\n      font-size: 0.7rem;\n      font-weight: 700;\n      text-transform: uppercase;\n      letter-spacing: 0.06em;\n      color: #ffffff;",
    ),
    ("background: #000000 !important;", "background: #FFFFFF !important;"),
    ("background: #000000;", "background: #FFFFFF;"),
    ("background: #000;", "background: #FFFFFF;"),
    ("background: #0a0a0a;", "background: #F3F4F6;"),
    ("background: #111;", "background: #F3F4F6;"),
    (
        "linear-gradient(90deg, #111 0%, #1a1a1a 50%, #111 100%);",
        "linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%);",
    ),
    (
        "html, body {\n      margin: 0;\n      min-height: 100vh;\n      background: #000;\n      color: #fff;",
        "html, body {\n      margin: 0;\n      min-height: 100vh;\n      background: #F9FAFB;\n      color: #111827;",
    ),
    ("color: #92d2ff;", "color: #10B981;"),
    ("color: #a1a1aa;", "color: #6B7280;"),
]


def iter_targets() -> list[Path]:
    paths: list[Path] = []
    paths.extend(ROOT.rglob("*.html"))
    paths.extend((ROOT / "assets").rglob("*.css"))
    out: list[Path] = []
    for path in paths:
        if "node_modules" in path.parts:
            continue
        out.append(path)
    return sorted(set(out))


def apply_text(text: str) -> str:
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    return text


def main() -> int:
    updated = 0
    for path in iter_targets():
        original = path.read_text(encoding="utf-8")
        changed = apply_text(original)
        if changed != original:
            path.write_text(changed, encoding="utf-8")
            updated += 1
    print(f"Updated {updated} file(s) for light theme.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
