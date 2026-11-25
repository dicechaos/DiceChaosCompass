#!/usr/bin/env python3
"""
Generates 3 clean-room CC0 2x-supersampled mechanical funicular hardware assets
for accurate Abt-switch cable routing (deflection sheaves, in-track guide rollers,
and heavy track-end buffer stops) and registers them in starter-cc0/manifest.json.
"""
from __future__ import annotations

import json
import math
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
STARTER_DIR = ROOT / "public" / "assets" / "starter-cc0"
OBJ_DIR = STARTER_DIR / "objects"
MANIFEST_PATH = STARTER_DIR / "manifest.json"
DCPACK_PATH = ROOT / "public" / "assets" / "DiceChaos_Berlin_Magipunk_Starter.dcpack"

INK = (26, 22, 20, 255)


def make_deflection_sheave() -> Image.Image:
    """Horizontal brass & cast-iron cable deflection sheave on bolted steel pillow-block."""
    S = 512
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = S // 2, S // 2

    # Subtle grounding contact shadow
    d.rounded_rectangle([68, 76, S - 60, S - 52], radius=34, fill=(8, 11, 18, 95))

    # Bolted steel baseplate mounting bracket
    d.rounded_rectangle([74, 74, S - 74, S - 74], radius=30, fill=(46, 54, 66, 255), outline=INK, width=10)
    d.rounded_rectangle([90, 90, S - 90, S - 90], radius=22, fill=(58, 68, 82, 255), outline=(32, 38, 48, 255), width=4)

    # 4 heavy corner hex anchor bolts
    for bx in (116, S - 116):
        for by in (116, S - 116):
            d.ellipse([bx - 16, by - 16, bx + 16, by + 16], fill=(148, 120, 62, 255), outline=INK, width=5)
            d.ellipse([bx - 6, by - 6, bx + 6, by + 6], fill=(214, 182, 108, 255))

    # Outer dark steel grooved pulley flange
    R_out = 170
    d.ellipse([cx - R_out, cy - R_out, cx + R_out, cy + R_out], fill=(74, 84, 98, 255), outline=INK, width=10)
    # Recessed cable groove ring
    R_grv = 148
    d.ellipse([cx - R_grv, cy - R_grv, cx + R_grv, cy + R_grv], fill=(32, 38, 48, 255), outline=(126, 138, 154, 255), width=6)
    # Brass inner rim
    R_rim = 128
    d.ellipse([cx - R_rim, cy - R_rim, cx + R_rim, cy + R_rim], fill=(178, 138, 62, 255), outline=INK, width=8)
    # Recessed spoked wheel interior
    R_in = 104
    d.ellipse([cx - R_in, cy - R_in, cx + R_in, cy + R_in], fill=(38, 44, 56, 255), outline=INK, width=6)

    # 6 sturdy brass spokes
    for i in range(6):
        ang = i * math.pi / 3
        x1 = cx + math.cos(ang) * 34
        y1 = cy + math.sin(ang) * 34
        x2 = cx + math.cos(ang) * 102
        y2 = cy + math.sin(ang) * 102
        d.line([(x1, y1), (x2, y2)], fill=INK, width=28)
        d.line([(x1, y1), (x2, y2)], fill=(192, 152, 74, 255), width=18)
        d.line([(x1, y1), (x2, y2)], fill=(228, 194, 114, 255), width=6)

    # Central axle cap & grease fitting
    d.ellipse([cx - 46, cy - 46, cx + 46, cy + 46], fill=(198, 158, 76, 255), outline=INK, width=8)
    d.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=(104, 118, 136, 255), outline=INK, width=6)
    d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(96, 224, 255, 255))

    return img.resize((256, 256), Image.Resampling.LANCZOS)


def make_track_roller() -> Image.Image:
    """In-track brass & iron cable guide roller (angled sheave cradle mounted between rails)."""
    W, H = 384, 256
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = W // 2, H // 2

    # Contact shadow
    d.rounded_rectangle([38, 44, W - 30, H - 30], radius=24, fill=(8, 11, 18, 85))

    # Iron tie-mount cradle brackets (top & bottom of cable trough)
    d.rounded_rectangle([42, 36, W - 42, H - 36], radius=22, fill=(52, 60, 72, 255), outline=INK, width=8)
    # Recessed steel trough slot
    d.rounded_rectangle([72, 62, W - 72, H - 62], radius=14, fill=(24, 30, 40, 255), outline=INK, width=6)

    # Brass cylindrical guide roller drum sitting horizontally across cable path
    d.rounded_rectangle([128, 52, W - 128, H - 52], radius=18, fill=(186, 146, 68, 255), outline=INK, width=8)
    # Grooved center guide channel where steel cable rides
    d.rectangle([156, 56, W - 156, H - 56], fill=(138, 104, 44, 255))
    d.rectangle([176, 56, W - 176, H - 56], fill=(224, 188, 108, 255))
    # Horizontal metallic sheen highlights on drum
    d.line([(134, cy - 26), (W - 134, cy - 26)], fill=(242, 214, 142, 255), width=6)
    d.line([(134, cy + 28), (W - 134, cy + 28)], fill=(96, 72, 30, 255), width=6)

    # Side axle bearings + mounting bolts
    for bx in (62, W - 62):
        for by in (60, H - 60):
            d.ellipse([bx - 12, by - 12, bx + 12, by + 12], fill=(166, 176, 190, 255), outline=INK, width=4)
    d.rounded_rectangle([96, cy - 16, 130, cy + 16], radius=6, fill=(110, 122, 138, 255), outline=INK, width=5)
    d.rounded_rectangle([W - 130, cy - 16, W - 96, cy + 16], radius=6, fill=(110, 122, 138, 255), outline=INK, width=5)

    return img.resize((192, 128), Image.Resampling.LANCZOS)


