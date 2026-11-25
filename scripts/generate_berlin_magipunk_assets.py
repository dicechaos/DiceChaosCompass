#!/usr/bin/env python3
"""
Dice Chaos Maps — Berlin Magi-Punk City Funicular Asset Generator (CC0)
Adds 44 dense urban Berlin Gründerzeit / Jugendstil Magi-Punk assets
(Lower-Town working-class slums -> Elevated Prussian-Green Steel Viaduct
-> Upper-Town Aristocratic Promenade & Glass-Domed Aether Terminal)
and merges them cleanly into public/assets/starter-cc0/manifest.json + .dcpack.
"""

from __future__ import annotations

import json
import math
import random
import zipfile
from pathlib import Path
from typing import Tuple

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from generate_funicular_assets import (
    OUT_DIR,
    ROOT,
    add_drop_shadow,
    apply_painterly_grain,
    dominant_hex,
    fbm_texture,
    tint_noise,
)

DCPACK_OUT = ROOT / "public" / "assets" / "DiceChaos_Berlin_Magipunk_Starter.dcpack"


# ---------------------------------------------------------------------------
# Urban Berlin Magi-Punk Terrains (512x512 seamless)
# ---------------------------------------------------------------------------
def gen_berlin_wet_cobble() -> Image.Image:
    """Rain-slicked Berlin Kopfsteinpflaster fan/arc granite cobblestones."""
    img = Image.new("RGBA", (512, 512), (24, 27, 34, 255))
    d = ImageDraw.Draw(img)
    rng = random.Random(3101)
    rows = 12
    rh = 512 // rows
    for r in range(rows):
        x = -(rng.randint(0, 22) if r % 2 else 0)
        while x < 512:
            bw = rng.randint(36, 56)
            base = rng.randint(58, 92)
            wet = rng.randint(0, 14)
            col = (base + rng.randint(-4, 6), base + 3 + wet // 2, base + 12 + wet, 255)
            box = (x + 2, r * rh + 2, x + bw - 2, (r + 1) * rh - 2)
            d.rounded_rectangle(box, radius=5, fill=col, outline=(16, 19, 25, 255), width=2)
            # Wet rain sheen specular edge
            d.line([(box[0] + 4, box[1] + 2), (box[2] - 4, box[1] + 2)], fill=(base + 48, base + 56, base + 74, 155), width=2)
            x += bw
    n = fbm_texture(512, 512, 3102, (64, 32, 16))
    return ImageChops.multiply(img, tint_noise(n, (186, 194, 212), (255, 255, 255)))


def gen_lower_slum_brick_alley() -> Image.Image:
    """Soot-stained, cracked Lower-Town Kreuzberg/Wedding brick alley paving."""
    img = Image.new("RGBA", (512, 512), (26, 22, 22, 255))
    d = ImageDraw.Draw(img)
    rng = random.Random(3103)
    rows = 14
    rh = 512 // rows
    for r in range(rows):
        x = -(28 if r % 2 else 0)
        while x < 512:
            bw = rng.randint(48, 64)
            red = rng.randint(76, 114)
            grn = int(red * rng.uniform(0.58, 0.72))
            blu = int(red * rng.uniform(0.52, 0.66))
            box = (x + 2, r * rh + 2, x + bw - 2, (r + 1) * rh - 2)
            d.rectangle(box, fill=(red, grn, blu, 255), outline=(18, 16, 18, 255), width=2)
            if rng.random() < 0.22:
                d.line([(box[0] + 4, box[1] + 4), (box[2] - 4, box[3] - 4)], fill=(18, 15, 16, 175), width=1)
            x += bw
    # Grime & damp puddle staining
    n = fbm_texture(512, 512, 3104, (64, 32, 16))
    return ImageChops.multiply(img, tint_noise(n, (152, 152, 162), (255, 248, 240)))


def gen_upper_marble_promenade() -> Image.Image:
    """Wealthy Upper-Town cream Prussian limestone & gold-brass Art-Nouveau promenade."""
    img = Image.new("RGBA", (512, 512), (176, 166, 148, 255))
    d = ImageDraw.Draw(img)
    tile = 128
    for gy in range(0, 512, tile):
        for gx in range(0, 512, tile):
            shade = 214 if ((gx // tile + gy // tile) % 2 == 0) else 198
            d.rectangle((gx + 2, gy + 2, gx + tile - 2, gy + tile - 2), fill=(shade, shade - 6, shade - 18, 255), outline=(136, 126, 108, 255), width=2)
            # Subtle Art-Nouveau gold brass corner diamond inlay
            cx, cy = gx + tile // 2, gy + tile // 2
            d.polygon([(cx, cy - 14), (cx + 14, cy), (cx, cy + 14), (cx - 14, cy)], outline=(198, 162, 74, 190))
            d.rectangle((gx + 10, gy + 10, gx + tile - 10, gy + tile - 10), outline=(176, 164, 142, 145), width=1)
    n = fbm_texture(512, 512, 3105, (64, 32, 16))
    return ImageChops.multiply(img, tint_noise(n, (224, 222, 218), (255, 255, 255)))


def gen_herringbone_parquet() -> Image.Image:
    """Polished warm oak herringbone salon floor for Upper Terminal."""
    img = Image.new("RGBA", (512, 512), (68, 44, 26, 255))
    d = ImageDraw.Draw(img)
    rng = random.Random(3106)
    step = 32
    for y in range(-64, 576, step):
        for x in range(-64, 576, step * 2):
            v1 = rng.randint(118, 146)
            v2 = rng.randint(96, 126)
            d.polygon([(x, y), (x + step, y + step), (x + step, y + step + 14), (x, y + 14)], fill=(v1, int(v1 * 0.68), int(v1 * 0.40), 255), outline=(44, 26, 14, 220))
            d.polygon([(x + step, y + step), (x + step * 2, y), (x + step * 2, y + 14), (x + step, y + step + 14)], fill=(v2, int(v2 * 0.66), int(v2 * 0.38), 255), outline=(44, 26, 14, 220))
    n = fbm_texture(512, 512, 3107, (32, 16, 8))
    return ImageChops.multiply(img, tint_noise(n, (212, 206, 198), (255, 255, 255)))


def gen_under_city_abyss() -> Image.Image:
    """Deep shadowed Lower-City roofs, glowing cyan/violet ley-line streets & mist 80ft below the viaduct."""
    n = fbm_texture(512, 512, 3108, (64, 32, 16))
    img = tint_noise(n, (10, 14, 24), (24, 34, 52))
    d = ImageDraw.Draw(img)
    rng = random.Random(3109)
    # Distant shadowed street canyons & glowing arcane ley-line pipes far below
    for x in (96, 256, 412):
        d.line([(x, 0), (x, 512)], fill=(18, 66, 92, 130), width=10)
        d.line([(x, 0), (x, 512)], fill=(56, 210, 242, 95), width=2)
    for y in (120, 340):
        d.line([(0, y), (512, y)], fill=(52, 30, 86, 110), width=8)
        d.line([(0, y), (512, y)], fill=(168, 114, 252, 85), width=2)
    # Miniature dark pitched rooftops & warm distant attic windows 80ft down
    for _ in range(26):
        rx, ry = rng.randint(12, 430), rng.randint(12, 430)
        rw, rh = rng.randint(44, 96), rng.randint(36, 76)
        s = rng.randint(24, 42)
        d.rectangle((rx, ry, rx + rw, ry + rh), fill=(s, s + 4, s + 12, 220), outline=(8, 10, 16, 240), width=2)
        d.line([(rx, ry + rh // 2), (rx + rw, ry + rh // 2)], fill=(s + 16, s + 20, s + 28, 190), width=2)
        if rng.random() < 0.45:
            wx, wy = rx + rng.randint(8, rw - 16), ry + rng.randint(8, rh - 14)
            d.rectangle((wx, wy, wx + 8, wy + 5), fill=(242, 178, 72, 145))
    # Subtle urban steam/smog haze
    haze = tint_noise(fbm_texture(512, 512, 3110, (64, 32)), (8, 14, 24), (72, 108, 142))
    return Image.blend(img, haze, 0.24)


def gen_berlin_canal() -> Image.Image:
    n = fbm_texture(512, 512, 3111, (64, 32, 16))
    img = tint_noise(n, (14, 36, 44), (36, 82, 96))
    d = ImageDraw.Draw(img)
    rng = random.Random(3112)
    for _ in range(80):
        x, y = rng.randint(0, 480), rng.randint(0, 512)
        l = rng.randint(24, 68)
        d.line([(x, y), (x + l, y)], fill=(120, 196, 212, 75), width=2)
    return img


def gen_slate_rooftop_tiles() -> Image.Image:
    img = Image.new("RGBA", (512, 512), (44, 48, 58, 255))
    d = ImageDraw.Draw(img)
    rng = random.Random(3113)
    for sy in range(0, 512, 32):
        for sx in range(0, 512, 48):
            off = 24 if (sy // 32) % 2 else 0
            s = rng.randint(52, 76)
            d.rectangle((sx + off - 24, sy, sx + off + 22, sy + 30), fill=(s, s + 4, s + 12, 255), outline=(22, 26, 34, 210), width=2)
    return apply_painterly_grain(img, 3114, 0.16)


# ---------------------------------------------------------------------------
# Urban Berlin Magi-Punk Wall Strips (512x128)
# ---------------------------------------------------------------------------
def gen_urban_wall(mode: str) -> Image.Image:
    w, h = 512, 128
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(hash(mode) & 0xFFFF)

    if mode == "grunderzeit_brick":
        d.rectangle((0, 20, w, h - 20), fill=(62, 34, 30, 255))
        for ry in (24, 52, 78):
            x = -(20 if ry == 52 else 0)
            while x < w:
                bw = rng.randint(44, 62)
                x0, x1 = max(1, x + 2), min(w - 1, x + bw - 2)
                if x1 > x0 + 4:
                    r = rng.randint(108, 148)
                    d.rectangle((x0, ry, x1, ry + 24), fill=(r, int(r * 0.46), int(r * 0.38), 255), outline=(30, 18, 16, 255), width=2)
                x += bw
        d.line([(0, 20), (w, 20)], fill=(20, 14, 14, 255), width=4)
        d.line([(0, h - 20), (w, h - 20)], fill=(20, 14, 14, 255), width=4)

    elif mode == "prussian_limestone":
        d.rectangle((0, 18, w, h - 18), fill=(172, 164, 146, 255), outline=(42, 38, 32, 255), width=4)
        for bx in range(0, w, 64):
            d.rectangle((bx + 2, 22, bx + 62, h - 22), fill=(214, 204, 184, 255), outline=(112, 102, 86, 255), width=2)
            d.line([(bx + 6, 26), (bx + 58, 26)], fill=(244, 238, 224, 210), width=3)
        # Gilded brass Art-Nouveau coping line along center
        d.rectangle((0, h // 2 - 5, w, h // 2 + 5), fill=(214, 172, 72, 255), outline=(72, 54, 22, 255), width=1)

    elif mode == "jugendstil_iron":
        d.rectangle((0, 50, w, 78), fill=(34, 48, 44, 255), outline=(14, 20, 18, 255), width=2)
        d.line([(0, 56), (w, 56)], fill=(224, 178, 76, 240), width=3)
        d.line([(0, 72), (w, 72)], fill=(224, 178, 76, 240), width=2)
        for px in range(32, w, 64):
            d.ellipse((px - 14, 50, px + 14, 78), fill=(46, 68, 60, 255), outline=(18, 24, 22, 255), width=2)
            d.ellipse((px - 6, 58, px + 6, 70), fill=(242, 198, 92, 255))

    elif mode == "aether_bulkhead":
        d.rectangle((0, 22, w, h - 22), fill=(48, 56, 66, 255), outline=(16, 20, 26, 255), width=4)
        for bx in range(0, w, 128):
            d.rectangle((bx + 4, 26, bx + 124, h - 26), fill=(62, 72, 84, 255), outline=(24, 28, 36, 255), width=2)
        # Glowing cyan copper aether conduit pipe running along bulkhead
        d.rectangle((0, h // 2 - 12, w, h // 2 + 12), fill=(176, 118, 62, 255), outline=(36, 22, 12, 255), width=2)
        d.rectangle((0, h // 2 - 5, w, h // 2 + 5), fill=(72, 232, 255, 245))

    elif mode == "tenement_plaster":
        d.rectangle((0, 22, w, h - 22), fill=(138, 126, 108, 255), outline=(32, 28, 24, 255), width=4)
        for bx in range(0, w, 96):
            d.rectangle((bx, 22, bx + 12, h - 22), fill=(86, 60, 40, 255), outline=(28, 18, 12, 255), width=2)
        d.line([(0, 28), (w, 28)], fill=(176, 166, 148, 190), width=3)

    return apply_painterly_grain(img, 3200 + (hash(mode) & 511), 0.16)


# ---------------------------------------------------------------------------
# Urban Magi-Punk Spline Paths (512x192 / 512x112)
# ---------------------------------------------------------------------------
def gen_magirail_track() -> Image.Image:
    """Dual brass-inlaid Berlin Magi-Rail Funicular Track with glowing cyan arcane induction coils."""
    w, h = 512, 192
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Riveted Prussian-green industrial steel track bed
    d.rectangle((0, 14, w, h - 14), fill=(36, 52, 50, 232), outline=(14, 22, 22, 255), width=3)
    for tx in range(10, w, 32):
        d.rounded_rectangle((tx, 24, tx + 16, h - 24), radius=2, fill=(54, 62, 72, 255), outline=(18, 22, 28, 255), width=2)
        for ry in (48, h - 48):
            d.rectangle((tx - 2, ry - 9, tx + 18, ry + 9), fill=(186, 142, 60, 255), outline=(36, 26, 12, 255))

    # Glowing cyan arcane induction coil nodes down the center channel
    d.rectangle((0, h // 2 - 14, w, h // 2 + 14), fill=(22, 32, 42, 255), outline=(14, 20, 28, 255), width=2)
    halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.line([(0, h // 2), (w, h // 2)], fill=(48, 224, 255, 130), width=16)
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(6)))
    d = ImageDraw.Draw(img)
    d.line([(0, h // 2), (w, h // 2)], fill=(96, 238, 255, 255), width=5)
    for rx in range(64, w, 128):
        d.rounded_rectangle((rx - 14, h // 2 - 18, rx + 14, h // 2 + 18), radius=4, fill=(182, 138, 58, 255), outline=(24, 18, 10, 255), width=2)
        d.ellipse((rx - 7, h // 2 - 7, rx + 7, h // 2 + 7), fill=(168, 248, 255, 255))

    # Dual gleaming brass-edged steel rails
    for ry in (48, h - 48):
        d.rectangle((0, ry - 6, w, ry + 6), fill=(96, 110, 126, 255), outline=(20, 24, 30, 255))
        d.line([(0, ry - 2), (w, ry - 2)], fill=(238, 220, 164, 245), width=3)

    return apply_painterly_grain(img, 3301, 0.12)


def gen_aether_conduit_path() -> Image.Image:
    w, h = 512, 72
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(halo).line([(0, h // 2), (w, h // 2)], fill=(56, 226, 255, 145), width=18)
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(7)))
    d = ImageDraw.Draw(img)
    d.line([(0, h // 2), (w, h // 2)], fill=(182, 118, 58, 255), width=12)
    d.line([(0, h // 2), (w, h // 2)], fill=(122, 242, 255, 255), width=5)
    for cx in range(32, w, 64):
        d.rectangle((cx - 6, h // 2 - 10, cx + 6, h // 2 + 10), fill=(214, 168, 72, 255), outline=(32, 22, 12, 255), width=2)
    return img


def gen_berlin_curb_path() -> Image.Image:
    w, h = 512, 96
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 24, w, 72), fill=(116, 122, 132, 255), outline=(26, 28, 34, 255), width=3)
    for sx in range(0, w, 64):
        d.line([(sx, 24), (sx, 72)], fill=(38, 42, 48, 220), width=2)
    d.line([(0, 28), (w, 28)], fill=(176, 184, 196, 190), width=3)
    return apply_painterly_grain(img, 3303, 0.16)


def gen_fire_escape_stairs() -> Image.Image:
    w, h = 512, 112
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 14, w, h - 14), fill=(36, 42, 50, 240), outline=(14, 16, 22, 255), width=3)
    for x in range(8, w, 20):
        d.rectangle((x, 20, x + 14, h - 20), fill=(68, 76, 88, 255), outline=(18, 20, 26, 255), width=2)
        d.line([(x + 3, 22), (x + 3, h - 22)], fill=(134, 146, 162, 180), width=2)
    d.line([(0, 16), (w, 16)], fill=(168, 178, 192, 225), width=3)
    d.line([(0, h - 16), (w, h - 16)], fill=(168, 178, 192, 225), width=3)
    return img


def gen_laundry_banner_line() -> Image.Image:
    w, h = 512, 96
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.line([(0, 48), (w, 48)], fill=(44, 48, 56, 240), width=3)
    colors = [(198, 66, 62, 235), (228, 220, 198, 235), (66, 134, 176, 235), (226, 176, 68, 235), (144, 92, 176, 235)]
    for idx, x in enumerate(range(24, w - 32, 56)):
        c = colors[idx % len(colors)]
        d.polygon([(x, 48), (x + 38, 48), (x + 32, 78), (x + 4, 74)], fill=c, outline=(24, 22, 26, 210))
    return img


# ---------------------------------------------------------------------------
# Inset Portals (256x128 — designed to sit cleanly inside carved wall jambs!)
# ---------------------------------------------------------------------------
def gen_urban_portal(kind: str) -> Image.Image:
    w, h = 256, 128
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == "jugendstil_door":
        d.rounded_rectangle((12, 34, w - 12, h - 34), radius=6, fill=(108, 52, 34, 255), outline=(28, 14, 10, 255), width=4)
        d.line([(w // 2, 34), (w // 2, h - 34)], fill=(224, 176, 72, 255), width=4)
        d.rounded_rectangle((28, 44, w // 2 - 12, h - 44), radius=4, fill=(134, 68, 44, 255), outline=(218, 172, 70, 230), width=3)
        d.rounded_rectangle((w // 2 + 12, 44, w - 28, h - 44), radius=4, fill=(134, 68, 44, 255), outline=(218, 172, 70, 230), width=3)
        d.ellipse((w // 2 - 14, h // 2 - 6, w // 2 - 4, h // 2 + 6), fill=(246, 206, 98, 255))
        d.ellipse((w // 2 + 4, h // 2 - 6, w // 2 + 14, h // 2 + 6), fill=(246, 206, 98, 255))
    elif kind == "magiglass_window":
        # Luminous leaded brass & amber/cyan Art-Nouveau stained magi-glass inset cleanly into wall!
        d.rectangle((10, 42, w - 10, h - 42), fill=(52, 62, 78, 255), outline=(18, 22, 30, 255), width=4)
        d.rectangle((18, 48, w - 18, h - 48), fill=(96, 212, 242, 235))
        d.rectangle((72, 48, w - 72, h - 48), fill=(248, 198, 94, 235))
        d.line([(18, h // 2), (w - 18, h // 2)], fill=(238, 248, 255, 220), width=4)
        for mx in (72, w // 2, w - 72):
            d.rectangle((mx - 4, 42, mx + 4, h - 42), fill=(198, 154, 64, 255))
    elif kind == "tenement_door":
        d.rounded_rectangle((14, 38, w - 14, h - 38), radius=4, fill=(96, 66, 44, 255), outline=(24, 16, 12, 255), width=4)
        d.rectangle((14, 46, w - 14, 56), fill=(52, 58, 66, 255))
        d.rectangle((14, h - 56, w - 14, h - 46), fill=(52, 58, 66, 255))
        d.ellipse((w - 44, h // 2 - 6, w - 32, h // 2 + 6), fill=(182, 148, 72, 255))
    elif kind == "slum_window":
        d.rectangle((12, 44, w - 12, h - 44), fill=(48, 42, 38, 255), outline=(18, 16, 16, 255), width=4)
        d.rectangle((20, 50, w - 20, h - 50), fill=(214, 172, 92, 220))
        for mx in (w // 3, (2 * w) // 3):
            d.rectangle((mx - 3, 44, mx + 3, h - 44), fill=(36, 32, 30, 255))
    elif kind == "aether_gate":
        d.rectangle((10, 42, w - 10, h - 42), fill=(34, 54, 50, 255), outline=(14, 22, 20, 255), width=3)
        for bx in range(28, w - 22, 22):
            d.ellipse((bx - 6, h // 2 - 10, bx + 6, h // 2 + 10), fill=(76, 114, 104, 255), outline=(18, 26, 24, 255), width=2)
        d.ellipse((w // 2 - 12, h // 2 - 12, w // 2 + 12, h // 2 + 12), fill=(78, 232, 255, 255), outline=(218, 170, 70, 255), width=4)
    return img


# ---------------------------------------------------------------------------
# Berlin Magi-Punk Hero & City Props
# ---------------------------------------------------------------------------
def gen_magipunk_funicular_interior() -> Image.Image:
    w, h = 768, 384
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Riveted Prussian-blue & brass Art-Nouveau hull
    d.rounded_rectangle((22, 50, w - 22, h - 50), radius=18, fill=(28, 46, 68, 255), outline=(12, 18, 28, 255), width=5)
    d.rounded_rectangle((30, 58, w - 30, h - 58), radius=14, outline=(222, 174, 74, 245), width=4)

    # Front/rear brass bumper couplings & glowing crystal headlamps
    for bx in (8, w - 32):
        d.rounded_rectangle((bx, h // 2 - 28, bx + 24, h // 2 + 28), radius=6, fill=(184, 140, 58, 255), outline=(24, 18, 10, 255), width=3)
    for lx in (28, w - 46):
        d.rounded_rectangle((lx, h // 2 - 16, lx + 18, h // 2 + 16), radius=5, fill=(142, 244, 255, 255), outline=(214, 168, 68, 255), width=3)

    # Polished inlaid hardwood interior deck + glowing central cyan aether core grating!
    d.rounded_rectangle((48, 72, w - 48, h - 72), radius=10, fill=(124, 82, 48, 255), outline=(26, 16, 10, 255), width=4)
    d.rounded_rectangle((150, h // 2 - 24, w - 150, h // 2 + 24), radius=6, fill=(28, 44, 58, 255), outline=(204, 158, 66, 255), width=3)
    for cx in range(180, w - 170, 58):
        d.rounded_rectangle((cx, h // 2 - 12, cx + 34, h // 2 + 12), radius=4, fill=(76, 232, 255, 235), outline=(24, 68, 92, 255), width=2)

    # Front & rear conductor decks with arcane brass throttle wheel & emergency rune lever
    for dx0, dx1 in ((48, 136), (w - 136, w - 48)):
        d.rectangle((dx0, 74, dx1, h - 74), fill=(44, 54, 68, 255), outline=(18, 22, 30, 255), width=3)
        cx, cy = (dx0 + dx1) // 2, h // 2 - 36
        d.ellipse((cx - 22, cy - 22, cx + 22, cy + 22), outline=(232, 182, 74, 255), width=5)
        d.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=(96, 238, 255, 255))
        d.rounded_rectangle((cx - 14, h // 2 + 12, cx + 14, h // 2 + 54), radius=4, fill=(32, 36, 46, 255), outline=(196, 152, 64, 255), width=2)
        d.ellipse((cx - 7, h // 2 + 24, cx + 7, h // 2 + 38), fill=(224, 62, 62, 255))

    # Stepped compartment dividers & plush royal-crimson velvet benches with gold trim
    for div_x in (138, 304, 464, 630):
        d.rectangle((div_x - 6, 72, div_x + 6, h - 72), fill=(76, 42, 26, 255), outline=(22, 14, 10, 255), width=2)
        d.rectangle((div_x - 6, h // 2 - 26, div_x + 6, h // 2 + 26), fill=(138, 96, 56, 255))

    for bx0, bx1 in ((152, 290), (318, 450), (478, 616)):
        for y0, y1 in ((82, 134), (h - 134, h - 82)):
            d.rounded_rectangle((bx0, y0, bx1, y1), radius=7, fill=(136, 28, 48, 255), outline=(218, 170, 72, 225), width=3)
            d.line([(bx0 + 10, y0 + 10), (bx1 - 10, y0 + 10)], fill=(192, 64, 86, 185), width=3)

    return add_drop_shadow(apply_painterly_grain(img, 3401, 0.14), offset=(8, 12), blur=12, alpha=175)


def gen_magipunk_funicular_roof() -> Image.Image:
    """Art-Nouveau Verdigris Copper & Glowing Amber/Cyan Stained-Glass Clerestory Roof."""
    w, h = 768, 384
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((32, 58, w - 32, h - 58), radius=20, fill=(48, 104, 96, 255), outline=(16, 36, 34, 255), width=5)
    for rx in range(96, w - 80, 64):
        d.line([(rx, 64), (rx, h - 64)], fill=(32, 72, 66, 200), width=3)
    d.rounded_rectangle((46, 72, w - 46, h - 72), radius=14, outline=(228, 180, 78, 235), width=4)
    # Raised stained-glass skylight cupola
    d.rounded_rectangle((114, 124, w - 114, h - 124), radius=12, fill=(36, 48, 62, 255), outline=(218, 172, 74, 240), width=4)
    for idx, vx in enumerate(range(148, w - 168, 98)):
        pane_col = (248, 198, 90, 230) if idx % 2 == 0 else (96, 224, 248, 220)
        d.rounded_rectangle((vx, 152, vx + 74, h - 152), radius=5, fill=pane_col, outline=(36, 28, 18, 255), width=3)
    # Brass aether-collector pantograph diamond on roof center
    d.polygon([(w // 2, 104), (w // 2 + 46, h // 2), (w // 2, h - 104), (w // 2 - 46, h // 2)], outline=(242, 198, 94, 240), width=4)
    return add_drop_shadow(apply_painterly_grain(img, 3402, 0.16), offset=(10, 14), blur=14, alpha=175)


def gen_hochbahn_steel_viaduct() -> Image.Image:
    """Berlin Hochbahn Riveted Prussian-Green Steel Elevated Viaduct Bridge Deck."""
    w, h = 768, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Ornate Prussian-green riveted steel outer box girders
    d.rounded_rectangle((10, 18, w - 10, h - 18), radius=8, fill=(42, 68, 62, 255), outline=(14, 24, 22, 255), width=5)
    d.rectangle((22, 54, w - 22, h - 54), fill=(30, 38, 46, 242), outline=(18, 24, 30, 255), width=4)
    # Cross-truss I-beams + subtle glowing cyan under-deck aether conduits
    for gx in range(52, w - 32, 92):
        d.rectangle((gx, 54, gx + 18, h - 54), fill=(52, 78, 72, 255), outline=(18, 26, 24, 255), width=2)
        d.line([(gx + 18, 62), (gx + 92, h - 62)], fill=(62, 92, 86, 175), width=5)
        d.line([(gx + 92, 62), (gx + 18, h - 62)], fill=(62, 92, 86, 175), width=5)
    # Glowing cyan ley-line rails beneath truss
    d.line([(24, h // 2 - 48), (w - 24, h // 2 - 48)], fill=(64, 224, 252, 130), width=4)
    d.line([(24, h // 2 + 48), (w - 24, h // 2 + 48)], fill=(64, 224, 252, 130), width=4)
    # Riveted steel walkway curbs & brass stanchion caps along north/south edges
    for sx in range(28, w - 24, 64):
        d.ellipse((sx - 8, 28, sx + 8, 44), fill=(214, 170, 72, 255), outline=(22, 18, 12, 255), width=2)
        d.ellipse((sx - 8, h - 44, sx + 8, h - 28), fill=(214, 170, 72, 255), outline=(22, 18, 12, 255), width=2)
    return add_drop_shadow(apply_painterly_grain(img, 3403, 0.16), offset=(12, 16), blur=16, alpha=190)


def gen_aether_core_dynamo() -> Image.Image:
    """512x512 — Giant Arcane Aether-Core Dynamo & Brass Bullwheel."""
    s = 512
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    halo = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((64, 64, s - 64, s - 64), fill=(64, 224, 255, 110))
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(24)))
    d = ImageDraw.Draw(img)
    cx, cy = s // 2, s // 2

    d.rounded_rectangle((32, 32, s - 32, s - 32), radius=18, fill=(44, 50, 62, 255), outline=(214, 170, 72, 255), width=5)
    d.ellipse((58, 58, s - 58, s - 58), fill=(18, 24, 34, 255), outline=(188, 146, 62, 255), width=5)
    # Outer brass bullwheel rim with cyan glowing rune ring
    d.ellipse((72, 72, s - 72, s - 72), outline=(214, 168, 68, 255), width=20)
    d.ellipse((92, 92, s - 92, s - 92), outline=(88, 236, 255, 235), width=8)
    for a in range(0, 360, 45):
        rad = math.radians(a)
        d.line([(cx, cy), (cx + math.cos(rad) * 158, cy + math.sin(rad) * 158)], fill=(192, 146, 62, 255), width=18)
        d.line([(cx, cy), (cx + math.cos(rad) * 158, cy + math.sin(rad) * 158)], fill=(246, 212, 118, 200), width=5)
    # Glowing arcane crystal dynamo core in center
    d.ellipse((cx - 64, cy - 64, cx + 64, cy + 64), fill=(52, 198, 246, 255), outline=(228, 182, 76, 255), width=6)
    d.ellipse((cx - 34, cy - 34, cx + 34, cy + 34), fill=(196, 248, 255, 255))
    return add_drop_shadow(img, offset=(8, 10), blur=12, alpha=170)


def gen_crystal_capacitor() -> Image.Image:
    w, h = 384, 256
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(halo).rounded_rectangle((36, 36, w - 36, h - 36), radius=24, fill=(139, 92, 246, 105))
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(16)))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((26, 34, w - 26, h - 34), radius=10, fill=(46, 52, 64, 255), outline=(204, 158, 66, 255), width=4)
    for cx in (92, 192, 292):
        d.ellipse((cx - 36, 74, cx + 36, 182), fill=(132, 92, 248, 245), outline=(224, 180, 76, 255), width=5)
        d.ellipse((cx - 18, 96, cx + 18, 160), fill=(198, 232, 255, 255))
    return add_drop_shadow(img)


def gen_aether_track_switch() -> Image.Image:
    w, h = 512, 384
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(36, 132), (476, 56), (476, 328), (36, 252)], fill=(38, 56, 54, 238), outline=(16, 26, 24, 255))
    for y_end in (96, 152, 232, 288):
        y_start = 160 if y_end < 192 else 224
        d.line([(32, y_start), (480, y_end)], fill=(116, 132, 146, 255), width=12)
        d.line([(32, y_start), (480, y_end)], fill=(238, 218, 160, 230), width=4)
    d.line([(48, 192), (464, 124)], fill=(76, 232, 255, 220), width=5)
    d.line([(48, 192), (464, 260)], fill=(76, 232, 255, 220), width=5)
    d.rounded_rectangle((176, 24, 256, 86), radius=8, fill=(44, 50, 60, 255), outline=(214, 168, 70, 255), width=3)
    d.ellipse((196, 36, 236, 76), fill=(76, 232, 255, 255), outline=(218, 170, 72, 255), width=4)
    return add_drop_shadow(img)


def gen_upper_terminal_dome() -> Image.Image:
    """768x768 — Grand Upper-Town Ribbed Glass & Verdigris-Copper Art-Nouveau Terminal Dome."""
    w, h = 768, 768
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((22, 22, w - 22, h - 22), radius=18, fill=(52, 112, 102, 255), outline=(22, 42, 38, 255), width=6)
    d.rounded_rectangle((40, 40, w - 40, h - 40), radius=12, outline=(228, 184, 82, 235), width=5)
    # Vaulted translucent golden-lit Art-Nouveau glass barrel roof
    d.rounded_rectangle((112, 86, w - 112, h - 86), radius=34, fill=(76, 132, 152, 215), outline=(224, 178, 76, 255), width=6)
    for ry in range(156, h - 120, 92):
        d.line([(116, ry), (w - 116, ry)], fill=(44, 72, 68, 240), width=10)
        d.line([(116, ry), (w - 116, ry)], fill=(224, 180, 82, 220), width=3)
    for rx in range(210, w - 180, 110):
        d.line([(rx, 92), (rx, h - 92)], fill=(44, 72, 68, 220), width=6)
    # Warm interior golden chandelier light glowing subtly through glass dome
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((210, 210, w - 210, h - 210), fill=(255, 212, 108, 110))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(36)))
    return add_drop_shadow(apply_painterly_grain(img, 3407, 0.14), offset=(14, 18), blur=18, alpha=185)


def gen_tenement_roof(variant: str) -> Image.Image:
    w, h = 768, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    base = (118, 56, 48, 255) if variant == "a" else (62, 68, 82, 255)
    dark = (74, 34, 30, 255) if variant == "a" else (38, 42, 54, 255)
    d.rounded_rectangle((20, 20, w - 20, h - 20), radius=8, fill=base, outline=(18, 16, 18, 255), width=5)
    d.rectangle((22, h // 2, w - 22, h - 22), fill=dark)
    for sy in range(44, h - 32, 32):
        d.line([(24, sy), (w - 24, sy)], fill=(24, 20, 22, 140), width=2)
    # Ridge cap
    d.rectangle((18, h // 2 - 12, w - 18, h // 2 + 12), fill=(52, 48, 52, 255), outline=(18, 16, 18, 255), width=3)
    # Dormer skylights & brick chimneys
    for dx in (160, 480):
        d.rounded_rectangle((dx, 76, dx + 96, 152), radius=4, fill=(76, 86, 98, 255), outline=(20, 22, 28, 255), width=4)
        d.rectangle((dx + 14, 92, dx + 82, 136), fill=(214, 172, 92, 210))
    d.rounded_rectangle((340, 290, 420, 366), radius=4, fill=(96, 50, 44, 255), outline=(22, 14, 14, 255), width=4)
    d.rectangle((358, 308, 402, 348), fill=(16, 16, 20, 255))
    return add_drop_shadow(apply_painterly_grain(img, 3408 + ord(variant[0]), 0.18), offset=(14, 18), blur=16, alpha=180)


def gen_mansard_roof() -> Image.Image:
    w, h = 768, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((20, 20, w - 20, h - 20), radius=10, fill=(46, 94, 88, 255), outline=(16, 32, 30, 255), width=5)
    d.rounded_rectangle((96, 96, w - 96, h - 96), radius=6, fill=(68, 76, 88, 255), outline=(224, 178, 76, 240), width=5)
    d.rounded_rectangle((176, 164, w - 176, h - 164), radius=6, fill=(102, 168, 194, 215), outline=(224, 178, 76, 240), width=4)
    return add_drop_shadow(apply_painterly_grain(img, 3410, 0.15), offset=(14, 18), blur=16, alpha=180)


def gen_vendor_stall() -> Image.Image:
    w, h = 384, 256
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((24, 34, w - 24, h - 34), radius=8, fill=(112, 78, 46, 255), outline=(28, 18, 12, 255), width=4)
    # Striped weathered canvas market awning
    for idx, sx in enumerate(range(30, w - 30, 36)):
        c = (164, 48, 44, 255) if idx % 2 == 0 else (218, 204, 174, 255)
        d.rectangle((sx, 40, min(w - 30, sx + 36), 174), fill=c)
    d.rectangle((30, 40, w - 30, 174), outline=(34, 20, 14, 255), width=4)
    # Glowing bootleg arcane potion bottles along counter edge
    for px, col in ((84, (76, 232, 255, 255)), (128, (168, 92, 248, 255)), (172, (76, 232, 152, 255))):
        d.ellipse((px - 10, 186, px + 10, 206), fill=col, outline=(24, 20, 26, 255), width=2)
    return add_drop_shadow(apply_painterly_grain(img, 3411, 0.16))


def gen_slum_scrap_crates() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((26, 28, 138, 138), radius=4, fill=(116, 84, 52, 255), outline=(26, 18, 12, 255), width=4)
    d.ellipse((134, 40, 224, 130), fill=(58, 66, 76, 255), outline=(18, 20, 26, 255), width=4)
    d.ellipse((150, 56, 208, 114), fill=(36, 72, 78, 255), outline=(88, 224, 236, 200), width=3)
    d.rounded_rectangle((56, 132, 202, 224), radius=6, fill=(92, 66, 44, 255), outline=(26, 18, 12, 255), width=4)
    return add_drop_shadow(apply_painterly_grain(img, 3412, 0.18))


def gen_steam_vent() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((46, 46, s - 46, s - 46), radius=10, fill=(44, 50, 58, 255), outline=(16, 18, 24, 255), width=5)
    for gy in range(66, s - 58, 18):
        d.line([(62, gy), (s - 62, gy)], fill=(18, 22, 28, 255), width=7)
    mist = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    md = ImageDraw.Draw(mist)
    md.ellipse((24, 24, 188, 176), fill=(168, 224, 236, 95))
    md.ellipse((78, 64, 232, 220), fill=(214, 232, 244, 85))
    return Image.alpha_composite(img, mist.filter(ImageFilter.GaussianBlur(18)))


def gen_slum_lamp() -> Image.Image:
    s = 192
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    halo = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((14, 14, s - 14, s - 14), fill=(64, 224, 212, 130))
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(img)
    d.ellipse((54, 54, s - 54, s - 54), fill=(42, 48, 56, 255), outline=(16, 18, 24, 255), width=4)
    d.ellipse((68, 68, s - 68, s - 68), fill=(116, 244, 234, 255), outline=(36, 118, 114, 255), width=4)
    return img


def gen_promenade_lamp() -> Image.Image:
    s = 192
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    halo = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((12, 12, s - 12, s - 12), fill=(255, 214, 112, 140))
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(img)
    d.ellipse((46, 46, s - 46, s - 46), fill=(196, 152, 62, 255), outline=(44, 32, 14, 255), width=4)
    for ox, oy in ((96, 68), (72, 112), (120, 112)):
        d.ellipse((ox - 18, oy - 18, ox + 18, oy + 18), fill=(255, 238, 174, 255), outline=(176, 132, 48, 255), width=3)
    return img


def gen_cafe_table() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 3 cushioned wrought-iron bistro chairs
    for a in (0, 120, 240):
        cx, cy = 128 + math.cos(math.radians(a)) * 78, 128 + math.sin(math.radians(a)) * 78
        d.ellipse((cx - 26, cy - 26, cx + 26, cy + 26), fill=(138, 36, 48, 255), outline=(214, 170, 72, 255), width=4)
    # Marble bistro table with tea cups
    d.ellipse((74, 74, 182, 182), fill=(232, 224, 208, 255), outline=(204, 158, 66, 255), width=5)
    d.ellipse((98, 96, 114, 112), fill=(255, 255, 255, 255), outline=(146, 116, 62, 255), width=2)
    d.ellipse((142, 138, 158, 154), fill=(255, 255, 255, 255), outline=(146, 116, 62, 255), width=2)
    return add_drop_shadow(img)


def gen_ornate_fountain() -> Image.Image:
    s = 384
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((26, 26, s - 26, s - 26), fill=(214, 206, 188, 255), outline=(66, 60, 50, 255), width=6)
    d.ellipse((52, 52, s - 52, s - 52), fill=(48, 152, 178, 255), outline=(176, 166, 146, 255), width=4)
    d.ellipse((84, 84, s - 84, s - 84), outline=(168, 238, 252, 185), width=5)
    # Bronze centerpiece pedestal + glowing cyan arcane water spire
    d.ellipse((136, 136, s - 136, s - 136), fill=(198, 154, 66, 255), outline=(44, 32, 14, 255), width=5)
    d.ellipse((166, 166, s - 166, s - 166), fill=(142, 244, 255, 255))
    return add_drop_shadow(apply_painterly_grain(img, 3417, 0.12), offset=(10, 12), blur=12)


def gen_velvet_divan() -> Image.Image:
    w, h = 320, 160
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((20, 26, w - 20, h - 26), radius=24, fill=(138, 28, 48, 255), outline=(224, 176, 74, 255), width=5)
    d.rounded_rectangle((46, 44, w - 46, h - 44), radius=14, fill=(166, 42, 64, 255), outline=(92, 18, 30, 255), width=2)
    for cx in (96, 160, 224):
        d.ellipse((cx - 5, h // 2 - 5, cx + 5, h // 2 + 5), fill=(232, 184, 78, 255))
    return add_drop_shadow(apply_painterly_grain(img, 3418, 0.12))


def gen_urban_linden_tree() -> Image.Image:
    s = 384
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Square ornate Berlin stone curb & iron tree grate
    d.rounded_rectangle((84, 84, s - 84, s - 84), radius=8, fill=(196, 188, 172, 255), outline=(46, 42, 36, 255), width=4)
    d.rectangle((102, 102, s - 102, s - 102), fill=(44, 50, 56, 255))
    rng = random.Random(3419)
    cx, cy = s // 2, s // 2
    for radius, col in [(134, (36, 86, 52, 245)), (104, (52, 114, 68, 250)), (72, (74, 142, 86, 255))]:
        for i in range(12):
            ang = math.tau * i / 12 + rng.uniform(-0.1, 0.1)
            px, py = cx + math.cos(ang) * radius * 0.52, cy + math.sin(ang) * radius * 0.52
            r = radius * rng.uniform(0.45, 0.62)
            d.ellipse((px - r, py - r, px + r, py + r), fill=col, outline=(22, 48, 30, 180), width=2)
    return add_drop_shadow(apply_painterly_grain(img, 3420, 0.14), offset=(10, 14), blur=14)


def gen_city_planter() -> Image.Image:
    w, h = 256, 160
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((18, 26, w - 18, h - 26), radius=8, fill=(214, 206, 188, 255), outline=(56, 52, 44, 255), width=4)
    d.rounded_rectangle((32, 40, w - 32, h - 40), radius=5, fill=(46, 98, 56, 255))
    for fx, col in ((64, (238, 198, 72, 255)), (108, (228, 76, 96, 255)), (152, (168, 114, 252, 255)), (192, (238, 198, 72, 255))):
        d.ellipse((fx - 12, h // 2 - 12, fx + 12, h // 2 + 12), fill=col, outline=(28, 54, 34, 200), width=2)
    return add_drop_shadow(img)


def gen_gilded_ticket_kiosk() -> Image.Image:
    w, h = 384, 256
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((22, 32, w - 22, h - 32), radius=12, fill=(98, 50, 34, 255), outline=(224, 178, 74, 255), width=5)
    d.rounded_rectangle((36, 44, w - 36, 94), radius=6, fill=(224, 214, 194, 255), outline=(198, 154, 62, 255), width=3)
    # Glowing cyan arcane departure ticker strip
    d.rounded_rectangle((68, 116, w - 68, 152), radius=4, fill=(22, 36, 52, 255), outline=(218, 172, 72, 255), width=3)
    d.line([(84, 134), (w - 84, 134)], fill=(96, 238, 255, 255), width=4)
    return add_drop_shadow(apply_painterly_grain(img, 3422, 0.12))


def gen_automaton_dock() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    halo = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((34, 34, s - 34, s - 34), fill=(76, 232, 255, 115))
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(14)))
    d = ImageDraw.Draw(img)
    d.ellipse((42, 42, s - 42, s - 42), fill=(44, 52, 64, 255), outline=(218, 172, 72, 255), width=5)
    d.ellipse((62, 62, s - 62, s - 62), outline=(88, 236, 255, 240), width=4)
    # Brass clockwork sentry shoulders & domed head from top-down
    d.rounded_rectangle((84, 94, 172, 162), radius=18, fill=(192, 146, 62, 255), outline=(32, 22, 12, 255), width=4)
    d.ellipse((106, 106, 150, 150), fill=(228, 184, 82, 255), outline=(32, 22, 12, 255), width=3)
    d.ellipse((120, 116, 136, 132), fill=(116, 244, 255, 255))
    return add_drop_shadow(img)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT_DIR / "manifest.json"
    existing_manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"assets": []}

    specs = [
        # New Urban Terrains (7)
        ("terrain/berlin_wet_cobble.png", "Berlin Wet Cobblestone", "terrain", ["berlin", "magipunk", "city", "cobblestone", "street"], "normal", False, gen_berlin_wet_cobble()),
        ("terrain/lower_slum_brick_alley.png", "Lower-Town Brick Alley", "terrain", ["berlin", "slum", "lower_town", "brick", "alley"], "normal", False, gen_lower_slum_brick_alley()),
        ("terrain/upper_marble_promenade.png", "Upper-Town Gold Marble", "terrain", ["berlin", "upper_town", "marble", "promenade", "rich"], "normal", False, gen_upper_marble_promenade()),
        ("terrain/herringbone_parquet.png", "Parlor Herringbone Parquet", "terrain", ["berlin", "upper_town", "wood", "floor", "terminal"], "normal", False, gen_herringbone_parquet()),
        ("terrain/under_city_abyss.png", "Under-City Tenement Depths", "terrain", ["berlin", "magipunk", "city", "chasm", "under_city"], "normal", False, gen_under_city_abyss()),
        ("terrain/berlin_canal_dark.png", "Urban Canal Water", "terrain", ["berlin", "water", "canal", "city"], "normal", False, gen_berlin_canal()),
        ("terrain/slate_rooftop_tiles.png", "Prussian Slate Roof Tiles", "terrain", ["berlin", "roof", "slate", "city"], "normal", False, gen_slate_rooftop_tiles()),
        # New Urban Walls (5)
        ("walls/grunderzeit_brick_wall.png", "Gründerzeit Brick Wall", "wall", ["wall", "berlin", "brick", "lower_town", "city"], "normal", True, gen_urban_wall("grunderzeit_brick")),
        ("walls/prussian_limestone_wall.png", "Prussian Limestone & Gold Wall", "wall", ["wall", "berlin", "upper_town", "marble", "rich"], "normal", True, gen_urban_wall("prussian_limestone")),
        ("walls/jugendstil_iron_balustrade.png", "Jugendstil Iron & Gold Railing", "wall", ["wall", "railing", "berlin", "upper_town", "iron"], "normal", False, gen_urban_wall("jugendstil_iron")),
        ("walls/aether_conduit_bulkhead.png", "Aether-Pipe Iron Bulkhead", "wall", ["wall", "magipunk", "aether", "iron", "machinery"], "normal", True, gen_urban_wall("aether_bulkhead")),
        ("walls/tenement_plaster_wall.png", "Tenement Stucco & Timber Wall", "wall", ["wall", "berlin", "lower_town", "slum"], "normal", True, gen_urban_wall("tenement_plaster")),
        # New Urban Paths / Lines (5)
        ("paths/magirail_funicular_track.png", "Magi-Rail Aether Funicular Track", "path", ["path", "funicular", "magipunk", "rail", "aether", "berlin"], "normal", False, gen_magirail_track()),
        ("paths/aether_power_conduit.png", "Glowing Aether Power Conduit", "path", ["path", "magipunk", "aether", "cable", "leyline"], "normal", False, gen_aether_conduit_path()),
        ("paths/berlin_curb_gutter.png", "Berlin Granite Street Curb", "path", ["path", "berlin", "street", "curb", "city"], "normal", False, gen_berlin_curb_path()),
        ("paths/iron_fire_escape_stairs.png", "Iron Fire-Escape Stairs", "path", ["path", "stairs", "berlin", "lower_town", "iron"], "normal", False, gen_fire_escape_stairs()),
        ("paths/laundry_banner_line.png", "Alley Laundry & Banner Line", "path", ["path", "berlin", "slum", "lower_town", "city"], "normal", False, gen_laundry_banner_line()),
        # New Inset Portals (5)
        ("portals/jugendstil_brass_door.png", "Jugendstil Brass Double Door", "portal", ["portal", "door", "berlin", "upper_town", "brass"], "normal", False, gen_urban_portal("jugendstil_door")),
        ("portals/magiglass_stained_window.png", "Stained Magi-Glass Window", "portal", ["portal", "window", "magipunk", "berlin", "upper_town"], "normal", False, gen_urban_portal("magiglass_window")),
        ("portals/tenement_slum_door.png", "Tenement Iron-Bolted Door", "portal", ["portal", "door", "berlin", "lower_town", "slum"], "normal", False, gen_urban_portal("tenement_door")),
        ("portals/slum_grimy_window.png", "Gaslit Tenement Window", "portal", ["portal", "window", "berlin", "lower_town", "slum"], "normal", False, gen_urban_portal("slum_window")),
        ("portals/aether_sliding_gate.png", "Aether-Rail Boarding Gate", "portal", ["portal", "gate", "funicular", "magipunk", "berlin"], "normal", False, gen_urban_portal("aether_gate")),
        # New Hero Urban Magi-Punk Objects (22)
        ("objects/magipunk_funicular_interior.png", "Magi-Punk Funicular Car (Interior)", "object", ["funicular", "magipunk", "berlin", "carriage", "hero"], "rgb_channels", True, gen_magipunk_funicular_interior()),
        ("objects/magipunk_funicular_roof.png", "Magi-Punk Funicular Car (Roof)", "object", ["funicular", "magipunk", "berlin", "roof", "hero"], "rgb_channels", True, gen_magipunk_funicular_roof()),
        ("objects/hochbahn_steel_viaduct.png", "Berlin Hochbahn Steel Viaduct", "object", ["funicular", "magipunk", "berlin", "bridge", "viaduct", "hero"], "normal", True, gen_hochbahn_steel_viaduct()),
        ("objects/aether_core_dynamo.png", "Arcane Aether-Core Bullwheel", "object", ["funicular", "magipunk", "aether", "machinery", "hero"], "normal", True, gen_aether_core_dynamo()),
        ("objects/crystal_capacitor_bank.png", "Aether Crystal Capacitor Bank", "object", ["magipunk", "aether", "machinery", "upper_town"], "normal", True, gen_crystal_capacitor()),
        ("objects/aether_track_switch.png", "Rune-Etched Track Switch Frog", "object", ["funicular", "magipunk", "rail", "switch", "aether"], "normal", False, gen_aether_track_switch()),
        ("objects/upper_terminal_glass_dome.png", "Upper Terminal Glass-Copper Dome", "object", ["roof", "berlin", "upper_town", "terminal", "magipunk"], "normal", True, gen_upper_terminal_dome()),
        ("objects/lower_tenement_roof_a.png", "Berlin Tenement Red-Slate Roof", "object", ["roof", "berlin", "lower_town", "slum", "city"], "normal", True, gen_tenement_roof("a")),
        ("objects/lower_tenement_roof_b.png", "Mietskaserne Dark Slate Roof", "object", ["roof", "berlin", "lower_town", "slum", "city"], "normal", True, gen_tenement_roof("b")),
        ("objects/upper_town_mansard_roof.png", "Charlottenburg Mansard Roof", "object", ["roof", "berlin", "upper_town", "rich", "city"], "normal", True, gen_mansard_roof()),
        ("objects/street_vendor_stall.png", "Alley Apothecary & Vendor Stall", "object", ["berlin", "lower_town", "slum", "market", "magipunk"], "rgb_channels", True, gen_vendor_stall()),
        ("objects/slum_scrap_crates.png", "Slum Alley Crates & Aether Vat", "object", ["berlin", "lower_town", "slum", "clutter", "magipunk"], "normal", True, gen_slum_scrap_crates()),
        ("objects/alley_steam_vent.png", "Street Steam & Aether Vent", "object", ["berlin", "lower_town", "magipunk", "street", "clutter"], "normal", False, gen_steam_vent()),
        ("objects/aether_streetlamp_slum.png", "Lower-Town Aether Streetlamp", "object", ["light", "berlin", "lower_town", "magipunk", "lamp"], "normal", False, gen_slum_lamp()),
        ("objects/ornate_promenade_lamp.png", "Upper-Town Gilded Globe Lamp", "object", ["light", "berlin", "upper_town", "rich", "lamp"], "normal", False, gen_promenade_lamp()),
        ("objects/aristocrat_cafe_table.png", "Promenade Bistro Café Table", "object", ["berlin", "upper_town", "rich", "furniture"], "rgb_channels", True, gen_cafe_table()),
        ("objects/ornate_fountain_basin.png", "Art-Nouveau Arcane Fountain", "object", ["berlin", "upper_town", "rich", "fountain", "magipunk"], "normal", True, gen_ornate_fountain()),
        ("objects/velvet_lounge_divan.png", "Upper Salon Velvet Divan", "object", ["berlin", "upper_town", "rich", "furniture"], "rgb_channels", True, gen_velvet_divan()),
        ("objects/urban_linden_tree.png", "Berlin Ornamental Linden Tree", "object", ["berlin", "upper_town", "tree", "city", "foliage"], "normal", True, gen_urban_linden_tree()),
        ("objects/city_planter_box.png", "Limestone Floral Planter Box", "object", ["berlin", "upper_town", "rich", "city", "clutter"], "normal", True, gen_city_planter()),
        ("objects/gilded_ticket_kiosk.png", "Gilded Aether-Ticker Kiosk", "object", ["berlin", "upper_town", "terminal", "magipunk", "furniture"], "normal", True, gen_gilded_ticket_kiosk()),
        ("objects/clockwork_automaton_dock.png", "Clockwork Sentry Charging Dock", "object", ["berlin", "upper_town", "magipunk", "machinery", "guard"], "normal", True, gen_automaton_dock()),
    ]

    # Put Berlin Magi-Punk assets FIRST in the manifest so they appear front-and-center in the Asset Vault!
    new_entries = []
    new_paths = set()
    for rel, name, cat, tags, draw_mode, shadow, image in specs:
        out_path = OUT_DIR / rel
        out_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(out_path, format="PNG", optimize=True)
        w, h = image.size
        new_paths.add(rel)
        new_entries.append({
            "path": rel,
            "displayName": name,
            "category": cat,
            "tags": tags,
            "drawMode": draw_mode,
            "defaultPpi": 256,
            "castsShadow": shadow,
            "dominantHex": dominant_hex(image),
            "widthPx": w,
            "heightPx": h,
        })

    kept_existing = [a for a in existing_manifest.get("assets", []) if a["path"] not in new_paths]
    combined = new_entries + kept_existing

    manifest = {
        "specVersion": "1.0",
        "id": "com.dicechaos.starter-berlin-magipunk-cc0",
        "name": "Dice Chaos Berlin Magi-Punk & Funicular Starter (CC0)",
        "author": "Dice Chaos Community",
        "license": "CC0-1.0",
        "defaultPpi": 256,
        "assets": combined,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    with zipfile.ZipFile(DCPACK_OUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(manifest_path, "manifest.json")
        for item in combined:
            p = OUT_DIR / item["path"]
            if p.exists():
                zf.write(p, item["path"])

    print(f"Generated {len(new_entries)} NEW Berlin Magi-Punk assets (Total starter library: {len(combined)} assets)")
    print(f"Packaged open .dcpack -> {DCPACK_OUT}")


if __name__ == "__main__":
    main()
