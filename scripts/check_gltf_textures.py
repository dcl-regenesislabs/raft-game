#!/usr/bin/env python3
"""Check GLTF/GLB files for oversized embedded textures.

Usage:
    python scripts/check_gltf_textures.py [paths...] [--max-size N] [--fix]

Defaults:
    paths     -> assets/
    max-size  -> 512 (pixels, applied to both width and height)

Exit codes:
    0  -> all textures within limit (or --fix succeeded)
    1  -> at least one texture exceeds the limit (only when not using --fix)

With --fix, oversized textures inside GLB files are downscaled in place
(preserving aspect ratio, re-encoded as PNG/JPEG, repacked into the binary
chunk with 4-byte alignment).
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import struct
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

GLB_MAGIC = b"glTF"
JSON_CHUNK = b"JSON"
BIN_CHUNK = b"BIN\x00"
DEFAULT_MAX_SIZE = 512


@dataclass(frozen=True)
class TextureIssue:
    file: Path
    image_index: int
    image_name: str | None
    width: int
    height: int


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if data[:4] != GLB_MAGIC:
        raise ValueError(f"{path}: not a GLB (bad magic)")
    version, total_len = struct.unpack_from("<II", data, 4)
    if version != 2:
        raise ValueError(f"{path}: unsupported GLB version {version}")
    offset = 12
    gltf_json: dict | None = None
    bin_data = b""
    while offset < total_len:
        chunk_len, chunk_type = struct.unpack_from("<I4s", data, offset)
        offset += 8
        chunk_data = data[offset:offset + chunk_len]
        offset += chunk_len
        if chunk_type == JSON_CHUNK:
            gltf_json = json.loads(chunk_data.decode("utf-8"))
        elif chunk_type == BIN_CHUNK:
            bin_data = bytes(chunk_data)
    if gltf_json is None:
        raise ValueError(f"{path}: missing JSON chunk")
    return gltf_json, bin_data


def write_glb(path: Path, gltf_json: dict, bin_data: bytes) -> None:
    json_bytes = json.dumps(gltf_json, separators=(",", ":")).encode("utf-8")
    json_pad = (4 - (len(json_bytes) % 4)) % 4
    json_bytes += b" " * json_pad
    bin_pad = (4 - (len(bin_data) % 4)) % 4
    padded_bin = bin_data + b"\x00" * bin_pad
    total_len = 12 + 8 + len(json_bytes)
    if padded_bin:
        total_len += 8 + len(padded_bin)
    with path.open("wb") as f:
        f.write(GLB_MAGIC)
        f.write(struct.pack("<II", 2, total_len))
        f.write(struct.pack("<I4s", len(json_bytes), JSON_CHUNK))
        f.write(json_bytes)
        if padded_bin:
            f.write(struct.pack("<I4s", len(padded_bin), BIN_CHUNK))
            f.write(padded_bin)


def get_image_data(image: dict, gltf: dict, bin_data: bytes, base_dir: Path) -> tuple[bytes, str]:
    if "bufferView" in image:
        bv = gltf["bufferViews"][image["bufferView"]]
        offset = bv.get("byteOffset", 0)
        length = bv["byteLength"]
        return bin_data[offset:offset + length], image.get("mimeType", "image/png")
    if "uri" in image:
        uri = image["uri"]
        if uri.startswith("data:"):
            header, b64 = uri.split(",", 1)
            mime = header.split(";")[0][5:] or "image/png"
            return base64.b64decode(b64), mime
        ext_path = (base_dir / uri).resolve()
        return ext_path.read_bytes(), f"image/{ext_path.suffix.lstrip('.').lower()}"
    raise ValueError("image has neither bufferView nor uri")


def check_file(path: Path, max_size: int) -> list[TextureIssue]:
    if path.suffix.lower() == ".glb":
        gltf, bin_data = read_glb(path)
    else:
        gltf = json.loads(path.read_text())
        bin_data = b""

    issues: list[TextureIssue] = []
    for idx, image in enumerate(gltf.get("images", [])):
        try:
            img_bytes, _mime = get_image_data(image, gltf, bin_data, path.parent)
            with Image.open(io.BytesIO(img_bytes)) as im:
                width, height = im.size
        except Exception as exc:
            print(f"warn: {path}: image {idx} failed to read: {exc}", file=sys.stderr)
            continue
        if width > max_size or height > max_size:
            issues.append(TextureIssue(path, idx, image.get("name"), width, height))
    return issues


def downscale(img_bytes: bytes, mime: str, max_size: int) -> bytes:
    with Image.open(io.BytesIO(img_bytes)) as im:
        im.load()
        width, height = im.size
        scale = min(max_size / width, max_size / height)
        new_w = max(1, int(round(width * scale)))
        new_h = max(1, int(round(height * scale)))
        resized = im.resize((new_w, new_h), Image.LANCZOS)
        out = io.BytesIO()
        if mime == "image/jpeg":
            resized.convert("RGB").save(out, format="JPEG", quality=90, optimize=True)
        else:
            resized.save(out, format="PNG", optimize=True)
        return out.getvalue()


def fix_glb(path: Path, max_size: int) -> int:
    gltf, bin_data = read_glb(path)
    images = gltf.get("images", [])
    buffer_views = gltf.get("bufferViews", [])
    if not images or not buffer_views:
        return 0

    replacements: dict[int, bytes] = {}
    for image in images:
        if "bufferView" not in image:
            continue
        bv_idx = image["bufferView"]
        bv = buffer_views[bv_idx]
        offset = bv.get("byteOffset", 0)
        length = bv["byteLength"]
        img_bytes = bin_data[offset:offset + length]
        try:
            with Image.open(io.BytesIO(img_bytes)) as im:
                width, height = im.size
        except Exception as exc:
            print(f"warn: {path}: bufferView {bv_idx} not a readable image: {exc}", file=sys.stderr)
            continue
        if width <= max_size and height <= max_size:
            continue
        mime = image.get("mimeType", "image/png")
        new_bytes = downscale(img_bytes, mime, max_size)
        replacements[bv_idx] = new_bytes
        label = image.get("name") or f"#{bv_idx}"
        print(f"  {path.name}: image {label} {width}x{height} -> downscaled (cap {max_size})")

    if not replacements:
        return 0

    # Rebuild buffer 0 in original offset order; only buffer 0 is the GLB BIN chunk.
    ordered = sorted(
        (idx for idx, bv in enumerate(buffer_views) if bv.get("buffer", 0) == 0),
        key=lambda idx: buffer_views[idx].get("byteOffset", 0),
    )

    new_buf = bytearray()
    new_offsets: dict[int, tuple[int, int]] = {}
    for bv_idx in ordered:
        bv = buffer_views[bv_idx]
        if bv_idx in replacements:
            chunk = replacements[bv_idx]
        else:
            offset = bv.get("byteOffset", 0)
            length = bv["byteLength"]
            chunk = bytes(bin_data[offset:offset + length])
        pad = (4 - (len(new_buf) % 4)) % 4
        if pad:
            new_buf.extend(b"\x00" * pad)
        new_offsets[bv_idx] = (len(new_buf), len(chunk))
        new_buf.extend(chunk)

    for bv_idx, (offset, length) in new_offsets.items():
        bv = buffer_views[bv_idx]
        bv["byteOffset"] = offset
        bv["byteLength"] = length

    buffers = gltf.get("buffers")
    if buffers:
        buffers[0]["byteLength"] = len(new_buf)

    write_glb(path, gltf, bytes(new_buf))
    return len(replacements)


def iter_targets(roots: list[Path]) -> list[Path]:
    files: list[Path] = []
    for root in roots:
        if root.is_file():
            files.append(root)
        elif root.is_dir():
            files.extend(sorted(root.rglob("*.glb")))
            files.extend(sorted(root.rglob("*.gltf")))
        else:
            print(f"warn: {root} not found, skipping", file=sys.stderr)
    return files


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check GLTF/GLB textures for oversized images.")
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="Files or directories to scan (default: assets/).",
    )
    parser.add_argument(
        "--max-size",
        type=int,
        default=DEFAULT_MAX_SIZE,
        help=f"Maximum allowed width/height in pixels (default: {DEFAULT_MAX_SIZE}).",
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Downscale oversized textures in place (GLB only).",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.max_size <= 0:
        print("error: --max-size must be positive", file=sys.stderr)
        return 2

    roots = args.paths or [Path("assets")]
    files = iter_targets(roots)
    if not files:
        print("no .glb or .gltf files found", file=sys.stderr)
        return 1

    total_issues = 0
    total_fixed = 0
    for path in files:
        try:
            if args.fix and path.suffix.lower() == ".glb":
                fixed = fix_glb(path, args.max_size)
                if fixed:
                    total_fixed += fixed
                    print(f"fixed {fixed} texture(s) in {path}")
                continue
            issues = check_file(path, args.max_size)
            for issue in issues:
                label = issue.image_name or f"#{issue.image_index}"
                print(
                    f"FAIL {path}: image {label} is {issue.width}x{issue.height} "
                    f"(> {args.max_size})"
                )
            total_issues += len(issues)
        except Exception as exc:
            print(f"error: {path}: {exc}", file=sys.stderr)
            total_issues += 1

    if args.fix:
        print(f"\ndone: downscaled {total_fixed} texture(s) across {len(files)} file(s)")
        return 0
    if total_issues:
        print(
            f"\n{total_issues} oversized texture(s) found. Run with --fix to downscale.",
            file=sys.stderr,
        )
        return 1
    print(f"all {len(files)} model(s) within {args.max_size}x{args.max_size} texture limit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
