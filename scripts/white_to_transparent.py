#!/usr/bin/env python3
"""Replace a near-white background with transparency.

Usage:
    python scripts/white_to_transparent.py <input> [output] [--threshold N]

Defaults:
    output    -> alongside input, suffixed "-transparent.png"
    threshold -> 250 (RGB channels >= threshold become transparent)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image


def white_to_transparent(src: Path, dst: Path, threshold: int) -> None:
    img = Image.open(src).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                pixels[x, y] = (r, g, b, 0)
    img.save(dst, "PNG")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replace white background with transparency.")
    parser.add_argument("input", type=Path, help="Path to source image.")
    parser.add_argument("output", type=Path, nargs="?", help="Path to output PNG (defaults to <input>-transparent.png).")
    parser.add_argument("--threshold", type=int, default=250, help="RGB threshold above which a pixel counts as white (0-255). Default: 250.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    src: Path = args.input.expanduser().resolve()
    if not src.is_file():
        print(f"error: input not found: {src}", file=sys.stderr)
        return 1

    dst: Path
    if args.output is None:
        dst = src.with_name(f"{src.stem}-transparent.png")
    else:
        dst = args.output.expanduser().resolve()
        dst.parent.mkdir(parents=True, exist_ok=True)

    if not 0 <= args.threshold <= 255:
        print("error: --threshold must be between 0 and 255", file=sys.stderr)
        return 1

    white_to_transparent(src, dst, args.threshold)
    print(f"wrote {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
