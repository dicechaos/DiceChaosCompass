#!/usr/bin/env python3
"""
Dice Chaos Compass — CC0 Alpine Funicular Ultra-Detail Starter Asset Generator
Generates 60 rich, painterly, high-DPI top-down TTRPG battlemap assets
optimized for a 55-inch 4K UHD tabletop TV (48x27 @ 1-inch scale),
manifest.json, DiceChaos_Funicular_Starter.dcpack, and the app D20 icon.
"""

from __future__ import annotations

import json
import math
import random
import zipfile
from pathlib import Path
from typing import Tuple

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "assets" / "starter-cc0"
DCPACK_OUT = ROOT / "public" / "assets" / "DiceChaos_Funicular_Starter.dcpack"
ICON_OUT = ROOT / "src-tauri" / "icons" / "icon.png"


def get_pixels_list(img: Image.Image):
    if hasattr(img, "get_flattened_data"):
        return list(img.get_flattened_data())
    return list(img.getdata())


def make_noise_field(w: int, h: int, scale: int, seed: int) -> Image.Image:
    rng = random.Random(seed)
    gw = max(2, w // scale)
    gh = max(2, h // scale)
    grid = Image.new("L", (gw, gh))
    px = grid.load()
    for y in range(gh):
        for x in range(gw):
            px[x, y] = rng.randint(0, 255)
    return grid.resize((w, h), Image.Resampling.BICUBIC)


def fbm_texture(w: int, h: int, seed: int, octaves=(64, 32, 16, 8)) -> Image.Image:
    acc = [0.0] * (w * h)
    weight_sum = 0.0
    for idx, sc in enumerate(octaves):
        weight = 0.5 ** idx
        layer = make_noise_field(w, h, sc, seed + idx * 97)
        data = get_pixels_list(layer)
        for i, val in enumerate(data):
            acc[i] += val * weight
        weight_sum += weight
    out = Image.new("L", (w, h))
    out.putdata([max(0, min(255, int(v / weight_sum))) for v in acc])
    return out


def tint_noise(
    noise: Image.Image,
    c_dark: Tuple[int, int, int],
    c_light: Tuple[int, int, int],
) -> Image.Image:
    w, h = noise.size
    rgb = Image.new("RGBA", (w, h))
    nd = get_pixels_list(noise)
    out = []
    for v in nd:
        t = v / 255.0
        r = int(c_dark[0] + (c_light[0] - c_dark[0]) * t)
        g = int(c_dark[1] + (c_light[1] - c_dark[1]) * t)
        b = int(c_dark[2] + (c_light[2] - c_dark[2]) * t)
        out.append((r, g, b, 255))
    rgb.putdata(out)
    return rgb


def apply_painterly_grain(img: Image.Image, seed: int, strength: float = 0.18) -> Image.Image:
    """Applies subtle painterly FBM surface weathering while preserving alpha channel cleanly."""
    w, h = img.size
    r, g, b, a = img.split()
    noise = fbm_texture(w, h, seed, (32, 16, 8))
    lo = int(255 * (1.0 - strength))
    grain_rgb = tint_noise(noise, (lo, lo, lo), (255, 255, 255)).convert("RGB")
    base_rgb = Image.merge("RGB", (r, g, b))
    mixed = ImageChops.multiply(base_rgb, grain_rgb)
    mr, mg, mb = mixed.split()
    return Image.merge("RGBA", (mr, mg, mb, a))


def add_drop_shadow(img: Image.Image, offset=(7, 10), blur=10, alpha=155) -> Image.Image:
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    a = img.split()[3]
    dark = Image.new("RGBA", img.size, (6, 8, 14, alpha))
    shadow.paste(dark, offset, a)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(shadow, img)


def dominant_hex(img: Image.Image) -> str:
    small = img.resize((48, 48), Image.Resampling.BILINEAR).convert("RGBA")
    r = g = b = n = 0
    for px in get_pixels_list(small):
        if px[3] > 80:
            r += px[0]
            g += px[1]
            b += px[2]
            n += 1
    if n == 0:
        return "#64748B"
    return f"#{r // n:02X}{g // n:02X}{b // n:02X}"


def generate_app_icon():
    ICON_OUT.parent.mkdir(parents=True, exist_ok=True)
    s = 512
    img = Image.new("RGBA", (s, s), (18, 20, 26, 255))
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((64, 64, 448, 448), fill=(229, 169, 60, 42))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(42)))
    d = ImageDraw.Draw(img)

    cx, cy = s / 2, s / 2
    outer = [
        (cx + 196 * math.cos(math.radians(a - 90)), cy + 196 * math.sin(math.radians(a - 90)))
        for a in range(0, 360, 60)
    ]
    inner = [
        (cx + 108 * math.cos(math.radians(a - 90)), cy + 108 * math.sin(math.radians(a - 90)))
        for a in [0, 120, 240]
    ]
    d.polygon(outer, fill=(28, 32, 44, 255), outline=(229, 169, 60, 255))
    d.polygon([outer[0], outer[1], inner[0]], fill=(44, 48, 66, 255))
    d.polygon([outer[2], outer[3], inner[1]], fill=(22, 24, 34, 255))
    d.polygon([outer[4], outer[5], inner[2]], fill=(36, 38, 54, 255))
    d.polygon(inner, fill=(139, 92, 246, 55), outline=(229, 169, 60, 255))

    gold = (229, 169, 60, 255)
    for i in range(6):
        d.line([outer[i], outer[(i + 1) % 6]], fill=gold, width=9)
    for i in range(3):
        d.line([inner[i], inner[(i + 1) % 3]], fill=gold, width=7)
        d.line([inner[i], outer[i * 2]], fill=gold, width=6)
        d.line([inner[i], outer[(i * 2 + 1) % 6]], fill=gold, width=5)
        d.line([inner[i], outer[(i * 2 - 1) % 6]], fill=gold, width=5)
    img.save(ICON_OUT)


# ---------------------------------------------------------------------------
# Terrain Splat Textures (512x512 seamless)
# ---------------------------------------------------------------------------
def gen_alpine_slate() -> Image.Image:
    n = fbm_texture(512, 512, 101)
    img = tint_noise(n, (38, 44, 56), (102, 114, 130))
    d = ImageDraw.Draw(img)
    rng = random.Random(102)
    for _ in range(55):
        x0, y0 = rng.randint(0, 512), rng.randint(0, 512)
        pts = [(x0, y0)]
        for _ in range(4):
            x0 += rng.randint(-48, 48)
            y0 += rng.randint(-30, 30)
            pts.append((x0, y0))
        d.line(pts, fill=(20, 24, 32, 165), width=rng.randint(1, 3))
        d.line([(x + 1, y + 1) for x, y in pts], fill=(144, 158, 176, 95), width=1)
    # Subtle alpine frost specks
    for _ in range(140):
        x, y = rng.randint(0, 512), rng.randint(0, 512)
        d.ellipse((x - 3, y - 2, x + 3, y + 2), fill=(184, 200, 220, rng.randint(25, 65)))
    return img


def gen_granite_cobble() -> Image.Image:
    img = Image.new("RGBA", (512, 512), (28, 31, 38, 255))
    n = fbm_texture(512, 512, 203, (32, 16, 8))
    d = ImageDraw.Draw(img)
    rng = random.Random(204)
    rows = 8
    rh = 512 // rows
    for r in range(rows):
        x = -(rng.randint(0, 30) if r % 2 else 0)
        while x < 512:
            bw = rng.randint(52, 86)
            shade = rng.randint(76, 122)
            box = (x + 3, r * rh + 3, x + bw - 3, (r + 1) * rh - 3)
            d.rounded_rectangle(
                box,
                radius=7,
                fill=(shade + rng.randint(-5, 8), shade + rng.randint(-4, 6), shade + rng.randint(2, 14), 255),
                outline=(20, 22, 28, 255),
                width=2,
            )
            d.line([(box[0] + 6, box[1] + 2), (box[2] - 6, box[1] + 2)], fill=(shade + 32, shade + 34, shade + 40, 175), width=2)
            d.line([(box[0] + 4, box[3] - 3), (box[2] - 4, box[3] - 3)], fill=(18, 20, 26, 170), width=2)
            x += bw
    return ImageChops.multiply(img, tint_noise(n, (206, 212, 224), (255, 255, 255)))


def gen_alpine_snow() -> Image.Image:
    n = fbm_texture(512, 512, 305, (64, 32, 16, 8))
    img = tint_noise(n, (162, 182, 208), (242, 247, 254))
    d = ImageDraw.Draw(img)
    rng = random.Random(306)
    for _ in range(70):
        x, y = rng.randint(0, 512), rng.randint(0, 512)
        rx, ry = rng.randint(3, 11), rng.randint(2, 7)
        d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(82, 92, 108, rng.randint(60, 145)))
    return img