def make_buffer_stop() -> Image.Image:
    """Heavy riveted iron & oak funicular track-end buffer stop with twin hydraulic spring buffers."""
    W, H = 256, 448
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Tight contact shadows strictly under the side rails and cross-beam
    for ry in (74, H - 114):
        d.rounded_rectangle([46, ry + 8, W - 28, ry + 48], radius=10, fill=(8, 11, 18, 90))
    d.rounded_rectangle([104, 44, 182, H - 28], radius=16, fill=(8, 11, 18, 95))

    # Heavy riveted steel A-frame side rails
    for ry in (74, H - 114):
        d.rounded_rectangle([42, ry, W - 36, ry + 40], radius=10, fill=(58, 68, 82, 255), outline=INK, width=7)
        for rx in (70, 126, 182):
            d.ellipse([rx - 7, ry + 13, rx + 7, ry + 27], fill=(170, 180, 194, 255), outline=INK, width=3)

    # Main timber & brass-strapped cross-beam bumper
    d.rounded_rectangle([96, 36, 174, H - 36], radius=16, fill=(122, 78, 44, 255), outline=INK, width=9)
    # Wood grain planks
    for gy in (90, 160, 224, 288, 358):
        d.line([(104, gy), (166, gy)], fill=(86, 52, 28, 255), width=4)
    # Brass reinforcing bands
    for by in (56, H - 82):
        d.rectangle([98, by, 172, by + 26], fill=(192, 152, 70, 255), outline=INK, width=5)

    # Twin west-facing circular hydraulic buffer pads (facing oncoming carriage!)
    for by in (122, H - 122):
        d.rounded_rectangle([48, by - 22, 102, by + 22], radius=8, fill=(88, 98, 114, 255), outline=INK, width=6)
        d.rounded_rectangle([30, by - 36, 62, by + 36], radius=12, fill=(198, 156, 72, 255), outline=INK, width=7)
        d.line([(46, by - 24), (46, by + 24)], fill=(242, 212, 134, 255), width=5)

    # Center cable pass-through slot & red/gold stop lamp
    d.rounded_rectangle([112, H // 2 - 26, 160, H // 2 + 26], radius=10, fill=(32, 38, 48, 255), outline=INK, width=6)
    d.ellipse([122, H // 2 - 16, 150, H // 2 + 16], fill=(224, 68, 56, 255), outline=INK, width=5)
    d.ellipse([129, H // 2 - 9, 141, H // 2 + 3], fill=(255, 180, 150, 255))

    return img.resize((128, 224), Image.Resampling.LANCZOS)


def main() -> None:
    OBJ_DIR.mkdir(parents=True, exist_ok=True)
    new_entries = [
        (
            "objects/funicular_deflection_sheave.png",
            make_deflection_sheave(),
            {
                "path": "objects/funicular_deflection_sheave.png",
                "displayName": "Funicular Brass Deflection Sheave",
                "category": "object",
                "tags": ["funicular", "machinery", "pulley", "cable", "brass", "magipunk", "berlin"],
                "drawMode": "normal",
                "defaultPpi": 256,
                "castsShadow": True,
                "dominantHex": "#B28A3E",
                "widthPx": 256,
                "heightPx": 256,
            },
        ),
        (
            "objects/funicular_track_roller.png",
            make_track_roller(),
            {
                "path": "objects/funicular_track_roller.png",
                "displayName": "Funicular In-Track Cable Guide Roller",
                "category": "object",
                "tags": ["funicular", "machinery", "pulley", "cable", "rail", "brass", "magipunk"],
                "drawMode": "normal",
                "defaultPpi": 256,
                "castsShadow": False,
                "dominantHex": "#BA9244",
                "widthPx": 192,
                "heightPx": 128,
            },
        ),
        (
            "objects/funicular_buffer_stop.png",
            make_buffer_stop(),
            {
                "path": "objects/funicular_buffer_stop.png",
                "displayName": "Funicular Hydraulic Track Buffer Stop",
                "category": "object",
                "tags": ["funicular", "rail", "machinery", "iron", "magipunk", "berlin"],
                "drawMode": "normal",
                "defaultPpi": 256,
                "castsShadow": True,
                "dominantHex": "#7A4E2C",
                "widthPx": 128,
                "heightPx": 224,
            },
        ),
    ]

    for rel, img, _ in new_entries:
        img.save(STARTER_DIR / rel, "PNG", optimize=True)

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    by_path = {a["path"]: a for a in manifest["assets"]}
    for _, _, meta in new_entries:
        by_path[meta["path"]] = meta
    manifest["assets"] = list(by_path.values())
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(MANIFEST_PATH, "manifest.json")
        for p in sorted(STARTER_DIR.rglob("*.png")):
            zf.write(p, p.relative_to(STARTER_DIR).as_posix())

    print(f"SUCCESS! Generated 3 funicular mechanical assets. Starter total: {len(manifest['assets'])}")


if __name__ == "__main__":
    main()
