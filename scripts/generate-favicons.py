#!/usr/bin/env python3
"""Generate root favicon assets from the square RR logo (solid white background)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets' / 'Squared logo.png'
OUTPUTS = {
    'apple-touch-icon.png': 180,
    'favicon-32x32.png': 32,
    'favicon-16x16.png': 16,
}


def flatten_on_white(image: Image.Image) -> Image.Image:
    base = Image.new('RGB', image.size, (255, 255, 255))
    if image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info):
        rgba = image.convert('RGBA')
        base.paste(rgba, mask=rgba.split()[-1])
    else:
        base.paste(image.convert('RGB'))
    return base


def resize_square(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def main() -> int:
    if not SOURCE.exists():
        raise SystemExit(f'Source logo not found: {SOURCE}')

    source = flatten_on_white(Image.open(SOURCE))
    png_paths: dict[int, Path] = {}

    for filename, size in OUTPUTS.items():
        out = ROOT / filename
        resized = resize_square(source, size)
        resized.save(out, format='PNG', optimize=True)
        png_paths[size] = out
        print(f'Wrote {out.relative_to(ROOT).as_posix()} ({size}x{size})')

    ico_path = ROOT / 'favicon.ico'
    png_paths[16].open('rb')
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