def gen_timber_deck() -> Image.Image:
    img = Image.new("RGBA", (512, 512), (30, 19, 12, 255))
    d = ImageDraw.Draw(img)
    rng = random.Random(407)
    plank_h = 32
    for row in range(512 // plank_h):
        y = row * plank_h
        base = rng.randint(84, 120)
        d.rectangle((0, y + 1, 512, y + plank_h - 2), fill=(base + 14, int(base * 0.72), int(base * 0.46), 255))
        for _ in range(14):
            gy = y + rng.randint(3, plank_h - 4)
            d.line([(0, gy), (512, gy)], fill=(base - 20, int(base * 0.50), int(base * 0.28), 80), width=1)
        joint_x = (row * 173 + rng.randint(40, 160)) % 460 + 24
        d.line([(joint_x, y), (joint_x, y + plank_h)], fill=(22, 14, 8, 255), width=2)
        for nx in (joint_x - 10, joint_x + 10):
            for ny in (y + 8, y + plank_h - 8):
                d.ellipse((nx - 2, ny - 2, nx + 2, ny + 2), fill=(32, 34, 40, 235))
        d.line([(0, y + 2), (512, y + 2)], fill=(base + 36, int(base * 0.90), int(base * 0.64), 95), width=1)
    n = fbm_texture(512, 512, 408, (32, 16, 8))
    return ImageChops.multiply(img, tint_noise(n, (200, 194, 186), (255, 255, 255)))


def gen_pine_moss() -> Image.Image:
    n = fbm_texture(512, 512, 509)
    img = tint_noise(n, (34, 52, 38), (82, 108, 68))
    d = ImageDraw.Draw(img)
    rng = random.Random(510)
    for _ in range(300):
        x, y = rng.randint(0, 512), rng.randint(0, 512)
        ang = rng.uniform(0, math.tau)
        l = rng.randint(5, 13)
        d.line([(x, y), (x + math.cos(ang) * l, y + math.sin(ang) * l)], fill=(64, 52, 34, 135), width=1)
    return img


def gen_iron_plate() -> Image.Image:
    img = Image.new("RGBA", (512, 512), (44, 50, 60, 255))
    d = ImageDraw.Draw(img)
    tile = 128
    for gy in range(0, 512, tile):
        for gx in range(0, 512, tile):
            d.rectangle((gx + 2, gy + 2, gx + tile - 2, gy + tile - 2), fill=(56, 62, 74, 255), outline=(24, 28, 34, 255), width=2)
            for sy in range(gy + 16, gy + tile - 12, 24):
                for sx in range(gx + 16, gx + tile - 12, 24):
                    d.line([(sx - 5, sy), (sx + 5, sy)], fill=(88, 96, 112, 165), width=2)
                    d.line([(sx + 10, sy - 5), (sx + 10, sy + 5)], fill=(88, 96, 112, 165), width=2)
            for rx in (gx + 10, gx + tile - 10):
                for ry in (gy + 10, gy + tile - 10):
                    d.ellipse((rx - 4, ry - 4, rx + 4, ry + 4), fill=(102, 110, 126, 255), outline=(22, 26, 32, 255))
    n = fbm_texture(512, 512, 611, (32, 16, 8))
    return ImageChops.multiply(img, tint_noise(n, (206, 208, 218), (255, 255, 255)))


def gen_chasm_abyss() -> Image.Image:
    n = fbm_texture(512, 512, 712, (64, 32, 16))
    img = tint_noise(n, (10, 17, 30), (36, 56, 82))
    # Subtle layered alpine mist wisps & tiny far-below rock ridges
    mist = fbm_texture(512, 512, 719, (64, 32))
    mist_rgba = tint_noise(mist, (12, 20, 34), (118, 152, 188))
    return Image.blend(img, mist_rgba, 0.28)


# ---------------------------------------------------------------------------
# Wall & Path Strips
# ---------------------------------------------------------------------------
def gen_wall_strip(mode: str) -> Image.Image:
    w, h = 512, 128
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(hash(mode) & 0xFFFF)

    if mode == "stone":
        d.rectangle((0, 20, w, h - 20), fill=(52, 58, 68, 255))
        x = 0
        while x < w - 12:
            bw = rng.randint(52, 88)
            x1 = min(w - 2, x + bw - 2)
            if x1 <= x + 6:
                break
            s = rng.randint(92, 134)
            d.rounded_rectangle((x + 2, 24, x1, h - 24), radius=4, fill=(s, s + 4, s + 10, 255), outline=(22, 25, 32, 255), width=2)
            if x1 - 4 > x + 6:
                d.line([(x + 6, 28), (x1 - 4, 28)], fill=(s + 38, s + 42, s + 46, 200), width=3)
            x += bw
        d.line([(0, 20), (w, 20)], fill=(16, 18, 24, 255), width=4)
        d.line([(0, h - 20), (w, h - 20)], fill=(16, 18, 24, 255), width=4)
    elif mode == "timber":
        d.rectangle((0, 26, w, h - 26), fill=(112, 76, 46, 255), outline=(28, 18, 12, 255), width=4)
        for bx in range(0, w, 128):
            d.rectangle((bx + 4, 20, bx + 26, h - 20), fill=(68, 74, 84, 255), outline=(20, 22, 28, 255), width=2)
            d.ellipse((bx + 11, 30, bx + 19, 38), fill=(180, 152, 92, 255))
            d.ellipse((bx + 11, h - 38, bx + 19, h - 30), fill=(180, 152, 92, 255))
        d.line([(0, 32), (w, 32)], fill=(154, 110, 72, 180), width=3)
    elif mode == "railing":
        d.rectangle((0, 52, w, 76), fill=(46, 52, 62, 255), outline=(16, 18, 24, 255), width=2)
        d.line([(0, 58), (w, 58)], fill=(124, 136, 154, 220), width=2)
        for px in range(32, w, 64):
            d.ellipse((px - 12, 52, px + 12, 76), fill=(72, 80, 94, 255), outline=(16, 18, 24, 255), width=2)
            d.ellipse((px - 5, 59, px + 5, 69), fill=(214, 170, 82, 255))
    elif mode == "retaining":
        d.rectangle((0, 16, w, h - 16), fill=(64, 70, 80, 255))
        for ry in (20, 56, 86):
            x = 0
            while x < w - 10:
                bw = rng.randint(44, 76)
                x1 = min(w - 1, x + bw - 1)
                s = rng.randint(76, 118)
                d.rectangle((x + 1, ry, x1, ry + 28), fill=(s, s + 3, s + 8, 255), outline=(20, 24, 30, 255), width=2)
                x += bw
        d.rectangle((0, 16, w, 30), fill=(218, 230, 246, 175))
    return apply_painterly_grain(img, 800 + (hash(mode) & 999), 0.16)


def gen_funicular_track_path() -> Image.Image:
    w, h = 512, 192
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(901)

    d.rectangle((0, 16, w, h - 16), fill=(52, 56, 64, 225))
    for _ in range(1100):
        gx = rng.randint(0, w - 1)
        gy = rng.randint(18, h - 19)
        c = rng.randint(40, 118)
        d.rectangle((gx, gy, gx + rng.randint(2, 5), gy + rng.randint(2, 4)), fill=(c, c + 2, c + 6, 190))

    for tx in range(12, w, 32):
        wood = rng.randint(66, 88)
        d.rounded_rectangle((tx, 26, tx + 16, h - 26), radius=2, fill=(wood, int(wood * 0.72), int(wood * 0.48), 255), outline=(22, 14, 10, 255), width=2)
        d.line([(tx + 3, 28), (tx + 3, h - 28)], fill=(wood + 26, int(wood * 0.90), int(wood * 0.65), 145), width=1)
        for ry in (48, h - 48):
            d.rectangle((tx - 2, ry - 8, tx + 18, ry + 8), fill=(46, 50, 58, 255), outline=(18, 20, 26, 255))

    for rx in range(64, w, 128):
        d.rounded_rectangle((rx - 14, h // 2 - 18, rx + 14, h // 2 + 18), radius=4, fill=(52, 58, 68, 255), outline=(18, 20, 26, 255), width=2)
        d.rectangle((rx - 7, h // 2 - 12, rx + 7, h // 2 + 12), fill=(176, 142, 74, 255), outline=(24, 20, 16, 255))

    for ry in (48, h - 48):
        d.rectangle((0, ry - 4, w, ry + 8), fill=(12, 14, 20, 160))
        d.rectangle((0, ry - 6, w, ry + 5), fill=(96, 108, 124, 255), outline=(22, 26, 34, 255))
        d.line([(0, ry - 2), (w, ry - 2)], fill=(224, 236, 248, 245), width=3)

    d.line([(0, h // 2 + 2), (w, h // 2 + 2)], fill=(12, 14, 18, 165), width=6)
    d.line([(0, h // 2), (w, h // 2)], fill=(134, 144, 160, 255), width=5)
    for cx in range(0, w, 10):
        d.line([(cx, h // 2 - 2), (cx + 6, h // 2 + 2)], fill=(216, 226, 240, 200), width=1)
    return apply_painterly_grain(img, 902, 0.14)


def gen_haul_cable_path() -> Image.Image:
    w, h = 512, 64
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.line([(0, 35), (w, 35)], fill=(10, 12, 16, 160), width=8)
    d.line([(0, 32), (w, 32)], fill=(124, 134, 150, 255), width=7)
    for x in range(0, w, 8):
        d.line([(x, 29), (x + 5, 35)], fill=(220, 230, 244, 215), width=2)
    return img


def gen_cliff_ledge_path() -> Image.Image:
    w, h = 512, 128
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(905)
    for y in range(44, h):
        a = int(205 * (1.0 - (y - 44) / (h - 44)))
        d.line([(0, y), (w, y)], fill=(8, 12, 20, a), width=1)
    pts = [(0, 48)]
    for x in range(16, w + 16, 24):
        pts.append((min(w, x), 42 + rng.randint(-12, 14)))
    d.line(pts, fill=(182, 198, 218, 240), width=5)
    d.line([(x, y + 5) for x, y in pts], fill=(22, 26, 36, 248), width=6)
    return img


def gen_stone_stairs_path() -> Image.Image:
    w, h = 512, 128
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 12, w, h - 12), fill=(68, 74, 84, 255), outline=(22, 25, 32, 255), width=3)
    for x in range(0, w, 24):
        d.rectangle((x + 1, 18, x + 22, h - 18), fill=(112, 118, 130, 255), outline=(28, 32, 40, 255), width=2)
        d.line([(x + 3, 20), (x + 3, h - 20)], fill=(166, 174, 186, 200), width=2)
    return apply_painterly_grain(img, 906, 0.16)


def gen_catwalk_path() -> Image.Image:
    w, h = 512, 112
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 18, w, h - 18), fill=(46, 50, 58, 255), outline=(16, 18, 24, 255), width=2)
    for x in range(4, w, 16):
        d.rectangle((x, 24, x + 12, h - 24), fill=(124, 86, 52, 255), outline=(32, 20, 12, 255), width=1)
    d.line([(0, 20), (w, 20)], fill=(158, 168, 184, 230), width=3)
    d.line([(0, h - 20), (w, h - 20)], fill=(158, 168, 184, 230), width=3)
    return apply_painterly_grain(img, 907, 0.15)


# ---------------------------------------------------------------------------
# Portals (256x128)
# ---------------------------------------------------------------------------
def gen_portal(kind: str) -> Image.Image:
    w, h = 256, 128
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == "door":
        d.rounded_rectangle((24, 40, w - 24, h - 40), radius=6, fill=(138, 86, 48, 255), outline=(26, 16, 10, 255), width=4)
        d.rectangle((20, 36, 42, h - 36), fill=(62, 68, 78, 255), outline=(18, 20, 26, 255), width=2)
        d.rectangle((w - 42, 36, w - 20, h - 36), fill=(62, 68, 78, 255), outline=(18, 20, 26, 255), width=2)
        d.ellipse((w - 64, h // 2 - 7, w - 50, h // 2 + 7), fill=(229, 178, 72, 255), outline=(36, 26, 12, 255))
    elif kind == "gate":
        d.rectangle((16, 46, w - 16, h - 46), fill=(46, 52, 62, 255), outline=(18, 20, 26, 255), width=3)
        for bx in range(36, w - 28, 24):
            d.ellipse((bx - 6, h // 2 - 10, bx + 6, h // 2 + 10), fill=(92, 102, 118, 255), outline=(20, 22, 28, 255), width=2)
        d.ellipse((w // 2 - 10, h // 2 - 10, w // 2 + 10, h // 2 + 10), fill=(224, 168, 60, 255), outline=(28, 22, 12, 255), width=2)
    elif kind == "window":
        d.rectangle((20, 46, w - 20, h - 46), fill=(116, 186, 232, 225), outline=(44, 52, 66, 255), width=4)
        d.line([(24, h // 2), (w - 24, h // 2)], fill=(214, 240, 255, 220), width=4)
        for mx in (w // 3, (2 * w) // 3):
            d.rectangle((mx - 4, 44, mx + 4, h - 44), fill=(52, 58, 70, 255))
    elif kind == "hatch":
        d.rounded_rectangle((28, 38, w - 28, h - 38), radius=8, fill=(76, 86, 98, 255), outline=(20, 24, 30, 255), width=4)
        d.ellipse((w // 2 - 18, h // 2 - 18, w // 2 + 18, h // 2 + 18), fill=(196, 148, 64, 255), outline=(30, 22, 12, 255), width=3)
        d.line([(w // 2 - 14, h // 2), (w // 2 + 14, h // 2)], fill=(30, 22, 12, 255), width=3)
        d.line([(w // 2, h // 2 - 14), (w // 2, h // 2 + 14)], fill=(30, 22, 12, 255), width=3)
    return apply_painterly_grain(img, 950 + len(kind), 0.12)


# ---------------------------------------------------------------------------
# Hero Funicular, Viaduct, Station & Alpine Props (Existing 20 + 20 NEW!)
# ---------------------------------------------------------------------------
def gen_funicular_car_interior() -> Image.Image:
    w, h = 768, 384
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    d.rounded_rectangle((24, 54, w - 24, h - 54), radius=14, fill=(44, 48, 58, 255), outline=(14, 16, 22, 255), width=5)
    for bx in (10, w - 34):
        d.rounded_rectangle((bx, h // 2 - 26, bx + 24, h // 2 + 26), radius=5, fill=(72, 78, 92, 255), outline=(18, 20, 26, 255), width=3)
        for by in (88, h - 108):
            d.rounded_rectangle((bx + 2, by, bx + 22, by + 20), radius=4, fill=(88, 96, 110, 255), outline=(18, 20, 26, 255), width=2)

    d.rounded_rectangle((46, 72, w - 46, h - 72), radius=10, fill=(138, 94, 54, 255), outline=(28, 18, 12, 255), width=4)
    for py in range(84, h - 80, 18):
        d.line([(50, py), (w - 50, py)], fill=(96, 62, 34, 165), width=2)
    # Center brass aisle tread strip
    d.rectangle((140, h // 2 - 22, w - 140, h // 2 + 22), fill=(116, 78, 44, 255), outline=(66, 44, 24, 200), width=2)

    for dx0, dx1 in ((48, 134), (w - 134, w - 48)):
        d.rectangle((dx0, 74, dx1, h - 74), fill=(62, 68, 80, 255), outline=(22, 24, 30, 255), width=3)
        cx = (dx0 + dx1) // 2
        cy = h // 2 - 36
        d.ellipse((cx - 22, cy - 22, cx + 22, cy + 22), outline=(230, 178, 72, 255), width=5)
        d.line([(cx - 18, cy), (cx + 18, cy)], fill=(230, 178, 72, 255), width=3)
        d.line([(cx, cy - 18), (cx, cy + 18)], fill=(230, 178, 72, 255), width=3)
        d.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=(252, 218, 124, 255))
        d.rounded_rectangle((cx - 14, h // 2 + 12, cx + 14, h // 2 + 56), radius=4, fill=(40, 44, 52, 255), outline=(18, 20, 24, 255), width=2)
        d.ellipse((cx - 7, h // 2 + 24, cx + 7, h // 2 + 38), fill=(208, 56, 56, 255), outline=(28, 12, 12, 255))

    for lx in (32, w - 48):
        d.rounded_rectangle((lx, h // 2 - 14, lx + 16, h // 2 + 14), radius=4, fill=(252, 224, 128, 255), outline=(92, 66, 22, 255), width=2)

    for div_x in (136, 304, 464, 632):
        d.rectangle((div_x - 7, 72, div_x + 7, h - 72), fill=(86, 46, 28, 255), outline=(24, 14, 10, 255), width=2)
        d.rectangle((div_x - 7, h // 2 - 28, div_x + 7, h // 2 + 28), fill=(146, 104, 62, 255))

    for bx0, bx1 in ((150, 290), (318, 450), (478, 618)):
        for y0, y1 in ((82, 134), (h - 134, h - 82)):
            d.rounded_rectangle((bx0, y0, bx1, y1), radius=6, fill=(142, 36, 44, 255), outline=(34, 14, 16, 255), width=3)
            d.line([(bx0 + 8, y0 + 10), (bx1 - 8, y0 + 10)], fill=(192, 72, 78, 185), width=3)
            # Brass seat buttons
            for sx in range(bx0 + 22, bx1 - 14, 34):
                d.ellipse((sx - 3, (y0 + y1) // 2 - 3, sx + 3, (y0 + y1) // 2 + 3), fill=(224, 178, 76, 220))

    for sx0, sx1 in ((170, 270), (340, 428), (498, 598)):
        d.rectangle((sx0, 66, sx1, 78), fill=(218, 170, 74, 255), outline=(28, 20, 10, 255), width=2)
        d.rectangle((sx0, h - 78, sx1, h - 66), fill=(218, 170, 74, 255), outline=(28, 20, 10, 255), width=2)

    img = apply_painterly_grain(img, 1011, 0.16)
    return add_drop_shadow(img, offset=(8, 10), blur=10, alpha=170)


def gen_funicular_car_roof() -> Image.Image:
    w, h = 768, 384
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((36, 62, w - 36, h - 62), radius=18, fill=(116, 36, 42, 255), outline=(26, 12, 14, 255), width=5)
    for rx in range(96, w - 80, 64):
        d.line([(rx, 68), (rx, h - 68)], fill=(78, 22, 28, 190), width=3)
        d.line([(rx + 3, 68), (rx + 3, h - 68)], fill=(164, 66, 72, 130), width=2)
    d.rounded_rectangle((48, 74, w - 48, h - 74), radius=12, outline=(224, 174, 78, 215), width=4)
    d.rounded_rectangle((112, 128, w - 112, h - 128), radius=10, fill=(68, 74, 86, 255), outline=(20, 22, 28, 255), width=4)
    d.rounded_rectangle((124, 140, w - 124, h - 140), radius=6, fill=(84, 92, 106, 255), outline=(196, 152, 68, 210), width=2)
    for vx in range(156, w - 168, 96):
        d.rounded_rectangle((vx, 158, vx + 68, h - 158), radius=4, fill=(242, 192, 90, 228), outline=(36, 28, 20, 255), width=2)
    d.line([(120, 96), (w - 120, 96)], fill=(228, 184, 92, 240), width=4)
    d.line([(120, h - 96), (w - 120, h - 96)], fill=(228, 184, 92, 240), width=4)
    d.rounded_rectangle((58, 66, w - 58, 84), radius=8, fill=(230, 238, 248, 125))
    img = apply_painterly_grain(img, 1012, 0.18)
    return add_drop_shadow(img, offset=(10, 14), blur=14, alpha=175)


def gen_cable_bullwheel() -> Image.Image:
    s = 512
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = s // 2, s // 2
    d.rounded_rectangle((36, 36, s - 36, s - 36), radius=14, fill=(44, 48, 56, 255), outline=(16, 18, 24, 255), width=5)
    d.ellipse((62, 62, s - 62, s - 62), fill=(20, 22, 28, 255), outline=(72, 78, 90, 255), width=4)
    d.ellipse((74, 74, s - 74, s - 74), outline=(168, 178, 192, 255), width=18)
    d.ellipse((86, 86, s - 86, s - 86), outline=(66, 74, 86, 255), width=24)
    d.ellipse((82, 82, s - 82, s - 82), outline=(222, 230, 242, 190), width=4)
    for a in range(0, 360, 45):
        rad = math.radians(a)
        x2, y2 = cx + math.cos(rad) * 158, cy + math.sin(rad) * 158
        d.line([(cx, cy), (x2, y2)], fill=(78, 86, 98, 255), width=22)
        d.line([(cx, cy), (x2, y2)], fill=(128, 138, 154, 175), width=6)
    d.ellipse((cx - 58, cy - 58, cx + 58, cy + 58), fill=(190, 142, 58, 255), outline=(28, 22, 12, 255), width=5)
    d.ellipse((cx - 26, cy - 26, cx + 26, cy + 26), fill=(66, 72, 84, 255), outline=(22, 24, 30, 255), width=3)
    for a in range(0, 360, 60):
        bx, by = cx + math.cos(math.radians(a)) * 42, cy + math.sin(math.radians(a)) * 42
        d.ellipse((bx - 6, by - 6, bx + 6, by + 6), fill=(242, 202, 112, 255), outline=(36, 26, 12, 255))
    return add_drop_shadow(apply_painterly_grain(img, 1013, 0.16), offset=(8, 10), blur=10, alpha=165)


def gen_steam_boiler() -> Image.Image:
    w, h = 512, 384
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((36, 48, w - 36, h - 48), radius=12, fill=(58, 60, 68, 255), outline=(18, 20, 26, 255), width=5)
    d.rounded_rectangle((64, 72, w - 120, h - 72), radius=52, fill=(52, 58, 68, 255), outline=(16, 18, 24, 255), width=5)
    d.rounded_rectangle((84, 96, w - 140, 148), radius=24, fill=(92, 102, 118, 155))
    for bx in (128, 224, 320):
        d.rectangle((bx, 74, bx + 14, h - 74), fill=(202, 150, 60, 255), outline=(36, 26, 12, 255), width=2)
    d.rounded_rectangle((w - 134, 112, w - 52, h - 112), radius=10, fill=(248, 114, 32, 255), outline=(42, 18, 12, 255), width=4)
    d.rounded_rectangle((w - 120, 128, w - 66, h - 128), radius=6, fill=(255, 214, 82, 255))
    for gy in range(132, h - 124, 20):
        d.line([(w - 130, gy), (w - 56, gy)], fill=(38, 22, 18, 230), width=4)
    d.ellipse((150, 150, 234, 234), fill=(36, 40, 48, 255), outline=(196, 126, 70, 255), width=8)
    d.ellipse((168, 168, 216, 216), fill=(16, 18, 22, 255))
    return add_drop_shadow(apply_painterly_grain(img, 1014, 0.16), offset=(8, 10), blur=10, alpha=165)


def gen_brake_console() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((28, 44, s - 28, s - 44), radius=10, fill=(56, 62, 74, 255), outline=(18, 20, 26, 255), width=4)
    for idx, lx in enumerate((72, 128, 184)):
        d.rectangle((lx - 8, 66, lx + 8, s - 66), fill=(26, 28, 34, 255), outline=(188, 144, 62, 255), width=2)
        knob_y = 88 + idx * 32
        knob_col = (218, 56, 52, 255) if idx == 0 else (232, 182, 70, 255)
        d.ellipse((lx - 14, knob_y - 14, lx + 14, knob_y + 14), fill=knob_col, outline=(28, 16, 12, 255), width=3)
    return add_drop_shadow(apply_painterly_grain(img, 1015, 0.14))


def gen_gear_winch() -> Image.Image:
    w, h = 384, 256
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((22, 28, w - 22, h - 28), radius=10, fill=(46, 52, 62, 255), outline=(16, 18, 24, 255), width=4)
    for cx, cy, r, col in ((128, 128, 68, (192, 144, 60, 255)), (254, 128, 52, (114, 124, 140, 255))):
        for a in range(0, 360, 30):
            tx, ty = cx + math.cos(math.radians(a)) * (r + 10), cy + math.sin(math.radians(a)) * (r + 10)
            d.ellipse((tx - 9, ty - 9, tx + 9, ty + 9), fill=col, outline=(22, 20, 18, 255), width=2)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col, outline=(22, 20, 18, 255), width=4)
        d.ellipse((cx - r // 3, cy - r // 3, cx + r // 3, cy + r // 3), fill=(36, 40, 48, 255))
    return add_drop_shadow(apply_painterly_grain(img, 1016, 0.14))


def gen_coal_hopper() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((24, 24, s - 24, s - 24), radius=8, fill=(98, 68, 42, 255), outline=(24, 16, 12, 255), width=5)
    d.rectangle((42, 42, s - 42, s - 42), fill=(24, 26, 32, 255))
    rng = random.Random(1201)
    for _ in range(95):
        cx, cy = rng.randint(52, s - 52), rng.randint(52, s - 52)
        r = rng.randint(8, 16)
        v = rng.randint(32, 72)
        d.polygon([(cx - r, cy), (cx, cy - r), (cx + r, cy - 2), (cx + 4, cy + r)], fill=(v, v + 2, v + 6, 255), outline=(12, 14, 18, 255))
    return add_drop_shadow(img)


def gen_ticket_booth() -> Image.Image:
    w, h = 384, 256
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((26, 36, w - 26, h - 36), radius=10, fill=(124, 82, 48, 255), outline=(28, 18, 12, 255), width=5)
    d.rounded_rectangle((40, 48, w - 40, 94), radius=6, fill=(172, 166, 156, 255), outline=(36, 32, 28, 255), width=3)
    for bx in range(64, w - 60, 22):
        d.line([(bx, 54), (bx, 88)], fill=(218, 170, 70, 255), width=3)
    d.rectangle((72, 118, 156, 178), fill=(228, 216, 186, 255), outline=(56, 38, 24, 255), width=3)
    d.line([(114, 120), (114, 176)], fill=(120, 96, 72, 255), width=2)
    d.ellipse((254, 126, 302, 174), fill=(248, 202, 94, 255), outline=(92, 62, 22, 255), width=4)
    return add_drop_shadow(apply_painterly_grain(img, 1018, 0.14))


def gen_iron_crane() -> Image.Image:
    s = 384
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((116, 116, 268, 268), fill=(58, 64, 76, 255), outline=(18, 20, 26, 255), width=5)
    d.polygon([(170, 162), (356, 176), (356, 208), (170, 222)], fill=(86, 94, 108, 255), outline=(18, 20, 26, 255))
    for bx in range(192, 344, 28):
        d.line([(bx, 170), (bx + 18, 214)], fill=(42, 46, 54, 255), width=4)
    d.rounded_rectangle((44, 148, 134, 236), radius=6, fill=(72, 78, 90, 255), outline=(18, 20, 26, 255), width=4)
    d.ellipse((156, 156, 228, 228), fill=(202, 152, 64, 255), outline=(28, 20, 12, 255), width=4)
    d.ellipse((328, 176, 360, 208), fill=(218, 170, 76, 255), outline=(26, 20, 12, 255), width=3)
    return add_drop_shadow(apply_painterly_grain(img, 1019, 0.14), offset=(8, 12), blur=12)


def gen_bridge_pylon() -> Image.Image:
    s = 384
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((36, 36, s - 36, s - 36), radius=12, fill=(78, 86, 98, 255), outline=(20, 24, 30, 255), width=5)
    d.rounded_rectangle((64, 64, s - 64, s - 64), radius=8, fill=(104, 112, 126, 255), outline=(28, 32, 40, 255), width=4)
    d.rectangle((92, 92, s - 92, s - 92), fill=(52, 58, 68, 255), outline=(18, 20, 26, 255), width=3)
    d.line([(96, 96), (s - 96, s - 96)], fill=(96, 106, 120, 220), width=6)
    d.line([(s - 96, 96), (96, s - 96)], fill=(96, 106, 120, 220), width=6)
    return add_drop_shadow(apply_painterly_grain(img, 1020, 0.18), offset=(10, 12), blur=14)


def gen_luggage_crates() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((28, 34, 148, 152), radius=5, fill=(144, 102, 62, 255), outline=(32, 20, 12, 255), width=4)
    d.line([(34, 40), (142, 146)], fill=(106, 70, 38, 255), width=7)
    d.line([(142, 40), (34, 146)], fill=(106, 70, 38, 255), width=7)
    d.rounded_rectangle((116, 118, 228, 218), radius=8, fill=(120, 46, 38, 255), outline=(28, 14, 12, 255), width=4)
    d.rectangle((138, 120, 152, 216), fill=(218, 172, 70, 255))
    d.rectangle((192, 120, 206, 216), fill=(218, 172, 70, 255))
    d.ellipse((34, 158, 110, 224), fill=(184, 170, 136, 255), outline=(44, 36, 24, 255), width=3)
    return add_drop_shadow(apply_painterly_grain(img, 1021, 0.14))


def gen_waiting_bench() -> Image.Image:
    w, h = 256, 128
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for sy in (26, 52, 78):
        d.rounded_rectangle((20, sy, w - 20, sy + 20), radius=4, fill=(142, 96, 54, 255), outline=(28, 18, 12, 255), width=3)
    for bx in (42, w - 58):
        d.rectangle((bx, 22, bx + 16, h - 22), fill=(48, 54, 64, 255), outline=(16, 18, 24, 255), width=2)
    return add_drop_shadow(apply_painterly_grain(img, 1022, 0.14))


def gen_cable_spool() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((28, 28, s - 28, s - 28), fill=(134, 92, 52, 255), outline=(28, 18, 12, 255), width=5)
    for r in range(86, 42, -9):
        d.ellipse((128 - r, 128 - r, 128 + r, 128 + r), outline=(150, 160, 174, 255), width=5)
    d.ellipse((96, 96, 160, 160), fill=(98, 66, 36, 255), outline=(24, 16, 10, 255), width=4)
    d.ellipse((116, 116, 140, 140), fill=(26, 28, 34, 255))
    return add_drop_shadow(apply_painterly_grain(img, 1023, 0.14))


def gen_lamp_post() -> Image.Image:
    s = 192
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    halo = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((18, 18, s - 18, s - 18), fill=(255, 198, 92, 120))
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(img)
    d.ellipse((52, 52, s - 52, s - 52), fill=(52, 58, 68, 255), outline=(18, 20, 26, 255), width=4)
    d.ellipse((68, 68, s - 68, s - 68), fill=(255, 224, 128, 255), outline=(184, 134, 48, 255), width=4)
    d.ellipse((84, 84, s - 84, s - 84), fill=(255, 248, 212, 255))
    return img


def gen_coal_brazier() -> Image.Image:
    s = 192
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    halo = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((14, 14, s - 14, s - 14), fill=(255, 120, 36, 135))
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(16)))
    d = ImageDraw.Draw(img)
    d.ellipse((42, 42, s - 42, s - 42), fill=(46, 50, 58, 255), outline=(16, 18, 22, 255), width=5)
    d.ellipse((58, 58, s - 58, s - 58), fill=(232, 86, 24, 255))
    d.ellipse((72, 72, s - 72, s - 72), fill=(255, 202, 72, 255))
    return img


def gen_alpine_pine(snowy: bool, seed: int) -> Image.Image:
    s = 384
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    cx, cy = s // 2, s // 2
    for radius, col, spikes in [
        (146, (24, 50, 38, 255), 16),
        (114, (34, 70, 50, 255), 14),
        (82, (46, 92, 62, 255), 12),
        (48, (64, 114, 78, 255), 10),
    ]:
        pts = []
        for i in range(spikes * 2):
            ang = (math.tau * i) / (spikes * 2) + rng.uniform(-0.08, 0.08)
            r = radius * (1.0 + rng.uniform(-0.14, 0.14)) if i % 2 == 0 else radius * 0.54
            pts.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
        d.polygon(pts, fill=col, outline=(14, 26, 20, 225))
        if snowy and radius <= 114:
            for i in range(0, len(pts), 2):
                px, py = pts[i]
                if py < cy + 45:
                    d.ellipse((px - 14, py - 10, px + 14, py + 10), fill=(228, 240, 252, 190))
    d.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill=(238, 246, 254, 225) if snowy else (94, 146, 102, 255))
    return add_drop_shadow(apply_painterly_grain(img, seed + 55, 0.14), offset=(12, 16), blur=14, alpha=165)


def gen_boulder(seed: int, wide: bool = False) -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    cx, cy = s // 2, s // 2
    rx, ry = (98, 66) if wide else (78, 76)
    pts = []
    for i in range(10):
        ang = math.tau * i / 10
        m = rng.uniform(0.82, 1.12)
        pts.append((cx + math.cos(ang) * rx * m, cy + math.sin(ang) * ry * m))
    d.polygon(pts, fill=(84, 92, 104, 255), outline=(22, 25, 32, 255))
    inner = [(cx + (x - cx) * 0.62 - 8, cy + (y - cy) * 0.62 - 8) for x, y in pts]
    d.polygon(inner, fill=(124, 134, 148, 255))
    snow = [(cx + (x - cx) * 0.42 - 14, cy + (y - cy) * 0.42 - 14) for x, y in pts[:6]]
    d.polygon(snow, fill=(224, 236, 248, 200))
    return add_drop_shadow(apply_painterly_grain(img, seed + 7, 0.18), offset=(8, 10), blur=9, alpha=155)


def gen_alpine_shrub() -> Image.Image:
    s = 192
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(1505)
    for _ in range(18):
        x, y, r = rng.randint(46, s - 46), rng.randint(46, s - 46), rng.randint(16, 30)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(44 + rng.randint(0, 26), 78 + rng.randint(0, 32), 52 + rng.randint(0, 22), 240), outline=(20, 34, 24, 200))
    for _ in range(8):
        x, y = rng.randint(58, s - 58), rng.randint(52, s // 2 + 12)
        d.ellipse((x - 9, y - 7, x + 9, y + 7), fill=(222, 236, 248, 175))
    return add_drop_shadow(img, offset=(4, 6), blur=6, alpha=130)


# ---------------- 20 NEW ULTRA-DETAIL FUNICULAR ASSETS ----------------

def gen_viaduct_arch_deck() -> Image.Image:
    """768x512 — Riveted Steel & Stone Viaduct Bridge Deck Spanning the Alpine Gorge."""
    w, h = 768, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Stone parapet outer curbs
    d.rounded_rectangle((14, 24, w - 14, h - 24), radius=10, fill=(68, 76, 88, 255), outline=(18, 22, 28, 255), width=5)
    # Recessed industrial iron deck grating
    d.rectangle((24, 58, w - 24, h - 58), fill=(42, 48, 58, 245), outline=(20, 24, 30, 255), width=4)
    # Cross-bracing steel girders
    for gx in range(56, w - 32, 96):
        d.rectangle((gx, 58, gx + 20, h - 58), fill=(62, 70, 82, 255), outline=(20, 24, 30, 255), width=2)
        d.line([(gx + 20, 66), (gx + 96, h - 66)], fill=(72, 80, 94, 180), width=5)
        d.line([(gx + 96, 66), (gx + 20, h - 66)], fill=(72, 80, 94, 180), width=5)
    # Stone cornice blocks along north & south bridge edges
    for sx in range(24, w - 40, 64):
        d.rectangle((sx, 26, sx + 60, 56), fill=(98, 106, 120, 255), outline=(24, 28, 36, 255), width=2)
        d.rectangle((sx, h - 56, sx + 60, h - 26), fill=(98, 106, 120, 255), outline=(24, 28, 36, 255), width=2)
        d.line([(sx + 4, 30), (sx + 56, 30)], fill=(188, 202, 220, 170), width=3)  # frost edge
    return add_drop_shadow(apply_painterly_grain(img, 2001, 0.18), offset=(12, 16), blur=16, alpha=185)


def gen_station_roof_west() -> Image.Image:
    """768x640 — Snow-Laden Alpine Timber Gable Roof for West Boarding Station."""
    w, h = 768, 640
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((28, 28, w - 28, h - 28), radius=12, fill=(68, 76, 92, 255), outline=(18, 22, 28, 255), width=5)
    # Layered dark slate roof shingles
    for sy in range(44, h - 44, 32):
        shade = 64 + (14 if sy < h // 2 else -8)
        d.line([(32, sy), (w - 32, sy)], fill=(24, 28, 36, 180), width=2)
        for sx in range(36, w - 44, 48):
            off = 24 if (sy // 32) % 2 else 0
            d.rectangle((sx + off, sy, min(w - 34, sx + off + 44), sy + 28), fill=(shade, shade + 6, shade + 16, 255), outline=(26, 30, 40, 160))
    # Central timber ridge beam & snowdrift cap
    d.rectangle((26, h // 2 - 14, w - 26, h // 2 + 14), fill=(116, 80, 48, 255), outline=(28, 18, 12, 255), width=4)
    d.rounded_rectangle((46, 36, w - 46, 148), radius=24, fill=(228, 238, 250, 175))
    # Brick stove chimney top
    d.rounded_rectangle((120, 120, 198, 198), radius=6, fill=(112, 64, 54, 255), outline=(26, 16, 14, 255), width=4)
    d.rectangle((140, 140, 178, 178), fill=(18, 20, 26, 255))
    return add_drop_shadow(apply_painterly_grain(img, 2002, 0.16), offset=(14, 18), blur=16, alpha=180)


def gen_winding_house_roof_east() -> Image.Image:
    """768x768 — Industrial Corrugated Iron & Skylight Roof for East Winding House."""
    w, h = 768, 768
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((28, 28, w - 28, h - 28), radius=10, fill=(58, 64, 74, 255), outline=(18, 20, 26, 255), width=5)
    for rx in range(44, w - 36, 22):
        d.line([(rx, 32), (rx, h - 32)], fill=(38, 42, 50, 210), width=3)
        d.line([(rx + 4, 32), (rx + 4, h - 32)], fill=(86, 94, 108, 140), width=2)
    # Raised industrial glass monitor skylight
    d.rounded_rectangle((148, 220, 480, 548), radius=8, fill=(44, 50, 60, 255), outline=(20, 24, 30, 255), width=5)
    for gy in range(244, 520, 72):
        for gx in range(170, 456, 76):
            d.rectangle((gx, gy, gx + 62, gy + 56), fill=(214, 178, 104, 190), outline=(30, 34, 42, 255), width=3)
    # Heavy boiler smokestack
    d.ellipse((538, 160, 668, 290), fill=(48, 52, 60, 255), outline=(188, 128, 66, 255), width=8)
    d.ellipse((564, 186, 642, 264), fill=(14, 16, 20, 255))
    return add_drop_shadow(apply_painterly_grain(img, 2003, 0.18), offset=(14, 18), blur=16, alpha=180)


def gen_track_switch_frog() -> Image.Image:
    """512x384 — Abt Pass-Loop Mechanical Track Switch Frog & Lever."""
    w, h = 512, 384
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Heavy bolted steel switch bed plate
    d.polygon([(36, 132), (476, 56), (476, 328), (36, 252)], fill=(54, 60, 70, 235), outline=(18, 22, 28, 255))
    # Converging steel switch rails
    for y_end in (96, 152, 232, 288):
        y_start = 160 if y_end < 192 else 224
        d.line([(32, y_start), (480, y_end)], fill=(120, 132, 148, 255), width=12)
        d.line([(32, y_start), (480, y_end)], fill=(218, 230, 244, 220), width=4)
    # Brass mechanical throw-lever & lantern indicator
    d.rounded_rectangle((176, 26, 256, 86), radius=8, fill=(46, 50, 58, 255), outline=(18, 20, 24, 255), width=3)
    d.ellipse((196, 38, 236, 78), fill=(224, 168, 60, 255), outline=(30, 22, 12, 255), width=3)
    d.line([(216, 58), (216, 168)], fill=(184, 140, 58, 255), width=6)
    return add_drop_shadow(apply_painterly_grain(img, 2004, 0.14))


def gen_semaphore_signal() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((92, 92, 164, 164), fill=(58, 64, 74, 255), outline=(18, 20, 26, 255), width=4)
    # Red/white striped signal blade arm
    d.rounded_rectangle((124, 112, 234, 144), radius=6, fill=(198, 48, 48, 255), outline=(28, 12, 12, 255), width=3)
    d.rectangle((184, 114, 204, 142), fill=(238, 240, 244, 255))
    # Dual green/amber signal lamp lenses
    d.ellipse((108, 108, 148, 148), fill=(52, 211, 153, 255), outline=(22, 40, 32, 255), width=4)
    return add_drop_shadow(img)


def gen_stationmaster_desk() -> Image.Image:
    w, h = 256, 192
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((22, 28, w - 22, h - 28), radius=8, fill=(116, 74, 42, 255), outline=(28, 16, 10, 255), width=4)
    # Green leather blotter + parchment railway schedule
    d.rectangle((48, 44, 164, 144), fill=(36, 78, 56, 255), outline=(22, 40, 30, 255), width=2)
    d.rectangle((64, 58, 146, 126), fill=(232, 220, 192, 255), outline=(82, 64, 44, 255), width=2)
    # Brass telegraph key
    d.rounded_rectangle((178, 56, 218, 118), radius=4, fill=(198, 152, 64, 255), outline=(36, 26, 12, 255), width=3)
    d.ellipse((190, 96, 206, 112), fill=(28, 30, 36, 255))
    return add_drop_shadow(apply_painterly_grain(img, 2006, 0.14))


def gen_potbelly_stove() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    halo = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((30, 30, s - 30, s - 30), fill=(255, 118, 36, 95))
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(img)
    # Stone hearth tile base
    d.rounded_rectangle((36, 36, s - 36, s - 36), radius=8, fill=(78, 82, 92, 255), outline=(22, 24, 30, 255), width=4)
    # Cast-iron stove drum + glowing firebox slit
    d.ellipse((64, 64, s - 64, s - 64), fill=(36, 40, 46, 255), outline=(14, 16, 20, 255), width=5)
    d.ellipse((98, 98, s - 98, s - 98), fill=(52, 56, 64, 255), outline=(18, 20, 24, 255), width=3)
    d.arc((74, 74, s - 74, s - 74), start=20, end=70, fill=(255, 148, 42, 255), width=9)
    return add_drop_shadow(img)


def gen_luggage_cart() -> Image.Image:
    w, h = 256, 192
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((28, 38, w - 36, h - 38), radius=8, fill=(138, 92, 52, 255), outline=(32, 20, 12, 255), width=4)
    # Brass push rail
    d.rounded_rectangle((w - 44, 46, w - 16, h - 46), radius=6, outline=(222, 174, 74, 255), width=5)
    # Stacked suitcases
    d.rounded_rectangle((46, 52, 134, 138), radius=5, fill=(124, 48, 42, 255), outline=(30, 14, 12, 255), width=3)
    d.rounded_rectangle((112, 68, 196, 128), radius=5, fill=(64, 88, 114, 255), outline=(20, 28, 38, 255), width=3)
    return add_drop_shadow(apply_painterly_grain(img, 2008, 0.14))


def gen_workbench() -> Image.Image:
    w, h = 384, 192
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((20, 28, w - 20, h - 28), radius=8, fill=(116, 80, 48, 255), outline=(28, 18, 12, 255), width=5)
    # Blueprint sheet
    d.rectangle((48, 48, 178, 140), fill=(38, 86, 148, 255), outline=(22, 44, 78, 255), width=2)
    d.line([(62, 72), (164, 72)], fill=(198, 228, 255, 200), width=2)
    d.ellipse((92, 82, 136, 126), outline=(198, 228, 255, 200), width=2)
    # Iron vise & brass wrenches
    d.rounded_rectangle((288, 32, 344, 76), radius=4, fill=(68, 76, 88, 255), outline=(18, 20, 26, 255), width=3)
    d.line([(204, 74), (264, 128)], fill=(176, 186, 200, 255), width=8)
    d.ellipse((200, 118, 232, 150), fill=(196, 148, 62, 255), outline=(32, 22, 12, 255), width=3)
    return add_drop_shadow(apply_painterly_grain(img, 2009, 0.16))


def gen_dynamite_crate() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((36, 36, s - 36, s - 36), radius=6, fill=(148, 108, 64, 255), outline=(32, 20, 12, 255), width=5)
    d.rectangle((56, 56, s - 56, s - 56), fill=(112, 78, 44, 255), outline=(32, 20, 12, 255), width=3)
    # Red blasting sticks bundled inside
    for bx in range(74, s - 74, 24):
        d.rounded_rectangle((bx, 72, bx + 18, s - 72), radius=4, fill=(208, 44, 44, 255), outline=(42, 12, 12, 255), width=2)
    d.rectangle((66, 116, s - 66, 140), fill=(232, 198, 72, 255), outline=(32, 24, 12, 255), width=2)
    return add_drop_shadow(apply_painterly_grain(img, 2010, 0.14))


def gen_oil_barrels() -> Image.Image:
    w, h = 256, 192
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((18, 26, w - 18, h - 26), radius=6, fill=(92, 64, 38, 255), outline=(26, 16, 10, 255), width=4)
    for cx in (78, 178):
        d.ellipse((cx - 44, 52, cx + 44, 140), fill=(52, 58, 68, 255), outline=(16, 18, 24, 255), width=4)
        d.ellipse((cx - 32, 64, cx + 32, 128), fill=(68, 76, 88, 255), outline=(204, 152, 54, 255), width=3)
        d.ellipse((cx + 8, 76, cx + 22, 90), fill=(204, 56, 48, 255))
    return add_drop_shadow(apply_painterly_grain(img, 2011, 0.14))


def gen_cargo_pallet() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for py in range(28, s - 28, 36):
        d.rectangle((24, py, s - 24, py + 24), fill=(122, 86, 52, 255), outline=(28, 18, 12, 255), width=2)
    d.rounded_rectangle((42, 42, 142, 134), radius=10, fill=(176, 162, 128, 255), outline=(44, 36, 24, 255), width=4)
    d.rounded_rectangle((116, 98, 216, 204), radius=10, fill=(158, 144, 112, 255), outline=(44, 36, 24, 255), width=4)
    d.line([(48, 52), (208, 198)], fill=(196, 154, 82, 230), width=5)
    d.line([(208, 52), (48, 198)], fill=(196, 154, 82, 230), width=5)
    return add_drop_shadow(apply_painterly_grain(img, 2012, 0.16))


def gen_snow_drift() -> Image.Image:
    w, h = 384, 256
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((32, 44, w - 32, h - 44), fill=(214, 228, 244, 185))
    d.ellipse((68, 66, w - 58, h - 66), fill=(238, 246, 254, 220))
    return img.filter(ImageFilter.GaussianBlur(8))


def gen_ice_crystal() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for pts, col in [
        ([(128, 26), (176, 96), (144, 178), (82, 136)], (86, 168, 228, 230)),
        ([(146, 62), (220, 124), (168, 212), (108, 164)], (126, 206, 248, 235)),
        ([(64, 92), (138, 116), (118, 214), (48, 168)], (178, 232, 255, 225)),
    ]:
        d.polygon(pts, fill=col, outline=(228, 246, 255, 255))
    return add_drop_shadow(img, offset=(6, 10), blur=10, alpha=145)


def gen_cracked_ice_bridge() -> Image.Image:
    w, h = 512, 256
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = [(24, 96), (168, 42), (356, 56), (488, 102), (474, 188), (324, 218), (134, 202), (20, 162)]
    d.polygon(pts, fill=(138, 192, 232, 235), outline=(218, 242, 255, 255))
    # Deep glacial cracks
    d.line([(120, 72), (186, 132), (242, 112), (310, 176)], fill=(38, 86, 134, 225), width=4)
    d.line([(290, 68), (344, 128), (412, 148)], fill=(38, 86, 134, 210), width=3)
    return add_drop_shadow(apply_painterly_grain(img, 2015, 0.14), offset=(8, 12), blur=12, alpha=160)


def gen_stream_cascade() -> Image.Image:
    w, h = 512, 256
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(12, 86), (340, 74), (478, 104), (478, 164), (340, 184), (12, 164)], fill=(62, 136, 196, 210))
    for fy in range(96, 168, 16):
        d.line([(24, fy), (446, fy + 6)], fill=(196, 234, 255, 165), width=4)
    # Frothy waterfall mist crest on cliff drop-off edge
    for mx in range(410, 492, 22):
        for my in range(88, 176, 22):
            d.ellipse((mx - 22, my - 22, mx + 22, my + 22), fill=(228, 244, 255, 165))
    return img.filter(ImageFilter.GaussianBlur(2))


def gen_sentry_watchbox() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((36, 36, s - 36, s - 36), radius=8, fill=(116, 78, 46, 255), outline=(28, 18, 12, 255), width=5)
    d.rectangle((56, 56, s - 56, s - 56), fill=(84, 58, 36, 255), outline=(36, 24, 14, 255), width=3)
    # Guard stool + rifle rack + glowing wall lantern
    d.ellipse((104, 104, 152, 152), fill=(144, 102, 62, 255), outline=(32, 20, 12, 255), width=3)
    d.ellipse((172, 68, 196, 92), fill=(255, 214, 96, 255), outline=(112, 72, 20, 255), width=3)
    return add_drop_shadow(apply_painterly_grain(img, 2017, 0.14))


def gen_lantern_garland() -> Image.Image:
    w, h = 384, 128
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.line([(16, 64), (w - 16, 64)], fill=(48, 54, 64, 255), width=4)
    for lx in (64, 144, 240, 320):
        halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(halo).ellipse((lx - 28, 36, lx + 28, 92), fill=(255, 206, 96, 120))
        img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(8)))
        d = ImageDraw.Draw(img)
        d.ellipse((lx - 10, 54, lx + 10, 74), fill=(255, 232, 138, 255), outline=(112, 78, 24, 255), width=3)
    return img


def gen_fallen_pine_log() -> Image.Image:
    w, h = 384, 160
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((28, 52, w - 28, 108), radius=24, fill=(96, 66, 42, 255), outline=(28, 18, 12, 255), width=4)
    for ly in (64, 78, 92):
        d.line([(44, ly), (w - 44, ly)], fill=(66, 44, 26, 185), width=2)
    # Snow strip resting along top side of trunk
    d.rounded_rectangle((46, 54, w - 58, 74), radius=10, fill=(228, 240, 252, 195))
    return add_drop_shadow(apply_painterly_grain(img, 2019, 0.18))


def gen_campfire_pit() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    halo = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((18, 18, s - 18, s - 18), fill=(255, 118, 32, 135))
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(img)
    cx, cy = s // 2, s // 2
    for a in range(0, 360, 36):
        rx, ry = cx + math.cos(math.radians(a)) * 68, cy + math.sin(math.radians(a)) * 68
        d.ellipse((rx - 18, ry - 16, rx + 18, ry + 16), fill=(98, 104, 116, 255), outline=(24, 26, 32, 255), width=3)
    d.ellipse((cx - 48, cy - 48, cx + 48, cy + 48), fill=(36, 24, 18, 255))
    d.ellipse((cx - 34, cy - 34, cx + 34, cy + 34), fill=(238, 92, 24, 255))
    d.ellipse((cx - 18, cy - 18, cx + 18, cy + 18), fill=(255, 212, 76, 255))
    return img


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    generate_app_icon()

    specs = [
        # Terrains (7)
        ("terrain/alpine_slate_rock.png", "Alpine Slate Rock", "terrain", ["alpine", "rock", "mountain", "slate", "funicular"], "normal", False, gen_alpine_slate()),
        ("terrain/granite_cobblestone.png", "Station Granite Cobble", "terrain", ["station", "cobblestone", "stone", "floor"], "normal", False, gen_granite_cobble()),
        ("terrain/alpine_snow_crag.png", "Alpine Snow & Crag", "terrain", ["snow", "alpine", "winter", "mountain"], "normal", False, gen_alpine_snow()),
        ("terrain/timber_platform_deck.png", "Timber Boarding Deck", "terrain", ["wood", "timber", "platform", "station", "funicular"], "normal", False, gen_timber_deck()),
        ("terrain/mountain_pine_moss.png", "Pine Needles & Moss", "terrain", ["moss", "forest", "alpine", "ground"], "normal", False, gen_pine_moss()),
        ("terrain/riveted_iron_plate.png", "Riveted Iron Grating", "terrain", ["iron", "industrial", "machinery", "winding_house"], "normal", False, gen_iron_plate()),
        ("terrain/chasm_abyss_mist.png", "Misty Gorge Abyss", "terrain", ["chasm", "abyss", "gorge", "alpine", "water"], "normal", False, gen_chasm_abyss()),
        # Walls (4)
        ("walls/alpine_stone_wall.png", "Alpine Stone Wall", "wall", ["wall", "stone", "station", "alpine"], "normal", True, gen_wall_strip("stone")),
        ("walls/timber_station_wall.png", "Timber & Iron Wall", "wall", ["wall", "wood", "timber", "station"], "normal", True, gen_wall_strip("timber")),
        ("walls/iron_safety_railing.png", "Iron Safety Railing", "wall", ["railing", "iron", "balcony", "platform", "funicular"], "normal", False, gen_wall_strip("railing")),
        ("walls/retaining_cliff_wall.png", "Retaining Cliff Wall", "wall", ["wall", "cliff", "stone", "snow"], "normal", True, gen_wall_strip("retaining")),
        # Spline Paths (5)
        ("paths/funicular_rail_track.png", "Dual Funicular Rail Track", "path", ["funicular", "rail", "track", "iron", "path"], "normal", False, gen_funicular_track_path()),
        ("paths/steel_haul_cable.png", "Steel Haulage Cable", "path", ["funicular", "cable", "steel", "path"], "normal", False, gen_haul_cable_path()),
        ("paths/cliff_ledge_dropoff.png", "Alpine Cliff Drop-off", "path", ["cliff", "ledge", "alpine", "gorge", "path"], "normal", False, gen_cliff_ledge_path()),
        ("paths/stone_retaining_stairs.png", "Granite Mountain Stairs", "path", ["stairs", "stone", "station", "path"], "normal", False, gen_stone_stairs_path()),
        ("paths/maintenance_catwalk.png", "Cliffside Catwalk", "path", ["catwalk", "bridge", "wood", "funicular", "path"], "normal", False, gen_catwalk_path()),
        # Portals (4)
        ("portals/station_oak_door.png", "Station Oak Door", "portal", ["door", "wood", "station", "portal"], "normal", False, gen_portal("door")),
        ("portals/funicular_iron_gate.png", "Funicular Boarding Gate", "portal", ["gate", "iron", "funicular", "portal"], "normal", False, gen_portal("gate")),
        ("portals/station_mullion_window.png", "Station Mullion Window", "portal", ["window", "glass", "station", "portal"], "normal", False, gen_portal("window")),
        ("portals/machine_steel_hatch.png", "Winding Room Steel Hatch", "portal", ["door", "iron", "machinery", "portal"], "normal", False, gen_portal("hatch")),
        # Core + New Funicular, Viaduct, Station & Alpine Objects (40 objects -> 60 total!)
        ("objects/funicular_car_interior.png", "Funicular Carriage (Interior)", "object", ["funicular", "carriage", "vehicle", "rail", "hero"], "rgb_channels", True, gen_funicular_car_interior()),
        ("objects/funicular_car_roof.png", "Funicular Carriage (Roof)", "object", ["funicular", "roof", "carriage", "hero"], "rgb_channels", True, gen_funicular_car_roof()),
        ("objects/viaduct_arch_deck.png", "Steel & Stone Viaduct Span", "object", ["funicular", "bridge", "viaduct", "iron", "gorge", "hero"], "normal", True, gen_viaduct_arch_deck()),
        ("objects/funicular_station_roof_west.png", "Alpine Station Roof (Snow)", "object", ["roof", "station", "snow", "alpine"], "normal", True, gen_station_roof_west()),
        ("objects/winding_house_roof_east.png", "Winding House Roof (Skylight)", "object", ["roof", "winding_house", "iron", "industrial"], "normal", True, gen_winding_house_roof_east()),
        ("objects/track_switch_frog.png", "Abt Track Switch Frog & Lever", "object", ["funicular", "rail", "switch", "iron", "machinery"], "normal", False, gen_track_switch_frog()),
        ("objects/semaphore_signal_post.png", "Railway Semaphore Signal", "object", ["funicular", "rail", "signal", "station"], "normal", True, gen_semaphore_signal()),
        ("objects/cable_bullwheel.png", "Cable Drive Bullwheel", "object", ["funicular", "machinery", "winding_house", "iron", "hero"], "normal", True, gen_cable_bullwheel()),
        ("objects/steam_boiler_furnace.png", "Steam Boiler Furnace", "object", ["boiler", "furnace", "machinery", "winding_house", "fire"], "normal", True, gen_steam_boiler()),
        ("objects/brake_lever_console.png", "Brake & Switch Console", "object", ["funicular", "lever", "brass", "machinery", "winding_house"], "normal", True, gen_brake_console()),
        ("objects/gear_winch_assembly.png", "Brass Gear Winch Train", "object", ["gears", "winch", "machinery", "winding_house"], "normal", True, gen_gear_winch()),
        ("objects/coal_hopper_bin.png", "Coal Bunker & Shovel", "object", ["coal", "machinery", "winding_house", "wood"], "normal", True, gen_coal_hopper()),
        ("objects/station_ticket_booth.png", "Station Ticket Counter", "object", ["station", "furniture", "wood", "brass"], "rgb_channels", True, gen_ticket_booth()),
        ("objects/ticket_kiosk_interior_desk.png", "Stationmaster Telegraph Desk", "object", ["station", "furniture", "wood", "brass"], "rgb_channels", True, gen_stationmaster_desk()),
        ("objects/potbelly_cast_stove.png", "Potbelly Cast-Iron Stove", "object", ["station", "fire", "iron", "furniture"], "normal", True, gen_potbelly_stove()),
        ("objects/luggage_hand_cart.png", "Porter's Brass Luggage Cart", "object", ["station", "luggage", "brass", "clutter"], "rgb_channels", True, gen_luggage_cart()),
        ("objects/tool_workbench.png", "Mechanic's Blueprint Bench", "object", ["machinery", "winding_house", "wood", "clutter"], "normal", True, gen_workbench()),
        ("objects/dynamite_supply_crate.png", "Blasting Powder & Flares Box", "object", ["hazard", "explosive", "funicular", "clutter"], "normal", True, gen_dynamite_crate()),
        ("objects/oil_barrels_rack.png", "Grease & Oil Drums Rack", "object", ["hazard", "machinery", "winding_house", "iron"], "normal", True, gen_oil_barrels()),
        ("objects/wooden_cargo_pallet.png", "Lashed Cargo Pallet", "object", ["cargo", "station", "wood", "clutter"], "normal", True, gen_cargo_pallet()),
        ("objects/iron_cargo_crane.png", "Iron Cargo Jib Crane", "object", ["crane", "iron", "cargo", "station", "funicular"], "normal", True, gen_iron_crane()),
        ("objects/bridge_stone_pylon.png", "Viaduct Stone Trestle Pier", "object", ["pylon", "bridge", "stone", "funicular", "gorge"], "normal", True, gen_bridge_pylon()),
        ("objects/luggage_crates_cluster.png", "Luggage & Cargo Crates", "object", ["crates", "luggage", "station", "wood", "clutter"], "rgb_channels", True, gen_luggage_crates()),
        ("objects/waiting_bench_wood.png", "Station Waiting Bench", "object", ["bench", "furniture", "wood", "station"], "rgb_channels", True, gen_waiting_bench()),
        ("objects/rope_cable_spool.png", "Spare Steel Cable Spool", "object", ["cable", "spool", "funicular", "clutter"], "normal", True, gen_cable_spool()),
        ("objects/cliff_guard_watchbox.png", "Railway Sentry Watchbox", "object", ["station", "guard", "wood", "alpine"], "normal", True, gen_sentry_watchbox()),
        ("objects/iron_lantern_garland.png", "Hanging Platform Lamp Line", "object", ["light", "lamp", "station", "funicular"], "normal", False, gen_lantern_garland()),
        ("objects/station_lamp_post.png", "Brass Station Lamp Post", "object", ["light", "lamp", "station", "brass"], "normal", False, gen_lamp_post()),
        ("objects/coal_brazier_lit.png", "Platform Warming Brazier", "object", ["light", "fire", "brazier", "station"], "normal", False, gen_coal_brazier()),
        ("objects/alpine_campfire_pit.png", "Watchman's Stone Campfire", "object", ["light", "fire", "alpine", "camp"], "normal", False, gen_campfire_pit()),
        ("objects/alpine_pine_snow.png", "Snow-Dusted Alpine Pine", "object", ["tree", "pine", "alpine", "snow", "foliage"], "normal", True, gen_alpine_pine(True, 1601)),
        ("objects/alpine_pine_deep.png", "Deep Mountain Fir", "object", ["tree", "pine", "alpine", "foliage"], "normal", True, gen_alpine_pine(False, 1602)),
        ("objects/mountain_boulder_a.png", "Snowy Granite Boulder", "object", ["rock", "boulder", "alpine", "snow", "clutter"], "normal", True, gen_boulder(1701, False)),
        ("objects/mountain_boulder_b.png", "Jagged Slate Outcrop", "object", ["rock", "boulder", "alpine", "clutter"], "normal", True, gen_boulder(1702, True)),
        ("objects/alpine_shrub_frost.png", "Frosted Mountain Juniper", "object", ["shrub", "foliage", "alpine", "snow", "clutter"], "normal", False, gen_alpine_shrub()),
        ("objects/snow_drift_bank.png", "Windblown Alpine Snowdrift", "object", ["snow", "alpine", "winter", "clutter"], "normal", False, gen_snow_drift()),
        ("objects/ice_crystal_spire.png", "Glacial Ice Crystal Spire", "object", ["ice", "alpine", "snow", "gorge", "clutter"], "normal", True, gen_ice_crystal()),
        ("objects/cracked_ice_bridge.png", "Treacherous Ice Ledge Spur", "object", ["ice", "bridge", "gorge", "alpine", "hazard"], "normal", False, gen_cracked_ice_bridge()),
        ("objects/mountain_stream_cascade.png", "Alpine Meltwater Cascade", "object", ["water", "waterfall", "alpine", "gorge"], "normal", False, gen_stream_cascade()),
        ("objects/fallen_pine_log.png", "Snowy Fallen Pine Trunk", "object", ["log", "cover", "alpine", "wood", "clutter"], "normal", True, gen_fallen_pine_log()),
    ]

    manifest_assets = []
    for rel, name, cat, tags, draw_mode, shadow, image in specs:
        out_path = OUT_DIR / rel
        out_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(out_path, format="PNG", optimize=True)
        w, h = image.size
        manifest_assets.append({
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

    manifest = {
        "specVersion": "1.0",
        "id": "com.dicechaos.starter-funicular-cc0",
        "name": "Dice Chaos Alpine Funicular Starter (CC0)",
        "author": "Dice Chaos Community",
        "license": "CC0-1.0",
        "defaultPpi": 256,
        "assets": manifest_assets,
    }
    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    with zipfile.ZipFile(DCPACK_OUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(manifest_path, "manifest.json")
        for item in manifest_assets:
            zf.write(OUT_DIR / item["path"], item["path"])

    print(f"Generated {len(manifest_assets)} CC0 Funicular assets -> {OUT_DIR}")
    print(f"Packaged open .dcpack -> {DCPACK_OUT}")


if __name__ == "__main__":
    main()
