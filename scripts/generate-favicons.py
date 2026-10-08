#!/usr/bin/env python3
"""Generate root favicon assets from the emerald R logo on a white background."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets' / 'emerald-r-logo.png'
FALLBACK_SOURCE = ROOT / 'assets' / 'Squared logo.png'
CANONICAL_BRAND_DIR = ROOT / 'assets' / 'images'
CANONICAL_BRAND_FILE = CANONICAL_BRAND_DIR / 'emerald-r-logo.png'
OUTPUTS = {
    'android-chrome-512x512.png': 512,
    'android-chrome-192x192.png': 192,
    'apple-touch-icon.png': 180,
    'favicon-32x32.png': 32,
    'favicon-16x16.png': 16,
}


def remove_dark_background(image: Image.Image, threshold: int = 32) -> Image.Image:
    """Turn near-black pixels transparent when a logo was exported on black."""
    rgba = image.convert('RGBA')
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            if red <= threshold and green <= threshold and blue <= threshold:
                pixels[x, y] = (red, green, blue, 0)
    return rgba


def corner_is_dark(image: Image.Image, threshold: int = 40) -> bool:
    rgba = image.convert('RGBA')
    w, h = rgba.size
    points = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    for x, y in points:
        red, green, blue, alpha = rgba.getpixel((x, y))
        if alpha > 0 and red <= threshold and green <= threshold and blue <= threshold:
            return True
    return False


def prepare_square_logo(image: Image.Image, size: int, padding_ratio: float = 0.08) -> Image.Image:
    rgba = image.convert('RGBA')
    bbox = rgba.getbbox()
    if not bbox:
        return Image.new('RGB', (size, size), (255, 255, 255))

    cropped = rgba.crop(bbox)
    side = max(cropped.size)
    pad = max(1, int(side * padding_ratio))
    canvas_side = side + pad * 2
    canvas = Image.new('RGBA', (canvas_side, canvas_side), (0, 0, 0, 0))
    offset_x = (canvas_side - cropped.width) // 2
    offset_y = (canvas_side - cropped.height) // 2
    canvas.paste(cropped, (offset_x, offset_y), cropped)
    resized = canvas.resize((size, size), Image.Resampling.LANCZOS)

    white = Image.new('RGB', (size, size), (255, 255, 255))
    white.paste(resized, mask=resized.split()[-1])
    return white


def load_source_logo() -> Image.Image:
    path = SOURCE if SOURCE.exists() else FALLBACK_SOURCE
    if not path.exists():
        raise SystemExit(f'Source logo not found: {SOURCE}')

    opened = Image.open(path)
    rgba = opened.convert('RGBA')
    if corner_is_dark(rgba):
        rgba = remove_dark_background(rgba)
    return rgba


def publish_canonical_brand_logo(source: Image.Image) -> None:
    CANONICAL_BRAND_DIR.mkdir(parents=True, exist_ok=True)
    if source.mode != 'RGB':
        source = source.convert('RGB')
    source.save(CANONICAL_BRAND_FILE, format='PNG', optimize=True)
    print(f'Wrote {CANONICAL_BRAND_FILE.relative_to(ROOT).as_posix()}')


def main() -> int:
    source = load_source_logo()
    publish_canonical_brand_logo(source)
    png_paths: dict[int, Path] = {}

    for filename, size in OUTPUTS.items():
        out = ROOT / filename
        resized = prepare_square_logo(source, size)
        resized.save(out, format='PNG', optimize=True)
        png_paths[size] = out
        print(f'Wrote {out.relative_to(ROOT).as_posix()} ({size}x{size}, white background)')

    ico_path = ROOT / 'favicon.ico'
    img16 = Image.open(png_paths[16])
    img32 = Image.open(png_paths[32])
    img32.save(
        ico_path,
        format='ICO',
        sizes=[(16, 16), (32, 32)],
        append_images=[img16],
    )
    print(f'Wrote {ico_path.relative_to(ROOT).as_posix()}')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
