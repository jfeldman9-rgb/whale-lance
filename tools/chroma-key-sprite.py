#!/usr/bin/env python3
"""Turn a Videomaker magenta-key sprite into a cropped game asset."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

CANDIDATES = [
    Path("/workspace/whale-lance/art/sprites"),
    Path("/workspace/art/sprites"),
    Path("art/sprites"),
]


def is_key(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    return r > 200 and b > 200 and g < 90 and (r + b) > g * 4


def key_and_crop(src: Path, dest: Path, max_dim: int = 220) -> None:
    im = Image.open(src).convert("RGBA")
    pix = im.load()
    w, h = im.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if is_key(r, g, b, a):
                pix[x, y] = (0, 0, 0, 0)
            elif a > 10:
                found = True
                if x < min_x:
                    min_x = x
                if y < min_y:
                    min_y = y
                if x > max_x:
                    max_x = x
                if y > max_y:
                    max_y = y
    if not found:
        raise SystemExit(f"no opaque pixels in {src}")
    pad = 4
    box = (
        max(0, min_x - pad),
        max(0, min_y - pad),
        min(w, max_x + 1 + pad),
        min(h, max_y + 1 + pad),
    )
    cropped = im.crop(box)
    cw, ch = cropped.size
    scale = min(1.0, max_dim / max(cw, ch))
    if scale < 1:
        cropped = cropped.resize((max(1, int(cw * scale)), max(1, int(ch * scale))), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(dest, "PNG")
    print(f"wrote {dest} {cropped.size}")


def find_source(name: str) -> Path | None:
    for folder in CANDIDATES:
        path = folder / name
        if path.exists():
            return path
    return None


def main() -> None:
    src_name = sys.argv[1] if len(sys.argv) > 1 else "froyo.png"
    dest = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("assets") / src_name
    src = Path(src_name) if Path(src_name).exists() else find_source(src_name)
    if src is None:
        raise SystemExit(f"missing {src_name}")
    if "cutscene" in src.name:
        im = Image.open(src).convert("RGB")
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "PNG")
        print(f"copied {dest} {im.size}")
        return
    key_and_crop(src, dest)


if __name__ == "__main__":
    main()
